"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

export interface RestaurantSettings {
  id: string
  name: string
  slug: string
  logo_url: string | null
  brand_color: string | null
  address: string | null
  phone: string | null
  website: string | null
  is_open: boolean
  prep_minutes: number
  min_order_cents: number
  table_contact: "none" | "optional"
  pickup_contact: "email" | "phone" | "email_or_phone"
  pay_mode: "counter" | "stripe"
  tax_rate: number
  telegram_enabled: boolean
  telegram_chat_id: string | null
  customer_email_sender_name: string | null
  customer_email_reply_to: string | null
  ready_message: string | null
  kitchen_can_soldout: boolean
  manager_can_edit_menu: boolean
}

const ProfileSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1, "Restaurant name is required").max(80),
  brandColor: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
})

const OrderingSchema = z.object({
  restaurantId: z.string().uuid(),
  isOpen: z.boolean(),
  prepMinutes: z.number().int().min(1).max(180),
  minOrderDollars: z.number().min(0),
  tableContact: z.enum(["none", "optional"]),
  pickupContact: z.enum(["email", "phone", "email_or_phone"]),
})

const PaymentsSchema = z.object({
  restaurantId: z.string().uuid(),
  payMode: z.enum(["counter", "stripe"]),
  taxRate: z.number().min(0).max(30),
})

const CustomerEmailSchema = z.object({
  restaurantId: z.string().uuid(),
  senderName: z.string().min(1),
  replyTo: z.string().email(),
  readyMessage: z.string().min(1),
})

function getDefaultSettings(restaurantId: string): RestaurantSettings {
  return {
    id: restaurantId,
    name: "Restaurant",
    slug: "",
    logo_url: null,
    brand_color: "#166534",
    address: "",
    phone: "",
    website: "",
    is_open: true,
    prep_minutes: 15,
    min_order_cents: 1000,
    table_contact: "optional",
    pickup_contact: "email_or_phone",
    pay_mode: "counter",
    tax_rate: 8.25,
    telegram_enabled: false,
    telegram_chat_id: null,
    customer_email_sender_name: "Restaurant Kitchen",
    customer_email_reply_to: "orders@restaurant.test",
    ready_message: "Your order is hot and ready for pickup!",
    kitchen_can_soldout: true,
    manager_can_edit_menu: true,
  }
}

const devSettingsStore: Record<string, RestaurantSettings> = {}

export async function getRestaurantSettings(restaurantId: string): Promise<RestaurantSettings> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  if (!supabaseUrl.includes("placeholder")) {
    try {
      const admin = createAdminClient()
      const { data, error } = await admin.from("restaurants").select("*").eq("id", restaurantId).maybeSingle()
      if (!error && data) return data as RestaurantSettings
    } catch {
      // Fall through to dev settings
    }
  }
  return devSettingsStore[restaurantId] || getDefaultSettings(restaurantId)
}

export async function updateRestaurantProfile(
  restaurantId: string,
  data: {
    name: string
    brandColor?: string
    address?: string
    phone?: string
    website?: string
    logoUrl?: string
  }
) {
  try {
    const validated = ProfileSchema.parse({ restaurantId, ...data })
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner"])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("restaurants").update({
        name: validated.name,
        brand_color: validated.brandColor || null,
        address: validated.address || null,
        phone: validated.phone || null,
        website: validated.website || null,
        logo_url: validated.logoUrl || null,
      }).eq("id", validated.restaurantId)
    } else {
      const cur = devSettingsStore[validated.restaurantId] || getDefaultSettings(validated.restaurantId)
      devSettingsStore[validated.restaurantId] = {
        ...cur,
        name: validated.name,
        brand_color: validated.brandColor || cur.brand_color,
        address: validated.address || cur.address,
        phone: validated.phone || cur.phone,
        website: validated.website || cur.website,
        logo_url: validated.logoUrl || cur.logo_url,
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Owner", "profile_updated", {
      name: validated.name,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update profile" }
  }
}

export async function updateOrderingSettings(
  restaurantId: string,
  data: {
    isOpen: boolean
    prepMinutes: number
    minOrderDollars: number
    tableContact: "none" | "optional"
    pickupContact: "email" | "phone" | "email_or_phone"
  }
) {
  try {
    const validated = OrderingSchema.parse({ restaurantId, ...data })
    // Managers can also update ordering settings (or open/close)
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner", "manager"])

    const minOrderCents = Math.round(validated.minOrderDollars * 100)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("restaurants").update({
        is_open: validated.isOpen,
        prep_minutes: validated.prepMinutes,
        min_order_cents: minOrderCents,
        table_contact: validated.tableContact,
        pickup_contact: validated.pickupContact,
      }).eq("id", validated.restaurantId)
    } else {
      const cur = devSettingsStore[validated.restaurantId] || getDefaultSettings(validated.restaurantId)
      devSettingsStore[validated.restaurantId] = {
        ...cur,
        is_open: validated.isOpen,
        prep_minutes: validated.prepMinutes,
        min_order_cents: minOrderCents,
        table_contact: validated.tableContact,
        pickup_contact: validated.pickupContact,
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Staff", "ordering_settings_updated", {
      isOpen: validated.isOpen,
      prepMinutes: validated.prepMinutes,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update ordering settings" }
  }
}

export async function updatePaymentSettings(
  restaurantId: string,
  data: {
    payMode: "counter" | "stripe"
    taxRate: number
  }
) {
  try {
    const validated = PaymentsSchema.parse({ restaurantId, ...data })
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner"])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("restaurants").update({
        pay_mode: validated.payMode,
        tax_rate: validated.taxRate,
      }).eq("id", validated.restaurantId)
    } else {
      const cur = devSettingsStore[validated.restaurantId] || getDefaultSettings(validated.restaurantId)
      devSettingsStore[validated.restaurantId] = {
        ...cur,
        pay_mode: validated.payMode,
        tax_rate: validated.taxRate,
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Owner", "payment_settings_updated", {
      payMode: validated.payMode,
      taxRate: validated.taxRate,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update payments" }
  }
}

export async function updateCustomerEmailSettings(
  restaurantId: string,
  data: {
    senderName: string
    replyTo: string
    readyMessage: string
  }
) {
  try {
    const validated = CustomerEmailSchema.parse({ restaurantId, ...data })
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner"])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("restaurants").update({
        customer_email_sender_name: validated.senderName,
        customer_email_reply_to: validated.replyTo,
        ready_message: validated.readyMessage,
      }).eq("id", validated.restaurantId)
    } else {
      const cur = devSettingsStore[validated.restaurantId] || getDefaultSettings(validated.restaurantId)
      devSettingsStore[validated.restaurantId] = {
        ...cur,
        customer_email_sender_name: validated.senderName,
        customer_email_reply_to: validated.replyTo,
        ready_message: validated.readyMessage,
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Owner", "email_settings_updated", {
      senderName: validated.senderName,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update email settings" }
  }
}

export async function updateNotificationSettings(restaurantId: string, telegramEnabled: boolean) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("restaurants").update({ telegram_enabled: telegramEnabled }).eq("id", restaurantId)
    } else {
      const cur = devSettingsStore[restaurantId] || getDefaultSettings(restaurantId)
      devSettingsStore[restaurantId] = {
        ...cur,
        telegram_enabled: telegramEnabled,
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Owner", "notifications_updated", {
      telegramEnabled,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update notification settings" }
  }
}

