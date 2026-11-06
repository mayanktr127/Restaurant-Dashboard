"use server"

import { cookies } from "next/headers"
import { getUserContext } from "@/lib/auth"

export async function switchRestaurant(restaurantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getUserContext()
    if (!context) {
      return { success: false, error: "Not authenticated" }
    }

    // Platform admin can switch to any restaurant
    if (!context.isAdmin) {
      const isMember = context.memberships.some(
        (m) => m.restaurant_id === restaurantId && m.active
      )
      if (!isMember) {
        return { success: false, error: "Unauthorized: You are not a member of this restaurant." }
      }
    }

    const cookieStore = await cookies()
    cookieStore.set("selected_restaurant_id", restaurantId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to switch restaurant",
    }
  }
}

