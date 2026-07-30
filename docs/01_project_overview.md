# Project Overview

## What is ReForge?
ReForge is an advanced, full-stack application built to demonstrate a **Self-Healing Retrieval-Augmented Generation (RAG)** pipeline. It allows users to upload documents, chat with the contents of those documents, and transparently view the decision-making process of the underlying AI agents.

## What Problem Does It Solve?
Standard RAG systems are brittle. If a search query yields poor context, the AI typically hallucinates or fails. ReForge solves this by employing an agentic, iterative workflow:
- **Hallucination Detection:** Automatically cross-references generated answers against the source documents.
- **Self-Critique:** Evaluates the quality of retrieved context.
- **Query Rewriting:** Dynamically reformulates the search query if the initial retrieval is insufficient.

## Who is it For?
- **Developers & Engineers:** Looking for a modern reference architecture for building stateful, agentic AI workflows.
- **Data Teams:** Needing to improve the reliability and factual grounding of information retrieved from private knowledge bases.
- **Technical Recruiters:** Evaluating full-stack AI engineering, complex state management, and modern system design.

## Why is it Different?
Unlike standard wrapper applications that simply pass user queries to an LLM, ReForge acts as an autonomous research assistant. By orchestrating a graph of specialized agents using LangGraph, ReForge can retry, rewrite, and rethink its answers to improve retrieval quality and generate responses grounded in the uploaded context.
