"use client"

import { useRef, useState, useEffect } from "react"
import { motion, useMotionTemplate, useMotionValue, Variants } from "framer-motion"
import { Database, Sparkles, LayoutTemplate, ArrowDown, UploadCloud, Search, BrainCircuit, RefreshCw, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

function SpotlightCard({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24, delay } }
      }}
      whileHover={{ y: -4 }}
      tabIndex={0}
      className={cn(
        "group relative rounded-xl border border-border/50 bg-card/10 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              350px circle at ${mouseX}px ${mouseY}px,
              rgba(var(--primary), 0.15),
              transparent 80%
            )
          `,
        }}
      />
      {/* Soft Border Glow on Hover */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-primary/20 transition-colors duration-300 pointer-events-none" />
      
      <div className="relative h-full w-full p-6">
        {children}
      </div>
    </motion.div>
  )
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
}

export default function AboutPage() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex-1 p-8 max-w-5xl mx-auto w-full relative overflow-hidden">
      {/* Background flares */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/10 blur-[120px] pointer-events-none rounded-full -z-10" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mb-12 text-center"
      >
        <motion.div variants={itemVariants} className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6 shadow-lg shadow-primary/20">
          <Sparkles className="w-8 h-8 text-primary" />
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/50">
          About ReForge
        </motion.h1>
        <motion.p variants={itemVariants} className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
          A Self-Healing Retrieval-Augmented Generation (RAG) Pipeline designed for absolute accuracy.
        </motion.p>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-12"
      >
        {/* Project Overview */}
        <div className="mx-auto w-full max-w-4xl">
          <SpotlightCard className="shadow-md">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-primary" /> Project Overview
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              ReForge is an advanced RAG system built to eliminate hallucinations. By employing a multi-stage reasoning architecture, the system actively evaluates its own answers against the source context and autonomously repairs them when they fall short of strict accuracy thresholds.
            </p>
          </SpotlightCard>
        </div>

        {/* Interactive Architecture Flow */}
        <motion.div variants={itemVariants} className="relative py-8">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-3 mb-16">
            <LayoutTemplate className="w-6 h-6 text-primary" /> Pipeline Architecture
          </h2>
          
          <div className="max-w-3xl mx-auto relative flex flex-col items-center">
            {/* Center Line connecting the cards */}
            <motion.div 
              initial={{ height: 0 }}
              whileInView={{ height: "100%" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute left-1/2 top-0 w-1 bg-gradient-to-b from-primary/70 via-primary/40 to-transparent -translate-x-1/2 z-0"
            />

            {/* Nodes */}
            <div className="space-y-24 relative z-10 w-full px-4 md:px-0">
              <ArchitectureNode 
                icon={<UploadCloud className="w-5 h-5 text-blue-500" />}
                title="1. Document Ingestion"
                desc="Files are parsed, optimally chunked using recursive algorithms, and converted into dense vector embeddings for instantaneous semantic search."
                delay={0.1}
              />
              <ArchitectureNode 
                icon={<Search className="w-5 h-5 text-purple-500" />}
                title="2. Semantic Retrieval"
                desc="User queries are transformed and mapped against the vector database to extract the highest-relevance context blocks."
                delay={0.2}
              />
              <ArchitectureNode 
                icon={<BrainCircuit className="w-5 h-5 text-amber-500" />}
                title="3. Evaluation & Reasoning"
                desc="The LLM synthesizes an initial response and scores it for hallucinations. If the score is low, the pipeline rejects it."
                delay={0.3}
              />
              <ArchitectureNode 
                icon={<RefreshCw className="w-5 h-5 text-emerald-500" />}
                title="4. Self-Healing Loop"
                desc="Rejected answers trigger a loop where the system alters its search strategy to find better context until strict grounding is achieved."
                delay={0.4}
              />
            </div>
          </div>
        </motion.div>

        {/* Tech Stack */}
        <motion.div variants={itemVariants}>
          <h2 className="text-2xl font-bold flex items-center justify-center md:justify-start gap-3 mb-8">
            <Layers className="w-6 h-6 text-primary" /> Technology Stack
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SpotlightCard delay={0.1} className="flex flex-col items-center md:items-start text-center md:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-inner">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">Backend & AI</h3>
              <ul className="space-y-3 text-muted-foreground w-full">
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/60"/> FastAPI & Python 3.11</li>
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/60"/> LangGraph (Agentic Flow)</li>
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/60"/> ChromaDB (Vector Store)</li>
              </ul>
            </SpotlightCard>
            
            <SpotlightCard delay={0.2} className="flex flex-col items-center md:items-start text-center md:text-left">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner">
                <LayoutTemplate className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">Frontend</h3>
              <ul className="space-y-3 text-muted-foreground w-full">
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/60"/> Next.js 14+ (App Router)</li>
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/60"/> React 18</li>
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500/60"/> Tailwind CSS</li>
              </ul>
            </SpotlightCard>

            <SpotlightCard delay={0.3} className="flex flex-col items-center md:items-start text-center md:text-left">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-inner">
                <Sparkles className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">UX & Animation</h3>
              <ul className="space-y-3 text-muted-foreground w-full">
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"/> Framer Motion</li>
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"/> Radix UI Primitives</li>
                <li className="flex items-center justify-center md:justify-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"/> Glassmorphism Design</li>
              </ul>
            </SpotlightCard>
          </div>
        </motion.div>

      </motion.div>
    </div>
  )
}

function ArchitectureNode({ icon, title, desc, delay }: { icon: React.ReactNode, title: string, desc: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 300, damping: 25 }}
      whileHover={{ y: -4 }}
      tabIndex={0}
      className="group relative flex flex-col md:flex-row items-center md:items-start bg-card/95 backdrop-blur border border-border/50 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl p-6 transition-all duration-300 md:w-5/6 lg:w-3/4 mx-auto text-center md:text-left"
    >
      {/* Top spine dot (centered above the card) */}
      <div className="absolute left-1/2 -top-[2px] -translate-x-1/2 -translate-y-full w-4 h-4 bg-background border-[3px] border-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.6)] z-20 transition-transform duration-300 group-hover:scale-125" />
      
      {/* Bottom spine dot (centered below the card) */}
      <div className="absolute left-1/2 -bottom-[2px] -translate-x-1/2 translate-y-full w-4 h-4 bg-background border-[3px] border-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.6)] z-20 transition-transform duration-300 group-hover:scale-125" />
      
      <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 mb-4 md:mb-0 md:mr-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}
