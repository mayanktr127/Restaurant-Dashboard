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

const DEV_USERS: Record<
  string,
  { role: "admin" | "owner" | "manager"; name: string; restaurantId: string }
> = {
  "admin@demo.test": {
    role: "admin",
    name: "System Admin",
    restaurantId: "529510ac-c83f-4be5-875b-5c1b8390fe12",
  },
  "owner.a@demo.test": {
    role: "owner",
    name: "Alice Owner",
    restaurantId: "529510ac-c83f-4be5-875b-5c1b8390fe12",
  },
  "manager.a@demo.test": {
    role: "manager",
    name: "Bob Manager",
    restaurantId: "529510ac-c83f-4be5-875b-5c1b8390fe12",
  },
  "owner.b@demo.test": {
    role: "owner",
    name: "Charlie Owner",
    restaurantId: "9f628688-fbd8-40cf-816f-e1a2627e1c16",
  },
}

/**
 * Returns the currently authenticated user session or null.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const isPlaceholder = supabaseUrl.includes("placeholder")

  if (!isPlaceholder) {
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
      // In development mode, ignore remote fetch errors and fall back to dev session
    }
  }

  // Development mode fallback: Read dev_user_email cookie
  if (process.env.NODE_ENV === "development") {
    try {
      const cookieStore = await cookies()
      const devEmail = cookieStore.get("dev_user_email")?.value
      if (devEmail && DEV_USERS[devEmail]) {
        const info = DEV_USERS[devEmail]
        return {
          id: `dev-user-${devEmail.replace(/[^a-zA-Z0-9]/g, "-")}`,
          email: devEmail,
          app_metadata: {},
          user_metadata: { full_name: info.name },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User
      }
    } catch {
      // Ignore cookie errors
    }
  }

  return null
}

/**
 * Retrieves full user context: User details, platform admin status, and active memberships.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const user = await getSessionUser()
  if (!user) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const isPlaceholder = supabaseUrl.includes("placeholder")

  if (!isPlaceholder) {
    try {
      const supabase = await createClient()

      // 1. Check Platform Admin
      const { data: adminRecord } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()

      const isAdmin = Boolean(adminRecord)

      // 2. Fetch memberships with restaurant info
      let { data: membershipsData } = await supabase
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

      // Fallback: If no memberships found by user_id but user.email is present, look up by email
      if ((!membershipsData || membershipsData.length === 0) && user.email) {
        const { data: byEmailData } = await supabase
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
          .eq("email", user.email)
          .eq("active", true)

        if (byEmailData && byEmailData.length > 0) {
          membershipsData = byEmailData
        }
      }

      if (isAdmin || (membershipsData && membershipsData.length > 0)) {
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
      }
    } catch {
      // In development mode, fall back to seed data if remote database is unreachable
    }
  }

  // Development mode: Return seeded context for the logged-in demo user strictly scoped to their restaurant
  if (process.env.NODE_ENV === "development" && user.email && DEV_USERS[user.email]) {
    const devInfo = DEV_USERS[user.email]
    const isAdmin = devInfo.role === "admin"

    let memberships: UserMembership[] = []
    if (isAdmin) {
      memberships = [] // Admin has platform_admins only (no memberships)
    } else if (user.email === "owner.b@demo.test") {
      memberships = [
        {
          id: "dev-mem-2",
          user_id: user.id,
          restaurant_id: "9f628688-fbd8-40cf-816f-e1a2627e1c16",
          role: "owner",
          display_name: devInfo.name,
          email: user.email,
          active: true,
          restaurant: {
            id: "9f628688-fbd8-40cf-816f-e1a2627e1c16",
            name: "Austin Noodle Bar",
            slug: "austin-noodle-bar",
            logo_url: null,
          },
        },
      ]
    } else {
      memberships = [
        {
          id: "dev-mem-1",
          user_id: user.id,
          restaurant_id: "529510ac-c83f-4be5-875b-5c1b8390fe12",
          role: devInfo.role as "owner" | "manager",
          display_name: devInfo.name,
          email: user.email,
          active: true,
          restaurant: {
            id: "529510ac-c83f-4be5-875b-5c1b8390fe12",
            name: "Lone Star Tacos",
            slug: "lone-star-tacos",
            logo_url: null,
          },
        },
      ]
    }

    return {
      user,
      isAdmin,
      memberships,
    }
  }

  return null
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

  // If user has no membership for that restaurant, ignore it and fall back to their first membership
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
      // In dev mode with placeholder credentials, log locally
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
