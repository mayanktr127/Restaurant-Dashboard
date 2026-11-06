import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { User } from "@supabase/supabase-js"

export interface UserMembership {
  id: string
  user_id: string
  restaurant_id: string
  role: "owner" | "manager" | "kitchen"
  display_name: string | null
  email: string | null
  active: boolean
  restaurant?: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  }
}

export interface UserContext {
  user: User
  isAdmin: boolean
  memberships: UserMembership[]
}

/**
 * Returns the currently authenticated user session or null.
 * Strictly uses real Supabase session cookies (no fake dev sessions).
 */
export async function getSessionUser(): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    return null
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error && user) {
      return user
    }
  } catch {
    return null
  }

  return null
}

/**
 * Retrieves full user context: User details, platform admin status, and active memberships.
 * Memberships come strictly from the Supabase memberships table using the user's real session (RLS applies).
 */
export async function getUserContext(): Promise<UserContext | null> {
  const user = await getSessionUser()
  if (!user) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    return null
  }

  try {
    const supabase = await createClient()

    // 1. Check Platform Admin
    const { data: adminRecord } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    const isAdmin = Boolean(adminRecord)

    // 2. Fetch memberships with restaurant info (RLS applies to authenticated user)
    const { data: membershipsData } = await supabase
      .from("memberships")
      .select(`
        id,
        user_id,
        restaurant_id,
        role,
        display_name,
        email,
        active,
        restaurants (
          id,
          name,
          slug,
          logo_url
        )
      `)
      .eq("user_id", user.id)
      .eq("active", true)

    const memberships: UserMembership[] = (membershipsData || []).map((m: {
      id: string
      user_id: string
      restaurant_id: string
      role: "owner" | "manager" | "kitchen"
      display_name: string | null
      email: string | null
      active: boolean
      restaurants: { id: string; name: string; slug: string; logo_url: string | null } | { id: string; name: string; slug: string; logo_url: string | null }[] | null
    }) => {
      const rest = Array.isArray(m.restaurants) ? m.restaurants[0] : m.restaurants
      return {
        id: m.id,
        user_id: m.user_id,
        restaurant_id: m.restaurant_id,
        role: m.role,
        display_name: m.display_name,
        email: m.email,
        active: m.active,
        restaurant: rest
          ? {
              id: rest.id,
              name: rest.name,
              slug: rest.slug,
              logo_url: rest.logo_url,
            }
          : undefined,
      }
    })

    return {
      user,
      isAdmin,
      memberships,
    }
  } catch (err) {
    console.error("Error retrieving user context:", err)
    return null
  }
}

/**
 * Enforces role requirement for a specific restaurant.
 * Throws or redirects if user is not authorized.
 */
export async function requireRole(
  restaurantId: string,
  allowedRoles: ("owner" | "manager" | "kitchen")[]
): Promise<{ context: UserContext; currentMembership: UserMembership | null }> {
  const context = await getUserContext()

  if (!context) {
    redirect("/login")
  }

  // Platform admin is always authorized across all restaurants
  if (context.isAdmin) {
    const membership = context.memberships.find((m) => m.restaurant_id === restaurantId) || null
    return { context, currentMembership: membership }
  }

  const membership = context.memberships.find(
    (m) => m.restaurant_id === restaurantId && m.active && allowedRoles.includes(m.role)
  )

  if (!membership) {
    throw new Error(
      `Forbidden: You do not have permission for this restaurant. Required roles: ${allowedRoles.join(", ")}`
    )
  }

  return { context, currentMembership: membership }
}

/**
 * Enforces platform admin role.
 */
export async function requireAdmin(): Promise<UserContext> {
  const context = await getUserContext()
  if (!context) {
    redirect("/login")
  }
  if (!context.isAdmin) {
    redirect("/app?error=admin_required")
  }
  return context
}

/**
 * Enforces owner role for owner-only pages (reports, customers, team, billing, activity).
 * Redirects manager or unprivileged members to /app?error=no_access.
 */
export async function requireOwnerPage(): Promise<{
  context: UserContext
  restaurantId: string
}> {
  const context = await getUserContext()
  if (!context) {
    redirect("/login")
  }

  const restaurantId = (await getActiveRestaurantId()) || ""

  // Platform admin has universal access
  if (context.isAdmin) {
    return { context, restaurantId }
  }

  if (!restaurantId) {
    redirect("/login?error=no_membership")
  }

  const membership = context.memberships.find(
    (m) => m.restaurant_id === restaurantId && m.active
  )

  if (!membership || membership.role !== "owner") {
    redirect("/app?error=no_access")
  }

  return { context, restaurantId }
}

/**
 * Returns the currently active restaurant ID for the user from cookies,
 * or defaults to the first restaurant in their memberships.
 * If user has no membership for that restaurant, ignores it and falls back to their first membership.
 */
export async function getActiveRestaurantId(): Promise<string | null> {
  const context = await getUserContext()
  if (!context) return null

  const cookieStore = await cookies()
  const savedRestaurantId = cookieStore.get("selected_restaurant_id")?.value

  if (savedRestaurantId) {
    if (context.isAdmin) return savedRestaurantId
    const hasMembership = context.memberships.some(
      (m) => m.restaurant_id === savedRestaurantId && m.active
    )
    if (hasMembership) return savedRestaurantId
  }

  return context.memberships[0]?.restaurant_id || null
}

/**
 * Security audit logger: Writes actions directly to public.activity_log table.
 */
export async function logActivity(
  restaurantId: string,
  actorType: "admin" | "owner" | "manager" | "kitchen" | "system",
  actorName: string,
  action: string,
  details: Record<string, unknown> = {}
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (supabaseUrl.includes("placeholder")) {
      console.log(`[ACTIVITY LOG] [${actorType}] ${actorName} -> ${action}:`, details)
      return
    }

    const admin = createAdminClient()
    await admin.from("activity_log").insert({
      restaurant_id: restaurantId,
      actor_type: actorType,
      actor_name: actorName,
      action,
      details,
    })
  } catch (err) {
    console.error("Failed to write to activity_log:", err)
  }
}
