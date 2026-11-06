import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })

  response.cookies.set("dev_user_email", "", {
    path: "/",
    maxAge: 0,
  })

  response.cookies.set("selected_restaurant_id", "", {
    path: "/",
    maxAge: 0,
  })

  return response
}

