"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

const ToggleOpenSchema = z.object({
  restaurantId: z.string().uuid(),
  isOpen: z.boolean(),
})

export async function toggleStoreOpen(restaurantId: string, isOpen: boolean) {
  try {
    const validated = ToggleOpenSchema.parse({ restaurantId, isOpen })
    const { context, currentMembership } = await requireRole(validated.restaurantId, [
      "owner",
      "manager",
    ])

    const admin = createAdminClient()
    const { error: updateErr } = await admin
      .from("restaurants")
      .update({ is_open: validated.isOpen })
      .eq("id", validated.restaurantId)

    if (updateErr) {
      throw new Error(`Failed to update store status: ${updateErr.message}`)
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(
      validated.restaurantId,
      actorRole,
      context.user.email || "Staff",
      validated.isOpen ? "store_opened" : "store_closed",
      { is_open: validated.isOpen }
    )

    return { success: true, isOpen: validated.isOpen }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle store status",
    }
  }
}

