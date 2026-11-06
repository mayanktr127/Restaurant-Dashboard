import { NextResponse } from "next/server"
import { getUserContext } from "@/lib/auth"

export async function GET() {
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ destination: "/login" })
  }

  if (context.isAdmin) {
    return NextResponse.json({ destination: "/admin" })
  }

  const isKitchen = context.memberships.some((m) => m.role === "kitchen")
  if (isKitchen) {
    return NextResponse.json({ destination: "/kitchen" })
  }

  const isOwnerOrManager = context.memberships.some(
    (m) => m.role === "owner" || m.role === "manager"
  )
  if (isOwnerOrManager) {
    return NextResponse.json({ destination: "/app" })
  }

  return NextResponse.json({ destination: "/login" })
}

