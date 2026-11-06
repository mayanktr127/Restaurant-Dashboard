import React from "react"
import { cn } from "@/lib/utils"

export type StatusType =
  | "new"
  | "cooking"
  | "ready"
  | "problem"
  | "collected"
  | "online"
  | "offline"

interface StatusDotProps {
  status: StatusType
  pulse?: boolean
  className?: string
  size?: "sm" | "md" | "lg"
}

export function StatusDot({
  status,
  pulse = false,
  className,
  size = "md",
}: StatusDotProps) {
  const colorMap: Record<StatusType, string> = {
    new: "bg-blue-600",
    cooking: "bg-amber-500",
    ready: "bg-emerald-600",
    problem: "bg-red-600",
    collected: "bg-stone-400",
    online: "bg-emerald-500",
    offline: "bg-stone-400",
  }

  const sizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  }

  return (
    <span className={cn("relative flex items-center justify-center shrink-0", className)}>
      {pulse && (
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            colorMap[status]
          )}
        />
      )}
      <span className={cn("relative inline-flex rounded-full", colorMap[status], sizeClasses[size])} />
    </span>
  )
}

