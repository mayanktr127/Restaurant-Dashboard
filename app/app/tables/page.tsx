import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getTables } from "@/app/actions/tables"
import { getRestaurantSettings } from "@/app/actions/settings"
import { TablesManager } from "@/components/tables/TablesManager"

export default async function TablesPage() {
  const context = await getUserContext()
  if (!context) redirect("/login")

  const restaurantId = (await getActiveRestaurantId()) || "00000000-0000-0000-0000-000000000010"

  const [tables, settings] = await Promise.all([
    getTables(restaurantId),
    getRestaurantSettings(restaurantId),
  ])

  return (
    <TablesManager
      restaurantId={restaurantId}
      restaurantSlug={settings.slug || "lone-star-tacos"}
      initialTables={tables}
    />
  )
}
