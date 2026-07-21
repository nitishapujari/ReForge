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
      viewBox={showText ? "0 0 260 64" : "0 0 64 64"}
      fill="none"
      className={cn("w-full h-full", className)}
      {...props}
    >
      <defs>
        <linearGradient id="flame-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF7A00" />
          <stop offset="50%" stopColor="#FF9D00" />
          <stop offset="100%" stopColor="#FFC700" />
        </linearGradient>
        <linearGradient id="flame-inner" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF9D00" />
          <stop offset="100%" stopColor="#FFE500" />
        </linearGradient>
      </defs>

      {/* ICON GROUP */}
      <g transform="translate(0, 0)">
        {/* Document Base */}
        <path 
          d="M22 6 C19.8 6 18 7.8 18 10 L18 50 C18 52.2 19.8 54 22 54 L34 54 L34 42 L50 42 L50 20 L36 20 C33.8 20 32 18.2 32 16 L32 6 Z" 
          fill="currentColor" 
          className="text-slate-800 dark:text-slate-200"
        />
        {/* Document Fold */}
        <path 
          d="M34 6 L50 22 L38 22 C35.8 22 34 20.2 34 18 Z" 
          fill="currentColor" 
          className="text-slate-800 dark:text-slate-200"
        />
        
        {/* Document Cutout Lines */}
        <rect x="25" y="22" width="16" height="3.5" rx="1.75" className="fill-background" />
        <rect x="25" y="30" width="16" height="3.5" rx="1.75" className="fill-background" />
        <rect x="25" y="38" width="10" height="3.5" rx="1.75" className="fill-background" />

        {/* Shattered Pixels */}
        {/* Orange Pixels */}
        <rect x="41" y="44" width="5" height="5" fill="#FF8C00" />
        <rect x="35" y="50" width="4" height="4" fill="#FF8C00" />
        <rect x="45" y="52" width="4" height="4" fill="#FF8C00" />
        
        {/* Dark Pixels */}
        <rect x="32" y="44" width="3" height="3" fill="currentColor" className="text-slate-800 dark:text-slate-200" />
        <rect x="40" y="53" width="3" height="3" fill="currentColor" className="text-slate-800 dark:text-slate-200" />

        {/* Flame */}
        <path 
          d="M 28 60 C 10 60 4 40 12 24 C 16 16 20 6 22 0 C 16 12 18 20 24 28 C 21 34 24 40 28 44 C 32 40 34 46 28 60 Z" 
          fill="url(#flame-grad)" 
        />
        <path 
          d="M 26 55 C 14 55 9 40 15 28 C 18 22 21 14 22 8 C 18 16 19 22 23 28 C 21 32 23 37 26 40 C 29 37 31 41 26 55 Z" 
          fill="url(#flame-inner)" 
        />
      </g>

      {/* TEXT LOCKUP - Only renders if showText is true */}
      {showText && (
        <g transform="translate(60, 36)">
          <text
            fontFamily="Inter, sans-serif"
            fontWeight="900"
            fontSize="32"
            letterSpacing="-1"
          >
            <tspan fill="currentColor" className="text-slate-800 dark:text-slate-100">Re</tspan>
            <tspan fill="#FF8C00">Forge</tspan>
          </text>
          <text 
            y="18" 
            x="2"
            fontFamily="Inter, sans-serif" 
            fontWeight="600" 
            fontSize="8.5" 
            letterSpacing="1.5" 
            fill="currentColor" 
            className="text-slate-500 dark:text-slate-400"
          >
            THE SELF-HEALING RAG PIPELINE
          </text>
        </g>
      )}
    </svg>
  )
}
