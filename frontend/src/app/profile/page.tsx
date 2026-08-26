"use client"

import { useUser } from "@/contexts/user-context"
import { useState, useEffect } from "react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  User2, Calendar, Monitor, CheckCircle2, 
  Copy, Check, FileText, MessageSquare, Activity, Mail
} from "lucide-react"

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { bounce: 0, duration: 2000 })
  const display = useTransform(spring, current => Math.round(current).toString())
  
  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

export default function ProfilePage() {
  const { user, isLoading } = useUser()
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState({ docs: 0, sessions: 0, queries: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/documents").then(res => res.ok ? res.json() : []),
      fetch("/api/v1/history").then(res => res.ok ? res.json() : [])
    ]).then(([docsData, historyData]) => {
      const docsCount = Array.isArray(docsData) ? docsData.length : 0
      const sessionsCount = Array.isArray(historyData) ? historyData.length : 0
      const queriesCount = Array.isArray(historyData) 
        ? historyData.reduce((acc, s) => acc + (s.message_count || 0), 0)
        : 0
      setStats({ docs: docsCount, sessions: sessionsCount, queries: queriesCount })
      setLoadingStats(false)
    }).catch(() => setLoadingStats(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-10">
        <div className="space-y-2 mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-10">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!user) return null

  const displayName = user.fullName
  const displayId = user.id
  const shortId = displayId.length > 12 ? `${displayId.slice(0, 8)}...${displayId.slice(-5)}` : displayId
  const initials = user.avatarInitials

  const joinedDate = new Date(user.createdAt || new Date()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(displayId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-1 p-8 max-w-4xl mx-auto w-full"
    >
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          View your personal information and account usage.
        </p>
      </div>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-8 right-8 bg-background border border-border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium z-50"
          >
            <Check className="w-4 h-4 text-emerald-500" /> Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-10">
        <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
          <Card className="shadow-sm hover:shadow-lg transition-all duration-300 border-primary/10 hover:border-primary/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-primary/0 rounded-xl blur-md group-hover:blur-lg transition-all opacity-0 group-hover:opacity-100 duration-500" />
                  <Avatar className="h-20 w-20 rounded-xl shadow-sm border-2 border-primary/10 group-hover:border-primary/40 transition-colors bg-background relative z-10">
                    <AvatarFallback className="text-2xl rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-2xl tracking-tight">{displayName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    <span>{user.email}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <User2 className="w-4 h-4" /> 
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{shortId}</span>
                    </p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 rounded-md hover:bg-muted"
                      onClick={handleCopy}
                      title="Copy full User ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10">
          <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Card className="h-full shadow-sm hover:shadow-lg transition-all duration-300 border-primary/10 hover:border-primary/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Preferences & Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-1 group">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors">
                    <Calendar className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors" /> Joined Date
                  </p>
                  <p className="text-base font-medium">{joinedDate}</p>
                </div>

              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Card className="h-full shadow-sm hover:shadow-lg transition-all duration-300 border-primary/10 hover:border-primary/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-1.5 group">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors">
                    <FileText className="w-4 h-4 text-blue-500/50 group-hover:text-blue-500 transition-colors" /> Documents Uploaded
                  </p>
                  <div className="text-3xl font-bold tracking-tight text-foreground ml-6">
                    {loadingStats ? <Skeleton className="h-8 w-16" /> : <AnimatedNumber value={stats.docs} />}
                  </div>
                </div>
                
                <Separator className="opacity-50" />
                
                <div className="flex flex-col gap-1.5 group">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors">
                    <MessageSquare className="w-4 h-4 text-emerald-500/50 group-hover:text-emerald-500 transition-colors" /> Total Conversations
                  </p>
                  <div className="text-3xl font-bold tracking-tight text-foreground ml-6">
                    {loadingStats ? <Skeleton className="h-8 w-16" /> : <AnimatedNumber value={stats.sessions} />}
                  </div>
                </div>

                <Separator className="opacity-50" />

                <div className="flex flex-col gap-1.5 group">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors">
                    <Activity className="w-4 h-4 text-purple-500/50 group-hover:text-purple-500 transition-colors" /> Total Queries Asked
                  </p>
                  <div className="text-3xl font-bold tracking-tight text-foreground ml-6">
                    {loadingStats ? <Skeleton className="h-8 w-16" /> : <AnimatedNumber value={stats.queries} />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

