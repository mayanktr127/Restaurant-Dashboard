import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getMenuData } from "@/app/actions/menu"
import { getRestaurantSettings } from "@/app/actions/settings"
import { MenuManager } from "@/components/menu/MenuManager"

export default async function MenuPage() {
  const context = await getUserContext()
  if (!context) redirect("/login")

  const restaurantId = await getActiveRestaurantId()
  if (!restaurantId) {
    if (context.isAdmin) redirect("/admin")
    redirect("/login")
  }

  const [menuData, settings] = await Promise.all([
    getMenuData(restaurantId),
    getRestaurantSettings(restaurantId),
  ])

  const userMembership = context.memberships.find((m) => m.restaurant_id === restaurantId)
  const userRole: "admin" | "owner" | "manager" = context.isAdmin
    ? "admin"
    : (userMembership?.role as "owner" | "manager") || "owner"

  return (
    <MenuManager
      restaurantId={restaurantId}
      restaurantName={settings.name || "Restaurant"}
      initialCategories={menuData.categories}
      initialItems={menuData.items}
      userRole={userRole}
      managerCanEditMenu={menuData.managerCanEditMenu}
    />
  )
}
