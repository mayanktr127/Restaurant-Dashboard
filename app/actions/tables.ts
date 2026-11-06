"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, logActivity } from "@/lib/auth"
import QRCode from "qrcode"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

export interface TableRecord {
  id: string
  restaurant_id: string
  label: string
  active: boolean
  sort_order: number
}

const TableSchema = z.object({
  restaurantId: z.string().uuid(),
  label: z.string().min(1, "Table label is required").max(30),
})

let devTablesStore: TableRecord[] = []

export async function getTables(restaurantId: string): Promise<TableRecord[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  if (!supabaseUrl.includes("placeholder")) {
    try {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order")

      if (!error && data) return data
    } catch {
      // Fall through to dev tables
    }
  }
  return devTablesStore.filter((t) => t.restaurant_id === restaurantId)
}

export async function addTable(restaurantId: string, label: string) {
  try {
    const validated = TableSchema.parse({ restaurantId, label })
    const { context, currentMembership } = await requireRole(validated.restaurantId, ["owner", "manager"])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    let newId = crypto.randomUUID()

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from("tables")
        .insert({
          restaurant_id: validated.restaurantId,
          label: validated.label,
          active: true,
          sort_order: devTablesStore.length + 1,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      if (data) newId = data.id
    } else {
      devTablesStore.push({
        id: newId,
        restaurant_id: validated.restaurantId,
        label: validated.label,
        active: true,
        sort_order: devTablesStore.length + 1,
      })
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(validated.restaurantId, actorRole, context.user.email || "Staff", "table_added", {
      table_id: newId,
      label: validated.label,
    })

    return { success: true, id: newId, label: validated.label }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add table" }
  }
}

export async function updateTable(
  restaurantId: string,
  tableId: string,
  data: { label?: string; active?: boolean }
) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("tables").update(data).eq("id", tableId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      const idx = devTablesStore.findIndex((t) => t.id === tableId)
      if (idx !== -1) {
        devTablesStore[idx] = { ...devTablesStore[idx], ...data }
      }
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "table_updated", { tableId, ...data })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update table" }
  }
}

export async function deleteTable(restaurantId: string, tableId: string) {
  try {
    const { context, currentMembership } = await requireRole(restaurantId, ["owner"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      const { error } = await admin.from("tables").delete().eq("id", tableId).eq("restaurant_id", restaurantId)
      if (error) throw new Error(error.message)
    } else {
      devTablesStore = devTablesStore.filter((t) => t.id !== tableId)
    }

    const actorRole = context.isAdmin ? "admin" : currentMembership?.role || "owner"
    await logActivity(restaurantId, actorRole, context.user.email || "Staff", "table_deleted", { tableId })

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete table" }
  }
}

export async function reorderTables(restaurantId: string, orderedIds: string[]) {
  try {
    await requireRole(restaurantId, ["owner", "manager"])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    if (!supabaseUrl.includes("placeholder")) {
      const admin = createAdminClient()
      await Promise.all(
        orderedIds.map((id, index) =>
          admin.from("tables").update({ sort_order: index + 1 }).eq("id", id).eq("restaurant_id", restaurantId)
        )
      )
    } else {
      orderedIds.forEach((id, index) => {
        const t = devTablesStore.find((item) => item.id === id)
        if (t) t.sort_order = index + 1
      })
      devTablesStore.sort((a, b) => a.sort_order - b.sort_order)
    }

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reorder tables" }
  }
}

/**
 * Generates printable PDF documents for table QRs:
 * Type 'tents' (A6 table tents) | 'stickers' (multi-up stickers) | 'single' (one per full page) | 'pickup'
 */
export async function generateQrPdf(
  restaurantId: string,
  type: "tents" | "stickers" | "single" | "pickup",
  tableLabel?: string
): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
  try {
    const customerMenuUrl = process.env.NEXT_PUBLIC_CUSTOMER_MENU_URL || "http://localhost:3000/menu"
    let restaurantSlug = "restaurant"
    let restaurantName = "Restaurant"

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (!supabaseUrl.includes("placeholder")) {
      try {
        const admin = createAdminClient()
        const { data: rest } = await admin.from("restaurants").select("name, slug").eq("id", restaurantId).maybeSingle()
        if (rest) {
          restaurantSlug = rest.slug
          restaurantName = rest.name
        }
      } catch {
        // use defaults
      }
    }

    const pdfDoc = await PDFDocument.create()
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const targetTables: { label: string; url: string }[] = []

    if (type === "pickup") {
      targetTables.push({
        label: "Pickup Station",
        url: `${customerMenuUrl}/?r=${restaurantSlug}&pickup=true`,
      })
    } else if (tableLabel) {
      targetTables.push({
        label: tableLabel,
        url: `${customerMenuUrl}/?r=${restaurantSlug}&table=${encodeURIComponent(tableLabel)}`,
      })
    } else {
      const tables = await getTables(restaurantId)
      const activeOnly = tables.filter((t) => t.active)
      activeOnly.forEach((t) => {
        targetTables.push({
          label: t.label,
          url: `${customerMenuUrl}/?r=${restaurantSlug}&table=${encodeURIComponent(t.label)}`,
        })
      })
    }

    if (type === "tents") {
      // A6 Table Tents (105mm x 148mm = ~298pt x 420pt)
      for (const item of targetTables) {
        const page = pdfDoc.addPage([298, 420])
        const qrDataUrl = await QRCode.toDataURL(item.url, { width: 400, margin: 1 })
        const pngImage = await pdfDoc.embedPng(qrDataUrl)

        // Draw brand header
        page.drawText(restaurantName, {
          x: 24,
          y: 375,
          size: 16,
          font: fontBold,
          color: rgb(0.086, 0.396, 0.204), // Green #166534
        })

        page.drawText("Scan to view menu & order", {
          x: 24,
          y: 355,
          size: 10,
          font: fontRegular,
          color: rgb(0.35, 0.35, 0.35),
        })

        // Draw QR Image
        page.drawImage(pngImage, {
          x: 39,
          y: 110,
          width: 220,
          height: 220,
        })

        // Table label footer
        page.drawRectangle({
          x: 24,
          y: 35,
          width: 250,
          height: 50,
          color: rgb(0.96, 0.98, 0.96),
          borderColor: rgb(0.85, 0.92, 0.85),
          borderWidth: 1,
        })

        page.drawText(item.label.toUpperCase(), {
          x: 34,
          y: 53,
          size: 16,
          font: fontBold,
          color: rgb(0.086, 0.396, 0.204),
        })

        page.drawText("Powered by MyPlanet Restaurant", {
          x: 24,
          y: 15,
          size: 7,
          font: fontRegular,
          color: rgb(0.6, 0.6, 0.6),
        })
      }
    } else if (type === "stickers") {
      // 2x3 Grid on Letter Sheet (612 x 792 pt)
      const page = pdfDoc.addPage([612, 792])
      const cellW = 270
      const cellH = 220
      const marginX = 36
      const marginY = 50

      for (let i = 0; i < Math.min(targetTables.length, 6); i++) {
        const item = targetTables[i]
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = marginX + col * (cellW + 10)
        const y = 792 - marginY - (row + 1) * cellH

        page.drawRectangle({
          x,
          y,
          width: cellW,
          height: cellH,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 1,
        })

        const qrDataUrl = await QRCode.toDataURL(item.url, { width: 250, margin: 1 })
        const pngImage = await pdfDoc.embedPng(qrDataUrl)

        page.drawImage(pngImage, {
          x: x + 15,
          y: y + 35,
          width: 130,
          height: 130,
        })

        page.drawText(restaurantName, {
          x: x + 155,
          y: y + 145,
          size: 11,
          font: fontBold,
          color: rgb(0.086, 0.396, 0.204),
        })

        page.drawText(item.label, {
          x: x + 155,
          y: y + 120,
          size: 14,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        })

        page.drawText("Scan to Order", {
          x: x + 155,
          y: y + 95,
          size: 9,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        })
      }
    } else {
      // Standard Single / Letter Page per QR
      for (const item of targetTables) {
        const page = pdfDoc.addPage([612, 792])
        const qrDataUrl = await QRCode.toDataURL(item.url, { width: 600, margin: 1 })
        const pngImage = await pdfDoc.embedPng(qrDataUrl)

        page.drawText(restaurantName, {
          x: 54,
          y: 710,
          size: 26,
          font: fontBold,
          color: rgb(0.086, 0.396, 0.204),
        })

        page.drawText(`Direct Table Order QR: ${item.label}`, {
          x: 54,
          y: 680,
          size: 14,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        })

        page.drawImage(pngImage, {
          x: 106,
          y: 240,
          width: 400,
          height: 400,
        })

        page.drawText("Open camera and scan QR to view menu and order without waiting", {
          x: 100,
          y: 190,
          size: 12,
          font: fontRegular,
          color: rgb(0.3, 0.3, 0.3),
        })
      }
    }

    const pdfBytes = await pdfDoc.save()
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64")
    return { success: true, pdfBase64 }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate PDF" }
  }
}

