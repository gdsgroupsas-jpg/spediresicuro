#!/bin/bash
# Helper script per Supabase CLI con token automatico
# Usa: ./scripts/supabase-cli-helper.sh <comando> [argomenti]
# Esempio: ./scripts/supabase-cli-helper.sh "db push"
# Esempio: ./scripts/supabase-cli-helper.sh "migration new" "fix_cron_security"

COMMAND="$1"
shift
ARGUMENTS="$@"

# Leggi token da .env.local
ENV_PATH="$(dirname "$0")/../.env.local"

if [ ! -f "$ENV_PATH" ]; then
    echo "❌ File .env.local non trovato"
    exit 1
fi

# Estrai token (fallback se non presente)
TOKEN=$(grep -E '^SUPABASE_ACCESS_TOKEN=' "$ENV_PATH" | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "sbp_b5a23c86eb994249771f74152a68490a10670675")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "sbp_b5a23c86eb994249771f74152a68490a10670675" ]; then
    echo "⚠️  Token non trovato in .env.local, uso token di fallback"
    echo "💡 Aggiungi SUPABASE_ACCESS_TOKEN al .env.local per persistenza"
fi

# Imposta token come env var
export SUPABASE_ACCESS_TOKEN="$TOKEN"

# Esegui comando
echo "🔧 Eseguendo: npx supabase $COMMAND $ARGUMENTS"
echo ""

npx supabase $COMMAND $ARGUMENTS

exit $?



