import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getLiveOrders } from "@/app/actions/orders"
import { LiveOrdersBoard } from "@/components/orders/LiveOrdersBoard"

export default async function OrdersPage() {
  const context = await getUserContext()
  if (!context) redirect("/login")

  const restaurantId = await getActiveRestaurantId()
  if (!restaurantId) {
    if (context.isAdmin) redirect("/admin")
    redirect("/login")
  }
  const orders = await getLiveOrders(restaurantId)

  return <LiveOrdersBoard restaurantId={restaurantId} initialOrders={orders} />
}
