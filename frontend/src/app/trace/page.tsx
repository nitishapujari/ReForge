"use client"

import Link from "next/link"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Accordion, AccordionContent, AccordionItem, AccordionTrigger 
} from "@/components/ui/accordion"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { 
  Activity, Clock, ChevronDown, ChevronRight, CheckCircle2, 
  XCircle, RotateCcw, Search, Bot, Scale, GitBranch, Edit3, MessageSquare,
  FileText, Zap, BarChart3, Database, ShieldCheck, ChevronUp, AlertCircle
} from "lucide-react"

// Types
interface SessionResponse {
  id: string
  title: string | null
  created_at: string
  updated_at: string
  message_count: number
}

interface TraceEntry {
  node: string
  execution_time_ms: number
  input_summary: string
  output_summary: string
  attempt: number
  decision: string | null
}

interface MessageTrace {
  message_id: string
  timestamp: string
  trace_data: TraceEntry[]
}

interface TraceResponse {
  session_id: string
  traces: MessageTrace[]
}

// Helpers
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}

const shortenId = (id: string) => {
  return id.split('-')[0]
}


// Node Component
const TraceNode = ({ entry, finalOutcome }: { entry: TraceEntry, finalOutcome?: TraceEntry }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  
  const tryParseJSON = (str: string) => {
    try {
      return JSON.parse(str)
    } catch {
      if (str === "grounded=None, confidence=None") {
        return { grounded: null, confidence: null, error: "Verification skipped (API unavailable)" }
      }
      return null
    }
  }

  const parsedInput = tryParseJSON(entry.input_summary)
  const parsedOutput = tryParseJSON(entry.output_summary)

  const getHumanReadableTitle = () => {
    switch(entry.node) {
      case 'retrieve': return "Finding Relevant Information"
      case 'generate': return "Generating Draft"
      case 'critique': return "Verifying Response"
      case 'rewrite': return "Rewriting Search Query"
      case 'web_search': return "Live Web Search"
      case 'router': return "Initial Routing"
      default: return entry.node
    }
  }

  const getIcon = () => {
    switch(entry.node) {
      case 'retrieve': return <Search className="w-4 h-4 text-blue-500" />
      case 'generate': return <Edit3 className="w-4 h-4 text-purple-500" />
      case 'critique': return <ShieldCheck className="w-4 h-4 text-green-600" />
      case 'rewrite': return <RotateCcw className="w-4 h-4 text-orange-500" />
      case 'web_search': return <Search className="w-4 h-4 text-blue-500" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="relative pl-6 pb-6">
      {/* Timeline line */}
      <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-border" />
      
      {/* Node Dot */}
      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-background border-2 border-muted flex items-center justify-center z-10">
        <div className="w-2 h-2 rounded-full bg-primary" />
      </div>

      <div 
        className="border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Collapsed Summary */}
        <div className="p-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-muted mt-0.5">
              {getIcon()}
            </div>
            <div>
              <p className="font-semibold text-sm">{getHumanReadableTitle()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center text-xs text-muted-foreground"><Clock className="w-3 h-3 mr-1"/> {entry.execution_time_ms.toFixed(0)} ms</span>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded Details - User Friendly View */}
        {isExpanded && (
          <div className="p-5 border-t bg-card text-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* RETRIEVAL NODE */}
              {entry.node === 'retrieve' && parsedOutput && (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50 md:col-span-2 space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3"/> Top Sources Found</p>
                    {parsedOutput.documents && parsedOutput.documents.length > 0 ? (
                      <ul className="space-y-2">
                        {parsedOutput.documents.map((doc: any, i: number) => (
                          <li key={i} className="flex items-center gap-2 text-sm font-medium"><FileText className="w-4 h-4 text-muted-foreground"/> {typeof doc === 'string' ? doc : (doc.filename || 'Unknown Document')}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No relevant documents found in the database.</p>
                    )}
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Database className="w-3 h-3"/> Snippets Combined</p>
                    <p className="font-medium text-foreground text-sm">{parsedOutput.snippet_count || 0} source snippets combined</p>
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><BarChart3 className="w-3 h-3"/> Match Quality</p>
                    <div className="flex items-center justify-between">
                      {parsedOutput.top_score >= 0.75 ? (
                         <span className="text-xs font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1">🟢 High Match</span>
                      ) : parsedOutput.top_score >= 0.50 ? (
                         <span className="text-xs font-bold text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded flex items-center gap-1">🟡 Medium Match</span>
                      ) : (
                         <span className="text-xs font-bold text-red-600 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1">🔴 Low Match</span>
                      )}
                      <span className="text-xs font-semibold text-muted-foreground">{parsedOutput.top_score} relevance</span>
                    </div>
                  </div>
                </>
              )}

              {/* WEB SEARCH NODE */}
              {entry.node === 'web_search' && parsedOutput && (
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50 md:col-span-2 space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search className="w-3 h-3"/> Web Search Results</p>
                  <p className="font-medium text-foreground text-sm">{parsedOutput.results_found || 0} sources found on the live web</p>
                </div>
              )}

              {/* GENERATE NODE */}
              {entry.node === 'generate' && parsedOutput && (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50 md:col-span-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Edit3 className="w-3 h-3"/> Draft Preview</p>
                    <p className="italic text-muted-foreground text-sm leading-relaxed border-l-2 border-primary/30 pl-3 py-1">{parsedOutput.preview}</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 md:col-span-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3"/> Generated in</p>
                    <p className="font-medium text-foreground text-sm">{parsedOutput.generation_time} seconds</p>
                  </div>
                </>
              )}

              {/* CRITIQUE NODE */}
              {entry.node === 'critique' && parsedOutput && (
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50 md:col-span-2 space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Scale className="w-3 h-3"/> Verification Summary</p>
                  
                  {parsedOutput.grounded !== undefined && (
                    <div className="flex items-center justify-between p-2.5 bg-background rounded border shadow-sm">
                      <span className="text-sm font-medium">Factually Grounded</span>
                      {parsedOutput.grounded === null ? (
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-500/10 px-2 py-1 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> SKIPPED</span>
                      ) : parsedOutput.grounded ? (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> PASS</span>
                      ) : (
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1"><XCircle className="w-3 h-3"/> FAIL</span>
                      )}
                    </div>
                  )}
                  
                  {parsedOutput.confidence !== undefined && parsedOutput.confidence !== null && (
                    <div className="flex items-center justify-between p-2.5 bg-background rounded border shadow-sm">
                      <span className="text-sm font-medium">Grounding Confidence</span>
                      <span className="text-sm font-bold text-primary">{parsedOutput.confidence}</span>
                    </div>
                  )}

                  {parsedOutput.error && (
                    <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
                      <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-1">Notice</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{parsedOutput.error}</p>
                    </div>
                  )}

                  {parsedOutput.missing_information && parsedOutput.missing_information.length > 0 && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Missing Information Detected</p>
                      <ul className="text-xs text-foreground/80 leading-relaxed list-disc list-inside">
                        {parsedOutput.missing_information.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* FINAL OUTCOME ATTACHED TO CRITIQUE */}
                  {finalOutcome && (
                    <div className="mt-4 pt-4 border-t border-border">
                      {(() => {
                        const finalParsed = tryParseJSON(finalOutcome.output_summary)
                        if (finalParsed?.decision === 'accept') {
                          return (
                            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-md">
                              <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3"/> {finalParsed.final_action || "Verification Complete"}</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{finalParsed.reason || "The answer was successfully verified against the retrieved sources and delivered."}</p>
                            </div>
                          )
                        } else if (finalParsed?.decision === 'rewrite' || finalParsed?.decision === 'escalate') {
                          return (
                            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
                              <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-1 flex items-center gap-1.5"><RotateCcw className="w-3 h-3"/> {finalParsed.final_action || "Verification Incomplete"}</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{finalParsed.reason || "The critic detected missing information. ReForge automatically searched again using an improved query."}</p>
                            </div>
                          )
                        } else if (finalParsed?.decision === 'fail') {
                          return (
                            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md">
                              <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1.5"><XCircle className="w-3 h-3"/> {finalParsed.final_action || "Verification Failed"}</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{finalParsed.reason || "A sufficiently grounded answer could not be produced after multiple verification attempts."}</p>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* TECHNICAL DETAILS COLLAPSIBLE */}
              <div className="md:col-span-2 mt-4 pt-2 border-t">
                <div 
                  className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground select-none"
                  onClick={(e) => { e.stopPropagation(); setShowTechnical(!showTechnical); }}
                >
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showTechnical ? 'rotate-90' : ''}`} />
                  Technical Details
                </div>
                <AnimatePresence>
                  {showTechnical && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 p-3 bg-muted/20 border rounded text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-w-full">
                        <div className="mb-2"><strong>Node:</strong> {entry.node}</div>
                        <div className="mb-2"><strong>Input Payload:</strong><br/>{entry.input_summary}</div>
                        <div><strong>Output Payload:</strong><br/>{entry.output_summary}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}


export default function TracePage() {
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  
  const [traceData, setTraceData] = useState<TraceResponse | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingTrace, setLoadingTrace] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch Sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/v1/history")
        if (!res.ok) throw new Error("Failed to load sessions")
        const data = await res.json()
        setSessions(data)
      } catch (err: any) {
        setErrorMsg("Failed to load session history.")
      } finally {
        setLoadingSessions(false)
      }
    }
    fetchSessions()
  }, [])

  // Fetch Traces when session is selected
  useEffect(() => {
    if (!selectedSessionId) {
      setTraceData(null)
      return
    }
    
    const fetchTrace = async () => {
      setLoadingTrace(true)
      setErrorMsg(null)
      try {
        const res = await fetch(`/api/v1/trace/${selectedSessionId}`)
        if (!res.ok) throw new Error("Failed to fetch execution trace")
        const data = await res.json()
        setTraceData(data)
      } catch (err: any) {
        setErrorMsg("Failed to load trace for this session.")
        setTraceData(null)
      } finally {
        setLoadingTrace(false)
      }
    }
    fetchTrace()
  }, [selectedSessionId])

  // Group traces by attempt
  const groupTracesByAttempt = (traces: TraceEntry[]) => {
    const grouped = traces.reduce((acc, curr) => {
      if (!acc[curr.attempt]) acc[curr.attempt] = []
      acc[curr.attempt].push(curr)
      return acc
    }, {} as Record<number, TraceEntry[]>)
    return Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b))
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen">
      
      {/* Mobile Session Selector */}
      <div className="md:hidden p-4 border-b bg-muted/10 shrink-0">
        <Select value={selectedSessionId || ""} onValueChange={setSelectedSessionId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a chat session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>
                Session {shortenId(s.id)} - {s.message_count} msgs
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-72 flex-col border-r bg-muted/10 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Chat Sessions</h2>
        </div>
        <ScrollArea className="flex-1">
          {loadingSessions ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground mt-10">
              No sessions found.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex flex-col gap-1 border-l-4 ${
                    selectedSessionId === s.id ? 'bg-primary/10 text-primary border-primary font-semibold shadow-sm' : 'hover:bg-muted border-transparent font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate pr-2" title={s.title || "New Chat"}>
                      {s.title || "New Chat"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      {s.message_count} msgs
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>ID: {shortenId(s.id)}</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b shrink-0 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Verification Log</h1>
            <p className="text-muted-foreground text-sm">
              Understand how ReForge arrived at each answer.
            </p>
          </div>
          {selectedSessionId && (
            <Link href={`/chat?session=${selectedSessionId}`}>
              <motion.div whileHover={{ y: -1, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="outline" size="sm" className="shadow-sm group hover:shadow-md hover:border-primary/30 transition-all duration-300">
                  <MessageSquare className="w-4 h-4 mr-2 group-hover:text-primary transition-colors" />
                  Open Chat
                  <ChevronRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 -mr-2" />
                </Button>
              </motion.div>
            </Link>
          )}
        </div>

        <div className="flex-1 p-6">
          {errorMsg && (
            <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3">
              <XCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          {!selectedSessionId ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-64 flex flex-col items-center justify-center text-muted-foreground"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                <ShieldCheck className="w-16 h-16 mb-6 opacity-30 text-primary" />
              </motion.div>
              <p className="text-base font-medium max-w-sm text-center">
                Select a chat session to inspect the complete retrieval and verification pipeline.
              </p>
            </motion.div>
          ) : loadingTrace ? (
            <div className="space-y-4 max-w-3xl">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : traceData?.traces.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl m-4">
              <MessageSquare className="w-10 h-10 mb-4 opacity-30" />
              <p className="font-medium">No verification log is available for this conversation.</p>
              <p className="text-sm mt-1">This usually means the conversation was created before tracing was enabled.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full pb-10">
              <Accordion className="w-full space-y-4">
                {traceData?.traces.map((messageTrace, idx) => (
                  <AccordionItem 
                    key={messageTrace.message_id} 
                    value={messageTrace.message_id}
                    className="border rounded-xl bg-card shadow-sm overflow-hidden"
                  >
                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-semibold text-base">Assistant Response {idx + 1}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(messageTrace.timestamp)} • {messageTrace.trace_data.length} graph steps
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    
                    <AccordionContent className="px-5 pb-5 pt-2 border-t bg-muted/5">
                      <div className="mt-4 pl-2">
                        {groupTracesByAttempt(messageTrace.trace_data).map(([attempt, entries], attemptIdx, arr) => {
                          
                          // Filter out the internal nodes from standard rendering
                          const displayEntries = entries.filter(e => !['decision', 'router', 'rewrite'].includes(e.node))
                          const decisionEntry = entries.find(e => e.node === 'decision')

                          // Determine overall quality for the attempt based on the final decision
                          let badgeText = "Accepted"
                          let badgeClass = "bg-green-100 text-green-700 border-green-200"
                          
                          if (decisionEntry) {
                            try {
                              const parsedDecision = JSON.parse(decisionEntry.output_summary)
                              if (parsedDecision.decision === 'rewrite' || parsedDecision.decision === 'escalate') {
                                badgeText = "Retry Needed"
                                badgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200"
                              } else if (parsedDecision.decision === 'fail') {
                                badgeText = "Failed"
                                badgeClass = "bg-red-100 text-red-700 border-red-200"
                              }
                            } catch {
                              // Legacy
                              if (decisionEntry.output_summary.includes("fail")) {
                                badgeText = "Failed"
                                badgeClass = "bg-red-100 text-red-700 border-red-200"
                              }
                            }
                          }

                          return (
                            <div key={attempt} className="mb-6 relative">
                              {/* Attempt Header */}
                              <div className="flex items-center gap-3 mb-4 sticky top-0 bg-muted/5 py-2 z-20">
                                <h4 className="font-semibold text-sm">Iteration {attempt}</h4>
                                <Badge variant="outline" className={`text-xs ${badgeClass}`}>
                                  {badgeText}
                                </Badge>
                              </div>
                              
                              {/* Nodes in this iteration */}
                              <div className="ml-2">
                                {displayEntries.map((entry, i) => (
                                  <motion.div
                                    key={`${entry.node}-${i}`} // use node+index as key to prevent duplicate keys while preserving state
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.15, ease: "easeOut" }}
                                  >
                                    <TraceNode 
                                      entry={entry} 
                                      finalOutcome={entry.node === 'critique' ? decisionEntry : undefined}
                                    />
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

                        {/* Summary & Quality Badge */}
                        <div className="mt-8 pt-6 border-t border-border">
                          {(() => {
                            const lastAttemptGroup = groupTracesByAttempt(messageTrace.trace_data).pop()
                            if (!lastAttemptGroup) return null
                            const lastEntries = lastAttemptGroup[1]
                            const finalDecision = lastEntries.find(e => e.node === 'decision')
                            const retrievalEntry = lastEntries.find(e => e.node === 'retrieve')
                            
                            let qualityBadge = <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold text-sm">🟢 Highly Grounded</span>
                            if (finalDecision) {
                              try {
                                const parsed = JSON.parse(finalDecision.output_summary)
                                if (parsed.decision === 'fail') qualityBadge = <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold text-sm">🔴 Low Confidence</span>
                              } catch {
                                if (finalDecision.output_summary.includes("fail")) qualityBadge = <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold text-sm">🔴 Low Confidence</span>
                              }
                            }

                            let docsSearched = 0
                            let docsFound = 0
                            if (retrievalEntry) {
                                try {
                                    const parsed = JSON.parse(retrievalEntry.output_summary)
                                    docsSearched = parsed.snippet_count || 0
                                    docsFound = (parsed.documents && parsed.documents.length) || 0
                                } catch {}
                            }
                            
                            const totalTime = lastEntries.reduce((acc, curr) => acc + curr.execution_time_ms, 0)

                            return (
                              <div className="space-y-6">
                                <div>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Overall Quality</h4>
                                  {qualityBadge}
                                </div>
                                
                                <div className="bg-card border rounded-lg p-4 shadow-sm max-w-sm">
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Summary</h4>
                                  <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between"><span>✓ {docsSearched} source snippets searched</span></li>
                                    <li className="flex justify-between"><span>✓ {docsFound} documents contributed</span></li>
                                    <li className="flex justify-between"><span>✓ Draft generated</span></li>
                                    <li className="flex justify-between"><span>✓ Verification completed</span></li>
                                  </ul>
                                  <div className="mt-4 pt-3 border-t flex justify-between text-xs font-medium">
                                    <span className="text-muted-foreground">Total processing time</span>
                                    <span>{(totalTime / 1000).toFixed(1)} seconds</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </AccordionContent>

                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
