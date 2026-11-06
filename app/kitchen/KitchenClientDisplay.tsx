"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  Clock,
  Volume2,
  VolumeX,
  User,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  X,
  Loader2,
  Flame,
  Check,
  AlertCircle,
  Tablet,
} from "lucide-react"
import {
  KitchenInitData,
  KitchenTicket,
  KitchenSoldOutItem,
  updateTicketStatus,
  undoKitchenAction,
  verifyStaffPin,
  getKitchenSoldOutList,
  toggleKitchenSoldOut,
  kitchenDeviceHeartbeat,
} from "@/app/actions/kitchen"
import { createClient } from "@/lib/supabase/client"
import { useCurrentTime } from "@/lib/hooks/useCurrentTime"
import { cn } from "@/lib/utils"

interface RecentAction {
  id: string
  orderId: string
  orderNumber: string
  description: string
  timestamp: string
  canUndo: boolean
}

// Audio synthesizer for loud kitchen chime
function playKitchenChime() {
  try {
    const AudioContextClass =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const playBeep = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0.7, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    const t = ctx.currentTime
    // Dual high-penetration bell chime for loud kitchens
    playBeep(659.25, t, 0.35) // E5
    playBeep(987.77, t + 0.18, 0.55) // B5
  } catch (err) {
    console.warn("Audio playback not allowed yet:", err)
  }
}

export default function KitchenClientDisplay({ initialData }: { initialData: KitchenInitData }) {
  const { restaurantId, restaurantName, kitchenCanSoldout, hasActivePins } = initialData

  const [tickets, setTickets] = useState<KitchenTicket[]>(initialData.tickets)
  const [deviceRevoked, setDeviceRevoked] = useState(initialData.isRevoked)
  const [activeCook, setActiveCook] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(`kitchen_cook_${restaurantId}`) || ""
    }
    return ""
  })
  const [pinModalOpen, setPinModalOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`kitchen_cook_${restaurantId}`)
      return !saved && hasActivePins
    }
    return hasActivePins
  })
  const [pinDigits, setPinDigits] = useState<string>("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)

  // Realtime & Connectivity
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== "undefined") {
      return navigator.onLine
    }
    return true
  })
  const [realtimeConnected, setRealtimeConnected] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    return supabaseUrl.includes("placeholder")
  })
  const [soundUnlocked, setSoundUnlocked] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [flashingTicketIds, setFlashingTicketIds] = useState<Set<string>>(new Set())

  // Modals & Drawers
  const [soldOutOpen, setSoldOutOpen] = useState(false)
  const [soldOutList, setSoldOutList] = useState<KitchenSoldOutItem[]>([])
  const [soldOutLoading, setSoldOutLoading] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentActions, setRecentActions] = useState<RecentAction[]>([])

  // Problem Dialog
  const [problemTicket, setProblemTicket] = useState<KitchenTicket | null>(null)
  const [problemReasonPreset, setProblemReasonPreset] = useState("Out of stock")
  const [problemCustomNote, setProblemCustomNote] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Live Clock
  const [clockString, setClockString] = useState("")
  const currentTime = useCurrentTime()

  // 1. Live Clock update every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setClockString(
        now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // 3. Keep Screen Awake using Wake Lock API
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen")
        }
      } catch (err) {
        console.warn("Wake Lock not supported or rejected:", err)
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (wakeLock) {
        wakeLock.release().catch(() => {})
      }
    }
  }, [])

  // 4. 60-Second Heartbeat to update last_seen_at and check revocation
  useEffect(() => {
    const heartbeat = async () => {
      const res = await kitchenDeviceHeartbeat(restaurantId)
      if (res.revoked) {
        setDeviceRevoked(true)
      }
    }

    const interval = setInterval(heartbeat, 60000)
    return () => clearInterval(interval)
  }, [restaurantId])

  // 5. Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // 6. Supabase Realtime Subscription on kitchen_tickets
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (supabaseUrl.includes("placeholder")) {
      return
    }

    try {
      const supabase = createClient()
      const channel = supabase
        .channel(`kitchen-tickets-${restaurantId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kitchen_tickets",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const newTicket = payload.new as KitchenTicket
              setTickets((prev) => {
                if (prev.some((t) => t.order_id === newTicket.order_id)) return prev
                return [...prev, newTicket]
              })

              // Audio notification
              if (soundEnabled) {
                playKitchenChime()
              }

              // Flash newly arrived card for 3 seconds
              setFlashingTicketIds((prev) => new Set(prev).add(newTicket.order_id))
              setTimeout(() => {
                setFlashingTicketIds((prev) => {
                  const next = new Set(prev)
                  next.delete(newTicket.order_id)
                  return next
                })
              }, 3000)
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new as KitchenTicket
              setTickets((prev) => {
                if (updated.status === "collected" || updated.status === "cancelled") {
                  return prev.filter((t) => t.order_id !== updated.order_id)
                }
                const idx = prev.findIndex((t) => t.order_id === updated.order_id)
                if (idx === -1) {
                  return [...prev, updated]
                }
                const next = [...prev]
                next[idx] = updated
                return next
              })
            } else if (payload.eventType === "DELETE") {
              const old = payload.old as { order_id: string }
              if (old?.order_id) {
                setTickets((prev) => prev.filter((t) => t.order_id !== old.order_id))
              }
            }
          }
        )
        .subscribe((status) => {
          setRealtimeConnected(status === "SUBSCRIBED")
        })

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (err) {
      console.warn("Realtime kitchen channel error:", err)
    }
  }, [restaurantId, soundEnabled])

  // Unlock Audio
  const handleUnlockSound = () => {
    setSoundUnlocked(true)
    playKitchenChime()
  }

  // 7. PIN Entry & Cook Verification
  const handlePinDigit = (digit: string) => {
    setPinError(null)
    if (pinDigits.length < 4) {
      const next = pinDigits + digit
      setPinDigits(next)
      if (next.length === 4) {
        submitPin(next)
      }
    }
  }

  const handlePinDelete = () => {
    setPinError(null)
    setPinDigits((prev) => prev.slice(0, -1))
  }

  const handlePinClear = () => {
    setPinError(null)
    setPinDigits("")
  }

  const submitPin = async (pinValue: string) => {
    setPinLoading(true)
    try {
      const res = await verifyStaffPin({ restaurantId, pin: pinValue })
      if (res.success && res.staffName) {
        setActiveCook(res.staffName)
        sessionStorage.setItem(`kitchen_cook_${restaurantId}`, res.staffName)
        setPinModalOpen(false)
        setPinDigits("")
      } else {
        setPinError(res.error || "Incorrect 4-digit PIN")
        setPinDigits("")
      }
    } finally {
      setPinLoading(false)
    }
  }

  const handleSkipPin = () => {
    if (!hasActivePins) {
      setActiveCook("Kitchen Cook")
      sessionStorage.setItem(`kitchen_cook_${restaurantId}`, "Kitchen Cook")
      setPinModalOpen(false)
    }
  }

  // 8. Ticket Status Advancement Actions
  const handleAdvanceStatus = async (
    ticket: KitchenTicket,
    newStatus: "cooking" | "ready" | "collected",
    reason?: string
  ) => {
    setActionLoadingId(ticket.order_id)
    try {
      const res = await updateTicketStatus({
        restaurantId,
        orderId: ticket.order_id,
        newStatus,
        reason,
        staffName: activeCook || "Kitchen Cook",
      })

      if (res.success) {
        // Optimistic UI update
        if (newStatus === "collected") {
          setTickets((prev) => prev.filter((t) => t.order_id !== ticket.order_id))
        } else {
          setTickets((prev) =>
            prev.map((t) => (t.order_id === ticket.order_id ? { ...t, status: newStatus } : t))
          )
        }

        // Record for Recent Actions & Undo
        const desc =
          newStatus === "cooking"
            ? `Started #${ticket.order_number}`
            : newStatus === "ready"
            ? `Marked #${ticket.order_number} Ready`
            : `Collected #${ticket.order_number}`

        setRecentActions((prev) => [
          {
            id: crypto.randomUUID(),
            orderId: ticket.order_id,
            orderNumber: ticket.order_number,
            description: desc,
            timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            canUndo: true,
          },
          ...prev.slice(0, 9),
        ])
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  // 9. Problem Report Action
  const handleConfirmProblem = async () => {
    if (!problemTicket) return
    const reasonText = problemCustomNote.trim()
      ? `${problemReasonPreset}: ${problemCustomNote.trim()}`
      : problemReasonPreset

    setActionLoadingId(problemTicket.order_id)
    try {
      const res = await updateTicketStatus({
        restaurantId,
        orderId: problemTicket.order_id,
        newStatus: "problem",
        reason: reasonText,
        staffName: activeCook || "Kitchen Cook",
      })

      if (res.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.order_id === problemTicket.order_id
              ? { ...t, status: "problem", problem_reason: reasonText }
              : t
          )
        )

        setRecentActions((prev) => [
          {
            id: crypto.randomUUID(),
            orderId: problemTicket.order_id,
            orderNumber: problemTicket.order_number,
            description: `Reported issue on #${problemTicket.order_number} (${problemReasonPreset})`,
            timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            canUndo: true,
          },
          ...prev.slice(0, 9),
        ])

        setProblemTicket(null)
        setProblemCustomNote("")
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  // 10. Undo Action
  const handleUndoRecent = async (action: RecentAction) => {
    try {
      const res = await undoKitchenAction({
        restaurantId,
        orderId: action.orderId,
        staffName: activeCook || "Kitchen Cook",
      })

      if (res.success) {
        setRecentActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, canUndo: false } : a))
        )
      }
    } catch (err) {
      console.error("Undo failed:", err)
    }
  }

  // 11. Sold-Out Panel Data Load
  const handleOpenSoldOut = async () => {
    setSoldOutOpen(true)
    setSoldOutLoading(true)
    try {
      const items = await getKitchenSoldOutList(restaurantId)
      setSoldOutList(items)
    } catch (err) {
      console.error("Failed to load sold out items:", err)
    } finally {
      setSoldOutLoading(false)
    }
  }

  const handleToggleSoldOutItem = async (item: KitchenSoldOutItem) => {
    const nextVal = !item.available
    setSoldOutList((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, available: nextVal } : i))
    )

    try {
      await toggleKitchenSoldOut({
        restaurantId,
        menuItemId: item.id,
        available: nextVal,
        staffName: activeCook,
      })
    } catch (err) {
      console.error("Toggle item availability error:", err)
      // Revert on error
      setSoldOutList((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, available: !nextVal } : i))
      )
    }
  }

  // Group columns (Oldest first)
  const newTickets = useMemo(
    () => tickets.filter((t) => t.status === "new" || t.status === "problem"),
    [tickets]
  )
  const cookingTickets = useMemo(() => tickets.filter((t) => t.status === "cooking"), [tickets])
  const readyTickets = useMemo(() => tickets.filter((t) => t.status === "ready"), [tickets])

  // Helper: Elapsed minutes & badge color
  const getElapsedBadge = (createdAt: string) => {
    const elapsedMinutes = currentTime
      ? Math.max(0, Math.floor((currentTime - new Date(createdAt).getTime()) / (1000 * 60)))
      : 0

    if (elapsedMinutes < 10) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
          <Clock className="w-3.5 h-3.5" />
          {elapsedMinutes}m
        </span>
      )
    }
    if (elapsedMinutes <= 20) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-amber-950/80 text-amber-400 border border-amber-700/60">
          <Clock className="w-3.5 h-3.5" />
          {elapsedMinutes}m
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-red-950 text-red-300 border border-red-600 animate-pulse">
        <Clock className="w-3.5 h-3.5" />
        {elapsedMinutes}m (DELAY)
      </span>
    )
  }

  // Ticket Card Renderer Helper
  const renderTicketCard = (ticket: KitchenTicket, column: "new" | "cooking" | "ready") => {
    const isFlashing = flashingTicketIds.has(ticket.order_id)
    const destination =
      ticket.order_type === "table"
        ? ticket.table_label || "Dine-in"
        : `Pickup – ${ticket.customer_first_name || "Guest"}`

    const elapsedMinutes = currentTime
      ? Math.max(0, Math.floor((currentTime - new Date(ticket.created_at).getTime()) / (1000 * 60)))
      : 0
    const isVeryLate = elapsedMinutes > 20
    const isLoading = actionLoadingId === ticket.order_id

    return (
      <div
        key={ticket.order_id}
        className={cn(
          "bg-[#151B23] border border-[#232B36] rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-300",
          isFlashing && "ring-4 ring-amber-400 ring-offset-4 ring-offset-[#0B0F14] bg-amber-950/30",
          isVeryLate && !isFlashing && "border-red-800 shadow-red-950/40 animate-pulse"
        )}
      >
        <div className="space-y-4">
          {/* Header: Destination & Order Number */}
          <div className="flex items-start justify-between gap-3 border-b border-[#232B36] pb-3.5">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-none">
                {destination}
              </h2>
              <div className="text-xs font-mono font-semibold text-stone-400 mt-1.5">
                Order #{ticket.order_number}
              </div>
            </div>

            <div className="shrink-0">{getElapsedBadge(ticket.created_at)}</div>
          </div>

          {/* Items List (Huge readable font: 22-24px) */}
          <div className="space-y-2.5 py-1">
            {ticket.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-stone-100 flex items-start gap-2">
                  <span className="font-mono text-emerald-400 shrink-0">{item.qty}×</span>
                  <span>{item.name}</span>
                </div>
                {item.notes && (
                  <div className="text-sm font-medium text-amber-300/90 pl-7 italic">
                    ↳ {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Order Notes (highlighted in red) */}
          {ticket.notes && (
            <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-xl text-red-300 text-sm font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>NOTE: {ticket.notes}</span>
            </div>
          )}

          {/* Problem Bottleneck Badge (if reported) */}
          {ticket.status === "problem" && ticket.problem_reason && (
            <div className="p-2.5 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Issue: {ticket.problem_reason}</span>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS (At least 64px tall!) */}
        <div className="mt-5 pt-3.5 border-t border-[#232B36] flex items-center gap-3">
          {column === "new" && (
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleAdvanceStatus(ticket, "cooking")}
                className="flex-1 h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-lg sm:text-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Flame className="w-6 h-6" />
                    <span>Start Cooking</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setProblemTicket(ticket)}
                className="h-16 px-4 rounded-2xl bg-[#232B36] hover:bg-[#2d3744] text-stone-300 hover:text-white font-semibold text-sm transition-colors border border-stone-700 flex flex-col items-center justify-center cursor-pointer"
              >
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] mt-0.5">Problem</span>
              </button>
            </>
          )}

          {column === "cooking" && (
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleAdvanceStatus(ticket, "ready")}
                className="flex-1 h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-lg sm:text-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>Mark Ready</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setProblemTicket(ticket)}
                className="h-16 px-4 rounded-2xl bg-[#232B36] hover:bg-[#2d3744] text-stone-300 hover:text-white font-semibold text-sm transition-colors border border-stone-700 flex flex-col items-center justify-center cursor-pointer"
              >
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] mt-0.5">Problem</span>
              </button>
            </>
          )}

          {column === "ready" && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAdvanceStatus(ticket, "collected")}
              className="w-full h-16 rounded-2xl bg-stone-700 hover:bg-stone-600 active:scale-[0.98] text-stone-100 font-bold text-lg sm:text-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  <span>Collected (Clear)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  // If tablet was revoked by owner
  if (deviceRevoked) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-[#F3F4F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#151B23] border border-[#232B36] rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/70 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Device Disconnected</h1>
            <p className="text-sm text-stone-400 leading-relaxed">
              This device was disconnected or revoked by the restaurant owner. Ask the owner for a
              new pairing code to reconnect this tablet.
            </p>
          </div>
          <Link
            href="/kitchen/pair"
            className="inline-flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-base transition-colors shadow-lg"
          >
            <Tablet className="w-5 h-5" />
            <span>Enter New Pairing Code</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#F3F4F6] flex flex-col font-sans select-none antialiased">
      {/* Autoplay sound banner (shows until unlocked) */}
      {!soundUnlocked && (
        <div
          onClick={handleUnlockSound}
          className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2.5 text-center text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md z-50 shrink-0"
        >
          <Volume2 className="w-4 h-4 animate-bounce" />
          <span>Tap here to enable sound for incoming orders</span>
        </div>
      )}

      {/* 1. TOP STRIP */}
      <header className="h-18 px-4 sm:px-6 bg-[#151B23] border-b border-[#232B36] flex items-center justify-between shrink-0 shadow-sm z-30">
        {/* Left: Restaurant name & connection status */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              {restaurantName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  isOnline && realtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                )}
              />
              <span className="text-xs text-stone-400 font-medium">
                {isOnline && realtimeConnected ? "Connected" : "Reconnecting..."}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Large Clock */}
        <div className="text-xl sm:text-2xl font-mono font-bold tracking-wider text-stone-200">
          {clockString}
        </div>

        {/* Right: Cook pill & controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active Cook Pill */}
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#232B36] hover:bg-[#2d3744] border border-stone-700 text-xs font-semibold text-stone-200 transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate max-w-[120px]">{activeCook || "Select Cook"}</span>
            <span className="text-[10px] text-stone-400 underline ml-0.5">Change</span>
          </button>

          {/* Sold-out Panel Button (Only if allowed) */}
          {kitchenCanSoldout && (
            <button
              type="button"
              onClick={handleOpenSoldOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232B36] hover:bg-[#2d3744] border border-stone-700 text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
            >
              <span>Sold out items</span>
            </button>
          )}

          {/* Recent Actions & Undo */}
          <button
            type="button"
            onClick={() => setRecentOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232B36] hover:bg-[#2d3744] border border-stone-700 text-xs font-semibold text-stone-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recent</span>
            {recentActions.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-stone-700 text-[10px] flex items-center justify-center font-bold">
                {recentActions.length}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              if (!soundUnlocked) handleUnlockSound()
            }}
            className="w-9 h-9 rounded-xl bg-[#232B36] hover:bg-[#2d3744] flex items-center justify-center text-stone-300 border border-stone-700 cursor-pointer transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>
        </div>
      </header>

      {/* 2. THREE-COLUMN KITCHEN BOARD */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-full">
          {/* COLUMN 1: NEW */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-950/40 border border-blue-900/60 text-blue-300">
              <div className="flex items-center gap-2.5 font-bold tracking-tight text-base sm:text-lg">
                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span>NEW</span>
              </div>
              <span className="text-sm font-mono font-bold bg-blue-900/60 px-2.5 py-0.5 rounded-full border border-blue-700/60">
                {newTickets.length}
              </span>
            </div>

            <div className="space-y-4">
              {newTickets.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-600 border border-dashed border-[#232B36] rounded-2xl">
                  No new orders waiting
                </div>
              ) : (
                newTickets.map((ticket) => renderTicketCard(ticket, "new"))
              )}
            </div>
          </div>

          {/* COLUMN 2: COOKING */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-950/40 border border-amber-900/60 text-amber-300">
              <div className="flex items-center gap-2.5 font-bold tracking-tight text-base sm:text-lg">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>COOKING</span>
              </div>
              <span className="text-sm font-mono font-bold bg-amber-900/60 px-2.5 py-0.5 rounded-full border border-amber-700/60">
                {cookingTickets.length}
              </span>
            </div>

            <div className="space-y-4">
              {cookingTickets.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-600 border border-dashed border-[#232B36] rounded-2xl">
                  No orders currently cooking
                </div>
              ) : (
                cookingTickets.map((ticket) => renderTicketCard(ticket, "cooking"))
              )}
            </div>
          </div>

          {/* COLUMN 3: READY */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-300">
              <div className="flex items-center gap-2.5 font-bold tracking-tight text-base sm:text-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>READY</span>
              </div>
              <span className="text-sm font-mono font-bold bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-700/60">
                {readyTickets.length}
              </span>
            </div>

            <div className="space-y-4">
              {readyTickets.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-600 border border-dashed border-[#232B36] rounded-2xl">
                  No orders waiting for pickup
                </div>
              ) : (
                readyTickets.map((ticket) => renderTicketCard(ticket, "ready"))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 4. PROBLEM DIALOG MODAL */}
      {problemTicket && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-[#232B36] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span>Report Ticket Issue</span>
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Order #{problemTicket.order_number} ({problemTicket.order_type === "table" ? problemTicket.table_label : problemTicket.customer_first_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProblemTicket(null)}
                className="w-9 h-9 rounded-xl bg-[#232B36] hover:bg-[#2d3744] flex items-center justify-center text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Option Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "Out of stock",
                "Kitchen bottleneck",
                "Modification question",
                "Allergy check required",
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setProblemReasonPreset(reason)}
                  className={cn(
                    "h-14 rounded-xl border text-sm font-bold transition-all px-4 flex items-center justify-start cursor-pointer",
                    problemReasonPreset === reason
                      ? "bg-amber-950/80 border-amber-500 text-amber-300"
                      : "bg-[#232B36] border-stone-700 text-stone-300 hover:bg-[#2d3744]"
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-400">Additional details (optional)</label>
              <input
                type="text"
                value={problemCustomNote}
                onChange={(e) => setProblemCustomNote(e.target.value)}
                placeholder="e.g. 86'd brisket, need customer sub"
                className="w-full h-12 bg-[#0B0F14] border border-[#232B36] rounded-xl px-4 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProblemTicket(null)}
                className="flex-1 h-14 rounded-xl bg-[#232B36] hover:bg-[#2d3744] text-stone-300 font-bold text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmProblem}
                className="flex-1 h-14 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Save Problem Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. RECENT ACTIONS DRAWER & UNDO */}
      {recentOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-[#151B23] border-l border-[#232B36] w-full max-w-md h-full flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#232B36]">
              <div className="flex items-center gap-2 text-base font-bold text-white">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                <span>Recent Actions (Undo)</span>
              </div>
              <button
                type="button"
                onClick={() => setRecentOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#232B36] hover:bg-[#2d3744] flex items-center justify-center text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {recentActions.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  No actions taken on this tablet yet
                </div>
              ) : (
                recentActions.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl bg-[#0B0F14] border border-[#232B36] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-stone-200">{act.description}</div>
                      <div className="text-[11px] text-stone-500">{act.timestamp}</div>
                    </div>

                    {act.canUndo ? (
                      <button
                        type="button"
                        onClick={() => handleUndoRecent(act)}
                        className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Undo</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-600 font-medium">Reverted</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. SOLD-OUT PANEL SHEET */}
      {soldOutOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-[#151B23] border-l border-[#232B36] w-full max-w-lg h-full flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#232B36]">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Sold Out Items Panel</span>
                </h3>
                <p className="text-xs text-stone-400">
                  Toggle dishes that have run out in the kitchen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSoldOutOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#232B36] hover:bg-[#2d3744] flex items-center justify-center text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
              {soldOutLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
              ) : soldOutList.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  No menu items found
                </div>
              ) : (
                soldOutList.map((item) => (
                  <div
                    key={item.id}
                    className="h-16 px-4 rounded-xl bg-[#0B0F14] border border-[#232B36] flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-sm text-stone-100">{item.name}</div>
                      {item.category_name && (
                        <div className="text-[11px] text-stone-500">{item.category_name}</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleSoldOutItem(item)}
                      className={cn(
                        "h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer",
                        item.available
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700"
                          : "bg-red-950/80 text-red-300 border border-red-700"
                      )}
                    >
                      {item.available ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Available</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          <span>Sold Out (86)</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. STAFF PIN KEYPAD MODAL */}
      {pinModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#151B23] border border-[#232B36] rounded-3xl max-w-sm w-full p-6 sm:p-8 space-y-6 shadow-2xl text-center">
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-white tracking-tight">Enter Cook PIN</h3>
              <p className="text-xs text-stone-400">
                Enter your 4-digit PIN to identify kitchen shift actions
              </p>
            </div>

            {/* 4-digit visual boxes */}
            <div className="flex justify-center gap-3.5 my-4">
              {[0, 1, 2, 3].map((i) => {
                const filled = pinDigits.length > i
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-12 h-14 rounded-xl border flex items-center justify-center text-2xl font-bold font-mono transition-all",
                      filled
                        ? "bg-emerald-950/50 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/30"
                        : "bg-[#0B0F14] border-stone-800 text-stone-600"
                    )}
                  >
                    {filled ? "•" : ""}
                  </div>
                )
              })}
            </div>

            {pinError && <div className="text-xs font-semibold text-red-400">{pinError}</div>}

            {/* On-screen Numeric Keypad (Buttons at least 72px) */}
            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handlePinDigit(String(num))}
                  className="h-16 sm:h-18 rounded-2xl bg-[#0B0F14] hover:bg-[#232B36] active:scale-95 border border-stone-800 text-xl font-bold text-white transition-all cursor-pointer flex items-center justify-center"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handlePinClear}
                className="h-16 sm:h-18 rounded-2xl bg-[#0B0F14] hover:bg-[#232B36] border border-stone-800 text-xs font-semibold text-stone-400 flex items-center justify-center cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                disabled={pinLoading}
                onClick={() => handlePinDigit("0")}
                className="h-16 sm:h-18 rounded-2xl bg-[#0B0F14] hover:bg-[#232B36] active:scale-95 border border-stone-800 text-xl font-bold text-white transition-all cursor-pointer flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={handlePinDelete}
                className="h-16 sm:h-18 rounded-2xl bg-[#0B0F14] hover:bg-[#232B36] border border-stone-800 text-xs font-semibold text-stone-400 flex items-center justify-center cursor-pointer"
              >
                ⌫
              </button>
            </div>

            {!hasActivePins && (
              <button
                type="button"
                onClick={handleSkipPin}
                className="text-xs font-semibold text-stone-500 hover:text-stone-300 underline cursor-pointer pt-2"
              >
                Skip PIN (No PINs configured)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
