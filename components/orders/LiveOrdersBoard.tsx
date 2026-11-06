"use client"

import React, { useState, useEffect } from "react"
import {
  Volume2,
  VolumeX,
  Plus,
  RotateCcw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  X,
  Flame,
  Check,
} from "lucide-react"
import { PageHeader } from "@/components/ui-kit"
import { OrderRecord, updateOrderStatus, undoOrderStatus, createTestOrder } from "@/app/actions/orders"
import { createClient } from "@/lib/supabase/client"
import { useCurrentTime } from "@/lib/hooks/useCurrentTime"
import { cn } from "@/lib/utils"

interface LiveOrdersBoardProps {
  restaurantId: string
  initialOrders: {
    new: OrderRecord[]
    cooking: OrderRecord[]
    ready: OrderRecord[]
    collected: OrderRecord[]
  }
}

// Synthetic pleasant 2-tone bell chime via Web Audio API
function playOrderChime() {
  try {
    const AudioContextClass =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0.3, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    const t = ctx.currentTime
    playTone(587.33, t, 0.4) // D5
    playTone(880.0, t + 0.15, 0.6) // A5
  } catch (err) {
    console.warn("Audio playback not permitted yet:", err)
  }
}

export function LiveOrdersBoard({ restaurantId, initialOrders }: LiveOrdersBoardProps) {
  const [orders, setOrders] = useState(initialOrders)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orders_sound_enabled")
      return saved !== null ? saved === "true" : true
    }
    return true
  })
  const [activeToast, setActiveToast] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const currentTime = useCurrentTime()

  // Problem Dialog state
  const [problemOrderId, setProblemOrderId] = useState<string | null>(null)
  const [problemReason, setProblemReason] = useState("Item out of stock")
  const [problemCustomNote, setProblemCustomNote] = useState("")
  const [simulatingOrder, setSimulatingOrder] = useState(false)

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem("orders_sound_enabled", String(next))
    if (next) playOrderChime()
  }

  // Realtime subscription
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (supabaseUrl.includes("placeholder")) return

    try {
      const supabase = createClient()
      const channel = supabase
        .channel(`restaurant-orders-${restaurantId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const newOrder = payload.new as Record<string, unknown> & { order_number?: number }
              if (soundEnabled) playOrderChime()
              setActiveToast(`New Order ${newOrder.order_number ?? ""} received!`)
              setTimeout(() => setActiveToast(null), 4000)
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (err) {
      console.warn("Realtime channel subscription error:", err)
    }
  }, [restaurantId, soundEnabled])

  // Move order status
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: "cooking" | "ready" | "collected" | "problem" | "new",
    reason?: string
  ) => {
    setActionLoadingId(orderId)
    try {
      const res = await updateOrderStatus(restaurantId, orderId, newStatus, reason)
      if (res.success) {
        // Find order in current lists
        let found: OrderRecord | null = null
        const nextOrders = { ...orders }

        for (const col of ["new", "cooking", "ready", "collected"] as const) {
          const idx = nextOrders[col].findIndex((o) => o.id === orderId)
          if (idx !== -1) {
            found = { ...nextOrders[col][idx] }
            nextOrders[col].splice(idx, 1)
            break
          }
        }

        if (found) {
          found.status = newStatus
          if (reason) found.problem_reason = reason
          if (newStatus === "cooking") nextOrders.cooking.unshift(found)
          else if (newStatus === "ready") nextOrders.ready.unshift(found)
          else if (newStatus === "collected") nextOrders.collected.unshift(found)
          else nextOrders.new.unshift(found)

          setOrders({ ...nextOrders })
        }
      }
    } finally {
      setActionLoadingId(null)
      setProblemOrderId(null)
    }
  }

  // Undo order status
  const handleUndo = async (orderId: string) => {
    setActionLoadingId(orderId)
    try {
      const res = await undoOrderStatus(restaurantId, orderId)
      if (res.success) {
        // Move from collected -> ready or ready -> cooking
        const next = { ...orders }
        const colOrder = next.collected.find((o) => o.id === orderId)
        if (colOrder) {
          next.collected = next.collected.filter((o) => o.id !== orderId)
          colOrder.status = "ready"
          next.ready.unshift(colOrder)
          setOrders(next)
        }
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  // Simulate new order button (for verifying sound & realtime)
  const handleSimulateOrder = async () => {
    setSimulatingOrder(true)
    try {
      const res = await createTestOrder(restaurantId)
      if (res.success && res.order) {
        const next = { ...orders }
        next.new.unshift(res.order)
        setOrders(next)
        if (soundEnabled) playOrderChime()
        setActiveToast(`New Order ${res.order.order_number} simulated!`)
        setTimeout(() => setActiveToast(null), 4000)
      }
    } finally {
      setSimulatingOrder(false)
    }
  }

  // Helper: Elapsed timer badge color
  const getElapsedBadge = (createdAt: string) => {
    const elapsedMinutes = currentTime
      ? Math.floor((currentTime - new Date(createdAt).getTime()) / (1000 * 60))
      : 0
    if (elapsedMinutes < 10) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <Clock className="w-3 h-3" />
          {elapsedMinutes}m
        </span>
      )
    }
    if (elapsedMinutes <= 20) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Clock className="w-3 h-3" />
          {elapsedMinutes}m
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
        <Clock className="w-3 h-3" />
        {elapsedMinutes}m
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {activeToast && (
        <div className="fixed top-20 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-800 animate-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{activeToast}</span>
        </div>
      )}

      {/* Header with sound toggle & simulate order */}
      <PageHeader
        title="Live Orders Board"
        description="Real-time kitchen kanban board · Tickets advance from New to Ready and Collected."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleSound}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors shadow-xs cursor-pointer",
                soundEnabled
                  ? "bg-white border-stone-200 text-stone-800 hover:bg-stone-50"
                  : "bg-stone-100 border-stone-200 text-stone-400"
              )}
              title={soundEnabled ? "Mute order chimes" : "Enable order chimes"}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-800" />
                  <span>Sound On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-stone-400" />
                  <span>Muted</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSimulateOrder}
              disabled={simulatingOrder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
            >
              {simulatingOrder ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Simulate Order</span>
            </button>
          </div>
        }
      />

      {/* 4-Column Live Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {/* 1. COLUMN: NEW */}
        <div className="bg-stone-100/70 rounded-2xl p-3 border border-stone-200/80 space-y-3 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                New Tickets
              </h2>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              {orders.new.length}
            </span>
          </div>

          <div className="space-y-3">
            {orders.new.map((order) => {
              const isLoading = actionLoadingId === order.id
              return (
                <div
                  key={order.id}
                  className={cn(
                    "bg-white rounded-xl border p-3.5 shadow-xs space-y-3 transition-all",
                    order.status === "problem"
                      ? "border-red-300 bg-red-50/20"
                      : "border-stone-200/80 hover:border-stone-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-stone-900">
                        {order.order_number}
                      </div>
                      <div className="text-xs font-semibold text-stone-800">
                        {order.order_type === "table"
                          ? order.table_label
                          : `Pickup – ${order.customer_name || "Guest"}`}
                      </div>
                    </div>
                    {getElapsedBadge(order.created_at)}
                  </div>

                  {order.problem_reason && (
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{order.problem_reason}</span>
                    </div>
                  )}

                  {/* Order items */}
                  <div className="space-y-1 text-xs border-t border-stone-100 pt-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-stone-700">
                        <span className="font-medium">
                          {item.qty}× {item.name}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-amber-700 italic">
                            ({item.notes})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg font-medium">
                      Note: {order.notes}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                    <span className="font-bold text-stone-900">
                      ${(order.total_cents / 100).toFixed(2)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setProblemOrderId(order.id)}
                        className="px-2 py-1 text-[11px] text-stone-500 hover:text-red-700 rounded hover:bg-stone-100"
                      >
                        Problem
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleUpdateStatus(order.id, "cooking")}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-lg flex items-center gap-1 transition-colors"
                      >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3" />}
                        <span>Start</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. COLUMN: COOKING */}
        <div className="bg-stone-100/70 rounded-2xl p-3 border border-stone-200/80 space-y-3 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                Cooking
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              {orders.cooking.length}
            </span>
          </div>

          <div className="space-y-3">
            {orders.cooking.map((order) => {
              const isLoading = actionLoadingId === order.id
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-stone-200/80 p-3.5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-stone-900">
                        {order.order_number}
                      </div>
                      <div className="text-xs font-semibold text-stone-800">
                        {order.order_type === "table"
                          ? order.table_label
                          : `Pickup – ${order.customer_name || "Guest"}`}
                      </div>
                    </div>
                    {getElapsedBadge(order.created_at)}
                  </div>

                  <div className="space-y-1 text-xs border-t border-stone-100 pt-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-stone-700">
                        <span className="font-medium">
                          {item.qty}× {item.name}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-amber-700 italic">
                            ({item.notes})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                    <span className="font-bold text-stone-900">
                      ${(order.total_cents / 100).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleUpdateStatus(order.id, "ready")}
                      className="px-3 py-1 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg flex items-center gap-1 transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Ready</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. COLUMN: READY */}
        <div className="bg-stone-100/70 rounded-2xl p-3 border border-stone-200/80 space-y-3 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h2 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                Ready for Pickup
              </h2>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              {orders.ready.length}
            </span>
          </div>

          <div className="space-y-3">
            {orders.ready.map((order) => {
              const isLoading = actionLoadingId === order.id
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-stone-200/80 p-3.5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-stone-900">
                        {order.order_number}
                      </div>
                      <div className="text-xs font-semibold text-stone-800">
                        {order.order_type === "table"
                          ? order.table_label
                          : `Pickup – ${order.customer_name || "Guest"}`}
                      </div>
                    </div>
                    {getElapsedBadge(order.created_at)}
                  </div>

                  <div className="space-y-1 text-xs border-t border-stone-100 pt-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-stone-700">
                        <span className="font-medium">
                          {item.qty}× {item.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                    <span className="font-bold text-stone-900">
                      ${(order.total_cents / 100).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleUpdateStatus(order.id, "collected")}
                      className="px-3 py-1 text-xs font-semibold bg-stone-900 hover:bg-black text-white rounded-lg flex items-center gap-1 transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      <span>Collected</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. COLUMN: COLLECTED */}
        <div className="bg-stone-100/70 rounded-2xl p-3 border border-stone-200/80 space-y-3 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Collected (Today)
              </h2>
            </div>
            <span className="text-xs font-semibold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full">
              {orders.collected.length}
            </span>
          </div>

          <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
            {orders.collected.map((order) => {
              const isLoading = actionLoadingId === order.id
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-stone-200/70 p-3 shadow-xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-stone-800">
                      {order.order_number}
                    </span>
                    <span className="text-stone-400">
                      ${(order.total_cents / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-600 truncate">
                    {order.order_type === "table"
                      ? order.table_label
                      : `Pickup – ${order.customer_name || "Guest"}`}
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleUndo(order.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-900 font-medium px-2 py-0.5 rounded hover:bg-stone-100"
                      title="Undo status change (within 10 min)"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Problem Dialog */}
      {problemOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-semibold text-sm text-stone-900">Report Ticket Problem</h3>
              <button
                type="button"
                onClick={() => setProblemOrderId(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-stone-700">Reason</label>
                <select
                  value={problemReason}
                  onChange={(e) => setProblemReason(e.target.value)}
                  className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-stone-800"
                >
                  <option value="Item out of stock">Item out of stock</option>
                  <option value="Kitchen equipment issue">Kitchen equipment issue</option>
                  <option value="Customer requested cancellation">
                    Customer requested cancellation
                  </option>
                  <option value="Allergy conflict">Allergy conflict</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              {problemReason === "Other" && (
                <div className="space-y-1">
                  <label className="font-medium text-stone-700">Custom note</label>
                  <input
                    type="text"
                    value={problemCustomNote}
                    onChange={(e) => setProblemCustomNote(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full h-9 rounded-lg border border-stone-200 px-2.5"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProblemOrderId(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(
                    problemOrderId,
                    "problem",
                    problemReason === "Other" ? problemCustomNote : problemReason
                  )
                }
                className="px-3 py-1.5 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg"
              >
                Flag Problem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
