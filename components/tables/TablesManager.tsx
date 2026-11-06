"use client"

import React, { useState, useEffect } from "react"
import {
  Plus,
  QrCode,
  Download,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  FileText,
  Printer,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import { PageHeader } from "@/components/ui-kit"
import {
  TableRecord,
  addTable,
  updateTable,
  deleteTable,
  generateQrPdf,
} from "@/app/actions/tables"
import QRCode from "qrcode"
import { cn } from "@/lib/utils"

interface TablesManagerProps {
  restaurantId: string
  restaurantSlug: string
  initialTables: TableRecord[]
}

export function TablesManager({
  restaurantId,
  restaurantSlug,
  initialTables,
}: TablesManagerProps) {
  const [tables, setTables] = useState<TableRecord[]>(initialTables)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTableLabel, setNewTableLabel] = useState("")
  const [loadingAdd, setLoadingAdd] = useState(false)

  // Edit table state
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")

  // PDF Download state
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [downloadDropdown, setDownloadDropdown] = useState(false)

  // QR preview thumbnails cache
  const [qrThumbs, setQrThumbs] = useState<Record<string, string>>({})

  // Generate local QR preview data URLs
  useEffect(() => {
    const customerUrl = process.env.NEXT_PUBLIC_CUSTOMER_MENU_URL || "http://localhost:3000/menu"
    const generateAllThumbs = async () => {
      const thumbs: Record<string, string> = {}
      for (const t of tables) {
        const url = `${customerUrl}/?r=${restaurantSlug}&table=${encodeURIComponent(t.label)}`
        try {
          thumbs[t.id] = await QRCode.toDataURL(url, { width: 120, margin: 1 })
        } catch {
          // ignore
        }
      }
      setQrThumbs(thumbs)
    }
    generateAllThumbs()
  }, [tables, restaurantSlug])

  // Add Table
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTableLabel.trim()) return
    setLoadingAdd(true)
    try {
      const res = await addTable(restaurantId, newTableLabel.trim())
      if (res.success && res.id) {
        setTables((prev) => [
          ...prev,
          {
            id: res.id,
            restaurant_id: restaurantId,
            label: res.label || newTableLabel.trim(),
            active: true,
            sort_order: prev.length + 1,
          },
        ])
        setNewTableLabel("")
        setShowAddModal(false)
      }
    } finally {
      setLoadingAdd(false)
    }
  }

  // Toggle active status
  const handleToggleActive = async (tableId: string, currentActive: boolean) => {
    const next = !currentActive
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, active: next } : t))
    )
    await updateTable(restaurantId, tableId, { active: next })
  }

  // Rename table
  const handleSaveRename = async (tableId: string) => {
    if (!editLabel.trim()) return
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, label: editLabel.trim() } : t))
    )
    await updateTable(restaurantId, tableId, { label: editLabel.trim() })
    setEditingTableId(null)
  }

  // Delete table
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("Are you sure you want to remove this table?")) return
    setTables((prev) => prev.filter((t) => t.id !== tableId))
    await deleteTable(restaurantId, tableId)
  }

  // Trigger PDF Generation and file download
  const handleDownloadPdf = async (
    type: "tents" | "stickers" | "single" | "pickup",
    label?: string
  ) => {
    setPdfDownloading(true)
    setDownloadDropdown(false)
    try {
      const res = await generateQrPdf(restaurantId, type, label)
      if (res.success && res.pdfBase64) {
        const byteCharacters = atob(res.pdfBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: "application/pdf" })
        const blobUrl = URL.createObjectURL(blob)

        const link = document.createElement("a")
        link.href = blobUrl
        link.download = `QR-${type}-${restaurantSlug}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      } else {
        alert(res.error || "Failed to generate PDF")
      }
    } finally {
      setPdfDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables & QR Codes"
        description="Configure dining tables and print high-resolution QR codes for contactless guest ordering."
        actions={
          <div className="flex items-center gap-2.5 relative">
            {/* Download Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDownloadDropdown(!downloadDropdown)}
                disabled={pdfDownloading}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors shadow-xs cursor-pointer select-none"
              >
                {pdfDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-stone-500" />
                )}
                <span>Download Print PDF</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {downloadDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-stone-200 shadow-xl p-2 z-50 text-xs space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Select PDF Format
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf("tents")}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-stone-50 text-stone-800 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-800 shrink-0" />
                    <div>
                      <div className="font-semibold text-stone-900">Table Tents (A6)</div>
                      <div className="text-[10px] text-stone-400">
                        Folded table cards with logo &amp; &quot;Scan to Order&quot;
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf("stickers")}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-stone-50 text-stone-800 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-800 shrink-0" />
                    <div>
                      <div className="font-semibold text-stone-900">Sticker Sheet</div>
                      <div className="text-[10px] text-stone-400">
                        Multi-up table stickers on a single sheet
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf("single")}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-stone-50 text-stone-800 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-emerald-800 shrink-0" />
                    <div>
                      <div className="font-semibold text-stone-900">One QR per Page</div>
                      <div className="text-[10px] text-stone-400">
                        Full-page posters for tabletop display stands
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-stone-100 my-1" />

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf("pickup")}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-stone-50 text-stone-800 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-stone-900">Pickup Station QR</div>
                      <div className="text-[10px] text-stone-400">
                        Direct counter & take-out QR (no table #)
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Add Table Button */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Table</span>
            </button>
          </div>
        }
      />

      {/* Tables Table Grid */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/40 text-xs">
          <div className="font-semibold text-stone-900">
            Registered Tables & Stations ({tables.length})
          </div>
          <span className="text-[11px] text-stone-400">
            QR URL Format: <code className="font-mono text-stone-600">/?r={restaurantSlug}&table=&#123;label&#125;</code>
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {tables.map((table) => {
            const isEditing = editingTableId === table.id

            return (
              <div
                key={table.id}
                className={cn(
                  "p-4 sm:px-5 flex items-center justify-between gap-4 transition-colors text-xs",
                  !table.active && "bg-stone-50/60 opacity-60"
                )}
              >
                {/* Left: Thumbnail & Name */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* QR Thumbnail */}
                  <div className="w-14 h-14 rounded-xl border border-stone-200 bg-white p-1 shrink-0 flex items-center justify-center shadow-2xs">
                    {qrThumbs[table.id] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={qrThumbs[table.id]}
                        alt={`QR for ${table.label}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-6 h-6 text-stone-300" />
                    )}
                  </div>

                  {/* Label or Inline Editor */}
                  <div className="space-y-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="h-8 rounded-lg border border-stone-300 px-2.5 text-xs text-stone-900 font-semibold"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(table.id)}
                          className="p-1.5 text-emerald-800 hover:bg-emerald-50 rounded"
                          title="Save label"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTableId(null)}
                          className="p-1.5 text-stone-400 hover:bg-stone-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-stone-900">
                          {table.label}
                        </span>
                        {!table.active && (
                          <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                            Deactivated
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-stone-400 text-[11px] font-mono">
                      /?r={restaurantSlug}&table={encodeURIComponent(table.label)}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Active Toggle */}
                  <label
                    className="flex items-center gap-2 cursor-pointer select-none"
                    title="Toggle table active status"
                  >
                    <span className="text-[11px] text-stone-500 hidden sm:inline">
                      {table.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(table.id, table.active)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                        table.active ? "bg-emerald-700" : "bg-stone-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                          table.active ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </label>

                  {/* Print single PDF */}
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf("tents", table.label)}
                    className="p-1.5 text-stone-400 hover:text-emerald-800 rounded-lg hover:bg-stone-100 cursor-pointer"
                    title="Download A6 tent card PDF for this table"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {/* Rename */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTableId(table.id)
                        setEditLabel(table.label)
                      }}
                      className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
                      title="Rename table label"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(table.id)}
                    className="p-1.5 text-stone-400 hover:text-red-700 rounded-lg hover:bg-stone-100 cursor-pointer"
                    title="Delete table"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ADD TABLE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-semibold text-sm text-stone-900">Add Dining Table</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-stone-700">Table Label</label>
                <input
                  type="text"
                  required
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  placeholder="e.g. Table 6, Patio 2, Bar A"
                  className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAdd}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg flex items-center gap-1"
                >
                  {loadingAdd && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Save Table</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
