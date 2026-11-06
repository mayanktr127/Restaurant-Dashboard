import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const DEMO_ACCOUNTS: Record<
  string,
  { role: "admin" | "owner" | "manager"; restaurantId: string; name: string }
> = {
  "admin@demo.test": {
    role: "admin",
    restaurantId: "demo-restaurant-a",
    name: "System Admin",
  },
  "owner.a@demo.test": {
    role: "owner",
    restaurantId: "demo-restaurant-a",
    name: "Alice Owner",
  },
  "manager.a@demo.test": {
    role: "manager",
    restaurantId: "demo-restaurant-a",
    name: "Bob Manager",
  },
  "owner.b@demo.test": {
    role: "owner",
    restaurantId: "demo-restaurant-b",
    name: "Charlie Owner",
  },
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Dev login is only available in development mode" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const email = (body.email || "").trim().toLowerCase()
    const password = body.password || ""

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const demoAccount = DEMO_ACCOUNTS[email]
    if (!demoAccount) {
      return NextResponse.json(
        { error: "Unknown seed account. Select one from the dev dropdown." },
        { status: 400 }
      )
    }

    if (password !== "DemoPass123!") {
      return NextResponse.json(
        { error: "Invalid password for seed account. Default is DemoPass123!" },
        { status: 401 }
      )
    }

    const destination = demoAccount.role === "admin" ? "/admin" : "/app"

    const response = NextResponse.json({
      success: true,
      destination,
      user: {
        email,
        role: demoAccount.role,
        name: demoAccount.name,
      },
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    const isPlaceholder =
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseUrl.includes("placeholder") ||
      supabaseAnonKey.includes("placeholder")

    // If real Supabase credentials are configured, authenticate against Supabase Auth
    if (!isPlaceholder) {
      try {
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

        await supabase.auth.signInWithPassword({
          email,
          password,
        })
      } catch (authErr) {
        console.warn("Supabase auth attempted but failed, falling back to dev session:", authErr)
      }
    }

    // Set dev_user_email cookie for instant local developer experience
    response.cookies.set("dev_user_email", email, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    // Set selected_restaurant_id cookie
    response.cookies.set("selected_restaurant_id", demoAccount.restaurantId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dev login failed" },
      { status: 500 }
    )
  }
}

