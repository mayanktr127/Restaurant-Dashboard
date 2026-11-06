"use server"

import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

export interface PairingResult {
  success: boolean
  code?: string
  expiresAt?: string
  error?: string
}

/**
 * Generates a 6-digit pairing code valid for 10 minutes (Owner or Admin only).
 * The code is returned once to the caller and stored hashed in pairing_codes.
 */
export async function createPairingCode(restaurantId: string): Promise<PairingResult> {
  try {
    const { context } = await requireRole(restaurantId, ["owner"])
    const admin = createAdminClient()

    // 1. Generate 6-digit random code (100000 - 999999)
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = crypto.createHash("sha256").update(rawCode).digest("hex")
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // 2. Insert into pairing_codes
    const { error: insertErr } = await admin.from("pairing_codes").insert({
      restaurant_id: restaurantId,
      code_hash: codeHash,
      expires_at: expiresAt,
      created_by: context.user.id,
    })

    if (insertErr) {
      throw new Error(`Failed to store pairing code: ${insertErr.message}`)
    }

    // 3. Security Audit Log
    await logActivity(
      restaurantId,
      context.isAdmin ? "admin" : "owner",
      context.user.email || "Owner",
      "pairing_code_created",
      { expiresAt }
    )

    return {
      success: true,
      code: rawCode,
      expiresAt,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create pairing code",
    }
  }
}

/**
 * Revokes a kitchen device, ending its active sessions immediately (Owner or Admin only).
 */
export async function revokeDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()

    // 1. Fetch device record
    const { data: device, error: fetchErr } = await admin
      .from("kitchen_devices")
      .select("id, restaurant_id, user_id, name")
      .eq("id", deviceId)
      .maybeSingle()

    if (fetchErr || !device) {
      return { success: false, error: "Kitchen device not found" }
    }

    // 2. Authorize caller for this restaurant
    const { context } = await requireRole(device.restaurant_id, ["owner"])

    // 3. Mark device revoked
    const revokedAt = new Date().toISOString()
    const { error: updateErr } = await admin
      .from("kitchen_devices")
      .update({ revoked_at: revokedAt })
      .eq("id", device.id)

    if (updateErr) {
      throw new Error(`Failed to revoke device: ${updateErr.message}`)
    }

    // 4. Delete the device user in Supabase Auth (terminates all active sessions)
    const { error: deleteUserErr } = await admin.auth.admin.deleteUser(device.user_id)
    if (deleteUserErr) {
      console.warn("Could not delete device auth user:", deleteUserErr.message)
    }

    // 5. Deactivate or delete device membership
    await admin
      .from("memberships")
      .delete()
      .eq("user_id", device.user_id)
      .eq("restaurant_id", device.restaurant_id)

    // 6. Security Audit Log
    await logActivity(
      device.restaurant_id,
      context.isAdmin ? "admin" : "owner",
      context.user.email || "Owner",
      "device_revoked",
      { device_id: device.id, device_name: device.name }
    )

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to revoke device",
    }
  }
}

