import React from "react"
import { History, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"

export default function OrderHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Order History & Search"
        description="Filterable audit log of all completed, refunded, and cancelled orders"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={History}
        title="Order History Coming Soon"
        description="Full order search, payment breakdown, date-range filters, and CSV export functionality will be available in Phase 7."
        sampleNotice
      />
    </div>
  )
}

