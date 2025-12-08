#!/bin/bash
# Script per eseguire test fino a quando sono tutti verdi
# Uso: bash scripts/run-tests-until-green.sh

echo "🚀 Eseguo test Playwright fino al successo..."
echo ""

MAX_ATTEMPTS=20
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo "=========================================="
  echo "Tentativo $ATTEMPT/$MAX_ATTEMPTS"
  echo "=========================================="
  
  npm run test:e2e
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅✅✅ TUTTI I TEST SONO VERDI! 🎉"
    exit 0
  fi
  
  echo ""
  echo "⚠️ Test falliti, riprovo..."
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "❌ Raggiunto limite di tentativi"
exit 1
