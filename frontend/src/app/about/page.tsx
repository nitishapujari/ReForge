"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Network, Database, Brain, Sparkles, BookOpen } from "lucide-react"

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
              ReForge is an advanced Retrieval-Augmented Generation (RAG) system built to eliminate hallucinations. Unlike standard RAG systems that blindly trust retrieved information, ReForge actively evaluates its own answers using an autonomous Critic Agent.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              If an answer is deemed ungrounded or missing critical context, the Self-Healing loop rewrites the query, expands the search depth, and tries again until absolute confidence is achieved.
            </p>
            <div className="pt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">Retrieval</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary">Generation</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary">Critic</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary">Decision Loop</Badge>
            </div>
          </CardContent>
        </Card>



        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Tech Stack
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-sm font-semibold">Backend</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>FastAPI</span>
                  <span>Python 3.11</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold">AI & Data</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>LangGraph</span>
                  <span>ChromaDB</span>
                  <span>Sentence Transformers</span>
                  <span>Gemini / Groq</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold">Frontend</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>Next.js 14+</span>
                  <span>React</span>
                  <span>TypeScript</span>
                  <span>Tailwind CSS</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-semibold">UI Components</span>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-2">
                  <span>shadcn/ui</span>
                  <span>Lucide Icons</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
