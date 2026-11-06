"use client"

import React, { useState } from "react"
import {
  Plus,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Upload,
  X,
  Loader2,
  Check,
  Smartphone,
  AlertCircle,
} from "lucide-react"
import { PageHeader } from "@/components/ui-kit"
import {
  CategoryRecord,
  MenuItemRecord,
  addCategory,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleItemAvailability,
  toggleItemVisibility,
  uploadMenuPhoto,
} from "@/app/actions/menu"
import { cn } from "@/lib/utils"

interface MenuManagerProps {
  restaurantId: string
  restaurantName: string
  initialCategories: CategoryRecord[]
  initialItems: MenuItemRecord[]
  userRole: "admin" | "owner" | "manager"
  managerCanEditMenu: boolean
}

export function MenuManager({
  restaurantId,
  restaurantName,
  initialCategories,
  initialItems,
  userRole,
  managerCanEditMenu,
}: MenuManagerProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)

  const isManager = userRole === "manager"
  const canFullEdit = !isManager || managerCanEditMenu

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [catLoading, setCatLoading] = useState(false)

  // Item side sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemRecord | null>(null)
  const [itemName, setItemName] = useState("")
  const [itemCatId, setItemCatId] = useState("")
  const [itemDesc, setItemDesc] = useState("")
  const [itemPrice, setItemPrice] = useState("")
  const [itemPhotoUrl, setItemPhotoUrl] = useState("")
  const [itemTags, setItemTags] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [savingItem, setSavingItem] = useState(false)

  // Customer preview modal
  const [showPreview, setShowPreview] = useState(false)

  const openAddItem = (catId?: string) => {
    setEditingItem(null)
    setItemName("")
    setItemCatId(catId || categories[0]?.id || "")
    setItemDesc("")
    setItemPrice("")
    setItemPhotoUrl("")
    setItemTags([])
    setSheetOpen(true)
  }

  const openEditItem = (item: MenuItemRecord) => {
    setEditingItem(item)
    setItemName(item.name)
    setItemCatId(item.category_id)
    setItemDesc(item.description || "")
    setItemPrice((item.price_cents / 100).toFixed(2))
    setItemPhotoUrl(item.photo_url || "")
    setItemTags(item.tags || [])
    setSheetOpen(true)
  }

  // Toggle sold out
  const handleToggleSoldOut = async (itemId: string, current: boolean) => {
    const next = !current
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, available: next } : it))
    )
    await toggleItemAvailability(restaurantId, itemId, next)
  }

  // Toggle visible
  const handleToggleVisible = async (itemId: string, current: boolean) => {
    if (!canFullEdit) return
    const next = !current
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, visible: next } : it))
    )
    await toggleItemVisibility(restaurantId, itemId, next)
  }

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setCatLoading(true)
    try {
      const res = await addCategory(restaurantId, newCatName.trim())
      if (res.success && res.id) {
        setCategories((prev) => [
          ...prev,
          {
            id: res.id,
            restaurant_id: restaurantId,
            name: res.name || newCatName.trim(),
            sort_order: prev.length + 1,
            visible: true,
          },
        ])
        setNewCatName("")
        setShowCatModal(false)
      }
    } finally {
      setCatLoading(false)
    }
  }

  // Photo file upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadMenuPhoto(restaurantId, fd)
      if (res.success && res.url) {
        setItemPhotoUrl(res.url)
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName || !itemPrice || !itemCatId) return
    setSavingItem(true)
    const priceDollars = parseFloat(itemPrice)

    try {
      if (editingItem) {
        await updateMenuItem(restaurantId, editingItem.id, {
          categoryId: itemCatId,
          name: itemName,
          description: itemDesc,
          priceDollars,
          photoUrl: itemPhotoUrl,
          tags: itemTags,
        })
        setItems((prev) =>
          prev.map((it) =>
            it.id === editingItem.id
              ? {
                  ...it,
                  category_id: itemCatId,
                  name: itemName,
                  description: itemDesc,
                  price_cents: Math.round(priceDollars * 100),
                  photo_url: itemPhotoUrl,
                  tags: itemTags,
                }
              : it
          )
        )
      } else {
        const res = await addMenuItem(restaurantId, {
          categoryId: itemCatId,
          name: itemName,
          description: itemDesc,
          priceDollars,
          photoUrl: itemPhotoUrl,
          tags: itemTags,
        })
        if (res.success && res.id) {
          setItems((prev) => [
            ...prev,
            {
              id: res.id,
              restaurant_id: restaurantId,
              category_id: itemCatId,
              name: itemName,
              description: itemDesc,
              price_cents: Math.round(priceDollars * 100),
              photo_url: itemPhotoUrl,
              tags: itemTags,
              available: true,
              visible: true,
              sort_order: prev.length + 1,
            },
          ])
        }
      }
      setSheetOpen(false)
    } finally {
      setSavingItem(false)
    }
  }

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return
    setItems((prev) => prev.filter((it) => it.id !== itemId))
    await deleteMenuItem(restaurantId, itemId)
  }

  const toggleTag = (tag: string) => {
    setItemTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Menu Management"
        description="Organize categories, configure dish prices, toggle sold-out availability, and preview customer ordering."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors shadow-xs cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-stone-500" />
              <span>Preview Menu</span>
            </button>

            {canFullEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCatModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-500" />
                  <span>Add Category</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAddItem()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Dish</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Manager notification banner if permissions locked */}
      {!canFullEdit && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong className="font-semibold">Manager Access:</strong> Menu dish creation and price
            editing are reserved for the Owner. You can toggle dish Sold Out switches at any time.
          </span>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-6">
        {categories.map((category) => {
          const catItems = items.filter((it) => it.category_id === category.id)

          return (
            <div
              key={category.id}
              className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden"
            >
              {/* Category Header Bar */}
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/40">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-sm text-stone-900">{category.name}</h3>
                  <span className="text-[11px] font-medium text-stone-400 bg-white px-2 py-0.5 rounded-full border border-stone-200">
                    {catItems.length} {catItems.length === 1 ? "dish" : "dishes"}
                  </span>
                </div>

                {canFullEdit && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => openAddItem(category.id)}
                      className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-900 font-medium px-2 py-1 rounded hover:bg-emerald-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to {category.name}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Items List in Category */}
              {catItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  No dishes in this category yet. Click &quot;Add to {category.name}&quot; to add your first
                  dish.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                        !item.available && "bg-stone-50/60 opacity-80"
                      )}
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {item.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-stone-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center text-xs font-semibold shrink-0 border border-stone-200">
                            Dish
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-stone-900 truncate">
                              {item.name}
                            </span>
                            {!item.available && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                Sold Out
                              </span>
                            )}
                            {!item.visible && (
                              <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                Hidden
                              </span>
                            )}
                          </div>

                          {item.description && (
                            <p className="text-xs text-stone-500 line-clamp-1 max-w-lg">
                              {item.description}
                            </p>
                          )}

                          {item.tags && item.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded capitalize"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Price & Controls */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                        <div className="font-bold text-sm text-stone-900">
                          ${(item.price_cents / 100).toFixed(2)}
                        </div>

                        {/* Sold Out Switch */}
                        <div className="flex items-center gap-2">
                          <label
                            className="text-xs font-medium text-stone-600 cursor-pointer select-none"
                            title="Toggle in-stock / sold-out"
                          >
                            <span className="hidden md:inline mr-1.5 text-[11px] text-stone-400">
                              {item.available ? "Available" : "Sold Out"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleSoldOut(item.id, item.available)}
                              className={cn(
                                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                                item.available ? "bg-emerald-700" : "bg-stone-300"
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                  item.available ? "translate-x-4" : "translate-x-0"
                                )}
                              />
                            </button>
                          </label>
                        </div>

                        {/* Visibility & Edit for Owners */}
                        {canFullEdit && (
                          <div className="flex items-center gap-1.5 text-stone-400">
                            <button
                              type="button"
                              onClick={() => handleToggleVisible(item.id, item.visible)}
                              className="p-1.5 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
                              title={item.visible ? "Hide from customer menu" : "Show on menu"}
                            >
                              {item.visible ? (
                                <Eye className="w-4 h-4 text-stone-600" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-stone-400" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="p-1.5 hover:text-emerald-800 rounded-lg hover:bg-stone-100 cursor-pointer"
                              title="Edit dish details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 hover:text-red-700 rounded-lg hover:bg-stone-100 cursor-pointer"
                              title="Delete dish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ADD / EDIT ITEM SIDE SHEET */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Sheet Header */}
            <div>
              <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-stone-900">
                    {editingItem ? "Edit Menu Dish" : "Add New Dish"}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Dishes will display directly on your customer QR ordering page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sheet Form */}
              <form onSubmit={handleSaveItem} id="dish-form" className="p-5 space-y-4 text-xs">
                {/* Dish Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Dish Name *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Crispy Carnitas Taco"
                    className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900 text-xs"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Category *</label>
                  <select
                    value={itemCatId}
                    onChange={(e) => setItemCatId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-stone-200 bg-white px-3 text-stone-900 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price in Dollars */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Price (USD $) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 font-semibold">$</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="4.50"
                      className="w-full h-9 rounded-xl border border-stone-200 pl-7 pr-3 text-stone-900 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Description</label>
                  <textarea
                    rows={3}
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    placeholder="Short description of ingredients, preparation, and flavor profile..."
                    className="w-full rounded-xl border border-stone-200 p-3 text-stone-900 text-xs"
                  />
                </div>

                {/* Photo Upload */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-700">Dish Photo</label>
                  {itemPhotoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={itemPhotoUrl}
                      alt="Preview"
                      className="w-full h-36 object-cover rounded-xl border border-stone-200 mb-2"
                    />
                  )}
                  <label className="flex items-center justify-center gap-2 w-full h-10 border border-dashed border-stone-300 rounded-xl hover:bg-stone-50 cursor-pointer text-stone-600 font-medium">
                    {uploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-800" />
                    ) : (
                      <Upload className="w-4 h-4 text-stone-400" />
                    )}
                    <span>{itemPhotoUrl ? "Change Photo" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Dietary Tags */}
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <label className="font-semibold text-stone-700">Dietary & Allergen Tags</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["vegan", "vegetarian", "gluten-free", "spicy"].map((tag) => {
                      const isSelected = itemTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium capitalize transition-colors text-left",
                            isSelected
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                              : "border-stone-200 text-stone-600 hover:bg-stone-50"
                          )}
                        >
                          <span>{tag}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </form>
            </div>

            {/* Sheet Footer */}
            <div className="p-4 border-t border-stone-100 flex items-center justify-end gap-2 bg-stone-50">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="dish-form"
                disabled={savingItem}
                className="px-4 py-2 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-xs flex items-center gap-1.5"
              >
                {savingItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingItem ? "Update Dish" : "Save Dish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-semibold text-sm text-stone-900">Add Menu Category</h3>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-stone-700">Category Name</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Desserts & Churros"
                  className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catLoading}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg flex items-center gap-1"
                >
                  {catLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Create Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER MENU SIMULATOR PREVIEW */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl max-w-sm w-full h-[620px] shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Simulated Phone Bar */}
            <div className="h-10 bg-emerald-900 text-white px-4 flex items-center justify-between text-xs font-semibold shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Customer QR Menu Preview</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Customer View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs bg-stone-50">
              <div className="text-center space-y-1 pb-3 border-b border-stone-200">
                <h2 className="font-bold text-base text-stone-900">{restaurantName}</h2>
                <p className="text-[11px] text-stone-500">Scan & Order from Table · Fast Kitchen Prep</p>
              </div>

              {categories
                .filter((c) => c.visible)
                .map((cat) => {
                  const visibleItems = items.filter((it) => it.category_id === cat.id && it.visible)
                  if (visibleItems.length === 0) return null

                  return (
                    <div key={cat.id} className="space-y-2.5">
                      <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] border-b border-stone-200 pb-1">
                        {cat.name}
                      </h4>

                      <div className="space-y-2">
                        {visibleItems.map((dish) => (
                          <div
                            key={dish.id}
                            className={cn(
                              "bg-white rounded-xl border border-stone-200 p-2.5 flex items-center justify-between gap-3 shadow-2xs",
                              !dish.available && "opacity-50"
                            )}
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="font-semibold text-stone-900">{dish.name}</div>
                              {dish.description && (
                                <p className="text-[10px] text-stone-500 line-clamp-1">
                                  {dish.description}
                                </p>
                              )}
                              <div className="font-bold text-stone-900 pt-0.5">
                                ${(dish.price_cents / 100).toFixed(2)}
                              </div>
                            </div>

                            {dish.photo_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={dish.photo_url}
                                alt={dish.name}
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Customer Order Footer Bar */}
            <div className="p-3 bg-white border-t border-stone-200 text-center text-[11px] text-stone-500 shrink-0">
              Direct checkout enabled · Pay at Counter or via Apple Pay
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
