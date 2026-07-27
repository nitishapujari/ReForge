"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UploadCloud, FileText, Trash2, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type TaskStatus = "idle" | "uploading" | "extracting text" | "chunking document" | "generating embeddings" | "saving document" | "indexed successfully" | "duplicate" | "error" | "canceled"

interface UploadTask {
  id: string
  file: File
  status: TaskStatus
  document_id?: string
  errorMsg?: string
  duplicateData?: any
  abortController?: AbortController
  progress: number
}

const STAGES: TaskStatus[] = [
  "extracting text",
  "chunking document",
  "generating embeddings",
  "saving document"
]

function DataParticles({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl opacity-30 mix-blend-screen">
       {[...Array(15)].map((_, i) => (
         <motion.div
           key={i}
           initial={{ x: -20, y: Math.random() * 80 + 10, opacity: 0, scale: 0, rotate: 0 }}
           animate={{ x: 800, opacity: [0, 0.8, 0], scale: [0, 1.5, 0], rotate: 180 }}
           transition={{ duration: 1.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2, ease: "linear" }}
           className="absolute w-1.5 h-1.5 bg-current shadow-[0_0_10px_currentColor] rounded-sm"
         />
       ))}
    </div>
  )
}

export default function UploadPage() {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (selectedFile: File): string | null => {
    if (selectedFile.size === 0) return "The selected file is empty."
    
    const isValidType = selectedFile.type === "application/pdf" || 
                        selectedFile.type === "text/plain" ||
                        selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                        selectedFile.type === "text/csv" ||
                        selectedFile.type === "text/markdown" ||
                        selectedFile.type === "image/png" ||
                        selectedFile.type === "image/jpeg" ||
                        selectedFile.name.endsWith(".pdf") ||
                        selectedFile.name.endsWith(".txt") ||
                        selectedFile.name.endsWith(".docx") ||
                        selectedFile.name.endsWith(".csv") ||
                        selectedFile.name.endsWith(".md") ||
                        selectedFile.name.endsWith(".png") ||
                        selectedFile.name.endsWith(".jpg")
                        
    if (!isValidType) return "Invalid file type. Please upload a PDF, TXT, DOCX, CSV, MD, PNG, or JPG file."
    
    if (selectedFile.size > 20 * 1024 * 1024) return "File is too large. Maximum size is 20MB."
    
    return null
  }

  const handleFilesSelect = (files: FileList | File[]) => {
    const newTasks: UploadTask[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const error = validateFile(file)
      
      const task: UploadTask = {
        id: Math.random().toString(36).substring(7) + Date.now().toString(),
        file,
        status: error ? "error" : "idle",
        errorMsg: error || undefined,
        progress: error ? 0 : 0
      }
      
      newTasks.push(task)
    }
    
    setTasks(prev => [...prev, ...newTasks])
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files)
    }
  }

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const startUpload = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status !== "idle") return

    const abortController = new AbortController()
    updateTask(taskId, { status: "uploading", progress: 10, abortController, errorMsg: undefined, duplicateData: undefined })

    const formData = new FormData()
    formData.append("file", task.file)

    try {
      const response = await fetch("/api/v1/documents/upload", {
        method: "POST",
        body: formData,
        signal: abortController.signal
      })

      if (!response.ok) {
        let errorText = "Failed to upload document."
        try {
          const errJson = await response.json()
          if (errJson.detail) errorText = errJson.detail
        } catch (e) {}
        throw new Error(errorText)
      }

      const data = await response.json()
      
      if (data.duplicate) {
        updateTask(taskId, {
          status: "duplicate",
          duplicateData: {
            filename: data.filename,
            existing_document_id: data.existing_document_id,
            message: data.message
          },
          progress: 0
        })
        return
      }

      updateTask(taskId, { document_id: data.document_id, status: STAGES[0], progress: 20 })
      startPolling(taskId, data.document_id)
      
    } catch (err: any) {
      if (err.name === "AbortError") {
        updateTask(taskId, { status: "canceled", progress: 0 })
      } else {
        updateTask(taskId, { status: "error", errorMsg: err.message || "An unexpected error occurred.", progress: 0 })
      }
    }
  }

  const handleReplace = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.duplicateData?.existing_document_id) return

    const abortController = new AbortController()
    updateTask(taskId, { status: "uploading", progress: 10, abortController, errorMsg: undefined, duplicateData: undefined })

    const formData = new FormData()
    formData.append("file", task.file)

    try {
      const response = await fetch(`/api/v1/documents/${task.duplicateData.existing_document_id}`, {
        method: "PUT",
        body: formData,
        signal: abortController.signal
      })

      if (!response.ok) {
        let errorText = "Failed to replace document."
        try {
          const errJson = await response.json()
          if (errJson.detail) errorText = errJson.detail
        } catch (e) {}
        throw new Error(errorText)
      }

      const data = await response.json()
      updateTask(taskId, { document_id: data.document_id || task.duplicateData.existing_document_id, status: STAGES[0], progress: 20 })
      startPolling(taskId, data.document_id || task.duplicateData.existing_document_id)
      
    } catch (err: any) {
      if (err.name === "AbortError") {
        updateTask(taskId, { status: "canceled", progress: 0 })
      } else {
        updateTask(taskId, { status: "error", errorMsg: err.message || "An unexpected error occurred.", progress: 0 })
      }
    }
  }

  const startPolling = (taskId: string, documentId: string) => {
    let stageIndex = 0
    let progress = 20

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/v1/documents")
        if (!response.ok) return
        
        const docs = await response.json()
        const doc = docs.find((d: any) => d.document_id === documentId)

        if (!doc) return // Might be deleted or not yet visible

        if (doc.status === "completed") {
          clearInterval(pollInterval)
          updateTask(taskId, { status: "indexed successfully", progress: 100 })
        } else if (doc.status === "failed") {
          clearInterval(pollInterval)
          updateTask(taskId, { status: "error", errorMsg: doc.error_message || "Backend processing failed.", progress: 0 })
        } else {
          // Simulate progression
          stageIndex = Math.min(stageIndex + 1, STAGES.length - 1)
          progress = Math.min(progress + 15, 90)
          updateTask(taskId, { status: STAGES[stageIndex], progress })
        }
      } catch (e) {
        console.error("Polling error", e)
      }
    }, 2000)
  }

  const cancelTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.status === "uploading" && task.abortController) {
      task.abortController.abort()
      updateTask(taskId, { status: "canceled", progress: 0 })
      return
    }

    if (task.document_id && !["indexed successfully", "error", "canceled"].includes(task.status)) {
      // It's processing in the backend. Call DELETE to stop it.
      try {
        await fetch(`/api/v1/documents/${task.document_id}`, { method: "DELETE" })
      } catch (err) {
        console.error("Failed to cancel on backend", err)
      }
      updateTask(taskId, { status: "canceled", progress: 0 })
      return
    }

    // If it's just idle, error, or already finished, we can just remove it
    removeTask(taskId)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "indexed successfully": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      case "error": return "text-destructive bg-destructive/10 border-destructive/20"
      case "duplicate": return "text-amber-500 bg-amber-500/10 border-amber-500/20"
      case "canceled": return "text-muted-foreground bg-muted/50 border-muted"
      case "idle": return "text-foreground bg-muted/30 border-muted"
      default: return "text-primary bg-primary/10 border-primary/20"
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-1 p-6 flex flex-col items-center min-h-[calc(100vh-3rem)]"
    >
      <div className="w-full max-w-3xl mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Documents</h1>
        <p className="text-muted-foreground">Select multiple files to add to your documents.</p>
      </div>

      <motion.div 
        animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`w-full max-w-3xl border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer mb-8
          ${isDragging 
            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 brightness-110' 
            : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm'}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <UploadCloud className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {isDragging ? "Drop files here to upload" : "Click or drag files to upload"}
        </h3>
        
        <div className="flex flex-col items-center gap-1 mb-6 text-sm text-muted-foreground">
          <p>Supported formats: <span className="font-medium text-foreground/80">PDF, TXT, DOCX, CSV, MD, PNG, JPG</span></p>
          <p className="text-xs opacity-70">Maximum size: 20MB per file</p>
        </div>

        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
          <Button 
            variant="outline" 
            type="button" 
            className="hover:shadow-md transition-shadow duration-300"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            Browse Files
          </Button>
        </motion.div>
        <input 
          type="file" 
          multiple
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.txt,.docx,.csv,.md,.png,.jpg,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/markdown,image/png,image/jpeg"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesSelect(e.target.files)
            }
            if (fileInputRef.current) fileInputRef.current.value = ""
          }}
        />
      </motion.div>

      <div className="w-full max-w-3xl space-y-4">
        <AnimatePresence mode="popLayout">
        {tasks.map(task => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            key={task.id} 
            className={`border rounded-xl p-4 flex flex-col gap-4 ${getStatusColor(task.status)} transition-colors relative overflow-hidden`}
          >
            <DataParticles active={!["idle", "error", "duplicate", "canceled", "indexed successfully"].includes(task.status)} />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-10 h-10 shrink-0 bg-background/50 rounded-lg flex items-center justify-center border shadow-sm">
                  <FileText className="w-5 h-5 opacity-80" />
                </div>
                <div className="overflow-hidden">
                  <p className="font-medium truncate" title={task.file.name}>{task.file.name}</p>
                  <div className="flex items-center gap-2 text-xs opacity-80 mt-1">
                    <span>{formatSize(task.file.size)}</span>
                    <span>•</span>
                    <span className="capitalize font-medium">
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {task.status === "idle" && (
                  <Button variant="default" size="sm" onClick={() => startUpload(task.id)}>
                    Upload
                  </Button>
                )}
                {task.status === "duplicate" && (
                  <Button variant="default" size="sm" onClick={() => handleReplace(task.id)}>
                    Replace
                  </Button>
                )}
                
                {(!["indexed successfully", "error", "canceled", "duplicate", "idle"].includes(task.status)) && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                    <Button variant="secondary" size="sm" onClick={() => cancelTask(task.id)}>
                      Cancel
                    </Button>
                  </>
                )}
                
                {task.status === "indexed successfully" && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                )}
                
                {["indexed successfully", "error", "canceled", "idle", "duplicate"].includes(task.status) && (
                  <Button variant="ghost" size="icon" onClick={() => cancelTask(task.id)} className="opacity-70 hover:opacity-100 hover:bg-background/50 rounded-full h-8 w-8 ml-1">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {(!["idle", "error", "duplicate", "canceled"].includes(task.status)) && (
              <div className="w-full bg-background/50 rounded-full h-1.5 overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.5 }}
                  className="bg-current h-full absolute left-0 top-0" 
                />
                <motion.div 
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent"
                />
              </div>
            )}

            {/* Error or Duplicate Messages */}
            {task.errorMsg && (
              <div className="text-sm font-medium mt-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {task.errorMsg}
              </div>
            )}
            {task.duplicateData && (
              <div className="text-sm mt-1">
                <p>{task.duplicateData.message}</p>
              </div>
            )}
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
