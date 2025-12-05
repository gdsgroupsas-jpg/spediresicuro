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
      <button onClick={() => setShowAnne(true)}>
        Parla con Anne
      </button>
      
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

Esegui la migration SQL:
```sql
-- Esegui il file: supabase/migrations/002_anne_setup.sql
```

