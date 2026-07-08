"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Trash2, Search, Library, AlertCircle, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import Link from "next/link"

interface DocumentData {
  document_id: string
  filename: string
  chunk_count: number
  created_at: string
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [documentToDelete, setDocumentToDelete] = useState<DocumentData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch documents
  const fetchDocuments = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      const data: DocumentData[] = await res.json()
      // Sort by newest first
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setDocuments(data)
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // Filter and paginate
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const query = searchQuery.toLowerCase()
    return documents.filter(doc => doc.filename.toLowerCase().includes(query))
  }, [documents, searchQuery])

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage) || 1
  const currentDocuments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredDocuments.slice(start, start + itemsPerPage)
  }, [filteredDocuments, currentPage, itemsPerPage])

  // Pagination handlers
  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1))
  const handleNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1))
  
  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Delete document
  const handleDelete = async () => {
    if (!documentToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/documents/${documentToDelete.document_id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error("Failed to delete document")
      
      // Optimistic update
      setDocuments(prev => prev.filter(d => d.document_id !== documentToDelete.document_id))
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete document.")
    } finally {
      setIsDeleting(false)
      setDocumentToDelete(null)
    }
  }

  // Helpers
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getFileType = (filename: string) => {
    const ext = filename.split('.').pop()?.toUpperCase() || "UNKNOWN"
    return ext
  }

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
            {!loading && (
              <Badge variant="secondary" className="text-sm px-2 py-0.5 rounded-full">
                {documents.length} Document{documents.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Manage the documents ReForge uses to answer your questions.
          </p>
        </div>
        <Link href="/upload">
          <Button><Plus className="w-4 h-4 mr-2" /> Upload Document</Button>
        </Link>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{errorMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="border rounded-xl">
          <div className="p-4 flex gap-4 border-b">
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="border border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center bg-muted/20">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Library className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No documents found</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Your knowledge base is empty. Upload some PDF or TXT files to give ReForge context for your questions.
          </p>
          <Link href="/upload">
            <Button size="lg">Go to Upload Page</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Chunks</TableHead>
                  <TableHead className="text-right">Ingested On</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentDocuments.length > 0 ? (
                  currentDocuments.map((doc) => (
                    <TableRow key={doc.document_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 bg-primary/10 rounded flex items-center justify-center">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-medium truncate" title={doc.filename}>{doc.filename}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 font-medium">{getFileType(doc.filename)} Document</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                          Indexed
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {doc.chunk_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-200"
                          onClick={() => setDocumentToDelete(doc)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete {doc.filename}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No documents match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {filteredDocuments.length > itemsPerPage && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredDocuments.length)} of {filteredDocuments.length} results
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrevPage} 
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="text-sm font-medium mx-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleNextPage} 
                  disabled={currentPage === totalPages}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-foreground">"{documentToDelete?.filename}"</span> and its {documentToDelete?.chunk_count} chunks from the vector database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
