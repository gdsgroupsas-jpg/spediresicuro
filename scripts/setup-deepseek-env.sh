#!/bin/bash

# Script per configurare variabili d'ambiente DeepSeek
# Uso: ./scripts/setup-deepseek-env.sh

DEEPSEEK_API_KEY="***REDACTED_DEEPSEEK_KEY***"

echo "🔧 Configurazione variabili d'ambiente DeepSeek..."

# Aggiungi a .env.local
if [ -f .env.local ]; then
  # Rimuovi eventuale riga esistente
  sed -i.bak '/^DEEPSEEK_API_KEY=/d' .env.local
  # Aggiungi nuova riga
  echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" >> .env.local
  echo "✅ Aggiunto DEEPSEEK_API_KEY a .env.local"
else
  echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" > .env.local
  echo "✅ Creato .env.local con DEEPSEEK_API_KEY"
fi

# Aggiungi su Vercel (se vercel CLI è installato)
if command -v vercel &> /dev/null; then
  echo ""
  echo "📦 Aggiunta variabile su Vercel..."
  echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" | vercel env add DEEPSEEK_API_KEY production
  echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" | vercel env add DEEPSEEK_API_KEY preview
  echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" | vercel env add DEEPSEEK_API_KEY development
  echo "✅ Variabili aggiunte su Vercel"
else
  echo "⚠️  Vercel CLI non trovato. Aggiungi manualmente:"
  echo "   vercel env add DEEPSEEK_API_KEY production"
  echo "   vercel env add DEEPSEEK_API_KEY preview"
  echo "   vercel env add DEEPSEEK_API_KEY development"
fi

echo ""
echo "✅ Configurazione completata!"
echo ""
echo "📝 Prossimi passi:"
echo "   1. Riavvia il server di sviluppo (npm run dev)"
echo "   2. Vai su /dashboard/super-admin per selezionare il provider AI"
echo "   3. Verifica che la variabile sia presente su Vercel Dashboard"

