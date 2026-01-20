# Architecture Diagrams

Diagrammi architetturali del sistema SpedireSicuro usando [Mermaid](https://mermaid.js.org/).

---

## 📊 C4 Model - Level 1: System Context

```mermaid
graph TB
    User[👤 User<br/>Reseller/Client]
    Admin[👤 Admin<br/>SuperAdmin]
    SpedireSicuro[SpedireSicuro<br/>Logistics OS]
    Supabase[(Supabase<br/>PostgreSQL + Auth)]
    Stripe[Stripe<br/>Payments]
    Spedisci[Spedisci Online<br/>Courier API]
    Poste[Poste Italiane<br/>Courier API]
    Claude[Anthropic Claude<br/>AI LLM]
    Gemini[Google Gemini<br/>Vision AI]

    User -->|Gestisce spedizioni| SpedireSicuro
    Admin -->|Amministra| SpedireSicuro
    SpedireSicuro -->|Autentica, Store data| Supabase
    SpedireSicuro -->|Process payments| Stripe
    SpedireSicuro -->|Book shipments| Spedisci
    SpedireSicuro -->|Book shipments| Poste
    SpedireSicuro -->|AI agent routing| Claude
    SpedireSicuro -->|OCR extraction| Gemini

    style SpedireSicuro fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style User fill:#81C784,stroke:#4CAF50,color:#fff
    style Admin fill:#FFB74D,stroke:#F57C00,color:#fff
```

---

## 📊 C4 Model - Level 2: Container Diagram

```mermaid
graph TB
    subgraph "SpedireSicuro System"
        WebApp[Web Application<br/>Next.js 14 + React]
        API[API Layer<br/>Next.js API Routes]
        AgentOrch[AI Agent Orchestrator<br/>LangGraph Supervisor]
        PricingEngine[Pricing Engine<br/>Calculator + VAT]
        WalletCore[Financial Core<br/>Atomic Wallet Ops]
        FulfillmentEngine[Fulfillment Engine<br/>Courier Adapters]
    end

    User[👤 User] --> WebApp
    WebApp --> API
    API --> AgentOrch
    API --> PricingEngine
    API --> WalletCore
    API --> FulfillmentEngine

    AgentOrch --> Claude[Claude API]
    AgentOrch --> Gemini[Gemini Vision]
    WalletCore --> Supabase[(PostgreSQL)]
    PricingEngine --> Supabase
    FulfillmentEngine --> Spedisci[Spedisci Online API]
    FulfillmentEngine --> Poste[Poste API]

    style WebApp fill:#64B5F6,stroke:#1976D2,color:#fff
    style API fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style AgentOrch fill:#BA68C8,stroke:#8E24AA,color:#fff
    style WalletCore fill:#EF5350,stroke:#C62828,color:#fff
```

---

## 🤖 AI Agent Architecture (LangGraph Supervisor)

```mermaid
graph TD
    Start([User Message]) --> IntentDetect{Intent<br/>Detection}
    IntentDetect -->|Pricing Request| Supervisor[Supervisor<br/>Decision Point]
    IntentDetect -->|Non-Pricing| LegacyHandler[Legacy Claude<br/>Handler]

    Supervisor --> OCR[OCR Worker<br/>Gemini Vision]
    Supervisor --> Address[Address Worker<br/>Normalization]
    Supervisor --> Pricing[Pricing Worker<br/>Quote Calculation]
    Supervisor --> Booking[Booking Worker<br/>Preflight + Book]

    OCR --> Supervisor
    Address --> Supervisor
    Pricing --> Supervisor
    Booking --> End([Response to User])
    LegacyHandler --> End

    Supervisor -->|Max 2 iterations| Supervisor

    style Supervisor fill:#BA68C8,stroke:#8E24AA,color:#fff
    style OCR fill:#64B5F6,stroke:#1976D2,color:#fff
    style Address fill:#4DD0E1,stroke:#00ACC1,color:#fff
    style Pricing fill:#FFD54F,stroke:#FFA000,color:#000
    style Booking fill:#81C784,stroke:#4CAF50,color:#fff
```

---

## 💰 Financial Core - Wallet System

```mermaid
sequenceDiagram
    participant User
    participant API
    participant WalletService
    participant PostgreSQL
    participant IdempotencyLock
    participant AuditLog

    User->>API: Create Shipment
    API->>WalletService: debitWallet(amount, idempotency_key)
    WalletService->>IdempotencyLock: Check lock (in_progress?)

    alt Lock exists
        IdempotencyLock-->>WalletService: Already processing
        WalletService-->>API: Return cached result
    else New operation
        WalletService->>IdempotencyLock: Create lock (in_progress)
        WalletService->>PostgreSQL: BEGIN TRANSACTION
        WalletService->>PostgreSQL: SELECT wallet_balance FOR UPDATE
        PostgreSQL-->>WalletService: Current balance

        alt Sufficient balance
            WalletService->>PostgreSQL: UPDATE wallet_balance (atomic)
            WalletService->>AuditLog: Insert transaction record
            WalletService->>IdempotencyLock: Mark completed
            WalletService->>PostgreSQL: COMMIT
            WalletService-->>API: Success + new balance
        else Insufficient balance
            WalletService->>PostgreSQL: ROLLBACK
            WalletService->>IdempotencyLock: Mark failed
            WalletService-->>API: Error: Insufficient funds
        end
    end

    API-->>User: Shipment created / Error
```

---

## 🚚 Fulfillment Flow (Multi-Carrier)

```mermaid
graph TD
    Request[Shipment Request] --> RouteSelect{Route<br/>Selection}

    RouteSelect -->|Broker Model| MasterCred[Master Credentials]
    RouteSelect -->|BYOC Model| UserCred[User Credentials]
    RouteSelect -->|B2C Model| WebChannel[Web Channel Account]

    MasterCred --> AdapterFactory[Courier Adapter<br/>Factory]
    UserCred --> AdapterFactory
    WebChannel --> AdapterFactory

    AdapterFactory --> SpedisciAdapter[Spedisci Online<br/>Adapter]
    AdapterFactory --> PosteAdapter[Poste Italiane<br/>Adapter]
    AdapterFactory --> GLSAdapter[GLS Adapter<br/>Future]

    SpedisciAdapter --> APICall[External API Call]
    PosteAdapter --> APICall
    GLSAdapter --> APICall

    APICall --> LabelGen[Label Generation]
    LabelGen --> TrackingNum[Tracking Number]
    TrackingNum --> Success([Success])

    APICall -->|Error| Fallback[Fallback Strategy]
    Fallback --> Retry[Retry Logic]
    Retry --> Success

    style RouteSelect fill:#FFD54F,stroke:#FFA000,color:#000
    style AdapterFactory fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style Success fill:#81C784,stroke:#4CAF50,color:#fff
```

---

## 🔒 Security Architecture (RLS + Acting Context)

```mermaid
graph TB
    subgraph "Authentication Layer"
        NextAuth[NextAuth v5]
        SafeAuth[requireSafeAuth]
        ActingContext[Acting Context<br/>Impersonation]
    end

    subgraph "Database Layer"
        RLS[Row Level Security<br/>Policies]
        Users[(users table)]
        Shipments[(shipments table)]
        Wallet[(wallet_transactions)]
    end

    subgraph "Audit Layer"
        AuditLog[Audit Log<br/>actor + target]
        SecurityEvents[Security Events]
    end

    User[👤 User] --> NextAuth
    SuperAdmin[👤 SuperAdmin] --> NextAuth

    NextAuth --> SafeAuth
    SafeAuth --> ActingContext

    ActingContext -->|Real user_id| RLS
    ActingContext -->|Acting as user_id| RLS

    RLS --> Users
    RLS --> Shipments
    RLS --> Wallet

    ActingContext --> AuditLog
    SafeAuth --> SecurityEvents

    style RLS fill:#EF5350,stroke:#C62828,color:#fff
    style ActingContext fill:#FFB74D,stroke:#F57C00,color:#fff
    style AuditLog fill:#64B5F6,stroke:#1976D2,color:#fff
```

---

## 📈 Data Flow: Pricing Request → Shipment

```mermaid
sequenceDiagram
    participant User
    participant AnneAI
    participant Supervisor
    participant OCRWorker
    participant AddressWorker
    participant PricingWorker
    participant BookingWorker
    participant Database
    participant CourierAPI

    User->>AnneAI: "Quanto costa spedire 2kg a Milano?"
    AnneAI->>Supervisor: Route request
    Supervisor->>OCRWorker: Extract structured data
    OCRWorker-->>Supervisor: {weight: 2, destination: "Milano"}

    Supervisor->>AddressWorker: Normalize address
    AddressWorker->>Database: Lookup CAP/Province
    Database-->>AddressWorker: CAP: 20100, Province: MI
    AddressWorker-->>Supervisor: Normalized address

    Supervisor->>PricingWorker: Calculate quote
    PricingWorker->>Database: Get active price lists
    Database-->>PricingWorker: Price lists data
    PricingWorker-->>Supervisor: Quote: €8.50 (Spedisci), €9.20 (Poste)

    Supervisor-->>User: "Ecco i preventivi: ..."

    User->>AnneAI: "Prenota con Spedisci"
    AnneAI->>Supervisor: Route booking request
    Supervisor->>BookingWorker: Preflight checks
    BookingWorker->>Database: Check wallet balance
    Database-->>BookingWorker: Balance OK

    BookingWorker->>CourierAPI: Book shipment
    CourierAPI-->>BookingWorker: Tracking: ABC123
    BookingWorker->>Database: Debit wallet + save shipment
    BookingWorker-->>User: "Prenotata! Tracking: ABC123"
```

---

## 🔄 CI/CD Pipeline

```mermaid
graph LR
    Commit[Git Commit] --> PreCommit[Pre-commit Hooks<br/>Prettier + ESLint]
    PreCommit --> Push[Git Push]
    Push --> CI{CI Pipeline<br/>GitHub Actions}

    CI --> FormatCheck[Format Check]
    CI --> Lint[ESLint]
    CI --> TypeCheck[TypeScript Check]
    CI --> UnitTests[Unit Tests]
    CI --> IntegrationTests[Integration Tests]
    CI --> Build[Next.js Build]

    FormatCheck --> Gate{All Passed?}
    Lint --> Gate
    TypeCheck --> Gate
    UnitTests --> Gate
    IntegrationTests --> Gate
    Build --> Gate

    Gate -->|Yes| Deploy[Deploy to Vercel]
    Gate -->|No| Fail[❌ Build Failed]

    Deploy --> Staging[Staging Environment]
    Staging --> Manual{Manual<br/>Approval}
    Manual -->|Approved| Production[Production Deploy]

    style CI fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style Deploy fill:#81C784,stroke:#4CAF50,color:#fff
    style Fail fill:#EF5350,stroke:#C62828,color:#fff
```

---

## 📖 How to View These Diagrams

### GitHub

GitHub natively supports Mermaid rendering in markdown files. Just view this file on GitHub!

### VS Code

Install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension.

### Online

Copy-paste the Mermaid code to [Mermaid Live Editor](https://mermaid.live/).

---

**Last Updated:** 2026-01-20
