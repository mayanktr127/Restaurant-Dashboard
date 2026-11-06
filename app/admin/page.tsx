"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  ExternalLink,
  Sparkles,
} from "lucide-react"
import { PageHeader, StatusBadge, StatusDot, DataTable } from "@/components/ui-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ClientRow {
  id: string
  name: string
  slug: string
  status: "active" | "trial" | "setting_up" | "paused"
  plan: string
  ordersToday: number
  lastOrder: string
  deviceOnline: boolean
}

const SAMPLE_CLIENTS: ClientRow[] = [
  {
    id: "cl-1",
    name: "Lone Star Tacos",
    slug: "lone-star-tacos",
    status: "active",
    plan: "Pro ($49/mo)",
    ordersToday: 48,
    lastOrder: "4 min ago",
    deviceOnline: true,
  },
  {
    id: "cl-2",
    name: "Austin Noodle Bar",
    slug: "austin-noodle-bar",
    status: "active",
    plan: "Pro ($49/mo)",
    ordersToday: 32,
    lastOrder: "18 min ago",
    deviceOnline: true,
  },
  {
    id: "cl-3",
    name: "Hill Country BBQ",
    slug: "hill-country-bbq",
    status: "trial",
    plan: "Pro ($49/mo)",
    ordersToday: 64,
    lastOrder: "2 min ago",
    deviceOnline: false,
  },
  {
    id: "cl-4",
    name: "San Antonio Cantina",
    slug: "san-antonio-cantina",
    status: "setting_up",
    plan: "Starter ($29/mo)",
    ordersToday: 0,
    lastOrder: "Never",
    deviceOnline: false,
  },
  {
    id: "cl-5",
    name: "Alamo Burger Shack",
    slug: "alamo-burger-shack",
    status: "paused",
    plan: "Starter ($29/mo)",
    ordersToday: 0,
    lastOrder: "3 days ago",
    deviceOnline: false,
  },
]

export default function AdminClientsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredClients = SAMPLE_CLIENTS.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant Clients"
        description="Monitor multi-tenant client instances, active tablets, and billing tiers"
        badge={
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Sample Clients
          </span>
        }
        actions={
          <Button className="h-9 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold gap-1.5 shadow-xs">
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </Button>
        }
      />

      <DataTable
        title="All Client Accounts"
        description={`${filteredClients.length} accounts configured`}
        toolbar={
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
              <Input
                placeholder="Search restaurant or slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 text-xs rounded-lg border-stone-200"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-xs rounded-lg border border-stone-200 bg-white px-2.5 text-stone-700"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="setting_up">Setting up</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        }
      >
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50/80 border-b border-stone-200/80 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-5">Restaurant Name</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Subscription Plan</th>
              <th className="py-3 px-4 text-right">Orders Today</th>
              <th className="py-3 px-4">Last Order</th>
              <th className="py-3 px-4">Tablet Device</th>
              <th className="py-3 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredClients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-stone-50/70 transition-colors group"
              >
                <td className="py-3.5 px-5">
                  <div className="font-semibold text-stone-900 group-hover:text-emerald-900">
                    {client.name}
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono">
                    /{client.slug}
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <StatusBadge status={client.status} size="sm" />
                </td>
                <td className="py-3.5 px-4 font-medium text-stone-700">
                  {client.plan}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-semibold text-stone-900 tabular-nums">
                  {client.ordersToday}
                </td>
                <td className="py-3.5 px-4 text-stone-500">
                  {client.lastOrder}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={client.deviceOnline ? "online" : "offline"}
                      pulse={client.deviceOnline}
                    />
                    <span className="text-stone-600">
                      {client.deviceOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    href="/app"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 hover:underline"
                    title="View client dashboard as owner"
                  >
                    <span>View Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  )
}
