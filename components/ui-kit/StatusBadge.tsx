import React from "react"
import { cn } from "@/lib/utils"
import { StatusDot, type StatusType } from "./StatusDot"

export interface StatusBadgeProps {
  status: "new" | "cooking" | "ready" | "problem" | "collected" | "cancelled" | "active" | "trial" | "paused" | "setting_up"
  label?: string
  withDot?: boolean
  className?: string
  size?: "sm" | "md"
}

export function StatusBadge({
  status,
  label,
  withDot = true,
  className,
  size = "md",
}: StatusBadgeProps) {
  const styles: Record<string, { bg: string; text: string; border: string; dot: StatusType; defaultLabel: string }> = {
    new: {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800/60",
      dot: "new",
      defaultLabel: "New",
    },
    cooking: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800/60",
      dot: "cooking",
      defaultLabel: "Cooking",
    },
    ready: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-800 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800/60",
      dot: "ready",
      defaultLabel: "Ready",
    },
    problem: {
      bg: "bg-red-50 dark:bg-red-950/40",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-200 dark:border-red-800/60",
      dot: "problem",
      defaultLabel: "Problem",
    },
    collected: {
      bg: "bg-stone-100 dark:bg-stone-800/60",
      text: "text-stone-700 dark:text-stone-300",
      border: "border-stone-200 dark:border-stone-700",
      dot: "collected",
      defaultLabel: "Collected",
    },
    cancelled: {
      bg: "bg-stone-100 dark:bg-stone-800/60",
      text: "text-stone-500 dark:text-stone-400",
      border: "border-stone-200 dark:border-stone-700",
      dot: "offline",
      defaultLabel: "Cancelled",
    },
    active: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-800 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800/60",
      dot: "ready",
      defaultLabel: "Active",
    },
    trial: {
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800/60",
      dot: "cooking",
      defaultLabel: "Trial",
    },
    paused: {
      bg: "bg-stone-100 dark:bg-stone-800/60",
      text: "text-stone-600 dark:text-stone-300",
      border: "border-stone-200 dark:border-stone-700",
      dot: "offline",
      defaultLabel: "Paused",
    },
    setting_up: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800/60",
      dot: "cooking",
      defaultLabel: "Setting up",
    },
  }

  const current = styles[status] || styles.collected
  const displayText = label || current.defaultLabel

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium select-none tracking-tight",
        current.bg,
        current.text,
        current.border,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {withDot && <StatusDot status={current.dot} size="sm" />}
      <span>{displayText}</span>
    </span>
  )
}

