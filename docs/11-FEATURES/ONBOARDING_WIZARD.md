# Onboarding Wizard

## Panoramica

Il sistema di onboarding wizard permette la raccolta guidata dei dati cliente attraverso un'interfaccia multi-step. Supporta tre modalità operative:

1. **Self-service** (`mode="self"`) - Per utenti che completano autonomamente i propri dati
2. **Admin** (`mode="admin"`) - Per superadmin che compilano dati di utenti esistenti
3. **Reseller** (`mode="reseller"`) - Per reseller che creano nuovi clienti (persona o azienda)

## Architettura

```
components/onboarding/
├── index.ts                    # Export pubblici
├── types.ts                    # Tipi TypeScript
├── WizardContext.tsx           # State management React Context
├── OnboardingWizard.tsx        # Componente principale
└── steps/
    ├── index.ts
    ├── StepTipoCliente.tsx     # Step 1: Persona/Azienda
    ├── StepAnagrafica.tsx      # Step 2: Dati anagrafici
    ├── StepIndirizzo.tsx       # Step 3: Indirizzo
    ├── StepAzienda.tsx         # Step 4: Dati azienda (condizionale)
    ├── StepBancari.tsx         # Step 5: Dati bancari (opzionale)
    ├── StepDocumento.tsx       # Step 6: Documento identità (opzionale)
    └── StepRiepilogo.tsx       # Step 7: Riepilogo e conferma
```

## Flusso Dati

### Step del Wizard

| Step         | ID           | Obbligatorio    | Condizionale             |
| ------------ | ------------ | --------------- | ------------------------ |
| Tipo Cliente | tipo-cliente | Sì              | No                       |
| Anagrafica   | anagrafica   | Sì              | No                       |
| Indirizzo    | indirizzo    | Sì              | No                       |
| Azienda      | azienda      | Sì (se azienda) | Sì (tipoCliente=azienda) |
| Bancari      | bancari      | No              | No                       |
| Documento    | documento    | No              | No                       |
| Riepilogo    | riepilogo    | Sì              | No                       |

### Validazione Campi

**Campi Obbligatori (Anagrafica):**

- Nome
- Cognome
- Codice Fiscale (16 caratteri)
- Telefono

**Campi Obbligatori (Indirizzo):**

- Indirizzo
- Città
- Provincia
- CAP

**Campi Obbligatori (Azienda - solo se tipoCliente=azienda):**

- Ragione Sociale
- Partita IVA (11 caratteri)

## API Endpoints

### Self-service

```
POST /api/user/dati-cliente
```

Salva i dati cliente dell'utente autenticato.

### Admin

```
POST /api/admin/users/[id]/dati-cliente
```

Permette a superadmin/admin di salvare dati cliente per un utente esistente.

### Reseller

```
POST /api/reseller/clients
GET /api/reseller/clients
```

Permette ai reseller di creare nuovi clienti e recuperare la lista.

**Request Body (POST /api/reseller/clients):**

```json
{
  "email": "cliente@email.com",
  "nome": "Mario",
  "cognome": "Rossi",
  "codiceFiscale": "RSSMRA80A01H501Z",
  "telefono": "+39 333 1234567",
  "indirizzo": "Via Roma 1",
  "citta": "Milano",
  "provincia": "MI",
  "cap": "20100",
  "tipoCliente": "persona"
  // ... altri campi opzionali
}
```

**Response:**

```json
{
  "success": true,
  "message": "Cliente creato con successo!",
  "client": {
    "id": "uuid",
    "email": "cliente@email.com",
    "name": "Mario Rossi"
  },
  "generatedPassword": "xK9#mPq2Lw5!" // Solo se password non fornita
}
```

## Utilizzo

### Self-service (pagina dati-cliente)

```tsx
import { OnboardingWizard } from '@/components/onboarding';

<OnboardingWizard
  mode="self"
  initialData={existingData}
  onComplete={(data) => {
    console.log('Onboarding completato');
  }}
/>;
```

### Admin (modal per utente esistente)

```tsx
<OnboardingWizard
  mode="admin"
  targetUserId="user-uuid"
  initialData={userData}
  onComplete={(data) => handleSave(data)}
  onCancel={() => closeModal()}
/>
```

### Reseller (creazione nuovo cliente)

```tsx
<OnboardingWizard
  mode="reseller"
  onComplete={(data) => {
    // data.clientId - ID del cliente creato
    // data.generatedPassword - Password generata (se non fornita)
  }}
  onCancel={() => closeModal()}
/>
```

## Middleware Protection

Il middleware (`middleware.ts`) forza gli utenti senza onboarding completato a `/dashboard/dati-cliente`:

```typescript
// In middleware.ts
if (
  !onboardingComplete &&
  pathname.startsWith('/dashboard') &&
  pathname !== '/dashboard/dati-cliente'
) {
  return NextResponse.redirect(new URL('/dashboard/dati-cliente', request.url));
}
```

Lo stato `onboarding_complete` è memorizzato nel JWT token per evitare query al database ad ogni richiesta.

## Integrazione con Sistema Reseller

I clienti creati tramite wizard in mode `reseller` vengono automaticamente:

1. Collegati al reseller tramite `parent_id`
2. Impostati con `account_type: 'user'`
3. Impostati con `dati_cliente.datiCompletati: true`

Questo permette al reseller di:

- Vedere i clienti nella dashboard `/dashboard/reseller/clienti`
- Assegnare listini prezzi
- Gestire wallet
- Visualizzare spedizioni

## Componenti UI Correlati

- `CreateClientWizardDialog` - Dialog modale per reseller
- `DatiClientePage` - Pagina self-service

## Sicurezza

- Validazione lato client e server
- Sanitizzazione input (uppercase per CF, PIVA, provincia)
- Password auto-generate sicure (12 caratteri, lettere, numeri, simboli)
- RBAC per endpoint admin/reseller
