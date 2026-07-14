"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { UploadCloud, FileText, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{
    filename: string
    document_id: string
    message: string
  } | null>(null)
  const [duplicateData, setDuplicateData] = useState<{
    filename: string
    existing_document_id: string
    message: string
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (selectedFile: File) => {
    setErrorMsg(null)
    setSuccessData(null)
    
    if (selectedFile.size === 0) {
      setErrorMsg("The selected file is empty.")
      return false
    }
    
    const isValidType = selectedFile.type === "application/pdf" || 
                        selectedFile.type === "text/plain" ||
                        selectedFile.name.endsWith(".pdf") ||
                        selectedFile.name.endsWith(".txt")
                        
    if (!isValidType) {
      setErrorMsg("Invalid file type. Please upload a .pdf or .txt file.")
      return false
    }
    
    // Check max size (20MB)
    if (selectedFile.size > 20 * 1024 * 1024) {
      setErrorMsg("File is too large. Maximum size is 20MB.")
      return false
    }
    
    return true
  }

  const handleFileSelect = (selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile)
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
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const clearFile = () => {
    setFile(null)
    setErrorMsg(null)
    setSuccessData(null)
    setDuplicateData(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setErrorMsg(null)
    setSuccessData(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/documents/upload", {
        method: "POST",
        body: formData,
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
        setDuplicateData({
          filename: data.filename,
          existing_document_id: data.existing_document_id,
          message: data.message
        })
        return // Wait for user action
      }

      setSuccessData(data)
      setFile(null) // Clear selection on success
      
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleReplace = async () => {
    if (!file || !duplicateData?.existing_document_id) return

    setIsUploading(true)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/documents/${duplicateData.existing_document_id}`, {
        method: "PUT",
        body: formData,
      })

      if (!response.ok) {
        let errorText = "Failed to replace document."
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
      setSuccessData(data)
      setDuplicateData(null)
      setFile(null)
      
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setIsUploading(false)
    }
  }

  // Format file size nicely
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <div className="flex-1 p-6 flex items-center justify-center min-h-[calc(100vh-3rem)]">
      <Card className="w-full max-w-xl mx-auto shadow-sm border-muted">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Upload Documents</CardTitle>
          <CardDescription>
            Upload PDF or TXT documents to expand ReForge's knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Success Banner */}
          {successData && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Document uploaded successfully!</p>
                <p><span className="font-medium text-emerald-700 dark:text-emerald-300">File:</span> {successData.filename}</p>
                <p><span className="font-medium text-emerald-700 dark:text-emerald-300">Details:</span> {successData.message}</p>
                <p className="text-xs mt-2 opacity-80 font-mono text-emerald-700 dark:text-emerald-300">ID: {successData.document_id}</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Duplicate Banner */}
          {duplicateData && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-3 text-amber-700 dark:text-amber-400">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Document Conflict</p>
                  <p>{duplicateData.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button variant="outline" size="sm" onClick={clearFile} disabled={isUploading}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleReplace} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                  Replace
                </Button>
              </div>
            </div>
          )}

          {/* Upload Area or Selected File */}
          {!file && !isUploading ? (
            <div 
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <UploadCloud className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Click or drag file to upload</h3>
              <p className="text-sm text-muted-foreground mb-4">Supported formats: PDF, TXT (Max 20MB)</p>
              <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Browse Files
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0])
                  }
                }}
              />
            </div>
          ) : file ? (
            /* Selected File Preview */
            <div className="border rounded-xl p-4 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="overflow-hidden">
                  <p className="font-medium truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.size)} • {file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain')}
                  </p>
                </div>
              </div>
              {!isUploading && (
                <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ) : null}
          
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 bg-muted/10 rounded-b-xl">
          <Button variant="ghost" onClick={clearFile} disabled={isUploading || !file}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading || !!duplicateData}
            className="w-48"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading & Processing...
              </>
            ) : (
              "Upload Document"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
