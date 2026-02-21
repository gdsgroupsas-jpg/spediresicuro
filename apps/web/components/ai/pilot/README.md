# Anne - Executive Business Partner

## Come usare Anne nel Dashboard

Anne è integrata nel componente `DashboardNav`. Per usarla in altre parti dell'applicazione:

```tsx
import { PilotModal } from '@/components/ai/pilot/pilot-modal';
import { useSession } from 'next-auth/react';

function MyComponent() {
  const [showAnne, setShowAnne] = useState(false);
  const { data: session } = useSession();

  // Ottieni dati utente dalla sessione
  const userId = session?.user?.id || '';
  const userRole = (session?.user as any)?.role || 'user';
  const userName = session?.user?.name || session?.user?.email || 'Utente';

  return (
    <>
      <button onClick={() => setShowAnne(true)}>Parla con Anne</button>

      <PilotModal
        isOpen={showAnne}
        onClose={() => setShowAnne(false)}
        userId={userId}
        userRole={userRole}
        userName={userName}
      />
    </>
  );
}
```

## Funzionalità

- **Chat interattiva** con Anne
- **Quick Actions** personalizzate per admin e user
- **Voice Input** (preparato, da implementare Web Speech API)
- **Tools automatici**: Anne può eseguire azioni concrete (calcolo prezzi, tracking, analisi business)
- **Context-aware**: Anne conosce le tue spedizioni recenti e statistiche

## Tools disponibili

### Per tutti gli utenti:

- `fill_shipment_form`: Compila form spedizione
- `calculate_price`: Calcola prezzo ottimale
- `track_shipment`: Traccia spedizione

### Solo per admin:

- `analyze_business_health`: Analizza salute business
- `check_error_logs`: Controlla errori sistema

## Configurazione

Assicurati di avere in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**⚠️ IMPORTANTE per Vercel (Produzione):**

- La variabile `ANTHROPIC_API_KEY` deve essere configurata su Vercel Dashboard
- Scope: Production, Preview, Development
- Dopo aver aggiunto la variabile, fai un nuovo deploy

Esegui la migration SQL:

```sql
-- Esegui il file: supabase/migrations/002_anne_setup.sql
```

## Troubleshooting

### Problemi su Mobile

Se Anne non funziona su mobile ma funziona su desktop:

1. **Verifica connessione**: Il problema potrebbe essere timeout o connessione instabile
2. **Timeout**: Le richieste hanno un timeout di 60 secondi
3. **Gestione errori**: Il componente gestisce automaticamente errori di rete e timeout
4. **Messaggi di errore**: I messaggi sono più specifici per aiutare il debug

**Fix applicato (2025-01-17):**

- ✅ Timeout esplicito di 60 secondi
- ✅ Gestione robusta errori di rete
- ✅ Parsing JSON più sicuro (legge testo prima di fare parse)
- ✅ Messaggi di errore specifici per mobile

Vedi anche: `FIX_ANTHROPIC_API_KEY_VERCEL.md` per dettagli completi.

### Errori Comuni

#### "Errore autenticazione API"

- Verifica che `ANTHROPIC_API_KEY` sia configurata su Vercel
- Controlla che la chiave sia valida e non scaduta
- Riavvia il deploy dopo aver aggiunto la variabile

#### "Risposta vuota dal server"

- Verifica la connessione internet
- Controlla i log del server per dettagli
- Prova a riavviare il server

#### "Errore di connessione"

- Verifica la connessione internet
- Su mobile, controlla che non ci siano problemi di rete
- Il timeout è di 60 secondi - se la connessione è molto lenta, potrebbe scadere
