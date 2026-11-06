import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { AppLayout } from "@/components/shells/AppLayout"

export const instant = false

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getUserContext()

  if (!context) {
    redirect("/login")
  }

  // Admin users without restaurant memberships belong in /admin
  if (context.isAdmin && context.memberships.length === 0) {
    redirect("/admin")
  }

  // Users without any memberships
  if (context.memberships.length === 0) {
    redirect("/login?error=no_memberships")
  }

  // Kitchen device users are strictly locked to /kitchen
  const isOnlyKitchen =
    !context.isAdmin &&
    context.memberships.length > 0 &&
    context.memberships.every((m) => m.role === "kitchen")

  if (isOnlyKitchen) {
    redirect("/kitchen")
  }

  // Active restaurant resolution
  const activeRestaurantId = await getActiveRestaurantId()
  const currentMembership = context.memberships.find(
    (m) => m.restaurant_id === activeRestaurantId
  )

  const userRole: "admin" | "owner" | "manager" = context.isAdmin
    ? "admin"
    : (currentMembership?.role as "owner" | "manager") || "owner"

  // Build available restaurants list for switcher
  const availableRestaurants = context.memberships.map((m) => ({
    id: m.restaurant_id,
    name: m.restaurant?.name || "Restaurant",
    role: m.role,
  }))

  const activeRestaurant = activeRestaurantId
    ? {
        id: activeRestaurantId,
        name:
          context.memberships.find((m) => m.restaurant_id === activeRestaurantId)?.restaurant
            ?.name ||
          availableRestaurants[0]?.name ||
          "Restaurant",
      }
    : availableRestaurants[0]
    ? { id: availableRestaurants[0].id, name: availableRestaurants[0].name }
    : { id: "", name: "" }

  const userName =
    context.user.user_metadata?.full_name ||
    context.user.email?.split("@")[0] ||
    "User"

  return (
    <AppLayout
      userEmail={context.user.email || ""}
      userName={userName}
      userRole={userRole}
      activeRestaurant={activeRestaurant}
      availableRestaurants={availableRestaurants}
    >
      {children}
    </AppLayout>
  )
}
