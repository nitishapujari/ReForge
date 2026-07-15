import React from "react"
import { cn } from "@/lib/utils"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  showText?: boolean
}

export function Logo({ className, showText = false, ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showText ? "0 0 240 64" : "0 0 64 64"}
      fill="none"
      className={cn("w-full h-full", className)}
      {...props}
    >
      <defs>
        <linearGradient id="flame-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff7b00" />
          <stop offset="50%" stopColor="#ff9500" />
          <stop offset="100%" stopColor="#ffb300" />
        </linearGradient>
        <linearGradient id="doc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Document Base */}
      <path
        d="M26 12C26 9.79086 27.7909 8 30 8H44.1716C45.2323 8 46.2497 8.42143 47 9.17157L54.8284 17C55.5786 17.7503 56 18.7677 56 19.8284V52C56 54.2091 54.2091 56 52 56H30C27.7909 56 26 54.2091 26 52V12Z"
        fill="url(#doc-gradient)"
        className="text-slate-800 dark:text-slate-100"
      />
      {/* Document Fold */}
      <path
        d="M44 8V16C44 18.2091 45.7909 20 48 20H56"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-800 dark:text-slate-100"
      />
      
      {/* Document Lines */}
      <line x1="34" y1="28" x2="48" y2="28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-background dark:text-slate-900" />
      <line x1="34" y1="36" x2="48" y2="36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-background dark:text-slate-900" />
      <line x1="34" y1="44" x2="42" y2="44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-background dark:text-slate-900" />

      {/* Flame */}
      <path
        d="M24.5 56C15.9396 56 9 49.0604 9 40.5C9 34.0253 12.8797 28.3283 18.3976 25.4385C19.1171 25.0617 19.8517 25.7601 19.5309 26.5057C17.9042 30.2882 18.7188 34.8055 21.7584 37.8451C22.1868 38.2736 22.8466 38.0833 23.0132 37.4952C23.9525 34.1802 24.5 28.5 24.5 20.5C24.5 17.5 25.5 15.5 27.5 14C27.9715 13.6465 28.6657 13.9161 28.7303 14.5098C29.6105 22.5857 32.5 30.5 32.5 40.5C32.5 49.0604 28.919 56 24.5 56Z"
        fill="url(#flame-gradient)"
      />

      {/* Text Box - Only renders if showText is true */}
      {showText && (
        <g transform="translate(68, 42)">
          <text
            fontFamily="Inter, sans-serif"
            fontWeight="800"
            fontSize="36"
            fill="currentColor"
            letterSpacing="-1"
            className="text-foreground"
          >
            ReForge
          </text>
        </g>
      )}
    </svg>
  )
}
