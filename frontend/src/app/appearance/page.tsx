"use client"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Sun, Moon, Palette, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { cn } from "@/lib/utils"

const THEMES = [
  { id: "light", icon: Sun, label: "Light", desc: "Clean and bright" },
  { id: "dark", icon: Moon, label: "Dark", desc: "Easy on the eyes" },
  { id: "system", icon: Monitor, label: "System", desc: "Follows device" },
]

export default function AppearancePage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Ensure we have a valid theme string for UI matching
  const currentTheme = theme || "system"

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (index + 1) % THEMES.length
      e.preventDefault()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + THEMES.length) % THEMES.length
      e.preventDefault()
    } else if (e.key === "Enter" || e.key === " ") {
      setTheme(THEMES[index].id)
      e.preventDefault()
    }

    if (nextIndex !== index && containerRef.current) {
      const buttons = containerRef.current.querySelectorAll("button")
      if (buttons[nextIndex]) {
        buttons[nextIndex].focus()
      }
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } }
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mb-8"
      >
        <motion.h1 variants={itemVariants} className="text-3xl font-bold tracking-tight">Appearance</motion.h1>
        <motion.p variants={itemVariants} className="text-muted-foreground mt-1">
          Customize the look and feel of ReForge.
        </motion.p>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-6"
      >
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" /> Theme
              </CardTitle>
              <CardDescription>Select your preferred color scheme.</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"
                role="radiogroup"
                aria-label="Theme selection"
              >
                {THEMES.map((t, idx) => {
                  const isSelected = currentTheme === t.id
                  const Icon = t.icon
                  
                  return (
                    <motion.button
                      key={t.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setTheme(t.id)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-3 h-32 md:h-40 rounded-xl border-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background group overflow-hidden",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10" 
                          : "border-muted bg-card hover:border-primary/40",
                        // Subtle color palette previews on hover (if not selected)
                        !isSelected && t.id === "light" && "hover:bg-slate-50 hover:text-slate-900",
                        !isSelected && t.id === "dark" && "hover:bg-slate-900 hover:text-slate-50",
                        !isSelected && t.id === "system" && "hover:bg-muted"
                      )}
                    >
                      {/* Inner Glow for selected state */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/10 blur-xl rounded-xl" />
                      )}
                      
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <Icon className={cn(
                          "w-7 h-7 transition-colors duration-300", 
                          isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <div className="flex flex-col items-center">
                          <span className={cn(
                            "font-semibold", 
                            isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {t.label}
                          </span>
                          <span className="text-xs text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity mt-1">
                            {t.desc}
                          </span>
                        </div>
                      </div>

                      {/* Checkmark Fade-In */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="absolute top-3 right-3 text-primary"
                          >
                            <CheckCircle2 className="w-5 h-5 fill-primary text-primary-foreground" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
