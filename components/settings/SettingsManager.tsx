"use client"

import React, { useState } from "react"
import {
  Building2,
  Clock,
  CreditCard,
  Bell,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { PageHeader } from "@/components/ui-kit"
import {
  RestaurantSettings,
  updateRestaurantProfile,
  updateOrderingSettings,
  updatePaymentSettings,
  updateCustomerEmailSettings,
  updateNotificationSettings,
} from "@/app/actions/settings"
import { cn } from "@/lib/utils"

interface SettingsManagerProps {
  restaurantId: string
  settings: RestaurantSettings
  userRole: "admin" | "owner" | "manager"
}

export function SettingsManager({
  restaurantId,
  settings,
  userRole,
}: SettingsManagerProps) {
  const isManager = userRole === "manager"
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin"

  const [activeTab, setActiveTab] = useState<
    "profile" | "ordering" | "payments" | "notifications" | "emails"
  >(isManager ? "ordering" : "profile")

  const [saving, setSaving] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  // Profile form state
  const [name, setName] = useState(settings.name)
  const [brandColor, setBrandColor] = useState(settings.brand_color || "#166534")
  const [address, setAddress] = useState(settings.address || "")
  const [phone, setPhone] = useState(settings.phone || "")
  const [website, setWebsite] = useState(settings.website || "")

  // Ordering form state
  const [isOpen, setIsOpen] = useState(settings.is_open)
  const [prepMinutes, setPrepMinutes] = useState(settings.prep_minutes)
  const [minOrderDollars, setMinOrderDollars] = useState(
    (settings.min_order_cents / 100).toFixed(2)
  )
  const [tableContact, setTableContact] = useState<"none" | "optional">(settings.table_contact)
  const [pickupContact, setPickupContact] = useState<"email" | "phone" | "email_or_phone">(
    settings.pickup_contact
  )

  // Payments form state
  const [payMode, setPayMode] = useState<"counter" | "stripe">(settings.pay_mode)
  const [taxRate, setTaxRate] = useState(settings.tax_rate)

  // Customer email state
  const [senderName, setSenderName] = useState(settings.customer_email_sender_name || "")
  const [replyTo, setReplyTo] = useState(settings.customer_email_reply_to || "")
  const [readyMessage, setReadyMessage] = useState(settings.ready_message || "")

  // Telegram state
  const [telegramEnabled, setTelegramEnabled] = useState(settings.telegram_enabled)

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorToast(msg)
      setTimeout(() => setErrorToast(null), 4000)
    } else {
      setSuccessToast(msg)
      setTimeout(() => setSuccessToast(null), 3000)
    }
  }

  // 1. Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updateRestaurantProfile(restaurantId, {
        name,
        brandColor,
        address,
        phone,
        website,
      })
      if (res.success) {
        showNotification("Restaurant profile updated successfully")
      } else {
        showNotification(res.error || "Failed to update profile", true)
      }
    } finally {
      setSaving(false)
    }
  }

  // 2. Save Ordering
  const handleSaveOrdering = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updateOrderingSettings(restaurantId, {
        isOpen,
        prepMinutes: Number(prepMinutes),
        minOrderDollars: parseFloat(minOrderDollars),
        tableContact,
        pickupContact,
      })
      if (res.success) {
        showNotification("Ordering rules and store status updated")
      } else {
        showNotification(res.error || "Failed to update ordering settings", true)
      }
    } finally {
      setSaving(false)
    }
  }

  // 3. Save Payments
  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updatePaymentSettings(restaurantId, {
        payMode,
        taxRate: Number(taxRate),
      })
      if (res.success) {
        showNotification("Payment and tax configuration updated")
      } else {
        showNotification(res.error || "Failed to update payment settings", true)
      }
    } finally {
      setSaving(false)
    }
  }

  // 4. Save Customer Emails
  const handleSaveEmails = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updateCustomerEmailSettings(restaurantId, {
        senderName,
        replyTo,
        readyMessage,
      })
      if (res.success) {
        showNotification("Automated order email settings updated")
      } else {
        showNotification(res.error || "Failed to update email settings", true)
      }
    } finally {
      setSaving(false)
    }
  }

  // 5. Toggle Telegram
  const handleToggleTelegram = async () => {
    const next = !telegramEnabled
    setTelegramEnabled(next)
    await updateNotificationSettings(restaurantId, next)
    showNotification(`Telegram order notifications ${next ? "enabled" : "disabled"}`)
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-800 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-20 right-6 z-50 bg-red-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-red-800 animate-in slide-in-from-top-4">
          <AlertCircle className="w-4 h-4 text-red-200" />
          <span className="text-xs font-semibold">{errorToast}</span>
        </div>
      )}

      <PageHeader
        title="Restaurant Settings"
        description="Brand identity, kitchen prep timings, payment gateways, and automated customer notifications."
      />

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-stone-200 overflow-x-auto pb-px">
        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer",
              activeTab === "profile"
                ? "border-emerald-800 text-emerald-900"
                : "border-transparent text-stone-500 hover:text-stone-900"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Profile & Brand</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("ordering")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer",
            activeTab === "ordering"
              ? "border-emerald-800 text-emerald-900"
              : "border-transparent text-stone-500 hover:text-stone-900"
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Ordering & Hours</span>
        </button>

        {isOwnerOrAdmin && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                activeTab === "payments"
                  ? "border-emerald-800 text-emerald-900"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payments & Tax</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                activeTab === "notifications"
                  ? "border-emerald-800 text-emerald-900"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              )}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Telegram Alerts</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("emails")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                activeTab === "emails"
                  ? "border-emerald-800 text-emerald-900"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              )}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Customer Emails</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: PROFILE & BRAND */}
      {activeTab === "profile" && isOwnerOrAdmin && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs max-w-2xl space-y-5 text-xs"
        >
          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Restaurant Public Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Brand Primary Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-xl border border-stone-200 p-0.5 cursor-pointer"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-32 h-9 rounded-xl border border-stone-200 px-3 text-stone-900 font-mono"
              />
              <span className="text-[11px] text-stone-400">
                Applied to QR customer pages & receipt banners.
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Physical Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 412 E 6th St, Austin, TX 78701"
              className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-stone-800">Customer Support Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(512) 555-0199"
                className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-stone-800">Official Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://lonestartacos.com"
                className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: ORDERING & HOURS */}
      {activeTab === "ordering" && (
        <form
          onSubmit={handleSaveOrdering}
          className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs max-w-2xl space-y-6 text-xs"
        >
          {/* Store Open / Closed Switch */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-stone-900 text-sm">Online Ordering Status</div>
              <p className="text-[11px] text-stone-500">
                When closed, customers scanning table QR codes are informed ordering is unavailable.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                isOpen ? "bg-emerald-700" : "bg-stone-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                  isOpen ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {!isManager ? (
            <>
              {/* Prep minutes & minimum order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-stone-800">
                    Estimated Kitchen Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={prepMinutes}
                    onChange={(e) => setPrepMinutes(Number(e.target.value))}
                    className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900 font-mono"
                  />
                  <span className="text-[11px] text-stone-400">
                    Displayed to customers on QR menu.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-800">Minimum Order Amount ($)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={minOrderDollars}
                    onChange={(e) => setMinOrderDollars(e.target.value)}
                    className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900 font-mono"
                  />
                </div>
              </div>

              {/* Contact Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div className="space-y-1">
                  <label className="font-semibold text-stone-800">Table Order Contact Rule</label>
                  <select
                    value={tableContact}
                    onChange={(e) => setTableContact(e.target.value as "none" | "optional")}
                    className="w-full h-9 rounded-xl border border-stone-200 bg-white px-3 text-stone-900"
                  >
                    <option value="none">None (Completely anonymous ordering)</option>
                    <option value="optional">Optional (Guest may leave name/phone)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-800">Pickup Order Contact Rule</label>
                  <select
                    value={pickupContact}
                    onChange={(e) =>
                      setPickupContact(
                        e.target.value as "email_or_phone" | "email" | "phone"
                      )
                    }
                    className="w-full h-9 rounded-xl border border-stone-200 bg-white px-3 text-stone-900"
                  >
                    <option value="email_or_phone">Email or Phone number required</option>
                    <option value="email">Email required</option>
                    <option value="phone">Phone number required</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
              Manager role permission: You can toggle Store Open / Closed status above. General
              kitchen timings are managed by the restaurant owner.
            </div>
          )}

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Ordering Rules</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: PAYMENTS & TAX (OWNER ONLY) */}
      {activeTab === "payments" && isOwnerOrAdmin && (
        <form
          onSubmit={handleSavePayments}
          className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs max-w-2xl space-y-6 text-xs"
        >
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 space-y-1">
            <div className="font-semibold text-sm">Stripe Payments Integration</div>
            <p className="text-[11px] leading-relaxed">
              Online credit card processing and Apple Pay are managed securely through Stripe Connect
              by MyPlanetServices.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Payment Collection Mode</label>
            <select
              value={payMode}
              onChange={(e) => setPayMode(e.target.value as "counter" | "stripe")}
              className="w-full h-9 rounded-xl border border-stone-200 bg-white px-3 text-stone-900"
            >
              <option value="counter">Pay at Counter (Cash / POS Terminal after ordering)</option>
              <option value="stripe">Online Checkout (Stripe credit card required before ticket sent)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Sales Tax Rate (%)</label>
            <div className="relative w-48">
              <input
                type="number"
                step="0.01"
                min="0"
                max="30"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900 font-mono"
              />
              <span className="absolute right-3 top-2 text-stone-400 font-semibold">%</span>
            </div>
            <span className="text-[11px] text-stone-400">
              Computed automatically at checkout on subtotal.
            </span>
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Payment Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: TELEGRAM NOTIFICATIONS */}
      {activeTab === "notifications" && isOwnerOrAdmin && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs max-w-2xl space-y-5 text-xs">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-stone-900">Telegram Kitchen Bot Backup</h3>
            <p className="text-stone-500 text-[11px]">
              Optional kitchen backup channel. Tickets are automatically posted to your Telegram group
              chat in addition to the dedicated tablet display.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-stone-800">Enable Telegram Notifications</div>
              <div className="text-[11px] text-stone-400">
                Bot webhook status: {telegramEnabled ? "Connected & Active" : "Disabled"}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleTelegram}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                telegramEnabled ? "bg-emerald-700" : "bg-stone-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                  telegramEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER EMAILS (OWNER ONLY) */}
      {activeTab === "emails" && isOwnerOrAdmin && (
        <form
          onSubmit={handleSaveEmails}
          className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs max-w-2xl space-y-5 text-xs"
        >
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-stone-900">Automated Order Status Emails</h3>
            <p className="text-stone-500 text-[11px]">
              When kitchen staff clicks &quot;Ready&quot; on a pickup order, an automated email notification is
              dispatched to the customer.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Email Sender Name *</label>
            <input
              type="text"
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="e.g. Lone Star Tacos Kitchen"
              className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Reply-to Email Address *</label>
            <input
              type="email"
              required
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="orders@lonestartacos.com"
              className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-800">Pickup Ready Custom Message</label>
            <textarea
              rows={3}
              value={readyMessage}
              onChange={(e) => setReadyMessage(e.target.value)}
              placeholder="Your fresh taco order is hot and ready for pickup at our counter!"
              className="w-full rounded-xl border border-stone-200 p-3 text-stone-900"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Email Configuration</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
