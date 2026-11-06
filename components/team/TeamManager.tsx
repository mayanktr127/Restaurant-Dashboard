"use client"

import React, { useState, useEffect } from "react"
import {
  Tablet,
  Plus,
  Trash2,
  X,
  Loader2,
  Copy,
  Check,
  Clock,
} from "lucide-react"
import { PageHeader, SectionCard } from "@/components/ui-kit"
import {
  TeamData,
  TeamMember,
  KitchenDeviceItem,
  removeMember,
  updateRestaurantPermissions,
} from "@/app/actions/team"
import { createInvite } from "@/app/actions/invites"
import { createPairingCode, revokeDevice } from "@/app/actions/pairing"
import { useCurrentTime } from "@/lib/hooks/useCurrentTime"
import { cn } from "@/lib/utils"

interface TeamManagerProps {
  restaurantId: string
  restaurantName: string
  initialData: TeamData
}

export function TeamManager({
  restaurantId,
  restaurantName,
  initialData,
}: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialData.members)
  const [devices, setDevices] = useState<KitchenDeviceItem[]>(initialData.devices)
  const [permissions, setPermissions] = useState(initialData.permissions)

  // Invite Manager Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Pair Kitchen Device Modal
  const [pairingModalOpen, setPairingModalOpen] = useState(false)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [codeCountdown, setCodeCountdown] = useState(600) // 10 minutes in seconds
  const [generatingCode, setGeneratingCode] = useState(false)
  const currentTime = useCurrentTime()

  // Live Countdown for pairing code
  useEffect(() => {
    if (!pairingModalOpen || !pairingCode) return
    const timer = setInterval(() => {
      setCodeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [pairingModalOpen, pairingCode])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // 1. Send / Create Manager Invite
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const res = await createInvite(restaurantId, inviteEmail.trim(), "manager")
      if (res.success && res.inviteLink) {
        setGeneratedInviteLink(res.inviteLink)
      } else {
        alert(res.error || "Failed to create invite")
      }
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopyInvite = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  // 2. Remove Member
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this manager from the restaurant?")) return
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    await removeMember(restaurantId, memberId)
  }

  // 3. Generate 6-digit Tablet Pairing Code
  const handleOpenPairing = async () => {
    setPairingModalOpen(true)
    setGeneratingCode(true)
    setCodeCountdown(600)
    try {
      const res = await createPairingCode(restaurantId)
      if (res.success && res.code) {
        setPairingCode(res.code)
      } else {
        alert(res.error || "Failed to generate pairing code")
      }
    } finally {
      setGeneratingCode(false)
    }
  }

  // 4. Revoke Kitchen Device
  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm("Revoke this kitchen tablet? The tablet's session will terminate immediately."))
      return
    setDevices((prev) => prev.filter((d) => d.id !== deviceId))
    await revokeDevice(deviceId)
  }

  // 5. Toggle Permission Switches
  const handleTogglePermission = async (
    key: "kitchenCanSoldout" | "managerCanEditMenu",
    currentVal: boolean
  ) => {
    const nextVal = !currentVal
    const nextPermissions = { ...permissions, [key]: nextVal }
    setPermissions(nextPermissions)
    await updateRestaurantPermissions(restaurantId, {
      [key]: nextVal,
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team & Kitchen Devices"
        description="Invite restaurant managers, connect kitchen display tablets with 6-digit codes, and configure access permissions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): People & Devices */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: People / Managers */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/40 text-xs">
              <div>
                <h3 className="font-semibold text-stone-900 text-sm">Staff & Managers</h3>
                <p className="text-[11px] text-stone-400">
                  People with dashboard credentials for {restaurantName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGeneratedInviteLink(null)
                  setInviteEmail("")
                  setInviteModalOpen(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite Manager</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 text-xs">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 sm:px-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900 truncate">
                          {member.name}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            member.role === "owner"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}
                        >
                          {member.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 truncate">{member.email}</div>
                    </div>
                  </div>

                  {member.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-stone-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
                      title="Remove manager access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Kitchen Devices */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/40 text-xs">
              <div>
                <h3 className="font-semibold text-stone-900 text-sm">Kitchen Display Tablets</h3>
                <p className="text-[11px] text-stone-400">
                  Dedicated kitchen hardware paired via 6-digit one-time code
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenPairing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Tablet className="w-3.5 h-3.5 text-stone-500" />
                <span>Pair New Tablet</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 text-xs">
              {devices.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  No kitchen tablets paired yet. Click &quot;Pair New Tablet&quot; to connect your first
                  device.
                </div>
              ) : (
                devices.map((device) => {
                  return (
                    <div
                      key={device.id}
                      className="p-4 sm:px-5 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0 border border-stone-200">
                          <Tablet className="w-4.5 h-4.5" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-stone-900 truncate">
                              {device.name}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                device.status === "online"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : device.status === "idle"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-stone-100 text-stone-500 border-stone-200"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  device.status === "online"
                                    ? "bg-emerald-600 animate-pulse"
                                    : device.status === "idle"
                                    ? "bg-amber-600"
                                    : "bg-stone-400"
                                )}
                              />
                              {device.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400">
                            Last check-in:{" "}
                            {device.lastSeenAt && currentTime
                              ? `${Math.floor((currentTime - new Date(device.lastSeenAt).getTime()) / (1000 * 60))}m ago`
                              : "Never"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(device.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
                      >
                        Revoke Access
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Role Permissions Switches */}
        <div className="lg:col-span-4 space-y-6">
          <SectionCard
            title="Operational Permissions"
            description="Fine-grained capability switches for non-owner roles"
          >
            <div className="space-y-5 text-xs">
              {/* Switch 1: kitchen_can_soldout */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-stone-900">Kitchen Sold-Out Toggle</div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Allow line cooks to mark items sold out directly from the kitchen display.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleTogglePermission("kitchenCanSoldout", permissions.kitchenCanSoldout)
                  }
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5",
                    permissions.kitchenCanSoldout ? "bg-emerald-700" : "bg-stone-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                      permissions.kitchenCanSoldout ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              <div className="border-t border-stone-100" />

              {/* Switch 2: manager_can_edit_menu */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-stone-900">Manager Menu Editing</div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Allow managers to add new dishes, change prices, and reorder categories.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleTogglePermission("managerCanEditMenu", permissions.managerCanEditMenu)
                  }
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5",
                    permissions.managerCanEditMenu ? "bg-emerald-700" : "bg-stone-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                      permissions.managerCanEditMenu ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* INVITE MANAGER MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-semibold text-sm text-stone-900">Invite Restaurant Manager</h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!generatedInviteLink ? (
              <form onSubmit={handleCreateInvite} className="space-y-4 text-xs">
                <p className="text-stone-500">
                  Managers can oversee live orders, view tables, and manage day-to-day operations.
                  Sensitive billing and reports remain restricted to owners.
                </p>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Manager Email Address *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="manager@example.com"
                    className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-900"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg flex items-center gap-1.5"
                  >
                    {inviteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Generate Invitation</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Invitation Created (Valid for 7 days)</div>
                    <p className="text-[11px] text-emerald-800">
                      Share this secure link with the manager to accept and create their account.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="w-full h-9 rounded-xl border border-stone-200 px-3 text-stone-800 bg-stone-50 font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="px-3 h-9 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold bg-stone-900 text-white rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAIR KITCHEN DEVICE MODAL */}
      {pairingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm">
          <div className="bg-[#151B23] text-white rounded-3xl max-w-sm w-full p-6 text-center space-y-5 border border-[#232B36] shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#1C2430] border border-[#2B3544] flex items-center justify-center mx-auto text-emerald-400">
              <Tablet className="w-6 h-6 stroke-[1.8]" />
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-white">Connect Kitchen Tablet</h3>
              <p className="text-xs text-stone-400">
                Open <span className="font-mono text-emerald-400 font-medium">kitchen.myplanetservices.com/kitchen/pair</span> on the tablet.
              </p>
            </div>

            {generatingCode ? (
              <div className="py-8 flex flex-col items-center gap-2 text-stone-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Generating secure pairing code...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 6 Large Digits */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {(pairingCode || "000000").split("").map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-14 sm:w-12 sm:h-16 rounded-xl bg-[#1C2430] border border-emerald-500/80 text-emerald-400 flex items-center justify-center text-2xl font-bold font-mono shadow-md"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Expires in <strong className="text-amber-400 font-mono">{formatCountdown(codeCountdown)}</strong>
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPairingModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#1C2430] hover:bg-[#253040] text-stone-300 text-xs font-semibold border border-[#2B3544] transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
