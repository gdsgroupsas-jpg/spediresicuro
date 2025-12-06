# Fix Accesso Admin - Istruzioni per gdsgroupsas@gmail.com

## Problema
Il tuo account **gdsgroupsas@gmail.com** mostra "Accesso Negato" alla sezione Team Management.

## Soluzione - Auto-Promozione a Superadmin

### Passo 1: Visita la pagina di promozione
```
https://spediresicuro.vercel.app/promote-superadmin
```

### Passo 2: Clicca su "Promuovi a Superadmin"

La pagina verifica che la tua email sia nella lista autorizzata e ti promuove automaticamente.

### Passo 3: Logout e Login

**IMPORTANTE:** Devi fare logout e login di nuovo per aggiornare la sessione:

1. Clicca sul pulsante "Logout" (in alto a destra)
2. Fai login nuovamente con **gdsgroupsas@gmail.com**

### Passo 4: Verifica accesso

Dopo il login, vai su:
```
https://spediresicuro.vercel.app/dashboard/team
```

✅ Ora dovresti avere accesso completo alla gestione team!

## Cosa fa la promozione

L'API aggiorna il tuo account nel database Supabase:
- `account_type` → `'superadmin'`
- `admin_level` → `0` (livello massimo)
- `role` → `'admin'`
- `parent_admin_id` → `null` (sei il capo!)

## Email autorizzate

Solo queste 4 email possono auto-promuoversi:
- ✅ `gdsgroupsas@gmail.com` (TU)
- ✅ `sigorn@hotmail.it`
- ✅ `admin@spediresicuro.it`
- ✅ `salvatore.squillante@gmail.com`

## Troubleshooting

### Se ancora non funziona dopo logout/login:

1. Cancella cache del browser (Ctrl+Shift+Del)
2. Riprova il logout/login
3. Verifica in console browser (F12) eventuali errori

### Se vedi errori:

Controlla che la migrazione `020_reseller_commission_structure.sql` sia stata eseguita su Supabase.

## File sorgente

- API: `app/api/auth/promote-superadmin/route.ts`
- Pagina: `app/promote-superadmin/page.tsx`
