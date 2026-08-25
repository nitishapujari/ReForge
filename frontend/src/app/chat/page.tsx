"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Send, Bot, User, RefreshCw, AlertTriangle, FileText, CheckCircle2, Paperclip, Loader2, Copy, ThumbsUp, ThumbsDown, Check, ChevronDown, Search, GitBranch, Scale, X, Hash, Square, ArrowDown, Activity } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import TextareaAutosize from "react-textarea-autosize"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  attached_documents?: { document_id: string, filename: string }[]
  status?: "generating" | "done" | "error"
  agentStatuses?: { message: string, status: string }[]
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



function ChatContent() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [sessionId, setSessionId] = useState<string>("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Document @-mentions state
  const [availableDocs, setAvailableDocs] = useState<{ document_id: string, filename: string }[]>([])
  const [selectedDocs, setSelectedDocs] = useState<{ document_id: string, filename: string }[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)

  useEffect(() => {
    fetch("/api/v1/documents")
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          setAvailableDocs(data)
        }
      })
      .catch(err => console.error("Failed to fetch available docs:", err))
  }, [])

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRegenerate = async (assistantMessageId: string) => {
    if (isGenerating) return
    const assistantIdx = messages.findIndex(m => m.id === assistantMessageId)
    if (assistantIdx < 1) return
    const userMessage = messages.slice(0, assistantIdx).reverse().find(m => m.role === "user")
    if (!userMessage) return

    setMessages(prev => prev.map(m => 
      m.id === assistantMessageId 
        ? { ...m, content: "", status: "generating", metadata: undefined } 
        : m
    ))
    setIsGenerating(true)
    setSuggestions([])

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch("/api/v1/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          session_id: sessionId || null,
          document_ids: userMessage.attached_documents?.map(d => d.document_id) || [],
          regenerate_message_id: assistantMessageId
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      if (!reader) throw new Error("No reader from response body")

      let accumulatedAnswer = ""
      let finalMetadata: any = null
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        if (value) {
          buffer += decoder.decode(value, { stream: true })

          let boundaryIndex;
          while ((boundaryIndex = buffer.indexOf('\n\n')) >= 0) {
            const eventPayload = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);

            const lines = eventPayload.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim()
                if (dataStr === '[DONE]' || !dataStr) continue
                
                try {
                  const data = JSON.parse(dataStr)
                  if (data.type === 'token') {
                    accumulatedAnswer += data.content
                    setMessages((prev) => prev.map((m) => m.id === assistantMessageId ? { ...m, content: accumulatedAnswer } : m))
                  } else if (data.type === 'clear') {
                    accumulatedAnswer = ""
                    setMessages((prev) => prev.map((m) => m.id === assistantMessageId ? { ...m, content: accumulatedAnswer } : m))
                  } else if (data.type === 'status') {
                    setMessages((prev) => prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, agentStatuses: [...(m.agentStatuses || []), { message: data.message, status: data.status }] } : m
                    ))
                  } else if (data.type === 'error') {
                    setMessages((prev) => prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, status: "error", content: data.error || "An unexpected error occurred." } : m
                    ))
                    break
                  } else if (data.type === 'done') {
                    finalMetadata = {
                      response_type: data.response_type,
                      verification_status: data.verification_status,
                      grounded: data.grounded,
                      confidence: data.confidence,
                      attempts: data.attempts,
                      sources: data.sources,
                      trace_available: data.trace_available,
                      trace_data: data.trace_data,
                    }
                    setMessages((prev) => prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, content: accumulatedAnswer || data.final_answer || m.content, status: "done", metadata: finalMetadata } : m
                    ))
                  }
                } catch (e) {
                  console.error("Error parsing SSE data:", e, dataStr)
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) => prev.map((m) => m.id === assistantMessageId ? { ...m, status: "done" } : m))
      } else {
        console.error("Stream error:", err)
        setMessages((prev) => prev.map((m) =>
          m.id === assistantMessageId ? { ...m, status: "error", content: "Sorry, an error occurred while generating the response." } : m
        ))
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
      
      setIsLoadingSuggestions(true)
      fetch(`/api/v1/chat/${sessionId}/suggestions`)
        .then(res => res.json())
        .then(data => {
          if (data && data.suggestions) setSuggestions(data.suggestions)
        })
        .catch(err => console.error("Failed to fetch suggestions:", err))
        .finally(() => setIsLoadingSuggestions(false))
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && isAtBottom) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      })
    }
  }, [messages, isAtBottom])

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const atBottom = scrollHeight - scrollTop - clientHeight < 100
      setIsAtBottom(atBottom)
    }
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      })
      setIsAtBottom(true)
    }
  }

  const searchParams = useSearchParams()
  const sessionParam = searchParams.get('session')

  useEffect(() => {
    if (sessionParam) {
      if (sessionId === sessionParam && messages.length > 0) return;
      
      setSessionId(sessionParam)
      fetch(`/api/v1/history/${sessionParam}`)
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
    } else {
      setSessionId("")
      setMessages([])

      // Fetch dynamic initial suggestions
      setIsLoadingSuggestions(true)
      fetch(`/api/v1/chat/initial_suggestions`)
        .then(res => res.json())
        .then(data => {
          if (data && data.suggestions) {
            setInitialSuggestions(data.suggestions)
          }
        })
        .catch(err => console.error("Failed to fetch initial suggestions:", err))
        .finally(() => setIsLoadingSuggestions(false))
    }
  }, [sessionParam])

  useEffect(() => {
    const handleNewChat = () => {
      setSessionId("")
      setMessages([])
      setIsLoadingSuggestions(true)
      fetch(`/api/v1/chat/initial_suggestions`)
        .then(res => res.json())
        .then(data => {
          if (data && data.suggestions) {
            setInitialSuggestions(data.suggestions)
          }
        })
        .catch(err => console.error("Failed to fetch initial suggestions:", err))
        .finally(() => setIsLoadingSuggestions(false))
    }

    window.addEventListener("new-chat-clicked", handleNewChat)
    return () => window.removeEventListener("new-chat-clicked", handleNewChat)
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
        const data = await response.json()
        setSelectedDocs(prev => [...prev, { document_id: data.document_id, filename: file.name }])
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const handleSend = async (overrideInput?: string | React.MouseEvent | React.FormEvent) => {
    if (isGenerating) return
    const textToSend = typeof overrideInput === "string" ? overrideInput : input
    if (!textToSend.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend.trim(),
      attached_documents: selectedDocs.length > 0 ? [...selectedDocs] : undefined,
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "generating",
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    if (typeof overrideInput !== "string") {
      setInput("")
      setSelectedDocs([])
    }
    setIsGenerating(true)
    setSuggestions([])

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch("/api/v1/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userMessage.content,
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(selectedDocs.length > 0 ? { document_ids: selectedDocs.map(d => d.document_id) } : {})
        }),
        signal: abortController.signal
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
      let buffer = ""

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          buffer += decoder.decode(value, { stream: true })

          let boundaryIndex;
          while ((boundaryIndex = buffer.indexOf('\n\n')) >= 0) {
            const eventPayload = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);

            const lines = eventPayload.split("\n")

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
                  } else if (data.type === "status") {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, agentStatuses: [...(msg.agentStatuses || []), { message: data.message, status: data.status }] }
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
                      router.replace(`/chat?session=${data.session_id}`)
                      window.dispatchEvent(new Event("session-created"))
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

                    // Fetch suggestions asynchronously
                    const activeSessionId = data.session_id || sessionId
                    if (activeSessionId) {
                      fetch(`/api/v1/chat/${activeSessionId}/suggestions`)
                        .then(r => r.json())
                        .then(d => {
                          if (d.suggestions && d.suggestions.length > 0) {
                            setSuggestions(d.suggestions)
                          }
                        })
                        .catch(e => console.error("Failed to fetch suggestions:", e))
                    }
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
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, status: "done", content: msg.content || "_Generation stopped by user._" }
              : msg
          )
        )
      } else {
        console.error("Chat error:", error)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, status: "error", content: error.message || "An error occurred." }
              : msg
          )
        )
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
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
    if (mentionOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape" || e.key === "Tab")) {
      if (e.key === "Escape") {
        setMentionOpen(false)
        e.preventDefault()
      }
      if (e.key === "Enter" || e.key === "Tab") {
        // Let cmdk handle selection when mention dropdown is open without sending message
        return
      }
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isGenerating) {
        handleSend()
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    const mentionMatch = val.match(/(?:^|\s)@([a-zA-Z0-9_\-\.]*)$/)
    if (mentionMatch) {
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  const addDocumentMention = (doc: { document_id: string, filename: string }) => {
    if (!selectedDocs.find(d => d.document_id === doc.document_id)) {
      setSelectedDocs(prev => [...prev, doc])
    }
    setMentionOpen(false)

    // Replace the @query with empty string to remove the mention text from input while preserving leading whitespace
    const newValue = input.replace(/(^|\s)@([a-zA-Z0-9_\-\.]*)$/, '$1')
    setInput(newValue)
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

      <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollRef} onScroll={handleScroll}>
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground space-y-4"
              >
                <div className="relative h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center shadow-inner overflow-hidden border border-primary/20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(var(--primary),0.3)_360deg)] opacity-50"
                  />
                  <Bot className="h-10 w-10 text-primary relative z-10 drop-shadow-md" />
                </div>
                <div className="mb-6">
                  <p className="text-xl font-medium text-foreground mb-1">How can I help you today?</p>
                  <p className="text-sm">Ask a question and I'll search your documents.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full px-4 mt-6">
                  {isLoadingSuggestions ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className="h-[46px] rounded-2xl bg-card border border-border/50 shadow-sm animate-pulse"></div>
                    ))
                  ) : (
                    (initialSuggestions.length > 0 ? initialSuggestions : [
                      "Summarize my notes",
                      "Compare two documents",
                      "Find important topics",
                      "Explain difficult concepts"
                    ]).map((query, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInput(query);
                        }}
                        className="text-left px-5 py-4 rounded-2xl bg-card border border-border/50 hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-transparent hover:shadow-lg transition-all duration-300 text-sm shadow-sm group relative overflow-hidden"
                      >
                        <span className="text-foreground font-medium group-hover:text-primary transition-colors relative z-10">{query}</span>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          <Send className="h-4 w-4 text-primary" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
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
                          ) : (
                            <>
                              {/* Live Heartbeat during generation */}
                              {message.status === "generating" && (
                                <div className="text-[11px] mb-4 border rounded-lg bg-card overflow-hidden font-mono">
                                  <div className="p-3 bg-muted/10 space-y-2">
                                    {message.agentStatuses && message.agentStatuses.length > 0 ? (
                                      message.agentStatuses.map((s, i) => (
                                        <motion.div
                                          key={i}
                                          initial={{ opacity: 0, x: -5 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          className={cn("flex items-start gap-2",
                                            s.status === "warning" ? "text-orange-500" :
                                              s.status === "error" ? "text-destructive" :
                                                s.status === "success" ? "text-green-500" :
                                                  "text-muted-foreground"
                                          )}
                                        >
                                          {i === message.agentStatuses!.length - 1 && s.status !== "success" && s.status !== "error" ? (
                                            <Loader2 className="w-3 h-3 animate-spin shrink-0 mt-0.5" />
                                          ) : (
                                            <div className="w-3 h-3 flex items-center justify-center shrink-0 mt-0.5">
                                              <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                                            </div>
                                          )}
                                          {(() => {
                                            let text = s.message
                                            const isDone = i < message.agentStatuses!.length - 1 || message.status !== "generating"
                                            if (isDone) {
                                              text = text.replace("Searching documents...", "Searched documents")
                                                .replace("Drafting response...", "Drafted response")
                                                .replace("Critic evaluating draft...", "Evaluated draft accuracy")
                                            }
                                            return <span className="flex-1">{text}</span>
                                          })()}
                                        </motion.div>
                                      ))
                                    ) : (
                                      <div className="flex items-center gap-3 text-primary/80">
                                        <div className="relative flex h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                        </div>
                                        <span className="animate-pulse font-medium text-sm tracking-wide">Thinking...</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

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
                                        const queryMatch = trace.input_summary?.match(/"query":\s*"(.*?)"/)
                                        text = queryMatch ? `Searched documents for: "${queryMatch[1]}"` : "Retrieved information from documents."
                                      } else if (trace.node === 'generate') {
                                        icon = <Bot className="w-3 h-3 text-purple-500" />
                                        text = `Drafted response (Attempt ${trace.attempt})`
                                      } else if (trace.node === 'critique') {
                                        icon = <Scale className="w-3 h-3 text-orange-500" />
                                        if (trace.output_summary?.includes('"grounded": true')) {
                                          text = `Verified response accuracy against documents.`
                                        } else if (trace.output_summary?.includes('"grounded": false')) {
                                          text = `Rejected draft for lacking supporting evidence.`
                                        } else {
                                          text = `Accuracy verification unavailable.`
                                        }
                                      } else if (trace.node === 'rewrite') {
                                        icon = <RefreshCw className="w-3 h-3 text-indigo-500" />
                                        text = `Reformulated search query to try again.`
                                      } else if (trace.node === 'router') {
                                        icon = <GitBranch className="w-3 h-3 text-gray-500" />
                                        text = trace.decision === 'bypass' ? "Decided to use general knowledge (no documents needed)." : "Decided to search documents."
                                      } else if (trace.node === 'decision') {
                                        icon = <GitBranch className="w-3 h-3 text-gray-500" />
                                        if (trace.decision === 'accept') {
                                          if (trace.input_summary?.includes('"grounded": null')) {
                                            text = "Accepted best-effort answer (verification unavailable)."
                                          } else {
                                            text = "Accepted answer as accurate."
                                          }
                                        } else if (trace.decision === 'rewrite') {
                                          text = "Decided to retry formulation."
                                        } else if (trace.decision === 'web_search') {
                                          text = "Decided to fallback to web search."
                                        } else {
                                          text = `Decision: ${trace.decision}`
                                        }
                                      } else if (trace.node === 'web_search') {
                                        icon = <Search className="w-3 h-3 text-cyan-500" />
                                        text = "Searched the web for additional context."
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

                              {message.content && (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ node, ...props }) => {
                                      if (props.href?.startsWith('#citation-')) {
                                        const idx = parseInt(props.href.replace('#citation-', '')) - 1
                                        const source = (message.metadata?.sources?.[idx] || message.metadata?.sources?.[0]) as any
                                        if (!source) {
                                          return (
                                            <span className="inline-flex items-center justify-center w-5 h-5 ml-1 rounded-full bg-primary/5 text-muted-foreground cursor-not-allowed" title={`Source unavailable (tried index ${idx})`}>
                                              <FileText className="w-3 h-3 opacity-50" />
                                            </span>
                                          )
                                        }

                                        return (
                                          <HoverCard>
                                            <HoverCardTrigger>
                                              <span className="inline-flex items-center justify-center w-5 h-5 ml-1 rounded-full bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors">
                                                <FileText className="w-3 h-3" />
                                              </span>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="top" align="center" className="w-80 p-0 overflow-hidden border-primary/20 shadow-xl z-50">
                                              <div className="bg-primary/5 px-3 py-2 border-b border-border/50 flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-xs font-semibold text-primary truncate">{source.filename || `Source ${idx + 1}`}</span>
                                              </div>
                                              <div className="p-3 bg-card/95 backdrop-blur max-h-48 overflow-y-auto">
                                                <p className="text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap">
                                                  {source.chunks?.[0]?.content_preview || source.content_preview || "Snippet not available."}
                                                </p>
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                        )
                                      }
                                      return <a {...props} className="text-primary hover:underline" />
                                    }
                                  }}
                                >
                                  {message.content
                                    .replace(/I couldn't find any information about this in your uploaded documents, but based on my general knowledge:\s*/, "")
                                    .replace(/I couldn't find any information about this in your uploaded documents, and I do not have confident general knowledge about this topic\.?\s*/, "")
                                    .replace(/\[(\d+)\]/g, '[$1](#citation-$1)')}
                                </ReactMarkdown>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {message.attached_documents && message.attached_documents.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-1">
                              {message.attached_documents.map((doc, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 bg-primary-foreground/10 text-primary-foreground px-2.5 py-1 rounded-md text-xs font-medium border border-primary-foreground/20">
                                  <FileText className="w-3 h-3" />
                                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        </div>
                      )}
                    </div>

                    {message.role === "assistant" && message.metadata && message.status !== "error" && (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {(message.metadata.attempts ?? 0) > 1 && (
                          <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" title={`Answer was iteratively refined ${message.metadata.attempts} times before finalizing.`}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Self-Healed ({message.metadata.attempts} passes)
                          </Badge>
                        )}
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

                        {message.metadata.response_type === "GROUNDED" && message.metadata.sources && message.metadata.sources.length > 0 && expandedSources[message.id] && (
                          <div className="w-full mt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                              <FileText className="h-3 w-3 mr-1" /> Sources
                            </p>
                            <div className="flex flex-col gap-3">
                              {Object.values(
                                (message.metadata?.sources || []).reduce((acc: any, src: any) => {
                                  if (!acc[src.filename]) {
                                    acc[src.filename] = { ...src, chunks: [...(src.chunks || [])] }
                                  } else {
                                    acc[src.filename].chunks.push(...(src.chunks || []))
                                  }
                                  return acc
                                }, {})
                              ).map((src: any, idx: number) => (
                                <Card key={idx} className="bg-background/50 text-xs w-full">
                                  <CardContent className="p-3">
                                    <div className="flex justify-between items-start">
                                      <p className="font-semibold text-primary truncate flex-1 flex items-center">
                                        <FileText className="w-3.5 h-3.5 mr-1.5 text-primary/70" />
                                        {src.filename || `Source`}
                                      </p>
                                      <Badge variant="secondary" className="ml-2 text-[10px] shrink-0 font-normal">
                                        {src.chunks?.length || 1} match{(src.chunks?.length || 1) !== 1 ? 'es' : ''}
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
                      <div className="relative opacity-0 group-hover/message:opacity-100 hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1.5 mt-1 -ml-1 before:absolute before:-inset-y-4 before:-inset-x-2 before:-z-10 before:content-['']">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground rounded-md"
                          onClick={() => handleCopy(message.id, message.content)}
                        >
                          {copiedId === message.id ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copiedId === message.id ? "Copied" : "Copy"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-[10px] text-muted-foreground rounded-md"
                          onClick={() => handleRegenerate(message.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                        </Button>
                        {message.metadata?.sources && message.metadata.sources.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-6 px-2 text-[10px] rounded-md transition-colors", expandedSources[message.id] ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground")}
                            onClick={() => setExpandedSources(prev => ({ ...prev, [message.id]: !prev[message.id] }))}
                          >
                            <FileText className="h-3 w-3 mr-1" /> {expandedSources[message.id] ? "Hide Sources" : "View Sources"}
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-[10px] text-muted-foreground rounded-md" 
                          onClick={() => router.push(`/trace?session=${sessionId}`)}
                        >
                          <Activity className="h-3 w-3 mr-1" /> Verification Log
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

            {/* Suggestions */}
            {suggestions.length > 0 && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 mt-4 ml-12"
              >
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(suggestion)}
                    className="text-xs text-primary/80 bg-primary/10 hover:bg-primary/20 hover:text-primary transition-colors border border-primary/20 rounded-full px-4 py-1.5 font-medium flex items-center gap-1.5 text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-4 px-4 sm:px-6 z-20 pointer-events-none">
        <AnimatePresence>
          {!isAtBottom && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
            >
              <Button
                variant="outline"
                size="icon"
                className="rounded-full shadow-lg h-8 w-8 bg-background border-primary/20 text-foreground hover:bg-muted"
                onClick={scrollToBottom}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-3xl mx-auto relative flex flex-col gap-2 bg-background/60 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-2 shadow-xl hover:shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 focus-within:shadow-2xl focus-within:shadow-primary/20 transition-all duration-300 pointer-events-auto"
        >
          {/* Selected Document Badges */}
          {selectedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {selectedDocs.map(doc => (
                <Badge key={doc.document_id} variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/20 pr-1 py-0 border-primary/20">
                  <FileText className="w-3 h-3 mr-1" />
                  {doc.filename}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-primary/20 rounded-full"
                    onClick={() => setSelectedDocs(prev => prev.filter(d => d.document_id !== doc.document_id))}
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
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

            <Popover
              open={mentionOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setMentionOpen(false)
                }
              }}
            >
              <PopoverTrigger render={<div className="flex-1 relative" />} nativeButton={false}>
                <TextareaAutosize
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your documents..."
                  className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent py-3 px-3 w-full outline-none text-sm"
                  minRows={1}
                  maxRows={5}
                />
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" sideOffset={10}>
                <Command>
                  <CommandList>
                    <CommandEmpty>No documents found.</CommandEmpty>
                    <CommandGroup>
                      {availableDocs.filter(doc => {
                        const mentionMatch = input.match(/(?:^|\s)@([a-zA-Z0-9_\-\.]*)$/)
                        const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : ""
                        return doc.filename.toLowerCase().includes(mentionQuery)
                      }).map((doc) => (
                        <CommandItem
                          key={doc.document_id}
                          value={doc.filename}
                          onSelect={() => addDocumentMention(doc)}
                          onMouseDown={(e) => e.preventDefault()}
                          className="cursor-pointer"
                        >
                          <FileText className="mr-2 h-4 w-4 text-primary/70" />
                          <span className="truncate">{doc.filename}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {isGenerating ? (
              <Button
                size="icon"
                variant="destructive"
                className="shrink-0 rounded-xl h-10 w-10 mb-1 mr-1 shadow-md hover:shadow-lg transition-shadow"
                onClick={handleStop}
              >
                <Square className="h-4 w-4 fill-current" />
                <span className="sr-only">Stop generating</span>
              </Button>
            ) : (
              <Button
                size="icon"
                className="shrink-0 rounded-xl h-10 w-10 mb-1 mr-1 shadow-md hover:shadow-lg transition-shadow"
                disabled={!input.trim()}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            )}
          </div>
          <div className="px-4 pb-2 text-[10.5px] text-muted-foreground/70 -mt-1 select-none">
            Tip: Type @ to search within a specific document.
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <ChatContent />
    </Suspense>
  )
}
