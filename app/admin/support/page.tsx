import React from "react"
import { LifeBuoy, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"

export default function AdminSupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Escalations"
        description="Incoming help tickets submitted from client owner dashboards"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={LifeBuoy}
        title="Client Support Queue Shell"
        description="Help requests dispatched from restaurant owners and managers will be tracked and resolved here in Phase 7."
        sampleNotice
      />
    </div>
  )
}

