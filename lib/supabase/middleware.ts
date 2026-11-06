import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let user: User | null = null

  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("placeholder")) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      })

      const { data } = await supabase.auth.getUser()
      user = data?.user || null
    } catch {
      user = null
    }
  }

  // Development mode: Fall back to dev_user_email cookie for instant local developer testing
  if (!user && process.env.NODE_ENV === "development") {
    const devEmail = request.cookies.get("dev_user_email")?.value
    if (devEmail) {
      user = {
        id: "dev-user-id",
        email: devEmail,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User
    }
  }

  return { supabaseResponse, user }
}
