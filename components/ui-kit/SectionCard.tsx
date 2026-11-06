import React from "react"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title?: string
  description?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  description,
  badge,
  actions,
  children,
  footer,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-white border border-stone-200/80 shadow-xs dark:bg-stone-900/60 dark:border-stone-800 overflow-hidden",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4.5 border-b border-stone-100 dark:border-stone-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {title}
              </h2>
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      <div className={cn("p-6", contentClassName)}>{children}</div>

      {footer && (
        <div className="px-6 py-3.5 bg-stone-50/70 border-t border-stone-100 dark:bg-stone-900/80 dark:border-stone-800 text-xs text-stone-500">
          {footer}
        </div>
      )}
    </section>
  )
}

