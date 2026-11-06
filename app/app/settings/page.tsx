import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getRestaurantSettings } from "@/app/actions/settings"
import { SettingsManager } from "@/components/settings/SettingsManager"

export default async function SettingsPage() {
  const context = await getUserContext()
  if (!context) redirect("/login")

  const restaurantId = (await getActiveRestaurantId()) || "00000000-0000-0000-0000-000000000010"
  const settings = await getRestaurantSettings(restaurantId)

  const userMembership = context.memberships.find((m) => m.restaurant_id === restaurantId)
  const userRole: "admin" | "owner" | "manager" = context.isAdmin
    ? "admin"
    : (userMembership?.role as "owner" | "manager") || "owner"

  return (
    <SettingsManager
      restaurantId={restaurantId}
      settings={settings}
      userRole={userRole}
    />
  )
}
