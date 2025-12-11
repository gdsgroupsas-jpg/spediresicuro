# 📦 SpedireSicuro AI - Logistics Brain Platform

> **The First Logistics Operating System powered by Multimodal GenAI (Gemini 2.0 Flash)**

![SpedireSicuro AI Badge](https://img.shields.io/badge/AI-Powered-purple?style=for-the-badge) ![Version](https://img.shields.io/badge/Version-Beta_2.0-blue?style=for-the-badge) ![Tech](https://img.shields.io/badge/Stack-Next.js_|_LangGraph_|_Supabase-black?style=for-the-badge)

## 🚀 Overview

**SpedireSicuro** non è un semplice gestionale di spedizioni. È una piattaforma **AI-First** progettata per automatizzare il flusso logistico complesso attraverso agenti intelligenti.

Il cuore del sistema è **"Anne" (Logistics Brain)**, un'architettura a grafo (LangGraph) potenziata da **Google Gemini 2.0 Flash**, capace di comprendere input multimodali (foto, chat WhatsApp, audio) e trasformarli in spedizioni pronte per i corrieri.

### ✨ Key Capabilities

1.  **🧠 Multimodal AI Ingestion**:
    - Carica uno screenshot di WhatsApp o una foto di un'etichetta.
    - L'IA "guarda" l'immagine, estrae indirizzi, capisce il contesto (es. "urgente", "contrassegno").
    - Formatta i dati, corregge i telefoni (`+39...`) e compila il form.
2.  **🤖 Agentic Workflow (LangGraph)**:
    - Non semplici chiamate API, ma un grafo decisionale.
    - **Nodi**: `Extraction` -> `Validation` -> `CourierSelection` -> `Booking`.
    - L'agente può "ragionare" e chiedere feedback se i dati sono ambigui.
3.  **🚚 Smart Routing Algorithm**:
    - Algoritmo interno che suggerisce il corriere migliore (SDA, GLS, BRT) basandosi su:
      - Performance storica (Capacità di consegna nella zona).
      - Costo (Listini dinamici per Reseller).
      - Tempi previsti.
4.  **⚡ Premium DX & UX**:
    - Frontend **Next.js 14** velocissimo.
    - Interfaccia "Glassmorphism" con animazioni **Framer Motion**.
    - **Mobile-First**: Ottimizzata per l'uso in mobilità (Touch targets, responsive).

---

## 🛠️ Tech Stack & Architecture

### Frontend Layer

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + Framer Motion (Animations)
- **State**: React Hooks + Server Actions
- **Auth**: NextAuth.js (Role Based: Superadmin, Reseller, User)

### AI Brain Layer (The "Black Box")

- **Orchestrator**: LangGraph (State Machine for Agents)
- **LLM**: Google Gemini 2.0 Flash (Multimodal Vision + Text)
- **Tools**: Custom OCR tools, Geocoding API, Courier APIs

### Backend & Data

- **DB**: Supabase (PostgreSQL)
- **API**: REST Endpoints (Next.js Route Handlers)
- **Storage**: Supabase Storage (Shipping labels, invoices)

---

## 📂 Project Structure

```bash
/app
  /api              # Server-side API Routes (Agent entry points)
  /dashboard        # Protected Application Area
    /spedizioni     # Shipment Management
    /ocr-scanner    # Legacy OCR tools
/lib
  /agent            # LangGraph Nodes & Edges definition
  /adapters         # Courier integrations (SDA, GLS...)
/components
  /ocr              # AI Components (Thinking visualizations)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase Account
- Google AI Studio Key (Gemini)

### Installation

1. **Clone & Install**

   ```bash
   git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
   cd spediresicuro
   npm install
   ```

2. **Environment Setup (.env.local)**

   ```env
   # Storage & DB
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...

   # AI Brain
   GOOGLE_API_KEY=AIza... (Gemini 2.0 Key)

   # Auth
   NEXTAUTH_SECRET=...
   ```

3. **Run Development**
   ```bash
   npm run dev
   ```

---

## 🔮 Future Roadmap (AI Team Focus)

- **Voice Agent**: Integrazione STT (Speech-to-Text) per dettare spedizioni mentre si guida.
- **Predictive Logistics**: Modello ML per prevedere "Giacenze" prima che accadano basandosi sullo storico indirizzi.
- **WhatsApp Bot**: Portare l'agente direttamente su WA (Twilio wrapper attorno all'Agente LangGraph).

---

_Built with ❤️ by the SpedireSicuro AI Team_
