import React from "react"
import { Users, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"
import { requireOwnerPage } from "@/lib/auth"

export default async function CustomersPage() {
  await requireOwnerPage()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers Directory"
        description="Opt-in customer loyalty contacts, order frequency, and lifetime spend history"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={Users}
        title="Customer Directory Shell"
        description="Customer opt-in list, marketing consent tracking, order history per guest, and CSV export will be available in Phase 7."
        sampleNotice
      />
    </div>
  )
}
