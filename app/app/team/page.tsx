import React from "react"
import { requireOwnerPage, getActiveRestaurantId } from "@/lib/auth"
import { getTeamData } from "@/app/actions/team"
import { getRestaurantSettings } from "@/app/actions/settings"
import { TeamManager } from "@/components/team/TeamManager"

export default async function TeamPage() {
  await requireOwnerPage()

  const restaurantId = (await getActiveRestaurantId()) || "00000000-0000-0000-0000-000000000010"

  const [teamData, settings] = await Promise.all([
    getTeamData(restaurantId),
    getRestaurantSettings(restaurantId),
  ])

  return (
    <TeamManager
      restaurantId={restaurantId}
      restaurantName={settings.name || "Lone Star Tacos"}
      initialData={teamData}
    />
  )
}
