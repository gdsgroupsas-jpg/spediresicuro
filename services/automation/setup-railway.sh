#!/bin/bash

# ============================================
# Script Setup Automatico Railway
# ============================================
# Questo script configura automaticamente Railway
# per il servizio automation
#
# REQUISITI:
# 1. Railway CLI installato: npm install -g @railway/cli
# 2. Loggato in Railway: railway login
# ============================================

echo "🚀 Setup Automatico Railway - Automation Service"
echo ""

# Verifica Railway CLI
echo "📋 Verifica Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI non trovato!"
    echo ""
    echo "Installa Railway CLI con:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Poi esegui:"
    echo "  railway login"
    exit 1
fi

RAILWAY_VERSION=$(railway --version 2>/dev/null)
echo "✅ Railway CLI trovato: $RAILWAY_VERSION"

# Verifica login
echo ""
echo "📋 Verifica login Railway..."
if ! railway whoami &> /dev/null; then
    echo "❌ Non loggato in Railway!"
    echo ""
    echo "Esegui:"
    echo "  railway login"
    exit 1
fi
echo "✅ Loggato in Railway"

# Leggi variabili d'ambiente da .env.local
echo ""
echo "📋 Leggo variabili d'ambiente da .env.local..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️ File .env.local non trovato!"
    echo "Cercando in: $ENV_FILE"
    echo ""
    echo "Inserisci manualmente le variabili d'ambiente:"
    echo ""
    
    read -p "SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL): " SUPABASE_URL
    read -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_KEY
    read -p "ENCRYPTION_KEY: " ENCRYPTION_KEY
else
    echo "✅ File .env.local trovato"
    
    # Leggi variabili
    SUPABASE_URL=$(grep -E "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$SUPABASE_URL" ]; then
        SUPABASE_URL=$(grep -E "^SUPABASE_URL=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    fi
    SUPABASE_SERVICE_KEY=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    ENCRYPTION_KEY=$(grep -E "^ENCRYPTION_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    
    if [ -z "$SUPABASE_URL" ]; then
        read -p "SUPABASE_URL non trovato. Inserisci manualmente: " SUPABASE_URL
    fi
    if [ -z "$SUPABASE_SERVICE_KEY" ]; then
        read -p "SUPABASE_SERVICE_ROLE_KEY non trovato. Inserisci manualmente: " SUPABASE_SERVICE_KEY
    fi
    if [ -z "$ENCRYPTION_KEY" ]; then
        read -p "ENCRYPTION_KEY non trovato. Inserisci manualmente: " ENCRYPTION_KEY
    fi
fi

# Verifica variabili
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ] || [ -z "$ENCRYPTION_KEY" ]; then
    echo ""
    echo "❌ Variabili d'ambiente mancanti!"
    echo "Assicurati di avere:"
    echo "  - SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo "  - ENCRYPTION_KEY"
    exit 1
fi

echo ""
echo "✅ Variabili d'ambiente lette"

# Seleziona progetto Railway
echo ""
echo "📋 Seleziona progetto Railway..."
echo "Se il progetto non esiste, verrà creato automaticamente"
echo ""

# Lista progetti esistenti
echo "Progetti disponibili:"
railway list

read -p "Nome progetto Railway (o premi Enter per 'spediresicuro'): " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-spediresicuro}

# Crea o seleziona progetto
echo ""
echo "📋 Configurazione progetto: $PROJECT_NAME"
if railway link --project "$PROJECT_NAME" &> /dev/null; then
    echo "✅ Progetto selezionato: $PROJECT_NAME"
else
    echo "⚠️ Progetto non trovato, creazione..."
    railway init --name "$PROJECT_NAME" &> /dev/null
    echo "✅ Progetto creato: $PROJECT_NAME"
fi

# Crea servizio automation (se non esiste)
echo ""
echo "📋 Configurazione servizio automation..."

SERVICE_NAME="automation-service"
echo "Nome servizio: $SERVICE_NAME"

# Verifica se servizio esiste già
if railway service list 2>&1 | grep -q "$SERVICE_NAME"; then
    echo "✅ Servizio $SERVICE_NAME già esistente"
    railway service use "$SERVICE_NAME" &> /dev/null
else
    echo "📦 Creazione nuovo servizio..."
    railway service create "$SERVICE_NAME" &> /dev/null
    railway service use "$SERVICE_NAME" &> /dev/null
    echo "✅ Servizio creato: $SERVICE_NAME"
fi

# Configura variabili d'ambiente
echo ""
echo "📋 Configurazione variabili d'ambiente..."

echo "  → SUPABASE_URL"
railway variables set "SUPABASE_URL=$SUPABASE_URL" &> /dev/null

echo "  → SUPABASE_SERVICE_ROLE_KEY"
railway variables set "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY" &> /dev/null

echo "  → ENCRYPTION_KEY"
railway variables set "ENCRYPTION_KEY=$ENCRYPTION_KEY" &> /dev/null

echo "  → NODE_ENV"
railway variables set "NODE_ENV=production" &> /dev/null

echo "✅ Variabili d'ambiente configurate"

# Configura root directory (se supportato)
echo ""
echo "📋 Configurazione root directory..."
echo "⚠️ Root directory deve essere configurato manualmente su Railway Dashboard"
echo "   Vai su: Settings → Root Directory → Imposta: automation-service"

# Genera domain pubblico
echo ""
echo "📋 Generazione domain pubblico..."
if railway domain &> /dev/null; then
    echo "✅ Domain configurato"
else
    echo "⚠️ Domain non generato automaticamente"
    echo "   Genera manualmente su Railway Dashboard: Settings → Networking → Generate Domain"
fi

# Deploy
echo ""
echo "📋 Avvio deploy..."
echo "⚠️ Assicurati di essere nella root del progetto (non in automation-service)"
echo ""

read -p "Vuoi fare deploy ora? (s/n): " DEPLOY
if [[ "$DEPLOY" == "s" || "$DEPLOY" == "S" || "$DEPLOY" == "y" || "$DEPLOY" == "Y" ]]; then
    echo ""
    echo "🚀 Avvio deploy..."
    
    # Torna alla root del progetto
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    cd "$PROJECT_ROOT"
    
    railway up --service "$SERVICE_NAME"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Deploy completato!"
    else
        echo ""
        echo "❌ Errore durante deploy"
        echo "Verifica logs su Railway Dashboard"
    fi
else
    echo ""
    echo "⏭️ Deploy saltato"
    echo "Esegui manualmente con: railway up"
fi

# Riepilogo
echo ""
echo "════════════════════════════════════════"
echo "✅ SETUP COMPLETATO!"
echo "════════════════════════════════════════"
echo ""
echo "📋 Prossimi passi:"
echo ""
echo "1. Vai su Railway Dashboard"
echo "2. Settings → Root Directory → Imposta: automation-service"
echo "3. Settings → Networking → Generate Domain"
echo "4. Copia URL domain e aggiungi a Vercel:"
echo "   AUTOMATION_SERVICE_URL=https://tuo-url-railway.app"
echo ""
echo "5. Test health check:"
echo "   https://tuo-url-railway.app/health"
echo ""
echo "📚 Documentazione:"
echo "   - GUIDA_SETUP_RAILWAY.md"
echo "   - RIEPILOGO_SETUP_RAILWAY.md"
echo ""

