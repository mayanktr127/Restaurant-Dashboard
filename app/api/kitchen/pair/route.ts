import { NextResponse, type NextRequest } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"
import { logActivity } from "@/lib/auth"

// In-memory rate limiter: IP -> timestamps array (max 5 per minute)
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxAttempts = 5

  const timestamps = (rateLimitMap.get(ip) || []).filter((t) => now - t < windowMs)
  if (timestamps.length >= maxAttempts) {
    rateLimitMap.set(ip, timestamps)
    return false // Rate limit exceeded
  }

  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

export async function POST(request: NextRequest) {
  // 1. Rate Limiting Check (5 attempts per minute per IP)
  const forwarded = request.headers.get("x-forwarded-for")
  const ip =
    (forwarded ? forwarded.split(",")[0].trim() : null) ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many pairing attempts. Please wait 1 minute before trying again." },
      { status: 429 }
    )
  }

  try {
    // 2. Parse request body
    let code = ""
    let deviceName = "Kitchen Display Tablet"

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await request.json()
      code = body.code || ""
      if (body.deviceName) deviceName = body.deviceName
    } else {
      const formData = await request.formData()
      code = (formData.get("code") as string) || ""
      const name = formData.get("deviceName") as string
      if (name) deviceName = name
    }

    const cleanCode = code.replace(/\D/g, "").trim()
    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit pairing code." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const codeHash = crypto.createHash("sha256").update(cleanCode).digest("hex")

    // 3. Validate pairing code (must exist, not used, not expired)
    const { data: pairingRecord, error: codeErr } = await admin
      .from("pairing_codes")
      .select("id, restaurant_id, expires_at, used_at")
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (codeErr || !pairingRecord) {
      return NextResponse.json(
        { error: "Invalid, expired, or previously used pairing code." },
        { status: 400 }
      )
    }

    const restaurantId = pairingRecord.restaurant_id

    // 4. Create dedicated device user with Supabase service role
    const deviceUuid = crypto.randomUUID()
    const deviceEmail = `device-${deviceUuid}@devices.invalid`
    const devicePassword = crypto.randomBytes(32).toString("hex")

    const { data: authData, error: createAuthErr } = await admin.auth.admin.createUser({
      email: deviceEmail,
      password: devicePassword,
      email_confirm: true,
      user_metadata: {
        role: "kitchen",
        is_kitchen_device: true,
        device_name: deviceName,
      },
    })

    if (createAuthErr || !authData.user) {
      console.error("Failed to create device user in auth:", createAuthErr)
      return NextResponse.json(
        { error: "Failed to create device credentials. Please try again." },
        { status: 500 }
      )
    }

    const deviceUserId = authData.user.id

    // 5. Create membership row (role: kitchen)
    const { error: memberErr } = await admin.from("memberships").insert({
      user_id: deviceUserId,
      restaurant_id: restaurantId,
      role: "kitchen",
      display_name: deviceName,
      email: deviceEmail,
      active: true,
    })

    if (memberErr) {
      console.error("Failed to insert kitchen membership:", memberErr)
      await admin.auth.admin.deleteUser(deviceUserId)
      return NextResponse.json(
        { error: "Failed to establish device membership." },
        { status: 500 }
      )
    }

    // 6. Create kitchen_devices row
    const { error: deviceErr } = await admin.from("kitchen_devices").insert({
      restaurant_id: restaurantId,
      user_id: deviceUserId,
      name: deviceName,
      last_seen_at: new Date().toISOString(),
    })

    if (deviceErr) {
      console.error("Failed to record kitchen device:", deviceErr)
    }

    // 7. Mark pairing code used
    await admin
      .from("pairing_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", pairingRecord.id)

    // 8. Log activity
    await logActivity(
      restaurantId,
      "kitchen",
      deviceName,
      "device_paired",
      { device_id: deviceUserId, device_name: deviceName }
    )

    // 9. Sign the browser in via @supabase/ssr session cookies
    const response = NextResponse.json({
      success: true,
      redirectUrl: "/kitchen",
      message: "Device successfully paired! Redirecting to kitchen screen...",
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: deviceEmail,
      password: devicePassword,
    })

    if (signInErr) {
      console.error("Failed to sign in newly paired device:", signInErr)
      return NextResponse.json(
        { error: "Device paired but session creation failed. Please try again." },
        { status: 500 }
      )
    }

    // Store restaurant id in cookie for fast tenant resolution
    response.cookies.set("selected_restaurant_id", restaurantId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return response
  } catch (err: unknown) {
    console.error("Pairing endpoint exception:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal pairing error" },
      { status: 500 }
    )
  }
}
