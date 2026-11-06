"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  AlertOctagon,
  Megaphone,
  LifeBuoy,
  Shield,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  ChevronDown,
} from "lucide-react"
import { Logo } from "@/components/ui-kit/Logo"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface AdminLayoutProps {
  children: React.ReactNode
  userEmail?: string
}

const ADMIN_NAV = [
  { label: "Clients", href: "/admin", icon: Building2 },
  { label: "Error Logs", href: "/admin/errors", icon: AlertOctagon },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "Support Requests", href: "/admin/support", icon: LifeBuoy },
]

export function AdminLayout({ children, userEmail = "" }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  const handleSignOut = async (globalScope = false) => {
    try {
      await fetch("/api/auth/signout", { method: "POST" })
      const supabase = createClient()
      await supabase.auth.signOut(globalScope ? { scope: "global" } : undefined)
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row text-stone-900">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-stone-200/80 shrink-0 sticky top-0 h-screen z-30 justify-between select-none">
        <div>
          {/* Brand & Admin Badge */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-stone-100">
            <Link href="/admin">
              <Logo size="sm" showText={true} />
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Admin
            </span>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
              Platform Overview
            </div>
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                    isActive
                      ? "bg-purple-50 text-purple-900 font-semibold"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 stroke-[1.8]",
                      isActive ? "text-purple-700" : "text-stone-400"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Profile and shortcuts */}
        <div className="p-3 border-t border-stone-100 bg-stone-50/60 space-y-2 text-xs">
          <Link
            href="/app"
            className="flex items-center justify-between p-2 rounded-lg text-stone-600 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              <span>Owner Portal (/app)</span>
            </div>
            <ChevronRight className="w-3 h-3 text-stone-400" />
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="w-full p-2 rounded-xl bg-white border border-stone-200/80 flex items-center justify-between hover:bg-stone-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded-full bg-purple-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="truncate leading-tight">
                  <div className="font-semibold text-stone-900 truncate">System Admin</div>
                  <div className="text-[10px] text-stone-400 truncate">{userEmail}</div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute bottom-12 left-0 right-0 bg-white rounded-xl border border-stone-200 shadow-lg p-1.5 z-50 text-xs">
                <div className="px-3 py-2 border-b border-stone-100 mb-1">
                  <div className="font-semibold text-stone-800">Platform Admin</div>
                  <div className="text-stone-400 truncate">{userEmail}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSignOut(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-700 hover:bg-stone-50 hover:text-red-700 text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSignOut(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-500 hover:bg-stone-50 hover:text-red-700 text-left text-[11px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out of all devices</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Mobile */}
        <header className="md:hidden h-14 bg-white border-b border-stone-200 px-4 flex items-center justify-between">
          <Logo size="sm" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative ml-auto w-64 bg-white h-full shadow-2xl p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <Logo size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {ADMIN_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 space-y-2">
              <button
                type="button"
                onClick={() => handleSignOut(false)}
                className="flex items-center justify-center gap-2 w-full py-2 bg-stone-900 text-white rounded-lg text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
              <button
                type="button"
                onClick={() => handleSignOut(true)}
                className="flex items-center justify-center gap-2 w-full py-1.5 border border-stone-300 text-stone-600 rounded-lg text-[11px]"
              >
                <span>Log out of all devices</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
