import React from "react"
import { requireOwnerPage, getActiveRestaurantId } from "@/lib/auth"
import { getTeamData } from "@/app/actions/team"
import { getRestaurantSettings } from "@/app/actions/settings"
import { TeamManager } from "@/components/team/TeamManager"

export default async function TeamPage() {
  await requireOwnerPage()

  const restaurantId = await getActiveRestaurantId()
  if (!restaurantId) {
    return null
  }

  const [teamData, settings] = await Promise.all([
    getTeamData(restaurantId),
    getRestaurantSettings(restaurantId),
  ])

  return (
    <TeamManager
      restaurantId={restaurantId}
      restaurantName={settings.name || "Restaurant"}
      initialData={teamData}
    />
  )
}
