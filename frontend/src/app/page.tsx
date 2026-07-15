"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Bot, ShieldAlert, Sparkles, Activity, FileText } from "lucide-react"
import { Logo } from "@/components/logo"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function HomePage() {
  const [provider, setProvider] = useState<string>("Loading...")

  useEffect(() => {
    fetch("/api/v1/health")
      .then(res => res.json())
      .then(data => {
        if (data.active_provider) {
          // Capitalize first letter
          const name = data.active_provider.charAt(0).toUpperCase() + data.active_provider.slice(1)
          setProvider(name)
        } else {
          setProvider("Unknown Provider")
        }
      })
      .catch(() => setProvider("LLM"))
  }, [])

  return (
    <div className="relative flex-1 min-h-[calc(100svh-3rem)] flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-blue-500/20 blur-[100px]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-16 flex flex-col items-center text-center">
        
        <div className="mb-8 flex items-center justify-center w-48 h-auto md:w-64">
          <Logo showText />
        </div>

        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
          <Sparkles className="mr-2 h-3 w-3" />
          Powered by {provider} & LangGraph
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60 mb-6 max-w-4xl">
          The Self-Healing <br className="hidden sm:inline" /> RAG Pipeline
        </h1>
        
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl mb-10">
          ReForge is an advanced Retrieval-Augmented Generation system that actively evaluates, rewrites, and heals its own queries to provide grounded, highly accurate answers.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link href="/chat" className={cn(buttonVariants({ size: "lg" }), "group rounded-full px-8")}>
            Start Chatting
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/upload" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-8")}>
            Upload Documents
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
          <FeatureCard 
            icon={<ShieldAlert className="h-6 w-6 text-orange-500" />}
            title="Critic Agent Evaluation"
            description="Every generated answer is reviewed by a strict Critic Agent. If claims are unsupported or information is missing, the system catches it."
          />
          <FeatureCard 
            icon={<Bot className="h-6 w-6 text-blue-500" />}
            title="Self-Healing Loop"
            description="When an answer is rejected, ReForge automatically rewrites the query and expands search depth until a confident, grounded answer is found."
          />
          <FeatureCard 
            icon={<Activity className="h-6 w-6 text-green-500" />}
            title="Explainable Traces"
            description="Complete transparency into the pipeline's execution. View exactly how the graph routed your query, the retrieved chunks, and the Critic's reasoning."
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-muted/60 hover:border-primary/50 transition-colors duration-300">
      <CardHeader>
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50 border">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base text-muted-foreground leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  )
}
