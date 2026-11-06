"use server"

import bcrypt from "bcryptjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

export interface StaffPinResult {
  success: boolean
  pin?: string
  staffName?: string
  id?: string
  error?: string
}

export interface VerifyPinResult {
  valid: boolean
  staffName?: string
  staffId?: string
  error?: string
}

/**
 * Adds a new staff PIN for a cook/worker.
 * Generates a random 4-digit PIN, saves it bcrypt-hashed, and returns the raw PIN ONCE.
 */
export async function addStaffPin(
  restaurantId: string,
  name: string
): Promise<StaffPinResult> {
  try {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return { success: false, error: "Staff member name is required." }
    }

    const { context, currentMembership } = await requireRole(restaurantId, ["owner", "manager"])
    const admin = createAdminClient()

    // 1. Generate 4-digit numeric PIN (1000 - 9999)
    const rawPin = Math.floor(1000 + Math.random() * 9000).toString()

    // 2. Hash PIN with bcrypt
    const salt = await bcrypt.genSalt(10)
    const pinHash = await bcrypt.hash(rawPin, salt)

    // 3. Store in staff_pins
    const { data: inserted, error: insertErr } = await admin
      .from("staff_pins")
      .insert({
        restaurant_id: restaurantId,
        display_name: trimmedName,
        pin_hash: pinHash,
        active: true,
      })
      .select("id")
      .single()

    if (insertErr || !inserted) {
      throw new Error(`Failed to save staff PIN: ${insertErr?.message || "Unknown error"}`)
    }

    // 4. Security Audit Log
    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(
      restaurantId,
      actorRole,
      context.user.email || "Staff Manager",
      "pin_added",
      { staff_name: trimmedName, staff_id: inserted.id }
    )

    return {
      success: true,
      pin: rawPin,
      staffName: trimmedName,
      id: inserted.id,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add staff PIN",
    }
  }
}

/**
 * Verifies a 4-digit staff PIN against the active PINs for the restaurant.
 * Returns the matching staff name on success.
 */
export async function verifyStaffPin(
  restaurantId: string,
  pin: string
): Promise<VerifyPinResult> {
  try {
    const cleanPin = pin.trim()
    if (cleanPin.length !== 4) {
      return { valid: false, error: "PIN must be 4 digits" }
    }

    const admin = createAdminClient()

    // 1. Fetch active PIN hashes for this restaurant
    const { data: activePins, error: fetchErr } = await admin
      .from("staff_pins")
      .select("id, display_name, pin_hash")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)

    if (fetchErr || !activePins || activePins.length === 0) {
      return { valid: false, error: "No active staff PINs found for this restaurant." }
    }

    // 2. Compare PIN against active hashes using bcrypt
    for (const record of activePins) {
      const isMatch = await bcrypt.compare(cleanPin, record.pin_hash)
      if (isMatch) {
        return {
          valid: true,
          staffName: record.display_name,
          staffId: record.id,
        }
      }
    }

    return { valid: false, error: "Incorrect staff PIN." }
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Verification error",
    }
  }
}

/**
 * Deactivates a staff PIN immediately (Owner or Admin only).
 */
export async function removeStaffPin(
  restaurantId: string,
  pinId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { context } = await requireRole(restaurantId, ["owner"])
    const admin = createAdminClient()

    // 1. Deactivate PIN record
    const { error: updateErr } = await admin
      .from("staff_pins")
      .update({ active: false })
      .eq("id", pinId)
      .eq("restaurant_id", restaurantId)

    if (updateErr) {
      throw new Error(`Failed to deactivate staff PIN: ${updateErr.message}`)
    }

    // 2. Security Audit Log
    await logActivity(
      restaurantId,
      context.isAdmin ? "admin" : "owner",
      context.user.email || "Owner",
      "pin_removed",
      { pin_id: pinId }
    )

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove staff PIN",
    }
  }
}

