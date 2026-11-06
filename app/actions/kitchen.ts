"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity, getUserContext } from "@/lib/auth"

export interface KitchenTicketItem {
  name: string
  qty: number
  notes?: string
}

export interface KitchenTicket {
  order_id: string
  restaurant_id: string
  order_number: string
  order_type: "table" | "pickup"
  table_label?: string | null
  customer_first_name?: string | null
  notes?: string | null
  items: KitchenTicketItem[]
  status: "new" | "cooking" | "ready" | "problem" | "collected" | "cancelled"
  problem_reason?: string | null
  created_at: string
  started_at?: string | null
  ready_at?: string | null
}

export interface KitchenSoldOutItem {
  id: string
  name: string
  available: boolean
  category_name?: string
}

export interface KitchenInitData {
  restaurantId: string
  restaurantName: string
  kitchenCanSoldout: boolean
  hasActivePins: boolean
  tickets: KitchenTicket[]
  isRevoked: boolean
}

let devTicketsStore: KitchenTicket[] = []

/**
 * 1. Fetch initial kitchen board data (tickets, restaurant configuration, PIN requirement)
 * Prices, totals, emails, and phone numbers are strictly excluded from queries.
 */
export async function getKitchenData(restaurantId: string): Promise<KitchenInitData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const isPlaceholder = supabaseUrl.includes("placeholder")

  if (!isPlaceholder) {
    try {
      const admin = createAdminClient()

      // Fetch restaurant configuration
      const { data: restaurant } = await admin
        .from("restaurants")
        .select("id, name, kitchen_can_soldout")
        .eq("id", restaurantId)
        .single()

      // Check for active staff PINs
      const { data: pins } = await admin
        .from("staff_pins")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("active", true)
        .limit(1)

      const hasActivePins = Boolean(pins && pins.length > 0)

      // Fetch active kitchen tickets: oldest first (created_at ASC)
      // Never fetch prices, totals, emails, or phones
      const { data: tickets, error: ticketErr } = await admin
        .from("kitchen_tickets")
        .select(`
          order_id,
          restaurant_id,
          order_number,
          order_type,
          table_label,
          customer_first_name,
          notes,
          items,
          status,
          problem_reason,
          created_at,
          started_at,
          ready_at
        `)
        .eq("restaurant_id", restaurantId)
        .in("status", ["new", "cooking", "ready", "problem"])
        .order("created_at", { ascending: true })

      if (ticketErr) {
        console.error("Error fetching kitchen_tickets:", ticketErr)
      }

      const formattedTickets: KitchenTicket[] = (tickets || []).map((t) => ({
        order_id: t.order_id,
        restaurant_id: t.restaurant_id,
        order_number: t.order_number,
        order_type: t.order_type as "table" | "pickup",
        table_label: t.table_label,
        customer_first_name: t.customer_first_name,
        notes: t.notes,
        items: Array.isArray(t.items) ? (t.items as unknown as KitchenTicketItem[]) : [],
        status: t.status as "new" | "cooking" | "ready" | "problem",
        problem_reason: t.problem_reason,
        created_at: t.created_at,
        started_at: t.started_at,
        ready_at: t.ready_at,
      }))

      // Check if current user is a revoked kitchen device
      const userContext = await getUserContext()
      let isRevoked = false
      if (userContext?.user) {
        const { data: device } = await admin
          .from("kitchen_devices")
          .select("id, revoked_at")
          .eq("restaurant_id", restaurantId)
          .eq("user_id", userContext.user.id)
          .maybeSingle()

        if (device?.revoked_at) {
          isRevoked = true
        }
      }

      return {
        restaurantId,
        restaurantName: restaurant?.name || "Kitchen Display",
        kitchenCanSoldout: Boolean(restaurant?.kitchen_can_soldout ?? true),
        hasActivePins,
        tickets: formattedTickets,
        isRevoked,
      }
    } catch (err) {
      console.error("Failed to load kitchen data from database, using fallback:", err)
    }
  }

  return {
    restaurantId,
    restaurantName: "Kitchen Display",
    kitchenCanSoldout: true,
    hasActivePins: false,
    tickets: devTicketsStore.filter((t) => t.restaurant_id === restaurantId && t.status !== "collected"),
    isRevoked: false,
  }
}

/**
 * 2. Advance kitchen ticket status (Start Cooking, Ready, Problem, Collected)
 */
const UpdateTicketSchema = z.object({
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid(),
  newStatus: z.enum(["cooking", "ready", "collected", "problem", "new"]),
  reason: z.string().optional(),
  staffName: z.string().optional(),
})

export async function updateTicketStatus(input: z.infer<typeof UpdateTicketSchema>) {
  const validated = UpdateTicketSchema.parse(input)
  const { context, currentMembership } = await requireRole(validated.restaurantId, [
    "kitchen",
    "owner",
    "manager",
  ])

  const staff = validated.staffName || currentMembership?.display_name || "Kitchen Cook"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

  if (!supabaseUrl.includes("placeholder")) {
    const admin = createAdminClient()

    // Call database function set_order_status
    const { error: rpcErr } = await admin.rpc("set_order_status", {
      p_order_id: validated.orderId,
      p_new_status: validated.newStatus,
      p_reason: validated.reason || null,
      p_staff_name: staff,
    })

    if (rpcErr) {
      // Fallback direct update to orders & kitchen_tickets
      const nowIso = new Date().toISOString()
      const updatePayload: Record<string, unknown> = { status: validated.newStatus }
      if (validated.newStatus === "cooking") updatePayload.started_at = nowIso
      if (validated.newStatus === "ready") updatePayload.ready_at = nowIso
      if (validated.newStatus === "collected") updatePayload.collected_at = nowIso
      if (validated.reason) updatePayload.problem_reason = validated.reason

      await admin.from("orders").update(updatePayload).eq("id", validated.orderId)
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "kitchen"
    await logActivity(
      validated.restaurantId,
      actorRole,
      staff,
      "kitchen_status_change",
      { order_id: validated.orderId, new_status: validated.newStatus, reason: validated.reason }
    )

    return { success: true }
  } else {
    // In-memory mutation
    const idx = devTicketsStore.findIndex((t) => t.order_id === validated.orderId)
    if (idx !== -1) {
      if (validated.newStatus === "collected") {
        devTicketsStore = devTicketsStore.filter((t) => t.order_id !== validated.orderId)
      } else {
        const ticket = { ...devTicketsStore[idx] }
        ticket.status = validated.newStatus
        if (validated.newStatus === "cooking") ticket.started_at = new Date().toISOString()
        if (validated.newStatus === "ready") ticket.ready_at = new Date().toISOString()
        if (validated.reason) ticket.problem_reason = validated.reason
        devTicketsStore[idx] = ticket
      }
    }
    return { success: true }
  }
}

/**
 * 3. Undo kitchen status change (within 10 minutes)
 */
const UndoTicketSchema = z.object({
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid(),
  staffName: z.string().optional(),
})

export async function undoKitchenAction(input: z.infer<typeof UndoTicketSchema>) {
  const validated = UndoTicketSchema.parse(input)
  const { currentMembership } = await requireRole(validated.restaurantId, [
    "kitchen",
    "owner",
    "manager",
  ])

  const staff = validated.staffName || currentMembership?.display_name || "Kitchen Cook"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

  if (!supabaseUrl.includes("placeholder")) {
    const admin = createAdminClient()
    const { error: rpcErr } = await admin.rpc("set_order_status", {
      p_order_id: validated.orderId,
      p_new_status: "undo",
      p_reason: "Reverted by kitchen staff",
      p_staff_name: staff,
    })

    if (rpcErr) {
      throw new Error(rpcErr.message)
    }

    return { success: true }
  } else {
    return { success: true }
  }
}

/**
 * 4. Verify Staff PIN (for active kitchen cook sessions)
 */
const VerifyPinSchema = z.object({
  restaurantId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
})

export async function verifyStaffPin(input: z.infer<typeof VerifyPinSchema>): Promise<{
  success: boolean
  staffName?: string
  error?: string
}> {
  try {
    const validated = VerifyPinSchema.parse(input)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { data: pins, error } = await admin
        .from("staff_pins")
        .select("id, display_name, pin_hash")
        .eq("restaurant_id", validated.restaurantId)
        .eq("active", true)

      if (error || !pins || pins.length === 0) {
        return { success: false, error: "No active PINs configured for this restaurant." }
      }

      // Check PIN match with bcrypt
      for (const p of pins) {
        if (bcrypt.compareSync(validated.pin, p.pin_hash)) {
          return { success: true, staffName: p.display_name }
        }
      }

      return { success: false, error: "Incorrect 4-digit PIN." }
    } else {
      // In dev fallback, PIN "1234" matches "Chef Marco"
      if (validated.pin === "1234") {
        return { success: true, staffName: "Chef Marco" }
      }
      return { success: false, error: "Incorrect 4-digit PIN (try 1234 in dev mode)." }
    }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Validation failed" }
  }
}

/**
 * 5. Get Sold-Out Panel dishes (only if kitchen_can_soldout is true)
 * Strictly excludes prices and financial totals.
 */
export async function getKitchenSoldOutList(restaurantId: string): Promise<KitchenSoldOutItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

  if (!supabaseUrl.includes("placeholder")) {
    const admin = createAdminClient()

    // Check permission
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("kitchen_can_soldout")
      .eq("id", restaurantId)
      .single()

    if (!restaurant?.kitchen_can_soldout) {
      throw new Error("Kitchen is not authorized to modify sold-out status.")
    }

    const { data: items } = await admin
      .from("menu_items")
      .select(`
        id,
        name,
        available,
        categories (
          name
        )
      `)
      .eq("restaurant_id", restaurantId)
      .order("name", { ascending: true })

    return (items || []).map((i) => {
      const cat = i.categories as unknown as { name: string } | null
      return {
        id: i.id,
        name: i.name,
        available: Boolean(i.available),
        category_name: cat?.name,
      }
    })
  }

  return [
    { id: "dev-item-1", name: "Smoked Brisket Taco", available: true, category_name: "Tacos" },
    { id: "dev-item-2", name: "Baja Fish Taco", available: true, category_name: "Tacos" },
    { id: "dev-item-3", name: "Chips & Fresh Guac", available: false, category_name: "Sides" },
    { id: "dev-item-4", name: "Warm Queso Dip", available: true, category_name: "Sides" },
  ]
}

/**
 * 6. Toggle Sold-Out Status from Kitchen Screen
 */
const ToggleSoldOutSchema = z.object({
  restaurantId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  available: z.boolean(),
  staffName: z.string().optional(),
})

export async function toggleKitchenSoldOut(input: z.infer<typeof ToggleSoldOutSchema>) {
  const validated = ToggleSoldOutSchema.parse(input)
  const { currentMembership } = await requireRole(validated.restaurantId, [
    "kitchen",
    "owner",
    "manager",
  ])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

  if (!supabaseUrl.includes("placeholder")) {
    const admin = createAdminClient()

    // Check permission
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("kitchen_can_soldout")
      .eq("id", validated.restaurantId)
      .single()

    if (!restaurant?.kitchen_can_soldout) {
      throw new Error("Kitchen is not permitted to toggle sold-out status.")
    }

    const { error } = await admin
      .from("menu_items")
      .update({ available: validated.available })
      .eq("id", validated.menuItemId)
      .eq("restaurant_id", validated.restaurantId)

    if (error) throw new Error(error.message)

    const staff = validated.staffName || currentMembership?.display_name || "Kitchen Staff"
    await logActivity(
      validated.restaurantId,
      "kitchen",
      staff,
      "kitchen_soldout_toggled",
      { menu_item_id: validated.menuItemId, available: validated.available }
    )

    return { success: true }
  }

  return { success: true }
}

/**
 * 7. Kitchen Device Heartbeat & Revocation Check (called every 60s)
 */
export async function kitchenDeviceHeartbeat(restaurantId: string): Promise<{ revoked: boolean }> {
  try {
    const userContext = await getUserContext()
    if (!userContext?.user) {
      return { revoked: false }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()

      // Find device record
      const { data: device } = await admin
        .from("kitchen_devices")
        .select("id, revoked_at")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", userContext.user.id)
        .maybeSingle()

      if (device) {
        if (device.revoked_at) {
          return { revoked: true }
        }

        // Update last seen
        await admin
          .from("kitchen_devices")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", device.id)
      }
    }

    return { revoked: false }
  } catch {
    return { revoked: false }
  }
}

