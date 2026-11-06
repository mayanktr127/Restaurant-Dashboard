import Link from "next/link"
import { CheckCircle2, Tablet, ArrowRight } from "lucide-react"
import { Logo } from "@/components/ui-kit/Logo"
import { brand } from "@/lib/brand"

export default function RootLandingPage() {
  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top minimal bar on mobile */}
      <header className="lg:hidden flex items-center justify-between pb-4">
        <Logo size="md" />
      </header>

      {/* Main card container */}
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
            {/* Ambient decorative glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <Logo size="lg" invert showTagline />

              <div className="mt-12 sm:mt-16 space-y-4">
                <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-900/60 px-2.5 py-1 rounded-full border border-emerald-700/50">
                  Restaurant Operations Platform
                </span>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-white">
                  {brand.tagline}
                </h1>
                <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed max-w-md">
                  A unified web workspace designed specifically for restaurant owners, floor managers, and kitchen tablet displays.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-10 pt-8 border-t border-emerald-800/60 space-y-3.5">
              {brand.benefits.map((benefit, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-emerald-100/90">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Action Panel */}
          <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white">
            <div className="max-w-md w-full mx-auto my-auto space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-stone-900 tracking-tight">
                  Sign in to your dashboard
                </h2>
                <p className="text-sm text-stone-500">
                  Access your restaurant orders, live floor metrics, menu availability, and staff settings.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full h-11 px-5 rounded-[10px] bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium transition-colors shadow-xs"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-stone-200"></div>
                  <span className="shrink mx-3 text-xs text-stone-400 font-medium uppercase tracking-wider">or</span>
                  <div className="flex-grow border-t border-stone-200"></div>
                </div>

                <Link
                  href="/kitchen/pair"
                  className="flex items-center justify-center gap-2 w-full h-11 px-5 rounded-[10px] border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium transition-colors"
                >
                  <Tablet className="w-4 h-4 text-stone-500" />
                  <span>Setting up a kitchen tablet? Pair device</span>
                </Link>
              </div>

              <div className="pt-4 text-xs text-stone-400 text-center">
                Protected by multi-tenant authentication and automated session refresh.
              </div>
            </div>

            <div className="pt-6 border-t border-stone-100 text-xs text-stone-400 flex items-center justify-between">
              <span>{brand.companyName}</span>
              <a href={`mailto:${brand.supportEmail}`} className="hover:text-stone-600 transition-colors">
                {brand.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Development Shortcuts (NODE_ENV=development ONLY) */}
      {isDev && (
        <footer className="mt-4 pt-3 border-t border-stone-200/60 text-center">
          <div className="flex items-center justify-center gap-3 text-xs text-stone-400 flex-wrap">
            <span className="font-semibold text-stone-500">Dev Shell Shortcuts:</span>
            <Link href="/app" className="hover:text-emerald-800 underline">Owner/Manager (/app)</Link>
            <span>·</span>
            <Link href="/kitchen" className="hover:text-emerald-800 underline">Kitchen Screen (/kitchen)</Link>
            <span>·</span>
            <Link href="/kitchen/pair" className="hover:text-emerald-800 underline">Pair Tablet (/kitchen/pair)</Link>
            <span>·</span>
            <Link href="/admin" className="hover:text-emerald-800 underline">Admin (/admin)</Link>
            <span>·</span>
            <Link href="/login" className="hover:text-emerald-800 underline">Login (/login)</Link>
          </div>
        </footer>
      )}
    </div>
  )
}
