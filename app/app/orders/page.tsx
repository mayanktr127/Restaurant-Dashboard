import React from "react"
import { redirect } from "next/navigation"
import { getUserContext, getActiveRestaurantId } from "@/lib/auth"
import { getLiveOrders } from "@/app/actions/orders"
import { LiveOrdersBoard } from "@/components/orders/LiveOrdersBoard"

export default async function OrdersPage() {
  const context = await getUserContext()
  if (!context) redirect("/login")

  const restaurantId = (await getActiveRestaurantId()) || "00000000-0000-0000-0000-000000000010"
  const orders = await getLiveOrders(restaurantId)

  return <LiveOrdersBoard restaurantId={restaurantId} initialOrders={orders} />
}
