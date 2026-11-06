"use client"

import React, { useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/ui-kit/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { brand } from "@/lib/brand"
import { acceptInvite } from "@/app/actions/invites"
import { createClient } from "@/lib/supabase/client"

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const handleAccept = async () => {
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const res = await acceptInvite(token)
      if (res.success && res.redirectUrl) {
        router.push(res.redirectUrl)
        router.refresh()
        return
      }

      if (res.requiresAuth) {
        setRequiresAuth(true)
        if (res.email) setInviteEmail(res.email)
      } else if (res.error) {
        setErrorMsg(res.error)
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept invite")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendLoginLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const origin = window.location.origin
      const { error } = await supabase.auth.signInWithOtp({
        email: inviteEmail,
        options: {
          emailRedirectTo: `${origin}/invite/${token}`,
        },
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setMagicLinkSent(true)
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send magic link")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Logo size="md" />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center my-auto">
        <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200/80 shadow-sm p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-8 h-8 stroke-[1.8]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
              Restaurant Team Invitation
            </h1>
            <p className="text-sm text-stone-500 max-w-xs mx-auto">
              You have been invited to join this restaurant. Accept the invitation to access live orders and floor management.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!requiresAuth ? (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 font-mono">
                Token: {token.slice(0, 12)}...
              </div>

              <Button
                type="button"
                onClick={handleAccept}
                disabled={isLoading}
                className="w-full h-11 rounded-[10px] bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-sm transition-colors shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Validating invitation...</span>
                  </>
                ) : (
                  <>
                    <span>Accept and sign in</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          ) : magicLinkSent ? (
            <div className="py-4 space-y-2 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">Check your email</h3>
              <p className="text-xs text-stone-500">
                We sent a login link to <span className="font-medium text-stone-800">{inviteEmail}</span>. Click it to confirm and activate your membership.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendLoginLink} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs font-medium text-stone-700">
                  Confirm your email to accept
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="name@restaurant.com"
                  className="h-10 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold"
              >
                {isLoading ? "Sending link..." : "Email me sign-in link"}
              </Button>
            </form>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-stone-400">
        {brand.companyName} · Need help?{" "}
        <a href={`mailto:${brand.supportEmail}`} className="hover:underline">
          {brand.supportEmail}
        </a>
      </footer>
    </div>
  )
}
