"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cpu, Search, Activity, ShieldCheck, FileText } from "lucide-react"

export default function SystemConfigurationPage() {
  const [provider, setProvider] = useState<string>("Loading...")
  const [model, setModel] = useState<string>("...")
  const [status, setStatus] = useState<string>("Checking...")

  useEffect(() => {
    fetch("/api/v1/health")
      .then(res => res.json())
      .then(data => {
        if (data.active_provider) {
          const name = data.active_provider.charAt(0).toUpperCase() + data.active_provider.slice(1)
          setProvider(name)
          setModel(data.active_model || "")
          setStatus("Online")
        } else {
          setProvider("Unknown")
          setStatus("Offline")
        }
      })
      .catch(() => {
        setProvider("Error")
        setStatus("Offline")
      })
  }, [])

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Current runtime settings and system architecture.
        </p>
      </div>

      <div className="grid gap-6">
        {/* 1. AI Engine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" /> AI Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Provider</span>
                <p className="text-lg font-semibold">{provider}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Model</span>
                <p className="text-lg font-semibold">{model}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <p className="text-lg font-semibold">
                  <Badge variant={status === "Online" ? "default" : "destructive"} className="mt-1">
                    {status}
                  </Badge>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Retrieval Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" /> Retrieval Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Every question is answered using your uploaded knowledge base. Relevant document chunks are retrieved before answer generation to ensure grounded responses.
            </p>
          </CardContent>
        </Card>

        {/* 3. Self-Healing Workflow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Self-Healing Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              If the system detects that an answer is incomplete, unsupported, or lacks sufficient context, it automatically performs another retrieval cycle before generating the final response.
            </p>
          </CardContent>
        </Card>

        {/* 4. Explainability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Explainability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-1">Source Attribution</h4>
              <p className="text-sm text-muted-foreground">Generated facts are traced back to exact chunks in your uploaded documents.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Confidence Evaluation</h4>
              <p className="text-sm text-muted-foreground">Answers are scored before reaching you to ensure accuracy and relevance.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Grounded Responses</h4>
              <p className="text-sm text-muted-foreground">The system rejects unverified claims that are not present in your knowledge base.</p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Supported Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Supported Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The following formats are currently supported for knowledge base ingestion:
            </p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-sm px-3 py-1 bg-muted/50">PDF</Badge>
              <Badge variant="outline" className="text-sm px-3 py-1 bg-muted/50">TXT</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
