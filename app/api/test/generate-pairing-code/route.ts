import { NextResponse } from "next/server"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { logActivity } from "@/lib/auth"

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 })
  }

  try {
    const admin = createAdminClient()

    // 1. Fetch first restaurant (Lone Star Tacos)
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
    }

    // 2. Generate random 6-digit code
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = crypto.createHash("sha256").update(rawCode).digest("hex")
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // 3. Insert into pairing_codes
    await admin.from("pairing_codes").insert({
      restaurant_id: restaurant.id,
      code_hash: codeHash,
      expires_at: expiresAt,
    })

    // 4. Activity log
    await logActivity(
      restaurant.id,
      "system",
      "Dev Pairing Helper",
      "pairing_code_created",
      { expiresAt, restaurantName: restaurant.name }
    )

    return NextResponse.json({
      success: true,
      code: rawCode,
      restaurantName: restaurant.name,
      expiresAt,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate test code" },
      { status: 500 }
    )
  }
}

