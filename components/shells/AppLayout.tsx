"use client"

import React, { useState, Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  UtensilsCrossed,
  History,
  BookOpen,
  QrCode,
  BarChart3,
  Users,
  UserCheck,
  Settings,
  CreditCard,
  Activity,
  HelpCircle,
  Bell,
  ChevronDown,
  LogOut,
  Menu as MenuIcon,
  X,
  Store,
  AlertCircle,
  ShieldAlert,
} from "lucide-react"
import { Logo } from "@/components/ui-kit/Logo"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { switchRestaurant } from "@/app/actions/restaurant"

interface AvailableRestaurant {
  id: string
  name: string
  role: string
}

interface AppLayoutProps {
  children: React.ReactNode
  userEmail?: string
  userName?: string
  userRole?: "admin" | "owner" | "manager"
  activeRestaurant?: { id: string; name: string }
  availableRestaurants?: AvailableRestaurant[]
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  ownerOnly?: boolean
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Main",
    items: [
      { label: "Home", href: "/app", icon: LayoutDashboard },
      { label: "Live Orders", href: "/app/orders", icon: UtensilsCrossed },
      { label: "Order History", href: "/app/history", icon: History },
      { label: "Menu", href: "/app/menu", icon: BookOpen },
      { label: "Tables & QR", href: "/app/tables", icon: QrCode },
    ],
  },
  {
    group: "Insights",
    items: [
      { label: "Reports", href: "/app/reports", icon: BarChart3, ownerOnly: true },
      { label: "Customers", href: "/app/customers", icon: Users, ownerOnly: true },
    ],
  },
  {
    group: "Manage",
    items: [
      { label: "Team & Devices", href: "/app/team", icon: UserCheck, ownerOnly: true },
      { label: "Settings", href: "/app/settings", icon: Settings },
      { label: "Billing", href: "/app/billing", icon: CreditCard, ownerOnly: true },
      { label: "Activity Log", href: "/app/activity", icon: Activity, ownerOnly: true },
    ],
  },
]

function SearchParamAlert() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")

  if (errorParam === "no_access") {
    return (
      <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 shadow-xs">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold">Access Restricted:</span> You do not have permission
          to view that page. Owner privileges are required.
        </div>
      </div>
    )
  }

  if (errorParam === "admin_required") {
    return (
      <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-3 shadow-xs">
        <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold">Admin Access Required:</span> That area is restricted
          to Platform Administrators.
        </div>
      </div>
    )
  }

  return null
}

export function AppLayout({
  children,
  userEmail = "owner.a@demo.test",
  userName = "Alice Owner",
  userRole = "owner",
  activeRestaurant = { id: "529510ac-c83f-4be5-875b-5c1b8390fe12", name: "Lone Star Tacos" },
  availableRestaurants = [
    { id: "529510ac-c83f-4be5-875b-5c1b8390fe12", name: "Lone Star Tacos", role: "owner" },
  ],
}: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [isOpenForOrders, setIsOpenForOrders] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [restaurantDropdownOpen, setRestaurantDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [topProfileOpen, setTopProfileOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const isManager = userRole === "manager"

  // Filter out owner-only routes for managers
  const visibleNavGroups = NAV_GROUPS.map((grp) => ({
    ...grp,
    items: grp.items.filter((item) => !isManager || !item.ownerOnly),
  })).filter((grp) => grp.items.length > 0)

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

  const handleSelectRestaurant = async (restaurantId: string) => {
    if (restaurantId === activeRestaurant.id) {
      setRestaurantDropdownOpen(false)
      return
    }
    setSwitching(true)
    try {
      await switchRestaurant(restaurantId)
      setRestaurantDropdownOpen(false)
      router.refresh()
    } catch (err) {
      console.error("Failed to switch restaurant", err)
    } finally {
      setSwitching(false)
    }
  }

  const initials = userName
    ? userName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US"

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col lg:flex-row text-stone-900">
      {/* 1. DESKTOP & TABLET SIDEBAR */}
      <aside className="hidden md:flex flex-col w-20 lg:w-64 bg-white border-r border-stone-200/80 shrink-0 sticky top-0 h-screen z-30 justify-between select-none">
        <div>
          {/* Logo Brand Header */}
          <div className="h-16 px-4 lg:px-6 flex items-center border-b border-stone-100">
            <Link href="/app" className="flex items-center gap-2">
              <Logo size="md" showText={false} className="lg:hidden" />
              <div className="hidden lg:block">
                <Logo size="md" showText={true} />
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="p-2 lg:p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            {visibleNavGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="px-3 text-[10px] font-semibold text-stone-400 uppercase tracking-wider hidden lg:block">
                  {group.group}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150",
                        isActive
                          ? "bg-emerald-50 text-emerald-900 font-semibold"
                          : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-800 rounded-r-md hidden lg:block" />
                      )}
                      <Icon
                        className={cn(
                          "w-4.5 h-4.5 shrink-0 stroke-[1.8]",
                          isActive ? "text-emerald-800" : "text-stone-400 group-hover:text-stone-600"
                        )}
                      />
                      <span className="hidden lg:inline-block truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Bottom: Help & User Info */}
        <div className="p-3 lg:p-4 border-t border-stone-100 bg-stone-50/50 space-y-2">
          <Link
            href="/app/help"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-stone-600 hover:text-stone-900 hover:bg-white",
              pathname === "/app/help" && "bg-white text-emerald-900 font-semibold"
            )}
            title="Help & Guides"
          >
            <HelpCircle className="w-4.5 h-4.5 text-stone-400 shrink-0" />
            <span className="hidden lg:inline-block text-xs">Help & Guides</span>
          </Link>

          {/* User Block */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-medium text-xs shrink-0">
                  {initials}
                </div>
                <div className="hidden lg:block truncate leading-tight">
                  <div className="text-xs font-semibold text-stone-900 truncate">{userName}</div>
                  <div className="text-[11px] text-stone-500 truncate">{userEmail}</div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden lg:block" />
            </button>

            {userDropdownOpen && (
              <div className="absolute bottom-12 left-0 w-56 bg-white rounded-xl border border-stone-200 shadow-lg p-1.5 z-50 text-xs">
                <div className="px-3 py-2 border-b border-stone-100 mb-1">
                  <div className="font-semibold text-stone-800 capitalize">Role: {userRole}</div>
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

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Restaurant Identifier or Switcher Dropdown */}
            {availableRestaurants.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRestaurantDropdownOpen(!restaurantDropdownOpen)}
                  disabled={switching}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors text-left cursor-pointer"
                  title="Switch Restaurant"
                >
                  <div className="w-5 h-5 rounded-md bg-emerald-800 text-white flex items-center justify-center shrink-0">
                    <Store className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-semibold text-stone-900 max-w-[130px] sm:max-w-none truncate">
                    {activeRestaurant.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                </button>

                {restaurantDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl border border-stone-200 shadow-lg p-1.5 z-50 text-xs">
                    <div className="px-2 py-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                      Switch Restaurant
                    </div>
                    {availableRestaurants.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectRestaurant(r.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left mt-1 transition-colors",
                          activeRestaurant.id === r.id
                            ? "bg-emerald-50 text-emerald-900 font-semibold"
                            : "hover:bg-stone-50 text-stone-700"
                        )}
                      >
                        <span className="truncate">{r.name}</span>
                        <span className="text-[10px] text-stone-400 capitalize shrink-0 ml-2">
                          {r.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200/80 bg-stone-50/70 text-left select-none">
                <div className="w-5 h-5 rounded-md bg-emerald-800 text-white flex items-center justify-center shrink-0">
                  <Store className="w-3 h-3" />
                </div>
                <span className="text-sm font-semibold text-stone-900 max-w-[130px] sm:max-w-none truncate">
                  {activeRestaurant.name}
                </span>
              </div>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Open / Closed Order Toggle Switch */}
            <button
              type="button"
              onClick={() => setIsOpenForOrders(!isOpenForOrders)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all select-none border",
                isOpenForOrders
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/70"
              )}
              title="Click to toggle store ordering status"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isOpenForOrders ? "bg-emerald-600 animate-pulse" : "bg-red-600"
                )}
              />
              <span className="hidden sm:inline">
                {isOpenForOrders ? "Open for orders" : "Store closed"}
              </span>
              <span className="sm:hidden">{isOpenForOrders ? "Open" : "Closed"}</span>
            </button>

            {/* Notifications */}
            <button
              type="button"
              className="relative p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100"
              aria-label="View notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-600 rounded-full" />
            </button>

            {/* Top Right Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTopProfileOpen(!topProfileOpen)}
                className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors"
                aria-label="User Profile"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-800 text-white flex items-center justify-center font-medium text-xs">
                  {initials}
                </div>
                <span className="text-xs font-medium text-stone-700 hidden sm:inline truncate max-w-[100px]">
                  {userName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {topProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-stone-200 shadow-lg p-1.5 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-stone-100 mb-1">
                    <div className="font-semibold text-stone-800 truncate">{userName}</div>
                    <div className="text-stone-400 truncate">{userEmail}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                      Role: {userRole}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSignOut(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-700 hover:bg-stone-50 hover:text-red-700 text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSignOut(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-500 hover:bg-stone-50 hover:text-red-700 text-left text-[11px] cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out of all devices</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Access Denied Toast / Alert Banner wrapped in Suspense */}
        <Suspense fallback={null}>
          <SearchParamAlert />
        </Suspense>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* 3. MOBILE BOTTOM TAB BAR (<768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-stone-200/80 px-3 flex items-center justify-around z-30 shadow-lg">
        <Link
          href="/app"
          className={cn(
            "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
            pathname === "/app" ? "text-emerald-800" : "text-stone-500 hover:text-stone-900"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </Link>
        <Link
          href="/app/orders"
          className={cn(
            "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
            pathname.startsWith("/app/orders")
              ? "text-emerald-800"
              : "text-stone-500 hover:text-stone-900"
          )}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span>Orders</span>
        </Link>
        <Link
          href="/app/menu"
          className={cn(
            "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors",
            pathname.startsWith("/app/menu")
              ? "text-emerald-800"
              : "text-stone-500 hover:text-stone-900"
          )}
        >
          <BookOpen className="w-5 h-5" />
          <span>Menu</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-900"
        >
          <MenuIcon className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* 4. MOBILE DRAWER SHEET */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative ml-auto w-72 bg-white h-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <Logo size="sm" showText={true} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Navigation Groups */}
              <div className="space-y-4">
                {visibleNavGroups.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-2">
                      {group.group}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive =
                        item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                            isActive
                              ? "bg-emerald-50 text-emerald-900 font-semibold"
                              : "text-stone-600 hover:bg-stone-50"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Footer & User */}
            <div className="pt-4 border-t border-stone-100 space-y-3">
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <div className="text-xs font-semibold text-stone-900">{userName}</div>
                <div className="text-[11px] text-stone-500 truncate">{userEmail}</div>
                <div className="text-[10px] text-emerald-800 font-semibold uppercase mt-0.5">
                  Role: {userRole}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSignOut(false)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
              <button
                type="button"
                onClick={() => handleSignOut(true)}
                className="w-full flex items-center justify-center gap-2 py-1.5 border border-stone-200 text-stone-600 rounded-xl text-[11px]"
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
