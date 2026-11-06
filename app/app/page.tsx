import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getLiveOrders } from "@/app/actions/orders"
import { getMenuData } from "@/app/actions/menu"
import { getRestaurantSettings } from "@/app/actions/settings"
import { getTeamData } from "@/app/actions/team"
import { HomeDashboard } from "@/components/dashboard/HomeDashboard"

export default async function AppHomePage() {
  const context = await getUserContext()
  if (!context) redirect("/login")

  const restaurantId = (await getActiveRestaurantId()) || "00000000-0000-0000-0000-000000000010"

  const [ordersData, menuData, settingsData, teamData] = await Promise.all([
    getLiveOrders(restaurantId),
    getMenuData(restaurantId),
    getRestaurantSettings(restaurantId),
    getTeamData(restaurantId),
  ])

  // Flatten all today's orders
  const allOrders = [
    ...ordersData.new,
    ...ordersData.cooking,
    ...ordersData.ready,
    ...ordersData.collected,
  ]

  const soldOutCount = menuData.items.filter((i) => !i.available).length
  const offlineDevicesCount = teamData.devices.filter((d) => d.status === "offline").length

  const userName =
    context.user.user_metadata?.full_name ||
    context.user.email?.split("@")[0] ||
    "Owner"

  return (
    <HomeDashboard
      restaurantId={restaurantId}
      restaurantName={settingsData.name || "Lone Star Tacos"}
      initialIsOpen={settingsData.is_open}
      orders={allOrders}
      soldOutCount={soldOutCount}
      offlineDevicesCount={offlineDevicesCount}
      userName={userName}
    />
  )
}
