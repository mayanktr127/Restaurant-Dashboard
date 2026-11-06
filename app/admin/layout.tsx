import React from "react"
import { redirect } from "next/navigation"
import { getUserContext } from "@/lib/auth"
import { AdminLayout } from "@/components/shells/AdminLayout"

export const instant = false

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getUserContext()

  if (!context) {
    redirect("/login")
  }

  // Kitchen devices attempting to open /admin -> locked to /kitchen
  const isOnlyKitchen =
    !context.isAdmin &&
    context.memberships.length > 0 &&
    context.memberships.every((m) => m.role === "kitchen")

  if (isOnlyKitchen) {
    redirect("/kitchen")
  }

  // Non-admins cannot access /admin
  if (!context.isAdmin) {
    redirect("/app?error=admin_required")
  }

  return <AdminLayout userEmail={context.user.email || "admin"}>{children}</AdminLayout>
}
