"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Server, Search, RefreshCw, Eye, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { motion, Variants } from "framer-motion"

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
            status: isOnline ? "Online" : "Degraded"
          })
        }
      })
      .catch(() => {
        setHealthInfo({
          provider: "Unknown",
          model: "Unknown",
          status: "Offline"
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
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Current runtime overview for the ReForge pipeline.
        </p>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-6"
      >
        
        {/* 1. AI Engine */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> AI Engine
            </CardTitle>
            <CardDescription>
              The active language model driving ReForge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 p-4 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Provider</p>
                <p className="font-medium text-lg">{loading ? "..." : (healthInfo?.provider || "N/A")}</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Model</p>
                <p className="font-medium text-lg">{loading ? "..." : (healthInfo?.model || "N/A")}</p>
              </div>
            </div>
          </CardContent>
          </Card>
        </motion.div>

        {/* 2. Retrieval Pipeline */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" /> Retrieval Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              Every question is answered using your uploaded documents. Relevant document chunks are retrieved before answer generation to ensure grounded responses.
            </p>
          </CardContent>
          </Card>
        </motion.div>

        {/* 3. Self-Healing Workflow */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-500" /> Self-Healing Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              If the system detects that an answer is incomplete, unsupported, or lacks sufficient context, it automatically performs another retrieval cycle before generating the final response.
            </p>
          </CardContent>
          </Card>
        </motion.div>

        {/* 4. Explainability */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-500" /> Explainability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium mb-1">Source Attribution</p>
              <p className="text-sm text-muted-foreground">Every claim is linked directly to the original document chunk it was extracted from.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Confidence Evaluation</p>
              <p className="text-sm text-muted-foreground">Responses are actively scored based on their accuracy against the retrieved context.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Grounded Responses</p>
              <p className="text-sm text-muted-foreground">The system prevents hallucination by strictly refusing to answer questions outside the scope of your uploaded documents.</p>
            </div>
          </CardContent>
          </Card>
        </motion.div>

        {/* 5. Supported Documents */}
        <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" /> Supported Formats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg border">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">PDF</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg border">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">TXT</span>
              </div>
            </div>
          </CardContent>
          </Card>
        </motion.div>

      </motion.div>
    </div>
  )
}
