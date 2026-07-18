"use client"

import Link from "next/link"

import { useState, useEffect, useMemo } from "react"
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
  XCircle, RotateCcw, HelpCircle, Search, Bot, Scale, GitBranch, Edit3, MessageSquare,
  FileText, Zap, BarChart3, Database
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
const TraceNode = ({ entry, attemptStatus }: { entry: TraceEntry, attemptStatus: string }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const getIcon = () => {
    switch(entry.node) {
      case 'retrieve': return <Search className="w-4 h-4 text-blue-500" />
      case 'generate': return <Bot className="w-4 h-4 text-purple-500" />
      case 'critic': return <Scale className="w-4 h-4 text-orange-500" />
      case 'decision': return <GitBranch className="w-4 h-4 text-gray-500" />
      case 'rewrite': return <Edit3 className="w-4 h-4 text-indigo-500" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getStatusIndicator = () => {
    if (entry.decision === 'fail') return <span className="flex items-center text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3 mr-1"/> Failed</span>
    if (entry.decision === 'rewrite') return <span className="flex items-center text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full"><RotateCcw className="w-3 h-3 mr-1"/> Retry</span>
    if (entry.decision === 'accept' || entry.node === 'generate') return <span className="flex items-center text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1"/> Success</span>
    return <span className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1"/> Done</span>
  }

  // Attempt to parse out confidence/grounded if present in output summary for Critic
  const tryParseJSON = (str: string) => {
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  const parsedOutput = tryParseJSON(entry.output_summary)

  const getHumanReadableTitle = () => {
    switch(entry.node) {
      case 'retrieve': return "Searching Context"
      case 'generate': return "Drafting Response"
      case 'critique': return "Verifying Accuracy"
      case 'rewrite': return "Rewriting Search Query"
      case 'router': return "Initial Routing"
      case 'decision': return "Routing Decision"
      default: return entry.node
    }
  }

  const getHumanReadableDescription = () => {
    if (entry.node === 'critique' && entry.decision === 'rewrite') return "The AI Critic rejected the draft for lacking grounded context. Triggering a retry."
    if (entry.node === 'critique' && entry.decision === 'accept') return "The AI Critic verified that the draft is grounded."
    if (entry.node === 'router' && entry.decision === 'bypass') return "General conversation detected. Bypassing document retrieval."
    if (entry.node === 'router' && entry.decision === 'retrieve') return "Question requires external knowledge. Routing to RAG pipeline."
    if (entry.node === 'decision') return "Determining next steps based on critic feedback."
    if (entry.node === 'retrieve') {
      const queryMatch = entry.input_summary.match(/query='(.*?)'/)
      if (queryMatch) return `Searched documents for: "${queryMatch[1]}"`
      return "Retrieving relevant information from documents."
    }
    if (entry.node === 'rewrite') return "Reformulating the search query to find better information."
    if (entry.node === 'generate') return "The AI formulated a draft response."
    return "Processing step."
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
              <p className="text-xs text-muted-foreground mt-0.5">{getHumanReadableDescription()}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 mt-1.5 font-medium">
                <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {entry.execution_time_ms.toFixed(0)} ms</span>
                <span>•</span>
                <span>Attempt {entry.attempt}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusIndicator()}
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded Details - User Friendly View */}
        {isExpanded && (
          <div className="p-5 border-t bg-card text-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Parse and display friendly metrics based on node type */}
              {entry.node === 'retrieve' && (
                <>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Search className="w-3 h-3"/> Search Query</p>
                    <p className="font-medium text-foreground text-sm">{entry.input_summary.match(/query='(.*?)'/)?.[1] || "N/A"}</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Database className="w-3 h-3"/> Context Snippets Retrieved</p>
                    <p className="font-medium text-foreground text-sm">{entry.output_summary.match(/found (\d+) docs/)?.[1] || "0"}</p>
                  </div>
                  {entry.output_summary.match(/best_score=([0-9.]+)/) && (
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50 md:col-span-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><BarChart3 className="w-3 h-3"/> Top Relevance Score</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full max-w-xs bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${parseFloat(entry.output_summary.match(/best_score=([0-9.]+)/)?.[1] || "0") * 100}%` }}></div>
                        </div>
                        <span className="text-xs font-semibold">{parseFloat(entry.output_summary.match(/best_score=([0-9.]+)/)?.[1] || "0").toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {entry.node === 'generate' && (
                <>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><FileText className="w-3 h-3"/> Context Documents Used</p>
                    <p className="font-medium text-foreground text-sm">{entry.input_summary.match(/context_docs=(\d+)/)?.[1] || "0"}</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Edit3 className="w-3 h-3"/> Draft Length</p>
                    <p className="font-medium text-foreground text-sm">{entry.output_summary.match(/answer_len=(\d+)/)?.[1] || "0"} characters</p>
                  </div>
                  {entry.output_summary.match(/sources=(\d+)/) && (
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50 md:col-span-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3"/> Sources Cited</p>
                      <p className="font-medium text-foreground text-sm">{entry.output_summary.match(/sources=(\d+)/)?.[1]}</p>
                    </div>
                  )}
                </>
              )}

              {entry.node === 'critique' && parsedOutput && (
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50 md:col-span-2 space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Scale className="w-3 h-3"/> Evaluation Results</p>
                  
                  {parsedOutput.grounded !== undefined && (
                    <div className="flex items-center justify-between p-2.5 bg-background rounded border shadow-sm">
                      <span className="text-sm font-medium">Factually Grounded</span>
                      {parsedOutput.grounded ? 
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> PASS</span> : 
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1"><XCircle className="w-3 h-3"/> FAIL</span>
                      }
                    </div>
                  )}
                  
                  {parsedOutput.confidence && (
                    <div className="flex items-center justify-between p-2.5 bg-background rounded border shadow-sm">
                      <span className="text-sm font-medium">AI Confidence</span>
                      <span className="text-sm font-bold text-primary">{parsedOutput.confidence}</span>
                    </div>
                  )}

                  {parsedOutput.missing_information && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Missing Information Detected</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{parsedOutput.missing_information}</p>
                    </div>
                  )}
                </div>
              )}

              {/* General Fallback for other nodes or unparsed data */}
              {entry.node !== 'retrieve' && entry.node !== 'generate' && (!parsedOutput || entry.node !== 'critique') && (
                <div className="bg-muted/30 p-3 rounded-lg border border-border/50 md:col-span-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Action Summary</p>
                  <p className="text-sm text-foreground/90">{entry.output_summary.replace(/[{}"']+/g, ' ')}</p>
                </div>
              )}
            </div>

            {/* View Raw Technical Data Toggle (Optional for power users) */}
            <details className="mt-4 group/raw">
              <summary className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer list-none flex items-center gap-1 hover:text-primary transition-colors w-max">
                <ChevronRight className="w-3 h-3 group-open/raw:rotate-90 transition-transform"/> View Raw Technical Data
              </summary>
              <div className="mt-3 p-3 bg-black/40 rounded-lg border border-border/50 space-y-3 font-mono text-[10px] text-muted-foreground">
                <div>
                  <span className="text-primary/70 block mb-1">Input Context:</span>
                  <div className="break-all whitespace-pre-wrap bg-black/40 p-2 rounded">{entry.input_summary}</div>
                </div>
                <div>
                  <span className="text-primary/70 block mb-1">Output Payload:</span>
                  <div className="break-all whitespace-pre-wrap bg-black/40 p-2 rounded">{entry.output_summary}</div>
                </div>
                {entry.decision && (
                  <div>
                    <span className="text-primary/70 block mb-1">Branch Decision:</span>
                    <div className="bg-black/40 p-2 rounded">{entry.decision}</div>
                  </div>
                )}
              </div>
            </details>
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
        const res = await fetch("http://127.0.0.1:8000/api/v1/history")
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
        const res = await fetch(`http://127.0.0.1:8000/api/v1/trace/${selectedSessionId}`)
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
                  className={`w-full text-left p-3 rounded-lg transition-colors flex flex-col gap-1 ${
                    selectedSessionId === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
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
              <Button variant="outline" size="sm" className="shadow-sm">
                <MessageSquare className="w-4 h-4 mr-2" />
                Open Chat
              </Button>
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
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Activity className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a chat session from the list to view its verification log.</p>
            </div>
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
                          // Determine status of attempt
                          const lastEntry = entries[entries.length - 1]
                          let badgeText = "Accepted"
                          let badgeClass = "bg-green-100 text-green-700 border-green-200"
                          
                          if (lastEntry.decision === 'rewrite') {
                            badgeText = "Retry"
                            badgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200"
                          } else if (lastEntry.decision === 'fail') {
                            badgeText = "Failed"
                            badgeClass = "bg-red-100 text-red-700 border-red-200"
                          }

                          return (
                            <div key={attempt} className="mb-6 relative">
                              {/* Attempt Header */}
                              <div className="flex items-center gap-3 mb-4 sticky top-0 bg-muted/5 py-2 z-20">
                                <h4 className="font-semibold text-sm">Attempt {attempt}</h4>
                                <Badge variant="outline" className={`text-xs ${badgeClass}`}>
                                  {badgeText}
                                </Badge>
                              </div>
                              
                              {/* Nodes in this attempt */}
                              <div className="ml-2">
                                {entries.map((entry, i) => (
                                  <TraceNode 
                                    key={i} 
                                    entry={entry} 
                                    attemptStatus={badgeText}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
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
