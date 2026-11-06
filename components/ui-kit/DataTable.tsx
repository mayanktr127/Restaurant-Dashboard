import React from "react"
import { cn } from "@/lib/utils"
import { TableSkeleton } from "./LoadingSkeletons"
import { EmptyState } from "./EmptyState"
import { Inbox } from "lucide-react"

interface DataTableProps {
  title?: string
  description?: string
  toolbar?: React.ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  children: React.ReactNode
  className?: string
  columnsCount?: number
}

export function DataTable({
  title,
  description,
  toolbar,
  isLoading = false,
  isEmpty = false,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries to display at this time.",
  emptyAction,
  children,
  className,
  columnsCount = 5,
}: DataTableProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white border border-stone-200/80 shadow-xs dark:bg-stone-900/60 dark:border-stone-800 overflow-hidden",
        className
      )}
    >
      {(title || toolbar) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800">
          {title && (
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                {title}
              </h2>
              {description && (
                <p className="text-xs text-stone-500 mt-0.5">{description}</p>
              )}
            </div>
          )}
          {toolbar && <div className="flex items-center gap-2.5 flex-wrap">{toolbar}</div>}
        </div>
      )}

      {isLoading ? (
        <div className="p-4">
          <TableSkeleton columns={columnsCount} rows={4} />
        </div>
      ) : isEmpty ? (
        <div className="p-8">
          <EmptyState
            icon={Inbox}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  )
}

