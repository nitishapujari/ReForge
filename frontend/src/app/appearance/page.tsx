"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Monitor, Sun, Moon, Palette } from "lucide-react"

export default function AppearancePage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null


  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Appearance</h1>
        <p className="text-muted-foreground mt-1">
          Customize the look and feel of ReForge.
        </p>
      </div>

      <div className="grid gap-6">
        
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" /> Theme
            </CardTitle>
            <CardDescription>Select your preferred color scheme.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant={theme === 'light' ? 'default' : 'outline'} 
                className="h-24 flex flex-col gap-2"
                onClick={() => setTheme('light')}
              >
                <Sun className="w-6 h-6" />
                Light
              </Button>
              <Button 
                variant={theme === 'dark' ? 'default' : 'outline'} 
                className="h-24 flex flex-col gap-2"
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-6 h-6" />
                Dark
              </Button>
              <Button 
                variant={theme === 'system' ? 'default' : 'outline'} 
                className="h-24 flex flex-col gap-2"
                onClick={() => setTheme('system')}
              >
                <Monitor className="w-6 h-6" />
                System
              </Button>
            </div>
          </CardContent>
        </Card>



      </div>
    </div>
  )
}
