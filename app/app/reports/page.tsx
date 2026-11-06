import React from "react"
import { BarChart3, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"
import { requireOwnerPage } from "@/lib/auth"

export default async function ReportsPage() {
  await requireOwnerPage()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Reports & Analytics"
        description="Daily sales trends, best-selling dishes, peak kitchen hours, and table turnover analytics"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={BarChart3}
        title="Analytics Dashboard Shell"
        description="Interactive charts, date range comparisons, kitchen prep speed averages, and exportable data will be available in Phase 7."
        sampleNotice
      />
    </div>
  )
}
