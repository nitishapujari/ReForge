"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Laptop, Moon, Sun, Trash2, Info, Code2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDeleteHistory = async () => {
    setIsDeleting(true)
    setStatusMessage(null)
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/history", {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete chat history")
      
      const data = await res.json()
      setStatusMessage({ type: 'success', text: data.message || "Successfully deleted all chat sessions." })
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || "An error occurred while deleting history." })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and data.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how ReForge looks on your device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                variant={theme === 'light' ? 'default' : 'outline'} 
                className="w-32 flex items-center gap-2"
                onClick={() => setTheme('light')}
              >
                <Sun className="w-4 h-4" /> Light
              </Button>
              <Button 
                variant={theme === 'dark' ? 'default' : 'outline'} 
                className="w-32 flex items-center gap-2"
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-4 h-4" /> Dark
              </Button>
              <Button 
                variant={theme === 'system' ? 'default' : 'outline'} 
                className="w-32 flex items-center gap-2"
                onClick={() => setTheme('system')}
              >
                <Laptop className="w-4 h-4" /> System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-5 h-5 text-muted-foreground" />
              <CardTitle>About ReForge</CardTitle>
            </div>
            <CardDescription>
              Application information and current configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Version</span>
              <span>1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="font-medium text-muted-foreground">Mode</span>
              <span className="capitalize">Development</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="font-medium text-muted-foreground">Repository</span>
              <a 
                href="https://github.com/nitishapujari/ReForge" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Code2 className="w-4 h-4" />
                nitishapujari/ReForge
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone Card */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions related to your personal data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusMessage && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${
                statusMessage.type === 'success' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {statusMessage.text}
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Delete All Chat History</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently remove all chat sessions and trace data.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger 
                  render={
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete All History
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <span className="block text-foreground font-medium">
                        This will permanently delete all chat sessions and their execution traces.
                      </span>
                      <span className="block">
                        Uploaded documents and the knowledge base will NOT be deleted.
                      </span>
                      <span className="block font-semibold text-destructive">
                        This action cannot be undone.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => { e.preventDefault(); handleDeleteHistory(); }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete All History"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
