import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserContext } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    // Role-based destination check
    const context = await getUserContext()
    if (!context) {
      return NextResponse.redirect(`${origin}/login?error=user_not_found`)
    }

    // Platform Admin -> /admin
    if (context.isAdmin) {
      return NextResponse.redirect(`${origin}/admin`)
    }

    // Kitchen Device -> /kitchen
    const isKitchen = context.memberships.some((m) => m.role === "kitchen")
    if (isKitchen) {
      return NextResponse.redirect(`${origin}/kitchen`)
    }

    // Owner or Manager -> /app
    const isOwnerOrManager = context.memberships.some(
      (m) => m.role === "owner" || m.role === "manager"
    )
    if (isOwnerOrManager) {
      // Store first restaurant ID in cookie if not set
      const response = NextResponse.redirect(`${origin}/app`)
      if (context.memberships[0]?.restaurant_id) {
        response.cookies.set("selected_restaurant_id", context.memberships[0].restaurant_id, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      }
      return response
    }

    // No active memberships
    return NextResponse.redirect(`${origin}/login?error=no_membership`)
  }

  return NextResponse.redirect(`${origin}/login`)
}
