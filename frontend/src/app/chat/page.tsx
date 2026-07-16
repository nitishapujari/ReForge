"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Send, Bot, User, RefreshCw, AlertTriangle, FileText, CheckCircle2, Paperclip, Loader2 } from "lucide-react"

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
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [sessionId, setSessionId] = useState<string>("")

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
                            metadata: {
                              response_type: data.response_type,
                              verification_status: data.verification_status,
                              grounded: data.grounded,
                              confidence: data.confidence,
                              attempts: data.attempts,
                              sources: data.sources,
                              trace_available: data.trace_available,
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
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">How can I help you today?</p>
                <p className="text-sm">Ask a question and I'll search your documents.</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
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
                
                <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]">
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
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        ) : message.status === "generating" ? (
                          <div className="flex items-center gap-2 h-6">
                            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    )}
                  </div>
                  
                  {message.role === "assistant" && message.metadata && message.status !== "error" && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {message.metadata.response_type === "GROUNDED" && message.metadata.attempts && message.metadata.attempts > 1 && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Self-Healed ({message.metadata.attempts} attempts)
                        </Badge>
                      )}
                      {message.metadata.response_type === "GROUNDED" && message.metadata.verification_status === "UNAVAILABLE" ? (
                        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Grounding verification unavailable
                        </Badge>
                      ) : message.metadata.response_type === "GROUNDED" && message.metadata.grounded ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Grounded
                        </Badge>
                      ) : message.metadata.response_type === "GROUNDED" && message.metadata.grounded === false ? (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Ungrounded
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
                                        {src.chunks.map((chunk: any, cIdx: number) => (
                                          <div key={cIdx} className="text-muted-foreground">
                                            <span className="font-semibold text-primary/70 mr-1">Match {cIdx + 1}:</span>
                                            <span className="break-words whitespace-pre-wrap">{chunk.content_preview}</span>
                                          </div>
                                        ))}
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
                </div>

                {message.role === "user" && (
                  <Avatar className="h-8 w-8 mt-1 border shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-4 px-4 sm:px-6 z-20">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-card border rounded-2xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
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
        </div>
      </div>
    </div>
  )
}
