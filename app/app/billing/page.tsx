import React from "react"
import { CreditCard, Sparkles } from "lucide-react"
import { PageHeader, EmptyState } from "@/components/ui-kit"
import { requireOwnerPage } from "@/lib/auth"

export default async function BillingPage() {
  await requireOwnerPage()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription & Invoices"
        description="Platform subscription tier, monthly invoice receipts, and next billing renewal date"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Phase 7 Feature
          </span>
        }
      />
      <EmptyState
        icon={CreditCard}
        title="Billing Portal Shell"
        description="Plan management, automated billing receipts, payment history, and payment method updates will be active in Phase 7."
        sampleNotice
      />
    </div>
  )
}
