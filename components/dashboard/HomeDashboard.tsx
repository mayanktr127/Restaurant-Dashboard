"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  WifiOff,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { PageHeader, StatCard, StatusBadge, SectionCard } from "@/components/ui-kit"
import { toggleStoreOpen } from "@/app/actions/store-status"
import { OrderRecord } from "@/app/actions/orders"
import { useCurrentTime } from "@/lib/hooks/useCurrentTime"
import { cn } from "@/lib/utils"

interface HomeDashboardProps {
  restaurantId: string
  restaurantName: string
  initialIsOpen: boolean
  orders: OrderRecord[]
  soldOutCount: number
  offlineDevicesCount: number
  userName: string
}

export function HomeDashboard({
  restaurantId,
  restaurantName,
  initialIsOpen,
  orders,
  soldOutCount,
  offlineDevicesCount,
  userName,
}: HomeDashboardProps) {
  const [isOpen, setIsOpen] = useState(initialIsOpen)
  const [togglingOpen, setTogglingOpen] = useState(false)

  // Calculate live statistics from orders
  const ordersTodayCount = orders.length
  const salesTodayCents = orders.reduce((sum, o) => sum + o.total_cents, 0)
  const salesTodayFormatted = `$${(salesTodayCents / 100).toFixed(2)}`
  const avgOrderCents = ordersTodayCount > 0 ? Math.round(salesTodayCents / ordersTodayCount) : 0
  const avgOrderFormatted = `$${(avgOrderCents / 100).toFixed(2)}`

  // Waiting now: orders in 'new' or 'cooking'
  const waitingOrders = orders.filter((o) => o.status === "new" || o.status === "cooking")
  const waitingNowCount = waitingOrders.length

  // Orders waiting > 20 minutes (computed client-side to prevent hydration mismatch)
  const now = useCurrentTime()

  const delayedOrders = now
    ? waitingOrders.filter((o) => {
        const elapsedMinutes = (now - new Date(o.created_at).getTime()) / (1000 * 60)
        return elapsedMinutes > 20
      })
    : []

  // 5 newest active orders
  const newestActiveOrders = orders
    .filter((o) => o.status !== "collected" && o.status !== "cancelled")
    .slice(0, 5)

  const handleToggleStore = async () => {
    setTogglingOpen(true)
    const nextState = !isOpen
    try {
      const res = await toggleStoreOpen(restaurantId, nextState)
      if (res.success) {
        setIsOpen(nextState)
      }
    } finally {
      setTogglingOpen(false)
    }
  }

  // Setup checklist items
  const checklist = [
    { title: "Restaurant Profile & Branding", done: true, href: "/app/settings" },
    { title: "Add Dishes to Menu", done: true, href: "/app/menu" },
    { title: "Generate Tables & QR Codes", done: true, href: "/app/tables" },
    { title: "Pair Kitchen Tablet Display", done: true, href: "/app/team" },
    { title: "Simulate a Test Order", done: false, href: "/app/orders" },
  ]
  const completedTasks = checklist.filter((i) => i.done).length

  return (
    <div className="space-y-8">
      {/* 1. Page Header with Open/Closed store switch */}
      <PageHeader
        title={`Good day, ${userName}`}
        description={`Live floor overview for ${restaurantName} · Orders, kitchen queue and real-time alerts.`}
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleStore}
              disabled={togglingOpen}
              className={cn(
                "inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border shadow-xs cursor-pointer select-none",
                isOpen
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/70"
              )}
            >
              {togglingOpen ? (
                <Loader2 className="w-3 h-3 animate-spin text-stone-500" />
              ) : (
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isOpen ? "bg-emerald-600 animate-pulse" : "bg-red-600"
                  )}
                />
              )}
              <span>{isOpen ? "Accepting Orders (Open)" : "Store Closed for Orders"}</span>
            </button>

            <Link
              href="/app/orders"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-800 text-white hover:bg-emerald-900 transition-colors shadow-xs"
            >
              <span>Live Kitchen Board</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {/* 2. Key Metrics - 4 Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Orders Today"
          value={ordersTodayCount}
          trend={{ value: "+14%", positive: true, label: "vs yesterday" }}
          icon={ShoppingBag}
        />
        <StatCard
          label="Sales Today"
          value={salesTodayFormatted}
          trend={{ value: "+8.5%", positive: true, label: "average" }}
          icon={DollarSign}
        />
        <StatCard
          label="Average Order"
          value={avgOrderFormatted}
          trend={{ value: "Healthy", positive: true, label: "basket size" }}
          icon={TrendingUp}
        />
        <StatCard
          label="Waiting Now in Kitchen"
          value={waitingNowCount}
          trend={
            waitingNowCount > 5
              ? { value: "High load", positive: false, label: "attention" }
              : { value: "Normal", positive: true, label: "flow" }
          }
          icon={Clock}
        />
      </section>

      {/* 3. Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 5 Newest Active Orders */}
        <div className="lg:col-span-8 space-y-6">
          <SectionCard
            title="Live Order Queue"
            description="5 newest active orders currently being prepared in the kitchen"
            actions={
              <Link
                href="/app/orders"
                className="text-xs font-medium text-emerald-800 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>View Live Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            {newestActiveOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                No active orders waiting in the queue right now.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {newestActiveOrders.map((order) => {
                  const elapsedMinutes = now
                    ? Math.floor((now - new Date(order.created_at).getTime()) / (1000 * 60))
                    : 0
                  const itemsSummary = order.items
                    .map((item) => `${item.qty}x ${item.name}`)
                    .join(", ")

                  return (
                    <div
                      key={order.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-stone-900">
                            {order.order_number}
                          </span>
                          <span className="text-stone-400">·</span>
                          <span className="font-medium text-stone-800">
                            {order.order_type === "table" ? order.table_label : `Pickup – ${order.customer_name || "Guest"}`}
                          </span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="text-stone-500 truncate max-w-md">{itemsSummary}</p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <span className="text-stone-400 text-[11px]">
                          {elapsedMinutes <= 1 ? "Just now" : `${elapsedMinutes} min ago`}
                        </span>
                        <span className="font-semibold text-stone-900">
                          ${(order.total_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Setup Checklist */}
          <SectionCard
            title="Launch & Setup Checklist"
            description="Complete onboarding steps before taking live customer payments"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">Onboarding Progress</span>
                  <span className="font-semibold text-emerald-800">
                    {completedTasks} of {checklist.length} completed
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-800 rounded-full transition-all duration-300"
                    style={{ width: `${(completedTasks / checklist.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {checklist.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-200/60"
                  >
                    <div className="flex items-center gap-3">
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-stone-300 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          item.done ? "text-stone-800" : "text-stone-600"
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                  </Link>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Operational Alerts */}
        <div className="lg:col-span-4 space-y-6">
          <SectionCard
            title="Needs Attention"
            description="Live operational alerts & bottlenecks"
          >
            <div className="space-y-3">
              {/* Alert 1: Sold-out items */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">
                    {soldOutCount} {soldOutCount === 1 ? "item" : "items"} marked Sold Out
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Sold-out dishes are automatically hidden from customer QR ordering.
                  </p>
                  <Link
                    href="/app/menu"
                    className="inline-block text-[11px] font-semibold text-amber-900 underline mt-1"
                  >
                    Manage menu availability →
                  </Link>
                </div>
              </div>

              {/* Alert 2: Orders delayed > 20m */}
              {delayedOrders.length > 0 ? (
                <div className="p-3 rounded-xl bg-red-50/80 border border-red-200/80 text-red-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {delayedOrders.length} {delayedOrders.length === 1 ? "order" : "orders"} waiting &gt; 20 min
                    </div>
                    <p className="text-[11px] text-red-800 leading-relaxed">
                      Orders exceeding prep target. Expedite in the kitchen board.
                    </p>
                    <Link
                      href="/app/orders"
                      className="inline-block text-[11px] font-semibold text-red-900 underline mt-1"
                    >
                      Open Live Orders →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Kitchen Flow on Time</div>
                    <p className="text-[11px] text-emerald-800">
                      All tickets are within the prep window.
                    </p>
                  </div>
                </div>
              )}

              {/* Alert 3: Kitchen Devices Status */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-stone-800 text-xs flex items-start gap-2.5">
                {offlineDevicesCount > 0 ? (
                  <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold">
                    {offlineDevicesCount > 0
                      ? `${offlineDevicesCount} kitchen display offline`
                      : "Kitchen Displays Online"}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {offlineDevicesCount > 0
                      ? "Device has not checked in for >5 minutes. Check tablet WiFi."
                      : "Expediter and cook tablets active and connected."}
                  </p>
                  <Link
                    href="/app/team"
                    className="inline-block text-[11px] font-semibold text-stone-700 underline mt-1"
                  >
                    View Devices & Pairing →
                  </Link>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Quick Shortcuts */}
          <SectionCard title="Quick Actions">
            <div className="space-y-2 text-xs">
              <Link
                href="/app/tables"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 text-stone-700 transition-colors"
              >
                <span>Print QR table tents (PDF)</span>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              </Link>
              <Link
                href="/app/menu"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 text-stone-700 transition-colors"
              >
                <span>Add new dish or drink</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              </Link>
              <Link
                href="/app/team"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 text-stone-700 transition-colors"
              >
                <span>Pair new kitchen tablet</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
