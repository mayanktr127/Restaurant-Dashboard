import React from "react"
import { Mail, BookOpen, Sparkles } from "lucide-react"
import { PageHeader, SectionCard } from "@/components/ui-kit"
import { brand } from "@/lib/brand"

export default function HelpPage() {
  const guides = [
    {
      title: "Setting up a Kitchen Tablet",
      description: "How to generate a 6-digit pairing code and lock your tablet into dedicated kitchen mode.",
    },
    {
      title: "QR Menu Printing & Table Stickers",
      description: "Best practices for table tent placement and sticker laminations.",
    },
    {
      title: "Staff PINs & Kitchen Accountability",
      description: "How line cooks enter their 4-digit PIN to mark tickets started or ready.",
    },
    {
      title: "Instant 86 (Sold-out) Workflow",
      description: "How front-of-house or kitchen staff instantly hide out-of-stock items from the guest menu.",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & Guides"
        description="Operational playbooks, kitchen display tips, and support contact"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Support Shell
          </span>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Quick Start Guides"
          description="Common workflows for restaurant managers and staff"
        >
          <div className="space-y-3">
            {guides.map((g, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-stone-200/80 hover:bg-stone-50/60 transition-colors flex items-start gap-3"
              >
                <BookOpen className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">{g.title}</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">{g.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Direct Support"
          description="Need assistance or custom integrations?"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed">
              Our support team is available 7 days a week to help with tablet setup, menu migrations, Telegram backups, and custom POS workflows.
            </p>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-medium text-stone-500">Contact Email:</div>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline"
              >
                <Mail className="w-4 h-4" />
                <span>{brand.supportEmail}</span>
              </a>
            </div>

            <div className="pt-2 text-xs text-stone-400">
              Operated by {brand.companyName}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
