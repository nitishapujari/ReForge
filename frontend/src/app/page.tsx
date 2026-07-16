"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Bot, ShieldAlert, Sparkles, Activity, FileText, MessageSquare } from "lucide-react"
import { Logo } from "@/components/logo"

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
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-blue-500/20 blur-[100px]" />
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
    <>
      <div className="mb-8 flex items-center justify-center w-48 h-auto md:w-64">
        <Logo showText />
      </div>

      <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
        <Sparkles className="mr-2 h-3 w-3" />
        Powered by {providerInfo.provider} {providerInfo.model ? `• ${providerInfo.model}` : ""}
      </div>
      
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60 mb-6 max-w-4xl">
        The Self-Healing <br className="hidden sm:inline" /> RAG Pipeline
      </h1>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-20 mt-10">
        <Link href="/chat" className={cn(buttonVariants({ size: "lg" }), "group rounded-full px-8")}>
          Start Chatting
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/upload" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-8")}>
          Upload Documents
        </Link>
      </div>
    </>
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

  const totalChunks = docs.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0)
  const recentDocs = docs.slice(0, 3)
  const recentSessions = sessions.slice(0, 3)
  const lastSession = sessions.length > 0 ? sessions[0] : null

  return (
    <div className="w-full max-w-5xl mt-24 space-y-16 text-left">
      {/* Your Activity */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-6">Your Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Total Documents</CardDescription>
              <CardTitle className="text-4xl font-bold">{loading ? "..." : docs.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardDescription>Total Conversations</CardDescription>
              <CardTitle className="text-4xl font-bold">{loading ? "..." : sessions.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* User Insights */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-6">User Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Recently Uploaded */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Recently Uploaded</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentDocs.length > 0 ? (
                <ul className="space-y-4">
                  {recentDocs.map((doc, idx) => (
                    <li key={doc.document_id || doc.id || idx} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate" title={doc.filename}>{doc.filename}</p>
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

          {/* Recent Sessions */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentSessions.length > 0 ? (
                <ul className="space-y-4">
                  {recentSessions.map((session, idx) => (
                    <li key={session.session_id || session.id || idx} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate" title={session.title}>{session.title || "New Chat"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.updated_at || session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recent conversations.</p>
              )}
            </CardContent>
          </Card>

          {/* Continue Last Conversation */}
          <Card className="bg-card/50 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Continue Last Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : lastSession ? (
                <div className="space-y-4 flex flex-col items-start">
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {lastSession.title || "Untitled Session"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active {new Date(lastSession.updated_at || lastSession.created_at).toLocaleDateString()}
                  </p>
                  <Link href={`/chat?session=${lastSession.session_id}`}>
                    <Button variant="default" size="sm" className="mt-2">
                      Resume Chat
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Start a new chat to see it here.</p>
              )}
            </CardContent>
          </Card>
          
        </div>
      </section>
    </div>
  )
}
