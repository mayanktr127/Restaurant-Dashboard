"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Mail, ArrowLeft, ShieldCheck, KeyRound, Loader2, AlertCircle } from "lucide-react"
import { Logo } from "@/components/ui-kit/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { brand } from "@/lib/brand"

export default function LoginPage() {
  const router = useRouter()
  const isDev = process.env.NODE_ENV === "development"
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Dev mode credentials
  const [devEmail, setDevEmail] = useState("owner.a@demo.test")
  const [devPassword, setDevPassword] = useState("DemoPass123!")
  const [isDevLoading, setIsDevLoading] = useState(false)

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const redirectOrigin = window.location.origin
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${redirectOrigin}/auth/callback`,
        },
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setIsSubmitted(true)
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send login link")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsDevLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: devEmail,
          password: devPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || "Dev login failed")
        setIsDevLoading(false)
        return
      }

      router.push(data.destination || "/app")
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Dev login failed")
      setIsDevLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between pb-4">
        <Logo size="md" />
        <Link href="/" className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center my-auto">
        <div className="w-full max-w-5xl bg-white rounded-3xl border border-stone-200/80 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* Left Brand Panel */}
          <div
            className="lg:col-span-6 text-white p-8 sm:p-12 flex flex-col justify-between relative brand-grid-pattern overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #022c22 0%, #064e3b 55%, #022c22 100%)",
              color: "#ffffff",
            }}
          >
            <div className="relative z-10">
              <Link href="/">
                <Logo size="lg" invert showTagline />
              </Link>

              <div className="mt-12 sm:mt-16 space-y-4">
                <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-900/60 px-2.5 py-1 rounded-full border border-emerald-700/50">
                  Passwordless Security
                </span>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-white">
                  Fast, secure sign-in for your whole team.
                </h1>
                <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed max-w-md">
                  No passwords to forget. We deliver a one-time verification link directly to your authorized business inbox.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-10 pt-8 border-t border-emerald-800/60 space-y-3.5">
              <div className="flex items-center gap-3 text-sm text-emerald-100/90">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Protected by role-based session isolation</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-100/90">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero kitchen staff credential leakage</span>
              </div>
            </div>
          </div>

          {/* Right Login Card */}
          <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white">
            <div className="max-w-md w-full mx-auto my-auto space-y-6">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {!isSubmitted ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-stone-900 tracking-tight">
                      Sign in
                    </h2>
                    <p className="text-sm text-stone-500">
                      We&apos;ll email you a secure sign-in link. No password needed.
                    </p>
                  </div>

                  <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-stone-700">
                        Email address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@restaurant.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 rounded-[10px] border-stone-200 focus-visible:ring-emerald-800"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 rounded-[10px] bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-sm transition-colors shadow-xs"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          <span>Sending link...</span>
                        </>
                      ) : (
                        <span>Email me a sign-in link</span>
                      )}
                    </Button>
                  </form>

                  {/* Development ONLY section */}
                  {isDev && (
                    <div className="mt-8 pt-6 border-t border-dashed border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Developer login (test accounts)
                        </span>
                        <span className="text-[11px] text-stone-400">Dev mode only</span>
                      </div>

                      <form onSubmit={handleDevLogin} className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                        <div className="space-y-1">
                          <Label htmlFor="dev-email" className="text-xs font-medium text-stone-600">
                            Seed User
                          </Label>
                          <select
                            id="dev-email"
                            value={devEmail}
                            onChange={(e) => setDevEmail(e.target.value)}
                            className="w-full h-9 text-xs rounded-lg border border-stone-200 bg-white px-2.5 text-stone-800"
                          >
                            <option value="owner.a@demo.test">owner.a@demo.test (Owner - Lone Star Tacos)</option>
                            <option value="manager.a@demo.test">manager.a@demo.test (Manager - Lone Star Tacos)</option>
                            <option value="owner.b@demo.test">owner.b@demo.test (Owner - Austin Noodle Bar)</option>
                            <option value="admin@demo.test">admin@demo.test (Platform Admin)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="dev-pass" className="text-xs font-medium text-stone-600">
                            Password
                          </Label>
                          <Input
                            id="dev-pass"
                            type="password"
                            value={devPassword}
                            onChange={(e) => setDevPassword(e.target.value)}
                            className="h-9 text-xs rounded-lg bg-white"
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={isDevLoading}
                          className="w-full h-9 rounded-lg bg-stone-900 hover:bg-black text-white text-xs font-medium gap-1.5 transition-colors"
                        >
                          {isDevLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Signing in...</span>
                            </>
                          ) : (
                            <>
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Log In as Seed User</span>
                            </>
                          )}
                        </Button>
                      </form>
                    </div>
                  )}
                </>
              ) : (
                /* Success State Component */
                <div className="py-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
                    <Mail className="w-7 h-7" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-semibold text-stone-900 tracking-tight">
                      Check your email
                    </h3>
                    <p className="text-sm text-stone-500 max-w-xs mx-auto">
                      We sent a temporary sign-in link to <span className="font-medium text-stone-800">{email}</span>. Click the link in the email to access your dashboard.
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSubmitted(false)
                        setErrorMsg(null)
                      }}
                      className="text-xs font-medium text-emerald-800 hover:text-emerald-900 hover:underline"
                    >
                      Use a different email address
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-stone-100 text-xs text-stone-400 text-center">
              Need help?{" "}
              <a href={`mailto:${brand.supportEmail}`} className="text-stone-600 hover:underline">
                {brand.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
