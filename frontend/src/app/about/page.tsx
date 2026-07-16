"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Sparkles, LayoutTemplate } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">About ReForge</h1>
        <p className="text-muted-foreground mt-1">
          A Self-Healing RAG Pipeline designed for absolute accuracy.
        </p>
      </div>

      <div className="grid gap-6">
        
        {/* Project Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Project Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              ReForge is an advanced Retrieval-Augmented Generation (RAG) system built to eliminate hallucinations by actively evaluating its own answers and repairing them when necessary.
            </p>
          </CardContent>
        </Card>

        {/* Architecture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-primary" /> Architecture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              The pipeline consists of a multi-agent workflow that orchestrates document ingestion, semantic retrieval, answer generation, and a critical decision node that routes poor responses back to the retrieval phase.
            </p>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Technology Stack
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-sm font-semibold">Backend</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>FastAPI</span>
                  <span>Python 3.11</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold">AI Frameworks</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>LangGraph</span>
                  <span>ChromaDB</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold">Frontend</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>Next.js 14+</span>
                  <span>React</span>
                  <span>Tailwind CSS</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
