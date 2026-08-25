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
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { FileText, Trash2, Search, Library, AlertCircle, ChevronLeft, ChevronRight, Plus, MoreVertical, PenLine, Info, RefreshCw } from "lucide-react"
import Link from "next/link"

interface DocumentData {
  document_id: string
  filename: string
  chunk_count: number
  created_at: string
  status?: string
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

  const [documentToRename, setDocumentToRename] = useState<DocumentData | null>(null)
  const [newFilename, setNewFilename] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

  const [documentToView, setDocumentToView] = useState<DocumentData | null>(null)

  // Fetch documents
  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
      setErrorMsg(null)
    }
    try {
      const res = await fetch("/api/v1/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      const data: DocumentData[] = await res.json()
      // Sort by newest first
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setDocuments(data)
    } catch (err: any) {
      if (showLoading) setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // Poll for status updates if any document is processing
  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing')
    if (!hasProcessing) return

    const interval = setInterval(() => {
      fetchDocuments(false)
    }, 3000)

    return () => clearInterval(interval)
  }, [documents])

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
      const res = await fetch(`/api/v1/documents/${documentToDelete.document_id}`, {
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

  // Rename document
  const handleRename = async () => {
    if (!documentToRename || !newFilename.trim() || newFilename === documentToRename.filename) {
      setDocumentToRename(null)
      return
    }
    setIsRenaming(true)
    try {
      const res = await fetch(`/api/v1/documents/${documentToRename.document_id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newFilename.trim() })
      })
      if (!res.ok) throw new Error("Failed to rename document")
      
      const data = await res.json()
      setDocuments(prev => prev.map(d => d.document_id === documentToRename.document_id ? { ...d, filename: data.filename } : d))
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to rename document.")
    } finally {
      setIsRenaming(false)
      setDocumentToRename(null)
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
        <div className="border border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/30 transition-colors duration-300">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Library className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No documents uploaded yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Upload your first document to start building your knowledge base.
          </p>
          <Link href="/upload">
            <Button size="lg" className="hover:shadow-md transition-shadow">Upload Document</Button>
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
                  <TableHead className="text-right">Segments</TableHead>
                  <TableHead className="text-right">Uploaded On</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentDocuments.length > 0 ? (
                  currentDocuments.map((doc) => (
                    <TableRow key={doc.document_id} className="group hover:bg-muted/50 cursor-pointer transition-colors duration-200 border-b border-border/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 bg-primary/10 rounded flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-medium truncate transition-colors group-hover:text-primary" title={doc.filename}>{doc.filename}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 font-medium">{getFileType(doc.filename)} Document</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.status === 'processing' ? (
                          <Badge variant="outline" className="w-24 justify-center bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 group-hover:border-amber-500/40 transition-colors">
                            Processing
                          </Badge>
                        ) : doc.status === 'failed' ? (
                          <Badge variant="outline" className="w-24 justify-center bg-destructive/10 text-destructive border-destructive/20 group-hover:border-destructive/40 transition-colors">
                            Failed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="w-24 justify-center bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
                            Indexed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm group-hover:text-foreground transition-colors">
                        {doc.chunk_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground group-hover:text-foreground transition-colors">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100 hover:bg-muted hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={(e) => { e.stopPropagation(); setDocumentToRename(doc); setNewFilename(doc.filename); }}>
                              <PenLine className="h-4 w-4 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={(e) => { e.stopPropagation(); setDocumentToView(doc); }}>
                              <Info className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); setDocumentToDelete(doc); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Rename Dialog */}
      <Dialog open={!!documentToRename} onOpenChange={(open) => !open && setDocumentToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Enter a new name for the document.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filename" className="sr-only">Filename</Label>
            <Input
              id="filename"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              disabled={isRenaming}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentToRename(null)} disabled={isRenaming}>Cancel</Button>
            <Button onClick={handleRename} disabled={isRenaming || !newFilename.trim()}>
              {isRenaming ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!documentToView} onOpenChange={(open) => !open && setDocumentToView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>Information about the ingested document.</DialogDescription>
          </DialogHeader>
          {documentToView && (
            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground font-medium">Filename</span>
                <span className="col-span-2 break-all">{documentToView.filename}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground font-medium">Document ID</span>
                <span className="col-span-2 break-all font-mono text-xs">{documentToView.document_id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground font-medium">Type</span>
                <span className="col-span-2">{getFileType(documentToView.filename)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground font-medium">Status</span>
                <span className="col-span-2 capitalize">{documentToView.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="text-muted-foreground font-medium">Vector Chunks</span>
                <span className="col-span-2">{documentToView.chunk_count.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pb-2">
                <span className="text-muted-foreground font-medium">Ingested On</span>
                <span className="col-span-2">{new Date(documentToView.created_at).toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDocumentToView(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
