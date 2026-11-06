import React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  trend?: {
    value: string
    positive?: boolean
    label?: string
  }
  icon?: LucideIcon
  className?: string
  sample?: boolean
}

export function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  className,
  sample = true,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs dark:bg-stone-900/60 dark:border-stone-800 transition-all hover:border-stone-300 dark:hover:border-stone-700",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
          {label}
        </span>
        {Icon && (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 tabular-nums">
          {value}
        </div>
      </div>

      {(trend || sample) && (
        <div className="mt-2.5 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          {trend ? (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "font-medium",
                  trend.positive
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {trend.positive ? "+" : ""}
                {trend.value}
              </span>
              {trend.label && <span>{trend.label}</span>}
            </div>
          ) : (
            <span />
          )}

          {sample && (
            <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              Sample
            </span>
          )}
        </div>
      )}
    </div>
  )
}

