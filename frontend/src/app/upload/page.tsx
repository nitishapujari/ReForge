"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { UploadCloud, FileText, Trash2, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react"

type UploadItem = {
  id: string
  file: File
  isUploading: boolean
  status: string | null
  errorMsg: string | null
  successData: { filename: string; document_id: string; message: string } | null
  duplicateData: { filename: string; existing_document_id: string; message: string } | null
  pollAborter?: AbortController
}

export default function UploadPage() {
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (selectedFile: File) => {
    if (selectedFile.size === 0) {
      return { valid: false, error: "File is empty." }
    }
    
    const isValidType = selectedFile.type === "application/pdf" || 
                        selectedFile.type === "text/plain" ||
                        selectedFile.name.endsWith(".pdf") ||
                        selectedFile.name.endsWith(".txt")
                        
    if (!isValidType) {
      return { valid: false, error: "Invalid file type. Please upload a .pdf or .txt file." }
    }
    
    // Check max size (20MB)
    if (selectedFile.size > 20 * 1024 * 1024) {
      return { valid: false, error: "File is too large. Maximum size is 20MB." }
    }
    
    return { valid: true }
  }

  const handleFilesSelect = (files: FileList | File[]) => {
    setGlobalError(null)
    const newItems: UploadItem[] = []
    const errors: string[] = []

    Array.from(files).forEach(file => {
      const validation = validateFile(file)
      if (validation.valid) {
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          isUploading: false,
          status: null,
          errorMsg: null,
          successData: null,
          duplicateData: null
        })
      } else {
        errors.push(`${file.name}: ${validation.error}`)
      }
    })

    if (errors.length > 0) {
      setGlobalError(errors.join(" | "))
    }

    if (newItems.length > 0) {
      setUploadQueue(prev => [...prev, ...newItems])
    }
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

  const removeFile = (id: string) => {
    setUploadQueue(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.pollAborter) {
        item.pollAborter.abort()
      }
      return prev.filter(i => i.id !== id)
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const updateItem = (id: string, updates: Partial<UploadItem>) => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
  }

  const pollDocumentStatus = async (itemId: string, documentId: string, abortSignal: AbortSignal) => {
    while (!abortSignal.aborted) {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/documents/${documentId}`, {
          signal: abortSignal
        })
        if (res.ok) {
          const data = await res.json()
          updateItem(itemId, { status: data.status })
          
          if (data.status === "completed") {
            updateItem(itemId, {
              successData: {
                filename: data.filename,
                document_id: data.document_id,
                message: "Document uploaded and indexed successfully."
              },
              isUploading: false
            })
            break
          } else if (data.status === "failed") {
            updateItem(itemId, {
              errorMsg: "Document indexing failed. Please try again.",
              status: null,
              isUploading: false
            })
            break
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log("Polling aborted for", itemId)
          break
        }
        console.error("Failed to poll status", err)
      }
      
      // Wait 1 second before polling again
      if (!abortSignal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  const startUpload = async (item: UploadItem, replace: boolean = false) => {
    if (!item.file) return

    const aborter = new AbortController()
    updateItem(item.id, {
      isUploading: true,
      status: "uploading",
      errorMsg: null,
      successData: null,
      duplicateData: replace ? null : item.duplicateData,
      pollAborter: aborter
    })

    const formData = new FormData()
    formData.append("file", item.file)

    try {
      const endpoint = replace && item.duplicateData 
        ? `http://127.0.0.1:8000/api/v1/documents/${item.duplicateData.existing_document_id}`
        : "http://127.0.0.1:8000/api/v1/documents/upload"
        
      const response = await fetch(endpoint, {
        method: replace ? "PUT" : "POST",
        body: formData,
        signal: aborter.signal
      })

      if (!response.ok) {
        let errorText = "Failed to upload document."
        try {
          const errJson = await response.json()
          if (errJson.detail) {
            errorText = errJson.detail
          }
        } catch (e) {
          errorText = `Server error: ${response.status}`
        }
        throw new Error(errorText)
      }

      const data = await response.json()
      
      if (data.duplicate) {
        updateItem(item.id, {
          duplicateData: {
            filename: data.filename,
            existing_document_id: data.existing_document_id,
            message: data.message
          },
          isUploading: false,
          status: null
        })
        return // Wait for user action
      }

      // Start polling
      pollDocumentStatus(item.id, data.document_id, aborter.signal)
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateItem(item.id, { isUploading: false, status: null })
      } else {
        updateItem(item.id, {
          errorMsg: err.message || "An unexpected error occurred.",
          isUploading: false,
          status: null
        })
      }
    }
  }

  const handleUploadAll = () => {
    uploadQueue.forEach(item => {
      if (!item.isUploading && !item.successData && !item.duplicateData) {
        startUpload(item)
      }
    })
  }

  const cancelUpload = (id: string) => {
    removeFile(id)
  }

  // Format file size nicely
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const pendingItems = uploadQueue.filter(i => !i.isUploading && !i.successData && !i.duplicateData)
  const isAnyUploading = uploadQueue.some(i => i.isUploading)

  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-start py-12 min-h-[calc(100vh-3rem)]">
      <div className="w-full max-w-2xl text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Documents</h1>
        <p className="text-muted-foreground">Select multiple PDF or TXT files to add to the knowledge base.</p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        
        {globalError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 text-destructive text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{globalError}</div>
          </div>
        )}

        {/* Upload Area */}
        <div 
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer bg-card
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <UploadCloud className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Click or drag files to upload</h3>
          <p className="text-sm text-muted-foreground mb-4">Supported formats: PDF, TXT (Max 20MB)</p>
          <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Browse Files
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.txt,application/pdf,text/plain"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesSelect(e.target.files)
              }
            }}
          />
        </div>

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="space-y-4">
            {uploadQueue.map(item => (
              <Card key={item.id} className="overflow-hidden shadow-sm">
                <div className="p-4 flex items-center justify-between bg-muted/30 border-b">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate text-sm" title={item.file.name}>{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(item.file.size)}
                      </p>
                    </div>
                  </div>
                  <div>
                    {!item.successData && (
                      <Button variant="ghost" size="sm" onClick={() => cancelUpload(item.id)} className="text-muted-foreground hover:text-destructive">
                        {item.isUploading ? "Cancel" : <X className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-card">
                  {/* Success */}
                  {item.successData && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Indexed successfully.
                    </div>
                  )}

                  {/* Error */}
                  {item.errorMsg && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {item.errorMsg}
                    </div>
                  )}

                  {/* Duplicate */}
                  {item.duplicateData && (
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>{item.duplicateData.message}</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="default" size="sm" onClick={() => startUpload(item, true)}>
                          Replace Document
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {item.isUploading && item.status && (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 text-xs ${item.status === 'uploading' ? 'text-primary font-medium' : item.status !== 'failed' ? 'text-muted-foreground' : ''}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'uploading' ? 'bg-primary animate-pulse' : item.status !== 'failed' ? 'bg-muted-foreground' : 'bg-muted'}`} />
                        Uploading...
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${item.status === 'extracting' ? 'text-primary font-medium' : (['chunking', 'embedding', 'completed'].includes(item.status) ? 'text-muted-foreground' : 'text-muted-foreground/30')}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'extracting' ? 'bg-primary animate-pulse' : (['chunking', 'embedding', 'completed'].includes(item.status) ? 'bg-muted-foreground' : 'bg-muted')}`} />
                        Extracting Text
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${item.status === 'chunking' ? 'text-primary font-medium' : (['embedding', 'completed'].includes(item.status) ? 'text-muted-foreground' : 'text-muted-foreground/30')}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'chunking' ? 'bg-primary animate-pulse' : (['embedding', 'completed'].includes(item.status) ? 'bg-muted-foreground' : 'bg-muted')}`} />
                        Chunking Document
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${item.status === 'embedding' ? 'text-primary font-medium' : (item.status === 'completed' ? 'text-muted-foreground' : 'text-muted-foreground/30')}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'embedding' ? 'bg-primary animate-pulse' : (item.status === 'completed' ? 'bg-muted-foreground' : 'bg-muted')}`} />
                        Generating Embeddings & Saving
                      </div>
                    </div>
                  )}
                  
                  {/* Idle/Pending */}
                  {!item.isUploading && !item.status && !item.errorMsg && !item.successData && !item.duplicateData && (
                    <div className="text-xs text-muted-foreground">Waiting to upload...</div>
                  )}
                </div>
              </Card>
            ))}

            {pendingItems.length > 0 && (
              <div className="pt-4 flex justify-end">
                <Button onClick={handleUploadAll} disabled={isAnyUploading}>
                  {isAnyUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Start Upload ({pendingItems.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
