"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Tablet, Delete, ArrowRight, ChefHat, Loader2, AlertCircle, CheckCircle2, Wrench } from "lucide-react"

export default function KitchenPairPage() {
  const router = useRouter()
  const isDev = process.env.NODE_ENV === "development"

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [devLoading, setDevLoading] = useState(false)

  const handleKeyPress = useCallback((num: string) => {
    setErrorMsg(null)
    setDigits((prev) => {
      const nextEmptyIndex = prev.findIndex((d) => d === "")
      if (nextEmptyIndex !== -1) {
        const copy = [...prev]
        copy[nextEmptyIndex] = num
        return copy
      }
      return prev
    })
  }, [])

  const handleDelete = useCallback(() => {
    setErrorMsg(null)
    setDigits((prev) => {
      const lastFilledIndex = prev.map((d) => d !== "").lastIndexOf(true)
      if (lastFilledIndex !== -1) {
        const copy = [...prev]
        copy[lastFilledIndex] = ""
        return copy
      }
      return prev
    })
  }, [])

  const handleClear = useCallback(() => {
    setErrorMsg(null)
    setDigits(["", "", "", "", "", ""])
  }, [])

  const isComplete = digits.every((d) => d !== "")

  // Submit pairing code to /api/kitchen/pair
  const handleConnect = useCallback(
    async (codeToSubmit?: string) => {
      const code = codeToSubmit || digits.join("")
      if (code.length !== 6) {
        setErrorMsg("Please enter all 6 digits.")
        return
      }

      setLoading(true)
      setErrorMsg(null)

      try {
        const res = await fetch("/api/kitchen/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            deviceName: "Kitchen Display Station",
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setErrorMsg(data.error || "Pairing failed. Please check the code.")
          setLoading(false)
          return
        }

        setSuccessMsg(data.message || "Connected! Launching kitchen...")
        setTimeout(() => {
          router.push(data.redirectUrl || "/kitchen")
          router.refresh()
        }, 600)
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Network error connecting tablet")
        setLoading(false)
      }
    },
    [digits, router]
  )

  // Dev helper: generates a live test pairing code and fills it in
  const handleDevGenerateCode = async () => {
    setDevLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/test/generate-pairing-code", { method: "POST" })
      const data = await res.json()
      if (data.code) {
        const codeDigits = data.code.split("")
        setDigits(codeDigits)
        // Auto connect for developer convenience
        handleConnect(data.code)
      } else {
        setErrorMsg(data.error || "Failed to generate test code")
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not reach test endpoint")
    } finally {
      setDevLoading(false)
    }
  }

  // Physical keyboard listeners for desktop / external keyboard testing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (loading || successMsg) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleKeyPress(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        handleDelete()
      } else if (e.key === "Enter" && isComplete) {
        e.preventDefault()
        handleConnect()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleKeyPress, handleDelete, handleConnect, isComplete, loading, successMsg])

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#F3F4F6] flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none">
      {/* Top minimal header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-stone-300">
          <div className="w-9 h-9 rounded-xl bg-[#151B23] border border-[#232B36] flex items-center justify-center text-emerald-400">
            <ChefHat className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Kitchen Display System</span>
        </div>

        {isDev && (
          <button
            type="button"
            onClick={handleDevGenerateCode}
            disabled={devLoading || loading}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 px-3 py-1.5 rounded-full border border-amber-700/60 transition-colors shadow-xs"
            title="Generate a 10-minute pairing code for testing"
          >
            {devLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wrench className="w-3 h-3" />
            )}
            <span>Dev: Fast Pair Demo Code</span>
          </button>
        )}
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto my-auto py-6">
        <div className="text-center space-y-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#151B23] border border-[#232B36] flex items-center justify-center mx-auto text-emerald-400 mb-3 shadow-lg">
            <Tablet className="w-7 h-7 stroke-[1.8]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Connect this tablet
          </h1>
          <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed">
            Enter the 6-digit pairing code generated in the restaurant owner dashboard under{" "}
            <span className="text-stone-200 font-medium">Team & Devices</span>.
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="w-full max-w-[340px] mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div className="w-full max-w-[340px] mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 6 Large Digit Boxes (at least 64px tall and wide) */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 mb-8 w-full">
          {digits.map((digit, idx) => (
            <div
              key={idx}
              className={`w-12 h-16 sm:w-16 sm:h-20 rounded-2xl border flex items-center justify-center text-2xl sm:text-3xl font-bold font-mono transition-all ${
                digit
                  ? "bg-[#1C2430] border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/30"
                  : idx === digits.findIndex((d) => d === "")
                  ? "bg-[#151B23] border-emerald-600/80 ring-2 ring-emerald-500/30 text-stone-500"
                  : "bg-[#151B23] border-[#232B36] text-stone-600"
              }`}
            >
              {digit || "•"}
            </div>
          ))}
        </div>

        {/* On-screen 3x4 Touch Keypad (Buttons at least 72px) */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[340px] mb-8">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={loading || Boolean(successMsg)}
              onClick={() => handleKeyPress(num)}
              className="h-[72px] rounded-2xl bg-[#151B23] hover:bg-[#1E2733] active:bg-[#253242] border border-[#232B36] text-2xl font-semibold text-white shadow-xs transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={loading || Boolean(successMsg)}
            onClick={handleClear}
            className="h-[72px] rounded-2xl bg-[#151B23] hover:bg-[#1E2733] active:bg-[#253242] border border-[#232B36] text-xs font-semibold uppercase tracking-wider text-stone-400 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={loading || Boolean(successMsg)}
            onClick={() => handleKeyPress("0")}
            className="h-[72px] rounded-2xl bg-[#151B23] hover:bg-[#1E2733] active:bg-[#253242] border border-[#232B36] text-2xl font-semibold text-white shadow-xs transition-colors flex items-center justify-center disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading || Boolean(successMsg)}
            onClick={handleDelete}
            className="h-[72px] rounded-2xl bg-[#151B23] hover:bg-[#1E2733] active:bg-[#253242] border border-[#232B36] text-stone-300 transition-colors flex items-center justify-center disabled:opacity-50"
            aria-label="Delete last digit"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Connect Action Button */}
        <div className="w-full max-w-[340px] space-y-3">
          <button
            type="button"
            onClick={() => handleConnect()}
            disabled={!isComplete || loading || Boolean(successMsg)}
            className={`w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
              isComplete && !loading && !successMsg
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 cursor-pointer"
                : "bg-emerald-950/60 text-emerald-600 border border-emerald-900/60 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Validating & Connecting...</span>
              </>
            ) : successMsg ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Connected!</span>
              </>
            ) : (
              <>
                <span>Connect & Launch Kitchen</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-[11px] text-stone-500 text-center">
            Once connected, this tablet locks into dedicated display mode.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-stone-600 py-2">
        Kitchen Display Station · Dedicated Device Portal
      </footer>
    </div>
  )
}
