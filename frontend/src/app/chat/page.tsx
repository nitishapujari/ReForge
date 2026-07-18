"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Send, Bot, User, RefreshCw, AlertTriangle, FileText, CheckCircle2, Paperclip, Loader2, Copy, ThumbsUp, ThumbsDown, Check, ChevronDown, Search, GitBranch, Scale } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "generating" | "done" | "error"
  metadata?: {
    response_type?: string
    verification_status?: string
    grounded?: boolean
    confidence?: string
    attempts?: number
    sources?: Array<{ id: string, content: string, metadata: any }>
    trace_available?: boolean
    trace_data?: any[]
  }
}

function ThoughtProcess() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const sequence = [
      { text: "Scanning knowledge base...", duration: 800 },
      { text: "Evaluating context...", duration: 800 },
      { text: "Verifying relevance...", duration: 800 },
      { text: "Synthesizing response...", duration: 2000 }
    ]
    let current = 0
    let timeout: NodeJS.Timeout
    
    const run = () => {
      setPhase(current)
      timeout = setTimeout(() => {
        current = (current + 1) % sequence.length
        run()
      }, sequence[current].duration)
    }
    
    run()
    return () => clearTimeout(timeout)
  }, [])

  const phrases = [
    "Scanning knowledge base...",
    "Evaluating context...",
    "Verifying relevance...",
    "Synthesizing response..."
  ]

  return (
    <div className="h-6 flex items-center px-1 overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={phase}
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -15, opacity: 0, transition: { duration: 0.1 } }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-xs font-mono text-primary/70 flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          {phrases[phase]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [sessionId, setSessionId] = useState<string>("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const session = searchParams.get('session')
      if (session) {
        setSessionId(session)
        fetch(`/api/v1/history/${session}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.messages) {
              setMessages(data.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                status: "done",
                metadata: m.metadata || {}
              })))
            }
          })
          .catch(err => console.error("Failed to load session history:", err))
      }
    }
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    
    try {
      const response = await fetch("/api/v1/documents/upload", {
        method: "POST",
        body: formData
      })
      
      if (response.ok) {
        setMessages(prev => [
          ...prev, 
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `✅ Document **${file.name}** uploaded successfully. It is now being processed and will be available in your documents shortly.`
          }
        ])
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Upload failed: ${errorData.detail || response.statusText}`)
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "generating",
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput("")
    setIsGenerating(true)

    try {
      const response = await fetch("/api/v1/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userMessage.content,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let done = false
      let currentContent = ""

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim()
              if (!dataStr) continue
              
              try {
                const data = JSON.parse(dataStr)
                if (data.type === "token") {
                  currentContent += data.content
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: currentContent }
                        : msg
                    )
                  )
                } else if (data.type === "clear") {
                  currentContent = ""
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: "" }
                        : msg
                    )
                  )
                } else if (data.type === "done") {
                  if (!sessionId && data.session_id) {
                    setSessionId(data.session_id)
                  }
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            status: "done",
                            content: currentContent || data.final_answer || msg.content,
                            metadata: {
                              response_type: data.response_type,
                              verification_status: data.verification_status,
                              grounded: data.grounded,
                              confidence: data.confidence,
                              attempts: data.attempts,
                              sources: data.sources,
                              trace_available: data.trace_available,
                              trace_data: data.trace_data,
                            },
                          }
                        : msg
                    )
                  )
                } else if (data.type === "error") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, status: "error", content: data.error || "An unexpected error occurred." }
                        : msg
                    )
                  )
                  break
                }
              } catch (e) {
                console.error("Failed to parse SSE line:", line, e)
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, status: "error", content: error.message || "An error occurred." }
            : msg
        )
      )
    } finally {
      setIsGenerating(false)
      // Safety net: if the connection dropped cleanly but didn't finish, mark it as error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId && msg.status === "generating"
            ? { ...msg, status: "error", content: msg.content || "The connection to the server was lost." }
            : msg
        )
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 shrink-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            ReForge Assistant
          </h1>
          <p className="text-xs text-muted-foreground">Session: {sessionId || "Initializing..."}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
          <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground space-y-4"
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shadow-inner">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div className="mb-6">
                <p className="text-xl font-medium text-foreground mb-1">How can I help you today?</p>
                <p className="text-sm">Ask a question and I'll search your documents.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full px-4 mt-6">
                {[
                  "Summarize the key points from my documents",
                  "What are the main applications of a DBMS?",
                  "Explain the architecture mentioned in the notes",
                  "Can you find any specific dates or names?"
                ].map((query, i) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      setInput(query);
                    }}
                    className="text-left px-4 py-3 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-md transition-all text-sm shadow-sm group"
                  >
                    <span className="text-foreground group-hover:text-primary transition-colors">{query}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                  "flex gap-4",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 mt-1 border shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] group/message">
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border">
                        {message.status === "error" ? (
                          <div className="text-destructive flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            {message.content}
                          </div>
                        ) : message.content ? (
                          <>
                            {/* Always show thought process accordion if trace_data is available */}
                            {message.metadata?.trace_data && message.metadata.trace_data.length > 0 && (
                              <details className="group/trace text-xs mb-4 border rounded-lg bg-card overflow-hidden">
                                <summary className="cursor-pointer flex items-center justify-between p-2.5 bg-muted/50 hover:bg-muted/80 list-none">
                                  <div className="flex items-center gap-2 font-medium text-muted-foreground">
                                    <Bot className="w-3.5 h-3.5" /> AI Thought Process
                                  </div>
                                  <ChevronDown className="w-4 h-4 text-muted-foreground group-open/trace:rotate-180 transition-transform" />
                                </summary>
                                <div className="p-3 border-t space-y-3 bg-muted/10 font-mono text-[11px] text-muted-foreground">
                                  {message.metadata.trace_data.map((trace: any, i: number) => {
                                    let icon = <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    let text = `Completed step: ${trace.node}`
                                    
                                    if (trace.node === 'retrieve') {
                                      icon = <Search className="w-3 h-3 text-blue-500" />
                                      const queryMatch = trace.input_summary?.match(/query='(.*?)'/)
                                      text = queryMatch ? `Searched documents for: "${queryMatch[1]}"` : "Retrieved information from documents."
                                    } else if (trace.node === 'generate') {
                                      icon = <Bot className="w-3 h-3 text-purple-500" />
                                      text = `Drafted response (Attempt ${trace.attempt})`
                                    } else if (trace.node === 'critique') {
                                      icon = <Scale className="w-3 h-3 text-orange-500" />
                                      text = trace.decision === 'rewrite' ? `Critic rejected draft for lacking grounding. Retrying...` : `Critic verified response is grounded.`
                                    } else if (trace.node === 'rewrite') {
                                      icon = <RefreshCw className="w-3 h-3 text-indigo-500" />
                                      text = `Reformulated search query to try again.`
                                    } else if (trace.node === 'router') {
                                      icon = <GitBranch className="w-3 h-3 text-gray-500" />
                                      text = trace.decision === 'bypass' ? "Decided to bypass RAG (general conversation)." : "Decided to route to RAG."
                                    } else if (trace.node === 'decision') {
                                      icon = <GitBranch className="w-3 h-3 text-gray-500" />
                                      text = trace.decision === 'accept' ? "Accepted answer as grounded." : "Decided to retry formulation."
                                    }

                                    return (
                                      <div key={i} className="flex gap-2.5 items-start">
                                        <div className="shrink-0 mt-0.5">{icon}</div>
                                        <div className="flex-1 leading-relaxed">
                                          <span className={trace.decision === 'rewrite' ? "text-orange-500/90" : ""}>{text}</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </details>
                            )}
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </>
                        ) : message.status === "generating" ? (
                          <div className="text-xs mb-2 border rounded-lg bg-card overflow-hidden">
                            <div className="flex items-center justify-between p-2.5 bg-muted/50">
                              <div className="flex items-center gap-2 font-medium text-muted-foreground animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> <ThoughtProcess />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    )}
                  </div>
                  
                  {message.role === "assistant" && message.metadata && message.status !== "error" && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {/* Removed the old Self-Healed dropdown since we now have the global thought process */}
                      {message.metadata.response_type === "GROUNDED" && message.metadata.verification_status === "UNAVAILABLE" ? (
                        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Grounding verification unavailable
                        </Badge>
                      ) : message.metadata.response_type === "GROUNDED" && message.metadata.grounded ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)] dark:shadow-[0_0_10px_rgba(74,222,128,0.15)] relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Grounded
                        </Badge>
                      ) : message.metadata.response_type === "GROUNDED" && message.metadata.grounded === false ? (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Ungrounded
                        </Badge>
                      ) : message.metadata.response_type === "GENERAL_KNOWLEDGE" ? (
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          <Bot className="h-3 w-3 mr-1" />
                          General Knowledge
                        </Badge>
                      ) : null}
                      {message.metadata.response_type === "GROUNDED" && message.metadata.verification_status !== "UNAVAILABLE" && message.metadata.confidence !== undefined && (
                        <span className="text-xs text-muted-foreground flex items-center">
                          Confidence: {message.metadata.confidence}
                        </span>
                      )}
                      
                      {message.metadata.response_type === "GROUNDED" && message.metadata.sources && message.metadata.sources.length > 0 && (
                        <div className="w-full mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <FileText className="h-3 w-3 mr-1" /> Sources
                          </p>
                          <div className="flex flex-col gap-3">
                            {message.metadata.sources.map((src: any, idx: number) => (
                              <Card key={idx} className="bg-background/50 text-xs w-full">
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-start">
                                    <p className="font-semibold text-primary truncate flex-1">
                                      {src.filename || `Source ${idx + 1}`}
                                    </p>
                                    <Badge variant="secondary" className="ml-2 text-[10px] shrink-0 font-normal">
                                      {src.chunks?.length || 1} match{(src.chunks?.length || 1) > 1 ? 'es' : ''}
                                    </Badge>
                                  </div>
                                  
                                  {src.chunks && src.chunks.length > 0 ? (
                                    <details className="mt-2 group">
                                      <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-primary list-none flex items-center gap-1 select-none">
                                        <span className="group-open:hidden">▶ Show Matches</span>
                                        <span className="hidden group-open:inline">▼ Hide Matches</span>
                                      </summary>
                                      <div className="mt-2 space-y-3 pl-2 border-l-2 border-primary/20">
                                        {src.chunks.map((chunk: any, cIdx: number) => {
                                          // Clean up the text: replace all newlines and excessive spaces with a single space.
                                          const cleanedText = chunk.content_preview
                                            .replace(/[\r\n]+/g, ' ')
                                            .replace(/\s{2,}/g, ' ')
                                            .trim();
                                          
                                          return (
                                            <div key={cIdx} className="text-muted-foreground bg-muted/50 rounded-lg p-3 mt-2 mb-3 border border-border/50 shadow-sm relative overflow-hidden group/chunk">
                                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 group-hover/chunk:bg-primary transition-colors"></div>
                                              <div className="font-semibold text-foreground/80 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <FileText className="h-3 w-3 text-primary/60" />
                                                Match {cIdx + 1}
                                              </div>
                                              <div className="break-words whitespace-pre-wrap leading-relaxed text-[11px] font-mono text-muted-foreground">
                                                {cleanedText}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </details>
                                  ) : (
                                    <p className="text-muted-foreground line-clamp-2 mt-1">
                                      {src.content_preview}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {message.status === "error" && (
                    <div className="text-xs text-destructive flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Failed to generate response.
                    </div>
                  )}

                  {/* Message Action Bar */}
                  {message.role === "assistant" && message.status === "done" && (
                    <div className="opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center gap-1.5 mt-1 -ml-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary rounded-md"
                        onClick={() => handleCopy(message.id, message.content)}
                      >
                        {copiedId === message.id ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedId === message.id ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary rounded-md">
                        <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                      </Button>
                      <div className="flex items-center gap-0 border rounded-md overflow-hidden bg-background ml-1">
                        <Button variant="ghost" size="icon" className="h-6 w-7 rounded-none text-muted-foreground hover:text-green-600 hover:bg-green-500/10" title="Good response">
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <div className="w-px h-3 bg-border"></div>
                        <Button variant="ghost" size="icon" className="h-6 w-7 rounded-none text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Bad response">
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <Avatar className="h-8 w-8 mt-1 border shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))
          )}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-4 px-4 sm:px-6 z-20">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-3xl mx-auto relative flex items-end gap-2 bg-background/60 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-2 shadow-xl hover:shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 focus-within:shadow-2xl focus-within:shadow-primary/20 transition-all duration-300"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".pdf,.txt,.md,.csv" 
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl h-10 w-10 mb-1 ml-1 text-muted-foreground hover:text-foreground"
            onClick={handleUploadClick}
            disabled={isUploading || isGenerating}
            title="Upload Document"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            <span className="sr-only">Upload</span>
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent py-3 px-3 w-full"
            rows={1}
            disabled={isGenerating}
          />
          <Button
            size="icon"
            className="shrink-0 rounded-xl h-10 w-10 mb-1 mr-1"
            disabled={!input.trim() || isGenerating}
            onClick={handleSend}
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
