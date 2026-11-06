"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"

export interface CategoryRecord {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
  visible: boolean
}

export interface MenuItemRecord {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description?: string | null
  price_cents: number
  photo_url?: string | null
  available: boolean
  visible: boolean
  sort_order: number
  tags: string[]
}

const AddCategorySchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1, "Category name is required").max(60),
})

const AddItemSchema = z.object({
  restaurantId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1, "Item name is required").max(100),
  description: z.string().optional(),
  priceDollars: z.number().min(0, "Price must be positive"),
  photoUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

let devCatsStore: CategoryRecord[] = []
let devItemsStore: MenuItemRecord[] = []

export async function getMenuData(restaurantId: string): Promise<{
  categories: CategoryRecord[]
  items: MenuItemRecord[]
  managerCanEditMenu: boolean
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const isPlaceholder = supabaseUrl.includes("placeholder")

  if (!isPlaceholder) {
    try {
      const admin = createAdminClient()
      const [catsRes, itemsRes, restRes] = await Promise.all([
        admin.from("categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
        admin.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
        admin.from("restaurants").select("manager_can_edit_menu").eq("id", restaurantId).maybeSingle(),
      ])

      if (!catsRes.error && catsRes.data) {
        return {
          categories: catsRes.data,
          items: itemsRes.data || [],
          managerCanEditMenu: restRes.data?.manager_can_edit_menu ?? false,
        }
      }
    } catch {
      // Fall through to dev fallback
    }
  }

  return {
    categories: devCatsStore.filter((c) => c.restaurant_id === restaurantId),
    items: devItemsStore.filter((i) => i.restaurant_id === restaurantId),
    managerCanEditMenu: true,
  }
}

export async function addCategory(restaurantId: string, name: string) {
  try {
    const validated = AddCategorySchema.parse({ restaurantId, name })
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner", "manager"])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    let newId = crypto.randomUUID()

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from("categories")
        .insert({
          restaurant_id: validated.restaurantId,
          name: validated.name,
          sort_order: devCatsStore.length + 1,
          visible: true,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      if (data) newId = data.id
    } else {
      devCatsStore.push({
        id: newId,
        restaurant_id: validated.restaurantId,
        name: validated.name,
        sort_order: devCatsStore.length + 1,
        visible: true,
      })
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Staff", "category_added", {
      name: validated.name,
      id: newId,
    })

    return { success: true, id: newId, name: validated.name }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add category" }
  }
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  data: { name?: string; visible?: boolean }
) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("categories").update(data).eq("id", categoryId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      const idx = devCatsStore.findIndex((c) => c.id === categoryId)
      if (idx !== -1) {
        devCatsStore[idx] = { ...devCatsStore[idx], ...data }
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "category_updated", {
      categoryId,
      ...data,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update category" }
  }
}

export async function deleteCategory(restaurantId: string, categoryId: string) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("categories").delete().eq("id", categoryId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      devCatsStore = devCatsStore.filter((c) => c.id !== categoryId)
      devItemsStore = devItemsStore.filter((i) => i.category_id !== categoryId)
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "category_deleted", { categoryId })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete category" }
  }
}

export async function reorderCategories(restaurantId: string, orderedIds: string[]) {
  try {
    await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await Promise.all(
        orderedIds.map((id, index) =>
          admin.from("categories").update({ sort_order: index + 1 }).eq("id", id).eq("restaurant_id", restaurantId)
        )
      )
    } else {
      orderedIds.forEach((id, index) => {
        const cat = devCatsStore.find((c) => c.id === id)
        if (cat) cat.sort_order = index + 1
      })
      devCatsStore.sort((a, b) => a.sort_order - b.sort_order)
    }

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reorder categories" }
  }
}

export async function addMenuItem(
  restaurantId: string,
  data: {
    categoryId: string
    name: string
    description?: string
    priceDollars: number
    photoUrl?: string
    tags?: string[]
  }
) {
  try {
    const validated = AddItemSchema.parse({ restaurantId, ...data })
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner", "manager"])

    const priceCents = Math.round(validated.priceDollars * 100)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    let newId = crypto.randomUUID()

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { data: item, error } = await admin
        .from("menu_items")
        .insert({
          restaurant_id: validated.restaurantId,
          category_id: validated.categoryId,
          name: validated.name,
          description: validated.description || null,
          price_cents: priceCents,
          photo_url: validated.photoUrl || null,
          tags: validated.tags || [],
          available: true,
          visible: true,
          sort_order: devItemsStore.length + 1,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      if (item) newId = item.id
    } else {
      devItemsStore.push({
        id: newId,
        restaurant_id: validated.restaurantId,
        category_id: validated.categoryId,
        name: validated.name,
        description: validated.description || null,
        price_cents: priceCents,
        photo_url: validated.photoUrl || null,
        tags: validated.tags || [],
        available: true,
        visible: true,
        sort_order: devItemsStore.length + 1,
      })
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Staff", "item_added", {
      id: newId,
      name: validated.name,
      price_cents: priceCents,
    })

    return { success: true, id: newId }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add menu item" }
  }
}

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  data: {
    categoryId?: string
    name?: string
    description?: string
    priceDollars?: number
    photoUrl?: string
    tags?: string[]
    available?: boolean
    visible?: boolean
  }
) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    const updatePayload: Record<string, unknown> = {}
    if (data.categoryId) updatePayload.category_id = data.categoryId
    if (data.name) updatePayload.name = data.name
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.priceDollars !== undefined) updatePayload.price_cents = Math.round(data.priceDollars * 100)
    if (data.photoUrl !== undefined) updatePayload.photo_url = data.photoUrl
    if (data.tags !== undefined) updatePayload.tags = data.tags
    if (data.available !== undefined) updatePayload.available = data.available
    if (data.visible !== undefined) updatePayload.visible = data.visible

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("menu_items").update(updatePayload).eq("id", itemId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      const idx = devItemsStore.findIndex((i) => i.id === itemId)
      if (idx !== -1) {
        devItemsStore[idx] = { ...devItemsStore[idx], ...updatePayload }
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "item_updated", {
      itemId,
      ...data,
    })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update menu item" }
  }
}

export async function deleteMenuItem(restaurantId: string, itemId: string) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("menu_items").delete().eq("id", itemId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      devItemsStore = devItemsStore.filter((i) => i.id !== itemId)
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "item_deleted", { itemId })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete item" }
  }
}

export async function toggleItemAvailability(restaurantId: string, itemId: string, available: boolean) {
  try {
    // Both owner and manager (and kitchen if kitchen_can_soldout) can toggle sold out
    const { context, currentMembership } = await requireRole(restaurantId, ["owner", "manager", "kitchen"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("menu_items").update({ available }).eq("id", itemId).eq("restaurant_id", restaurantId)
    } else {
      const item = devItemsStore.find((i) => i.id === itemId)
      if (item) item.available = available
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "sold_out_toggled", {
      itemId,
      available,
    })

    return { success: true, available }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to toggle item availability" }
  }
}

export async function toggleItemVisibility(restaurantId: string, itemId: string, visible: boolean) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await admin.from("menu_items").update({ visible }).eq("id", itemId).eq("restaurant_id", restaurantId)
    } else {
      const item = devItemsStore.find((i) => i.id === itemId)
      if (item) item.visible = visible
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "visibility_toggled", {
      itemId,
      visible,
    })

    return { success: true, visible }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to toggle item visibility" }
  }
}

export async function reorderMenuItems(restaurantId: string, orderedIds: string[]) {
  try {
    await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await Promise.all(
        orderedIds.map((id, index) =>
          admin.from("menu_items").update({ sort_order: index + 1 }).eq("id", id).eq("restaurant_id", restaurantId)
        )
      )
    } else {
      orderedIds.forEach((id, index) => {
        const it = devItemsStore.find((i) => i.id === id)
        if (it) it.sort_order = index + 1
      })
      devItemsStore.sort((a, b) => a.sort_order - b.sort_order)
    }

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reorder items" }
  }
}

export async function uploadMenuPhoto(restaurantId: string, formData: FormData) {
  try {
    await requireRole(restaurantId, ["owner", "manager"])
    const file = formData.get("file") as File
    if (!file) throw new Error("No file uploaded")

    const ext = file.name.split(".").pop() || "jpg"
    const filePath = `${restaurantId}/items/${crypto.randomUUID()}.${ext}`

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { error } = await admin.storage
        .from("media")
        .upload(filePath, buffer, { contentType: file.type, upsert: true })

      if (error) throw new Error(error.message)
      const { data: urlData } = admin.storage.from("media").getPublicUrl(filePath)
      return { success: true, url: urlData.publicUrl }
    } else {
      // Mock dev photo URL from unsplash
      return {
        success: true,
        url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80",
      }
    }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to upload photo" }
  }
}
