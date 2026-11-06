import React from "react"
import { Megaphone, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Announcements"
        description="Broadcast banner updates, maintenance notices, and new feature alerts to all restaurant dashboards"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={Megaphone}
        title="Announcements Broadcast Shell"
        description="Global banner announcements and targeted client notifications will be managed here in Phase 7."
        sampleNotice
      />
    </div>
  )
}

