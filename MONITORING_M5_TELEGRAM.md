# M5: Telegram Bot Notifications

## Overview

Bot Telegram per notifiche real-time di SpediReSicuro.

**Costo: €0/mese** (Telegram Bot API gratuita)

## Funzionalità

### Notifiche Push
- Downtime alerts (da UptimeRobot)
- Error alerts (da Sentry)
- Wallet alerts (ricariche)

### Comandi Bot
| Comando | Descrizione |
|---------|-------------|
| `/start` | Benvenuto |
| `/help` | Lista comandi |
| `/stats` | Statistiche oggi |
| `/health` | Stato servizi |
| `/id` | Mostra Chat ID |

## Setup

### 1. Crea Bot
1. Cerca `@BotFather` su Telegram
2. Invia `/newbot`
3. Copia il token

### 2. Ottieni Chat ID
1. Avvia chat con il bot
2. Invia `/id`

### 3. Configura Vercel
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...
TELEGRAM_CHAT_ID=123456789
```

### 4. Attiva Webhook
```bash
curl -X POST https://spediresicuro.it/api/telegram/setup
```

## Files

| File | Descrizione |
|------|-------------|
| `lib/services/telegram-bot.ts` | Servizio Telegram |
| `app/api/webhooks/telegram/route.ts` | Comandi bot |
| `app/api/telegram/setup/route.ts` | Setup webhook |
