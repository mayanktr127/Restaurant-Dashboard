import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getKitchenData } from "@/app/actions/kitchen"
import KitchenClientDisplay from "./KitchenClientDisplay"
import Link from "next/link"
import { AlertCircle, Tablet } from "lucide-react"

export const instant = false

export default async function KitchenPage() {
  const context = await getUserContext()

  // Unauthenticated visitors are sent to the tablet pairing portal
  if (!context) {
    redirect("/kitchen/pair")
  }

  // Permitted roles: kitchen device, owner, manager, platform admin
  const hasAccess =
    context.isAdmin ||
    context.memberships.some(
      (m) =>
        m.active &&
        (m.role === "kitchen" || m.role === "owner" || m.role === "manager")
    )

  if (!hasAccess) {
    redirect("/kitchen/pair")
  }

  // Resolve target restaurant
  const kitchenMembership = context.memberships.find(
    (m) => m.active && m.role === "kitchen"
  )
  const activeRestaurantId = await getActiveRestaurantId()
  const restaurantId =
    kitchenMembership?.restaurant_id ||
    activeRestaurantId ||
    context.memberships[0]?.restaurant_id

  if (!restaurantId) {
    redirect("/kitchen/pair")
  }

  const kitchenData = await getKitchenData(restaurantId)

  // If this device was revoked by the restaurant owner
  if (kitchenData.isRevoked) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-[#F3F4F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#151B23] border border-[#232B36] rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/70 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Device Disconnected
            </h1>
            <p className="text-sm text-stone-400 leading-relaxed">
              This device was disconnected or revoked by the restaurant owner. Ask the owner for a
              new pairing code to reconnect this tablet.
            </p>
          </div>
          <Link
            href="/kitchen/pair"
            className="inline-flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-base transition-colors shadow-lg shadow-emerald-950/40"
          >
            <Tablet className="w-5 h-5" />
            <span>Enter New Pairing Code</span>
          </Link>
        </div>
      </div>
    )
  }

  return <KitchenClientDisplay initialData={kitchenData} />
}
