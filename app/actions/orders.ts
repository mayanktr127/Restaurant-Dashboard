"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

export interface OrderItemRecord {
  id: string
  name: string
  qty: number
  unit_price_cents: number
  notes?: string | null
}

export interface OrderRecord {
  id: string
  order_number: string
  order_type: "table" | "pickup"
  table_label?: string | null
  customer_name?: string | null
  notes?: string | null
  total_cents: number
  status: "new" | "cooking" | "ready" | "collected" | "problem" | "cancelled"
  problem_reason?: string | null
  created_at: string
  started_at?: string | null
  ready_at?: string | null
  collected_at?: string | null
  items: OrderItemRecord[]
}

const UpdateStatusSchema = z.object({
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid(),
  newStatus: z.enum(["cooking", "ready", "collected", "problem", "new"]),
  reason: z.string().optional(),
  staffName: z.string().optional(),
})

// In-memory fallback for local dev testing when remote database is not connected
const DEV_ORDERS: OrderRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    order_number: "ORD-12",
    order_type: "table",
    table_label: "Table 4",
    notes: "No cilantro on tacos please",
    total_cents: 1850,
    status: "new",
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    items: [
      { id: "item-1", name: "Smoked Brisket Taco", qty: 2, unit_price_cents: 450, notes: "Corn tortilla" },
      { id: "item-2", name: "Chips & Fresh Guac", qty: 1, unit_price_cents: 550 },
      { id: "item-3", name: "House Horchata", qty: 1, unit_price_cents: 400 },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    order_number: "ORD-13",
    order_type: "pickup",
    customer_name: "Sarah Miller",
    total_cents: 2200,
    status: "new",
    created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    items: [
      { id: "item-4", name: "Baja Fish Taco", qty: 3, unit_price_cents: 500 },
      { id: "item-5", name: "Mexican Street Corn (Elote)", qty: 1, unit_price_cents: 700 },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    order_number: "ORD-09",
    order_type: "table",
    table_label: "Table 2",
    total_cents: 1450,
    status: "cooking",
    created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    items: [
      { id: "item-6", name: "Carnitas Street Taco", qty: 2, unit_price_cents: 450 },
      { id: "item-7", name: "Warm Queso Blanco Dip", qty: 1, unit_price_cents: 550 },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    order_number: "ORD-07",
    order_type: "table",
    table_label: "Table 5",
    total_cents: 2600,
    status: "ready",
    created_at: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
    ready_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    items: [
      { id: "item-8", name: "Al Pastor Taco Platter", qty: 1, unit_price_cents: 1800 },
      { id: "item-9", name: "Mexican Coke", qty: 2, unit_price_cents: 400 },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000105",
    order_number: "ORD-05",
    order_type: "pickup",
    customer_name: "David Kim",
    total_cents: 1500,
    status: "collected",
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    collected_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    items: [
      { id: "item-10", name: "Crispy Birria Quesadilla", qty: 1, unit_price_cents: 1500 },
    ],
  },
]

interface DbOrderItem {
  id: string
  name: string
  qty: number
  unit_price_cents: number
  notes?: string | null
}

interface DbOrder {
  id: string
  order_number: number
  order_type: "dine_in" | "pickup"
  table_label?: string | null
  customer_name?: string | null
  notes?: string | null
  total_cents: number
  status: "new" | "cooking" | "ready" | "collected"
  problem_reason?: string | null
  created_at: string
  started_at?: string | null
  ready_at?: string | null
  collected_at?: string | null
  order_items?: DbOrderItem[]
}

const devOrdersStore = [...DEV_ORDERS]

export async function getLiveOrders(restaurantId: string): Promise<{
  new: OrderRecord[]
  cooking: OrderRecord[]
  ready: OrderRecord[]
  collected: OrderRecord[]
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const isPlaceholder = supabaseUrl.includes("placeholder")

  if (!isPlaceholder) {
    try {
      const admin = createAdminClient()
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const { data: dbOrders, error } = await admin
        .from("orders")
        .select(`
          id,
          order_number,
          order_type,
          table_label,
          customer_name,
          notes,
          total_cents,
          status,
          problem_reason,
          created_at,
          started_at,
          ready_at,
          collected_at,
          order_items (
            id,
            name,
            qty,
            unit_price_cents,
            notes
          )
        `)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: false })

      if (!error && dbOrders) {
        const formatted: OrderRecord[] = (dbOrders as unknown as DbOrder[]).map((o) => ({
          id: o.id,
          order_number: String(o.order_number),
          order_type: (o.order_type === "dine_in" ? "table" : o.order_type) as "table" | "pickup",
          table_label: o.table_label,
          customer_name: o.customer_name,
          notes: o.notes,
          total_cents: o.total_cents,
          status: o.status,
          problem_reason: o.problem_reason,
          created_at: o.created_at,
          started_at: o.started_at,
          ready_at: o.ready_at,
          collected_at: o.collected_at,
          items: o.order_items || [],
        }))

        return {
          new: formatted.filter((o) => o.status === "new" || o.status === "problem"),
          cooking: formatted.filter((o) => o.status === "cooking"),
          ready: formatted.filter((o) => o.status === "ready"),
          collected: formatted.filter((o) => o.status === "collected"),
        }
      }
    } catch {
      // Fallback to dev store if database query fails
    }
  }

  // Fallback dev data
  return {
    new: devOrdersStore.filter((o) => o.status === "new" || o.status === "problem"),
    cooking: devOrdersStore.filter((o) => o.status === "cooking"),
    ready: devOrdersStore.filter((o) => o.status === "ready"),
    collected: devOrdersStore.filter((o) => o.status === "collected"),
  }
}

export async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  newStatus: "cooking" | "ready" | "collected" | "problem" | "new",
  reason?: string,
  staffName?: string
) {
  try {
    const validated = UpdateStatusSchema.parse({
      restaurantId,
      orderId,
      newStatus,
      reason,
      staffName,
    })

    const { context, currentMembership } = await requireRole(validated.restaurantId, [
      "owner",
      "manager",
      "kitchen",
    ])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const isPlaceholder = supabaseUrl.includes("placeholder")

    if (!isPlaceholder) {
      const admin = createAdminClient()
      const { error: rpcErr } = await admin.rpc("set_order_status", {
        p_order_id: validated.orderId,
        p_new_status: validated.newStatus,
        p_reason: validated.reason || null,
        p_staff_name: validated.staffName || context.user.email || "Staff",
      })

      if (rpcErr) {
        // Fallback update if RPC fails
        const updatePayload: Record<string, unknown> = { status: validated.newStatus }
        if (validated.newStatus === "cooking") updatePayload.started_at = new Date().toISOString()
        if (validated.newStatus === "ready") updatePayload.ready_at = new Date().toISOString()
        if (validated.newStatus === "collected") updatePayload.collected_at = new Date().toISOString()
        if (validated.reason) updatePayload.problem_reason = validated.reason

        await admin.from("orders").update(updatePayload).eq("id", validated.orderId)
      }
    } else {
      // In-memory dev mutation
      const idx = devOrdersStore.findIndex((o) => o.id === validated.orderId)
      if (idx !== -1) {
        const order = { ...devOrdersStore[idx] }
        order.status = validated.newStatus
        if (validated.newStatus === "cooking") order.started_at = new Date().toISOString()
        if (validated.newStatus === "ready") order.ready_at = new Date().toISOString()
        if (validated.newStatus === "collected") order.collected_at = new Date().toISOString()
        if (validated.reason) order.problem_reason = validated.reason
        devOrdersStore[idx] = order
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(
      validated.restaurantId,
      actorRole,
      context.user.email || "Staff",
      "status_change",
      { order_id: validated.orderId, new_status: validated.newStatus, reason: validated.reason }
    )

    return { success: true, orderId: validated.orderId, newStatus: validated.newStatus }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update order status",
    }
  }
}

export async function undoOrderStatus(restaurantId: string, orderId: string) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, [
      "owner",
      "manager",
      "kitchen",
    ])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const isPlaceholder = supabaseUrl.includes("placeholder")

    if (!isPlaceholder) {
      const admin = createAdminClient()
      const { error } = await admin.rpc("set_order_status", {
        p_order_id: orderId,
        p_new_status: "undo",
      })
      if (error) throw new Error(error.message)
    } else {
      // In-memory undo: revert to new or cooking
      const idx = devOrdersStore.findIndex((o) => o.id === orderId)
      if (idx !== -1) {
        const current = devOrdersStore[idx].status
        let reverted: OrderRecord["status"] = "new"
        if (current === "collected") reverted = "ready"
        else if (current === "ready") reverted = "cooking"
        else if (current === "cooking") reverted = "new"
        devOrdersStore[idx] = { ...devOrdersStore[idx], status: reverted }
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(
      restaurantId,
      actorRole,
      context.user.email || "Staff",
      "order_undo",
      { order_id: orderId }
    )

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to undo order status",
    }
  }
}

export async function createTestOrder(restaurantId: string): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
  try {
    const randomNum = Math.floor(10 + Math.random() * 90)
    const newOrder: OrderRecord = {
      id: crypto.randomUUID(),
      order_number: `ORD-${randomNum}`,
      order_type: Math.random() > 0.5 ? "table" : "pickup",
      table_label: `Table ${Math.floor(1 + Math.random() * 8)}`,
      customer_name: "Test Customer",
      notes: "Extra napkins",
      total_cents: 1650,
      status: "new",
      created_at: new Date().toISOString(),
      items: [
        { id: `test-i1-${Date.now()}`, name: "Smoked Brisket Taco", qty: 2, unit_price_cents: 450 },
        { id: `test-i2-${Date.now()}`, name: "House Horchata", qty: 1, unit_price_cents: 400 },
      ],
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const isPlaceholder = supabaseUrl.includes("placeholder")

    if (!isPlaceholder) {
      const admin = createAdminClient()
      const { data: inserted, error: insertErr } = await admin
        .from("orders")
        .insert({
          id: newOrder.id,
          restaurant_id: restaurantId,
          order_number: newOrder.order_number,
          order_type: newOrder.order_type,
          table_label: newOrder.table_label,
          customer_name: newOrder.customer_name,
          notes: newOrder.notes,
          subtotal_cents: 1500,
          tax_cents: 150,
          total_cents: 1650,
          status: "new",
        })
        .select()
        .single()

      if (!insertErr && inserted) {
        await admin.from("order_items").insert([
          { order_id: newOrder.id, restaurant_id: restaurantId, name: "Smoked Brisket Taco", qty: 2, unit_price_cents: 450 },
          { order_id: newOrder.id, restaurant_id: restaurantId, name: "House Horchata", qty: 1, unit_price_cents: 400 },
        ])
      }
    } else {
      devOrdersStore.unshift(newOrder)
    }

    return { success: true, order: newOrder }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create test order",
    }
  }
}
