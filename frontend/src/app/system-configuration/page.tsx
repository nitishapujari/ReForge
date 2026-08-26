"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Server, Search, RefreshCw, Eye, FileText, Info, Database, Layers, CheckCircle2, AlertCircle } from "lucide-react"
import { motion, Variants } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

export default function SystemConfigurationPage() {
  const [healthInfo, setHealthInfo] = useState<{
    provider: string
    model: string
    status: string
    vectorDb: string
    database: string
  } | null>(null)
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/health")
      .then(res => res.json())
      .then(data => {
        if (data.active_provider) {
          const providerName = data.active_provider.charAt(0).toUpperCase() + data.active_provider.slice(1)
          const isOnline = data.status === "healthy"
          setHealthInfo({
            provider: providerName,
            model: data.llm || "Unknown",
            status: isOnline ? "Operational" : "Degraded",
            vectorDb: data.chromadb === "connected" ? "ChromaDB" : "Disconnected",
            database: data.database === "connected" ? "Connected" : "Disconnected"
          })
        }
      })
      .catch(() => {
        setHealthInfo({
          provider: "Unknown",
          model: "Unknown",
          status: "Offline",
          vectorDb: "Unknown",
          database: "Unknown"
        })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Current runtime overview for the ReForge pipeline.
          </p>
        </div>
        {/* Runtime Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card shadow-sm w-fit">
          <div className="relative flex h-3 w-3">
            {healthInfo?.status === "Operational" ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : loading ? (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-muted"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            )}
          </div>
          <span className="text-sm font-medium">
            {loading ? "Checking status..." : healthInfo?.status || "Unknown"}
          </span>
        </div>
      </motion.div>

      <TooltipProvider delay={300}>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid gap-8"
        >
          
          {/* 1. AI Engine - Highest Emphasis */}
          <motion.div variants={itemVariants} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Card className="hover:shadow-lg transition-all duration-300 border-primary/20 hover:border-primary/40 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50" />
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Server className="w-6 h-6 text-primary" /> AI Engine
                </CardTitle>
                <CardDescription>
                  The active language model and core infrastructure driving ReForge.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/40 p-4 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
                    <p className="text-xs text-muted-foreground mb-1.5 uppercase font-semibold flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5" /> Provider
                    </p>
                    <p className="font-semibold text-lg">{loading ? "..." : (healthInfo?.provider || "N/A")}</p>
                  </div>
                  <div className="bg-muted/40 p-4 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
                    <p className="text-xs text-muted-foreground mb-1.5 uppercase font-semibold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Model
                    </p>
                    <p className="font-semibold text-lg">{loading ? "..." : (healthInfo?.model || "N/A")}</p>
                  </div>
                  <div className="bg-muted/40 p-4 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
                    <p className="text-xs text-muted-foreground mb-1.5 uppercase font-semibold flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> Vector Database
                    </p>
                    <p className="font-semibold text-lg">{loading ? "..." : (healthInfo?.vectorDb || "N/A")}</p>
                  </div>
                  <div className="bg-muted/40 p-4 rounded-xl border border-primary/10 hover:border-primary/30 transition-colors">
                    <p className="text-xs text-muted-foreground mb-1.5 uppercase font-semibold flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> Database
                    </p>
                    <p className="font-semibold text-lg">{loading ? "..." : (healthInfo?.database || "Unknown")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 2. Retrieval Pipeline */}
            <motion.div variants={itemVariants} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Card className="h-full hover:shadow-md transition-all duration-300 border-border/50 hover:border-blue-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-blue-500" /> Retrieval Pipeline
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="ml-auto cursor-help flex items-center justify-center">
                          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Searches indexed document chunks before generation.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    Every question is answered using your uploaded documents. Relevant document chunks are retrieved before answer generation to ensure grounded responses.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* 3. Self-Healing Workflow */}
            <motion.div variants={itemVariants} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Card className="h-full hover:shadow-md transition-all duration-300 border-border/50 hover:border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-purple-500" /> Self-Healing Workflow
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="ml-auto cursor-help flex items-center justify-center">
                          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Retries retrieval automatically when confidence is low.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    If the system detects that an answer is incomplete, unsupported, or lacks sufficient context, it automatically performs another retrieval cycle before generating the final response.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* 4. Explainability */}
            <motion.div variants={itemVariants} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Card className="h-full hover:shadow-md transition-all duration-300 border-border/50 hover:border-emerald-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-emerald-500" /> Explainability
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="ml-auto cursor-help flex items-center justify-center">
                          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Shows why the final answer was generated.</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium mb-1 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Source Attribution
                    </p>
                    <p className="text-xs text-muted-foreground pl-3.5">Every claim is linked directly to the original document chunk it was extracted from.</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confidence Evaluation
                    </p>
                    <p className="text-xs text-muted-foreground pl-3.5">Responses are actively scored based on their accuracy against the retrieved context.</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Grounded Responses
                    </p>
                    <p className="text-xs text-muted-foreground pl-3.5">The system prevents hallucination by strictly refusing to answer questions outside the scope of your uploaded documents.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* 5. Supported Documents */}
            <motion.div variants={itemVariants} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Card className="h-full hover:shadow-md transition-all duration-300 border-border/50 hover:border-orange-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-500" /> Supported Formats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {["PDF", "DOCX", "CSV", "TXT", "MD", "PNG", "JPG"].map((ext) => (
                      <motion.div 
                        key={ext}
                        whileHover={{ scale: 1.05, y: -2 }}
                        className="flex items-center gap-2 bg-muted/40 hover:bg-muted/80 px-3 py-1.5 rounded-lg border border-border/50 hover:border-orange-500/30 transition-colors cursor-default shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">{ext}</span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

        </motion.div>
      </TooltipProvider>
    </div>
  )
}
