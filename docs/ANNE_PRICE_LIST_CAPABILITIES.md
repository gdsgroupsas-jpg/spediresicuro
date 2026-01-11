# Anne AI - Price List Management Capabilities

## Overview

As of Jan 2026, the Anne AI agent has been upgraded with capabilities to manage price lists directly via chat interaction. This feature allows for rapid cloning, customization, and assignment of price lists, streamlining operations for Superadmins and authorized Resellers.

## Features

### 1. Master List Search

Anne can search the database for available "Master" price lists (e.g., "Listino Base DHL", "Listino UPS 2024").

- **Trigger**: "Cerca listini master...", "Quali listini base abbiamo?"
- **Tool**: `search_master_price_lists`

### 2. Price List Cloning (Customization)

Anne can clone a Master price list to create a new, detached custom list.

- **Trigger**: "Clona il listino DHL per il cliente Rossi...", "Crea un nuovo listino partendo dal base..."
- **Capabilities**:
  - Set new name.
  - Set target owner (optional).
  - Apply a default margin percentage (e.g., +10%).
- **Tool**: `clone_price_list`

### 3. Price List Assignment

Anne can assign an existing price list to a specific user or reseller.

- **Trigger**: "Assegna il listino X a Mario Rossi", "Dai questo listino all'utente Y"
- **Tool**: `assign_price_list`

## Security & Permissions (RBAC)

This feature implements a strict **Feature Toggle** mechanism to ensure tenant isolation and business control.

| Role           | Access Level    | Notes                                                   |
| :------------- | :-------------- | :------------------------------------------------------ |
| **Superadmin** | **Full Access** | Can perform all operations without restrictions.        |
| **Reseller**   | **Restricted**  | **Default: DENIED.** Access must be explicitly granted. |
| **User**       | **None**        | Cannot access these tools.                              |

### Enabling Access for Resellers

To allow a specific Reseller to use these AI features, a Superadmin must enable the `ai_can_manage_pricelists` flag in the user's metadata.

**SQL Command:**

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{ai_can_manage_pricelists}',
  'true'
)
WHERE email = 'reseller@example.com';
```

## Architecture

- **Worker**: `lib/agent/workers/price-list-manager.ts` handles the conversation logic.
- **Tools**: `lib/agent/tools/price-list-tools.ts` wraps the Server Actions.
- **Graph**: Integrated into `pricing-graph.ts` as a simplified sub-graph node.

## Usage Example

> **User**: "Anne, ho bisogno di un listino per il nuovo Reseller 'Logistica Milanese'. Clonami il 'Master DHL 2025' applicando un ricarico del 5%."
>
> **Anne**: _Checks permissions... executes clone..._
> "Fatto! Ho creato il listino 'Logistica Milanese (Cloned)' con ricarico +5%. ID: pl_123abc."
>
> **User**: "Ottimo, assegnalo subito a loro."
>
> **Anne**: _Executes assignment..._
> "Assegnato correttamente all'utente Logistica Milanese."
