import React from "react"
import { Utensils } from "lucide-react"
import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  showTagline?: boolean
  className?: string
  invert?: boolean
}

export function Logo({
  size = "md",
  showText = true,
  showTagline = false,
  className,
  invert = false,
}: LogoProps) {
  const iconSizes = {
    sm: "w-7 h-7 rounded-[8px]",
    md: "w-9 h-9 rounded-[10px]",
    lg: "w-11 h-11 rounded-[12px]",
  }

  const glyphSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4.5 h-4.5",
    lg: "w-6 h-6",
  }

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  }

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div
        className={cn(
          "flex items-center justify-center shrink-0 shadow-xs",
          invert
            ? "bg-white text-emerald-900"
            : "bg-emerald-800 text-white",
          iconSizes[size]
        )}
      >
        <Utensils className={glyphSizes[size]} strokeWidth={2.2} />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-semibold tracking-tight leading-none",
              invert ? "text-white" : "text-stone-900 dark:text-stone-100",
              textSizes[size]
            )}
          >
            {brand.productName}
          </span>
          {showTagline && (
            <span
              className={cn(
                "text-xs mt-0.5",
                invert ? "text-emerald-100/80" : "text-stone-500"
              )}
            >
              by {brand.companyName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

