import React, { Suspense } from "react"
import InviteClient from "./InviteClient"

export const instant = false

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="text-sm text-stone-500 animate-pulse font-medium">
            Loading invitation details...
          </div>
        </div>
      }
    >
      <InviteClient params={params} />
    </Suspense>
  )
}
