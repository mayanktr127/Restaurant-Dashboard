import React from "react"
import { AlertOctagon, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"

export default function AdminErrorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Error Logs"
        description="Monitor system-level webhook execution failures, n8n payload issues, and auth alerts"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 6 Feature
          </span>
        }
      />
      <EmptyState
        icon={AlertOctagon}
        title="Error Log Stream Shell"
        description="Incoming n8n webhook alerts, Telegram delivery issues, and error tracking logs will be displayed here in Phase 6."
        sampleNotice
      />
    </div>
  )
}

