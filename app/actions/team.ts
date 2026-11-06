"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string
  role: "owner" | "manager" | "kitchen"
  joinedAt: string
}

export interface KitchenDeviceItem {
  id: string
  name: string
  lastSeenAt: string | null
  revokedAt: string | null
  status: "online" | "idle" | "offline"
}

export interface TeamData {
  members: TeamMember[]
  devices: KitchenDeviceItem[]
  permissions: {
    kitchenCanSoldout: boolean
    managerCanEditMenu: boolean
  }
}

let devMembersStore: TeamMember[] = []
let devDevicesStore: KitchenDeviceItem[] = []
let devPermissionsStore = { kitchenCanSoldout: true, managerCanEditMenu: true }

export async function getTeamData(restaurantId: string): Promise<TeamData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  if (!supabaseUrl.includes("placeholder")) {
    try {
      const admin = createAdminClient()
      const [membersRes, devicesRes, restRes] = await Promise.all([
        admin.from("memberships").select("*").eq("restaurant_id", restaurantId).eq("active", true),
        admin.from("kitchen_devices").select("*").eq("restaurant_id", restaurantId).is("revoked_at", null),
        admin.from("restaurants").select("kitchen_can_soldout, manager_can_edit_menu").eq("id", restaurantId).maybeSingle(),
      ])

      if (!membersRes.error && membersRes.data) {
        const members: TeamMember[] = membersRes.data
          .filter((m) => m.role !== "kitchen")
          .map((m) => ({
            id: m.id,
            userId: m.user_id,
            name: m.display_name || m.email?.split("@")[0] || "Member",
            email: m.email || "",
            role: m.role as "owner" | "manager",
            joinedAt: m.created_at,
          }))

        const devices: KitchenDeviceItem[] = (devicesRes.data || []).map((d) => {
          const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0
          const diffMinutes = (Date.now() - lastSeen) / (1000 * 60)
          let status: "online" | "idle" | "offline" = "offline"
          if (diffMinutes <= 3) status = "online"
          else if (diffMinutes <= 15) status = "idle"

          return {
            id: d.id,
            name: d.name,
            lastSeenAt: d.last_seen_at,
            revokedAt: d.revoked_at,
            status,
          }
        })

        return {
          members,
          devices,
          permissions: {
            kitchenCanSoldout: restRes.data?.kitchen_can_soldout ?? true,
            managerCanEditMenu: restRes.data?.manager_can_edit_menu ?? true,
          },
        }
      }
    } catch {
      // Fall through to dev fallback
    }
  }

  return {
    members: devMembersStore,
    devices: devDevicesStore,
    permissions: devPermissionsStore,
  }
}

export async function removeMember(restaurantId: string, memberId: string) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("memberships").update({ active: false }).eq("id", memberId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      devMembersStore = devMembersStore.filter((m) => m.id !== memberId)
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Owner", "member_removed", { memberId })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove member" }
  }
}

export async function updateRestaurantPermissions(
  restaurantId: string,
  permissions: {
    kitchenCanSoldout?: boolean
    managerCanEditMenu?: boolean
  }
) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    const payload: Record<string, unknown> = {}
    if (permissions.kitchenCanSoldout !== undefined) payload.kitchen_can_soldout = permissions.kitchenCanSoldout
    if (permissions.managerCanEditMenu !== undefined) payload.manager_can_edit_menu = permissions.managerCanEditMenu

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("restaurants").update(payload).eq("id", restaurantId)
    } else {
      devPermissionsStore = { ...devPermissionsStore, ...permissions }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Owner", "permissions_updated", permissions)

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update permissions" }
  }
}
