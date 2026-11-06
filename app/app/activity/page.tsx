import React from "react"
import { Activity, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"
import { requireOwnerPage } from "@/lib/auth"

export default async function ActivityPage() {
  await requireOwnerPage()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Activity Log"
        description="Immutable audit trail of order status changes, menu edits, staff actions, and pairings"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={Activity}
        title="Activity Log Shell"
        description="Real-time security definer event stream recording all actor types, timestamps, and order transitions will be available in Phase 7."
        sampleNotice
      />
    </div>
  )
}
