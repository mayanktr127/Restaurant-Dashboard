import React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
  sampleNotice?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  sampleNotice = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-stone-200 bg-white/50 dark:bg-stone-900/40 dark:border-stone-800",
        className
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 mb-4 shadow-2xs">
        <Icon className="w-6 h-6 stroke-[1.8]" />
      </div>

      <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
        {title}
      </h3>

      <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400 max-w-sm">
        {description}
      </p>

      {sampleNotice && (
        <span className="mt-3 text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200/80">
          Placeholder Shell
        </span>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

