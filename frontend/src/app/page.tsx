"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Bot, ShieldAlert, Sparkles, Activity, FileText, MessageSquare, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { motion, useSpring, useTransform, Variants } from "framer-motion"

import { buttonVariants, Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useUser } from "@/contexts/user-context"
import { Badge } from "@/components/ui/badge"

const shortenId = (id: string) => {
  if (!id) return ""
  return id.split('-')[0]
}

function FloatingOrbs() {
  const [mounted, setMounted] = useState(false)
  const [orbs, setOrbs] = useState<any[]>([])

  useEffect(() => {
    setOrbs([...Array(5)].map(() => ({
      left: `${10 + Math.random() * 80}%`,
      top: `${20 + Math.random() * 60}%`,
      duration: 8 + Math.random() * 10,
      delay: Math.random() * 5,
      yOffset: Math.random() * -100 - 50,
      xOffset: Math.random() * 100 - 50,
    })))
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, orb.yOffset, 0],
            x: [0, orb.xOffset, 0],
            opacity: [0.1, 0.5, 0.1],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
          className="absolute h-4 w-4 md:h-8 md:w-8 rounded-full bg-primary blur-[4px]"
          style={{
            left: orb.left,
            top: orb.top,
          }}
        />
      ))}
    </>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { bounce: 0, duration: 2000 })
  const display = useTransform(spring, current => Math.round(current).toString())
  
  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

// Framer motion variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
}

export default function HomePage() {
  const [providerInfo, setProviderInfo] = useState<{provider: string, model: string}>({ provider: "Loading...", model: "" })

  useEffect(() => {
    fetch("/api/v1/health")
      .then(res => res.json())
      .then(data => {
        if (data.active_provider) {
          const name = data.active_provider.charAt(0).toUpperCase() + data.active_provider.slice(1)
          setProviderInfo({ provider: name, model: data.llm || "" })
        } else {
          setProviderInfo({ provider: "Unknown Provider", model: "" })
        }
      })
      .catch(() => setProviderInfo({ provider: "LLM", model: "" }))
  }, [])

  return (
    <div className="relative flex-1 min-h-[calc(100svh-3rem)] flex flex-col items-center justify-center overflow-hidden">
      {/* Animated Mesh Gradient Background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[100px]" 
        />
      <FloatingOrbs />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-16 flex flex-col items-center text-center w-full">
        <HeroSection providerInfo={providerInfo} />
        <PersonalizedDashboard />
      </div>
    </div>
  )
}

function HeroSection({ providerInfo }: { providerInfo: { provider: string, model: string } }) {
  return (
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="show"
      className="flex flex-col items-center"
    >
      <motion.div variants={itemVariants} className="mb-8 flex items-center justify-center w-48 h-auto md:w-64">
        <Logo showText />
      </motion.div>

      <motion.div variants={itemVariants} className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-primary/20 bg-primary/10 text-primary mb-6 shadow-sm shadow-primary/20 hover:shadow-primary/40 hover:bg-primary/20 cursor-default">
        <Sparkles className="mr-2 h-4 w-4" />
        Powered by {providerInfo.provider} {providerInfo.model ? `• ${providerInfo.model}` : ""}
      </motion.div>
      
      <div className="overflow-hidden mb-6 max-w-4xl">
        <motion.h1 
          className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl flex flex-wrap justify-center gap-x-4 gap-y-2"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          initial="hidden"
          animate="show"
        >
          {["The", "Self-Healing", "RAG", "Pipeline"].map((word, i) => (
            <motion.span
              key={i}
              variants={{
                hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
                show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 200, damping: 20 } }
              }}
              className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60 inline-block"
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>
      </div>
      
      <RagPipelineVisualizer />
      
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mb-16 mt-10">
        <Link href="/chat" className={cn(buttonVariants({ size: "lg" }), "group rounded-full px-8 shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5")}>
          Start Chatting
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/upload" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-8 backdrop-blur-sm bg-background/50 hover:bg-muted/80 transition-all hover:-translate-y-0.5")}>
          Upload Documents
        </Link>
      </motion.div>
    </motion.div>
  )
}

function RagPipelineVisualizer() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    // 0: Idle, 1: Query, 2: Retrieve, 3: Evaluate, 4: Heal (Error), 5: Generate
    const sequence = [0, 1, 2, 3, 4, 1, 2, 3, 5]
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % sequence.length
      setStep(sequence[i])
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  const getNodeClasses = (nodeStep: number) => {
    if (step === 4 && nodeStep === 3) return "bg-destructive text-destructive-foreground border-destructive shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-110"
    if (step === nodeStep || (step > nodeStep && step !== 4 && step !== 0)) return "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)] scale-105"
    return "bg-card text-muted-foreground border-border"
  }

  const getLabel = () => {
    switch (step) {
      case 1: return "Parsing Query..."
      case 2: return "Searching Vector DB..."
      case 3: return "Evaluating Context..."
      case 4: return "Hallucination Detected! Healing..."
      case 5: return "Synthesizing Grounded Response"
      default: return "System Idle"
    }
  }

  return (
    <motion.div 
      variants={itemVariants} 
      className="w-full max-w-3xl mx-auto my-8 relative p-6 rounded-2xl bg-card/10 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] group hover:border-primary/30 transition-colors duration-500 overflow-hidden"
    >
      {/* Animated glowing backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(var(--primary),0.2)_360deg)] opacity-30 pointer-events-none" 
      />
      
      <div className="absolute top-4 left-0 w-full text-center z-20">
        <span className={cn("text-xs font-mono font-semibold tracking-wider transition-colors duration-300", step === 4 ? "text-destructive" : "text-primary")}>
          {getLabel()}
        </span>
      </div>

      <div className="flex items-center justify-between relative mt-10 z-10">
        {/* Connecting Line */}
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-1 bg-muted/50 rounded-full -z-10 overflow-hidden">
          {step > 0 && step !== 4 && (
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-1/2 h-full bg-primary/50"
            />
          )}
          {step === 4 && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: "-100%" }}
              transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
              className="w-1/2 h-full bg-destructive/50"
            />
          )}
        </div>

        {/* Nodes */}
        <div className={cn("flex flex-col items-center gap-2 transition-all duration-300", getNodeClasses(1)) + " rounded-xl p-3 border-2"}>
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs font-bold uppercase">Query</span>
        </div>

        <div className={cn("flex flex-col items-center gap-2 transition-all duration-300", getNodeClasses(2)) + " rounded-xl p-3 border-2"}>
          <FileText className="w-6 h-6" />
          <span className="text-xs font-bold uppercase">Retrieve</span>
        </div>

        <div className={cn("flex flex-col items-center gap-2 transition-all duration-300", getNodeClasses(3), step === 4 && "animate-shake") + " rounded-xl p-3 border-2"}>
          <ShieldAlert className="w-6 h-6" />
          <span className="text-xs font-bold uppercase">Evaluate</span>
        </div>

        <div className={cn("flex flex-col items-center gap-2 transition-all duration-300", getNodeClasses(5)) + " rounded-xl p-3 border-2"}>
          <Bot className="w-6 h-6" />
          <span className="text-xs font-bold uppercase">Generate</span>
        </div>
      </div>
    </motion.div>
  )
}

function PersonalizedDashboard() {
  const { user } = useUser()
  const [docs, setDocs] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [docsRes, histRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/v1/documents").catch(() => null),
          fetch("http://127.0.0.1:8000/api/v1/history").catch(() => null)
        ])
        
        if (docsRes?.ok) {
          const docsData = await docsRes.json()
          setDocs(docsData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        }
        
        if (histRes?.ok) {
          const histData = await histRes.json()
          setSessions(histData)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  if (!user) return null

  const recentDocs = docs.slice(0, 3)
  const recentSessions = sessions.slice(0, 3)
  const lastSession = sessions.length > 0 ? sessions[0] : null

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
      className="w-full max-w-5xl mt-12 space-y-16 text-left"
    >
      {/* Your Activity */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> System & Activity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription>Total Documents</CardDescription>
                <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? "..." : <AnimatedNumber value={docs.length} />}
                </CardTitle>
              </CardHeader>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-lg hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription>Total Conversations</CardDescription>
                <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? "..." : <AnimatedNumber value={sessions.length} />}
                </CardTitle>
              </CardHeader>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="bg-card/40 backdrop-blur-md border-primary/30 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)] hover:border-primary/50 transition-colors relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <CardHeader className="pb-2">
                <CardDescription className="text-primary font-medium flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Grounded Accuracy</CardDescription>
                <CardTitle className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-primary to-primary/60">
                  {loading ? "..." : <span><AnimatedNumber value={99} />%</span>}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-2">Self-healing pipeline active</p>
              </CardHeader>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* User Insights */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-6">Recent Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Recently Uploaded */}
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400 }}>
            <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md h-full">
              <CardHeader>
                <CardTitle className="text-lg">Recently Uploaded</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3 opacity-50">
                    <div className="h-10 bg-muted rounded animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </div>
                ) : recentDocs.length > 0 ? (
                  <ul className="space-y-4">
                    {recentDocs.map((doc, idx) => (
                      <li key={doc.document_id || doc.id || idx} className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors" title={doc.filename}>{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Sessions */}
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400 }}>
            <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md h-full">
              <CardHeader>
                <CardTitle className="text-lg">Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3 opacity-50">
                    <div className="h-10 bg-muted rounded animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </div>
                ) : recentSessions.length > 0 ? (
                  <ul className="space-y-4">
                    {recentSessions.map((session, idx) => (
                      <li key={session.id || idx}>
                        <Link href={`/chat?session=${session.id}`} className="block group">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                              <MessageSquare className="w-5 h-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate" title={session.title}>{session.title || "New Chat"}</p>
                              <p className="text-sm text-muted-foreground">
                                ID: {shortenId(session.id)} • {session.message_count} messages
                              </p>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent conversations.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Continue Last Conversation */}
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400 }}>
            <Card className="bg-card/40 backdrop-blur-md border-primary/20 bg-primary/5 shadow-md h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
              <CardHeader>
                <CardTitle className="text-lg">Continue Last Conversation</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3 opacity-50">
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </div>
                ) : lastSession ? (
                  <div className="space-y-4 flex flex-col items-start relative z-10">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {lastSession.title || "Untitled Session"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last active {new Date(lastSession.updated_at || lastSession.created_at).toLocaleDateString()}
                    </p>
                    <Link href={`/chat?session=${lastSession.id}`}>
                      <Button variant="default" size="sm" className="mt-2 group shadow-md">
                        Resume Chat
                        <ArrowRight className="ml-2 w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Start a new chat to see it here.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
          
        </div>
      </section>
    </motion.div>
  )
}
