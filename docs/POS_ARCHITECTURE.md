# 🏪 SpediReSicuro POS - Architettura Multi-Servizio

**Versione:** 1.0
**Data:** 2026-01-18
**Autore:** Claude Agent (basato su analisi tan-pos)

---

## 📋 Executive Summary

Sistema **Point of Sale (POS)** multi-servizio per reseller SpediReSicuro che gestiscono front office fisico (uffici postali, negozi multi-servizio).

**Servizi e Prodotti Gestiti:**

1. **📦 Spedizioni** - Servizio core SpediReSicuro (GLS, BRT, Poste)
2. **📝 Cartoleria** - Penne, quaderni, carta, buste
3. **📚 Cartolibreria** - Libri, materiale scolastico
4. **🔌 Elettronica di Consumo** - Cavi USB, caricabatterie, powerbank, cavetteria
5. **💡 Servizi di Procacciamento** - Contratti energia, telefonia (commissioni)

**Pattern Architetturali:** Ispirato a [tan-pos](https://github.com/kadekdodikwirawan/tan-pos) (TanStack POS per ristoranti).

---

## ⚠️ IMPORTANTE: Gestione Fiscale

**Il POS NON gestisce la fiscalità diretta.**

Questo sistema è un **gestionale interno** per tracking vendite, inventario e commissioni.

**Gestione Fiscale Esterna:**
- Scontrini/Fatture emessi tramite registratore di cassa fiscale esistente del reseller
- Il POS genera **ricevute interne** (non fiscali) per tracking
- Integrazione fiscale (RT, DGFE, ecc.) **NON implementata** in questa versione
- **Futura integrazione possibile** quando il volume lo richiederà (es. oltre una certa soglia)

**Workflow Consigliato:**
1. POS genera ordine interno + ricevuta
2. Reseller emette scontrino/fattura con proprio sistema fiscale
3. Riconciliazione a fine giornata tra POS e cassa fiscale

---

## 🎯 Obiettivi

### Funzionali
- ✅ **Catalogo multi-categoria** (spedizioni + retail + servizi)
- ✅ **Carrello misto** (spedizioni + prodotti fisici + servizi)
- ✅ **Gestione inventario** (stock per POS/location)
- ✅ **Sistema commissioni** (tracking contratti procacciati)
- ✅ **Pagamenti multipli** (Cash, Card, Wallet prepagato)
- ✅ **Stampa ricevute** (ricevuta interna + etichette spedizione)
- ✅ **Multi-terminal** (più POS per reseller)

### Non-Funzionali
- ⚡ **Performance:** Carrello locale (React state), sync DB asincrono
- 🔒 **Security:** RLS multi-tenant, POS credentials isolate
- 📱 **UX:** Tablet-first (Android/iPad 10"+)
- 🔄 **Real-time:** Socket.IO per sync inventory multi-terminal

---

## 🗂️ Database Schema

### 1. Product Catalog

```sql
-- Categorie prodotti/servizi
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "Spedizioni", "Cartoleria", "Elettronica", "Servizi"
  description TEXT,
  icon TEXT, -- Emoji o icon name
  parent_id UUID REFERENCES product_categories(id), -- Gerarchia (opzionale)
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_categories_active ON product_categories(is_active) WHERE is_active = true;

-- Tipo prodotto
CREATE TYPE product_type AS ENUM (
  'physical',           -- Prodotto fisico (cartoleria, elettronica)
  'shipment',           -- Servizio spedizione (dinamico, prezzo da listino)
  'commission_service', -- Servizio commissionale (energia, telefonia)
  'virtual'             -- Servizio digitale (ricariche, bolli)
);

-- Catalogo prodotti
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Info Base
  sku TEXT UNIQUE NOT NULL, -- Codice prodotto
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),

  -- Tipo e Pricing
  product_type product_type NOT NULL DEFAULT 'physical',

  -- Pricing Fisso (per physical/virtual)
  base_price DECIMAL(10,2), -- NULL se product_type='shipment' (prezzo dinamico)
  cost_price DECIMAL(10,2), -- Costo acquisto (per calcolo margine)

  -- VAT
  vat_rate DECIMAL(5,2) DEFAULT 22.00,
  vat_included BOOLEAN DEFAULT true, -- Prezzo comprensivo IVA

  -- Commissioni (per commission_service)
  commission_type TEXT, -- 'fixed' | 'percentage' | NULL
  commission_amount DECIMAL(10,2), -- Importo fisso o %

  -- Multi-tenant Ownership
  owner_id UUID REFERENCES users(id), -- NULL = catalogo globale (SuperAdmin)
  is_global BOOLEAN DEFAULT false, -- Prodotto disponibile a tutti i reseller

  -- Metadata
  image_url TEXT,
  emoji TEXT, -- 📦🔌📝 per UI rapida
  barcode TEXT, -- EAN13/UPC per scanner

  -- Availability
  is_active BOOLEAN DEFAULT true,
  requires_stock BOOLEAN DEFAULT true, -- false per servizi

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_owner ON products(owner_id);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

-- Esempio Prodotti:
-- SKU: "SHIP-GLS-STD" | product_type: 'shipment' | base_price: NULL (dinamico da price_list)
-- SKU: "PENNA-BIC-BLU" | product_type: 'physical' | base_price: 0.50
-- SKU: "CAVO-USB-C" | product_type: 'physical' | base_price: 3.99
-- SKU: "COMM-ENERGIA" | product_type: 'commission_service' | commission_type: 'fixed' | commission_amount: 50.00
```

### 2. Inventory Management

```sql
-- Inventario per location (multi-terminal)
CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "POS Terminal 1", "Magazzino Centrale"
  reseller_id UUID REFERENCES users(id) NOT NULL, -- Owner reseller
  location_type TEXT, -- 'pos_terminal', 'warehouse', 'store'
  address TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_locations_reseller ON inventory_locations(reseller_id);

-- Stock per prodotto per location
CREATE TABLE inventory_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES inventory_locations(id) ON DELETE CASCADE NOT NULL,

  -- Stock Tracking
  quantity_available INTEGER DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved INTEGER DEFAULT 0 CHECK (quantity_reserved >= 0), -- In carrello ma non ancora venduto
  reorder_point INTEGER DEFAULT 10, -- Soglia riordino
  reorder_quantity INTEGER DEFAULT 50, -- Quantità riordino automatico

  -- Pricing Override (opzionale per location-specific pricing)
  location_price DECIMAL(10,2), -- NULL = usa products.base_price

  -- Audit
  last_restock_at TIMESTAMPTZ,
  last_restock_quantity INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, location_id)
);

CREATE INDEX idx_inventory_stocks_product ON inventory_stocks(product_id);
CREATE INDEX idx_inventory_stocks_location ON inventory_stocks(location_id);
CREATE INDEX idx_inventory_stocks_low ON inventory_stocks(quantity_available) WHERE quantity_available <= reorder_point;

-- Movimenti inventario (audit trail append-only)
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  location_id UUID REFERENCES inventory_locations(id) NOT NULL,

  -- Movimento
  movement_type TEXT NOT NULL, -- 'SALE', 'RESTOCK', 'ADJUSTMENT', 'TRANSFER', 'RETURN'
  quantity INTEGER NOT NULL, -- Positivo = entrata, Negativo = uscita

  -- Riferimenti
  order_id UUID REFERENCES pos_orders(id), -- Se movimento da vendita
  reference_id UUID, -- ID generico (transfer, restock order, ecc.)
  notes TEXT,

  -- Audit
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_location ON inventory_movements(location_id);
CREATE INDEX idx_inventory_movements_order ON inventory_movements(order_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at DESC);
```

### 3. POS Orders (Carrello Misto)

```sql
-- Ordini POS (multi-prodotto/servizio)
CREATE TABLE pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificazione
  order_number TEXT UNIQUE NOT NULL, -- "POS-20260118-001"

  -- Ownership
  reseller_id UUID REFERENCES users(id) NOT NULL, -- Reseller owner
  pos_terminal_id UUID REFERENCES users(id) NOT NULL, -- POS terminal user
  location_id UUID REFERENCES inventory_locations(id), -- Location vendita
  operator_name TEXT, -- Nome cassiere (opzionale)

  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'pending', 'completed', 'cancelled'

  -- Totali
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,

  -- Customer Info (opzionale)
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_fiscal_code TEXT, -- Codice Fiscale per fattura
  customer_vat_number TEXT, -- P.IVA per fattura B2B

  -- Payment
  payment_method TEXT, -- 'cash', 'card', 'wallet', 'mixed'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'refunded'
  paid_at TIMESTAMPTZ,

  -- Internal Receipt (non-fiscal)
  internal_receipt_number TEXT, -- Numero ricevuta interna (auto-increment)

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT
);

CREATE INDEX idx_pos_orders_reseller ON pos_orders(reseller_id);
CREATE INDEX idx_pos_orders_terminal ON pos_orders(pos_terminal_id);
CREATE INDEX idx_pos_orders_location ON pos_orders(location_id);
CREATE INDEX idx_pos_orders_status ON pos_orders(status);
CREATE INDEX idx_pos_orders_date ON pos_orders(created_at DESC);
CREATE INDEX idx_pos_orders_number ON pos_orders(order_number);

-- Order Items (Line Items Polymorphic)
CREATE TABLE pos_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES pos_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,

  -- Quantity & Pricing
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL, -- Prezzo unitario al momento della vendita (snapshot)
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL, -- (unit_price * quantity) - discount_amount
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL, -- subtotal + tax_amount

  -- Polymorphic Link (per spedizioni)
  shipment_id UUID REFERENCES shipments(id), -- Link a shipment se product_type='shipment'

  -- Commission Tracking (per commission_service)
  commission_contract_id UUID REFERENCES commission_contracts(id), -- Link a contratto procacciato

  -- Item Details (snapshot)
  item_snapshot JSONB, -- Snapshot completo product al momento vendita (audit)
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_order_items_order ON pos_order_items(order_id);
CREATE INDEX idx_pos_order_items_product ON pos_order_items(product_id);
CREATE INDEX idx_pos_order_items_shipment ON pos_order_items(shipment_id);
CREATE INDEX idx_pos_order_items_commission ON pos_order_items(commission_contract_id);
```

### 4. Commission Contracts (Servizi Procacciati)

```sql
-- Contratti procacciati (energia, telefonia, ecc.)
CREATE TABLE commission_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  reseller_id UUID REFERENCES users(id) NOT NULL,
  pos_terminal_id UUID REFERENCES users(id), -- POS che ha chiuso il contratto
  agent_id UUID REFERENCES users(id), -- Agente procacciatore (se diverso da POS)

  -- Contract Info
  contract_type TEXT NOT NULL, -- 'energia', 'gas', 'telefonia', 'internet', 'assicurazione'
  provider_name TEXT NOT NULL, -- "Enel", "TIM", "WindTre"
  contract_number TEXT UNIQUE, -- Numero contratto provider

  -- Customer
  customer_name TEXT NOT NULL,
  customer_fiscal_code TEXT,
  customer_phone TEXT,
  customer_email TEXT,

  -- Commission
  commission_type TEXT NOT NULL, -- 'fixed', 'percentage', 'tiered'
  commission_gross DECIMAL(10,2) NOT NULL, -- Commissione lorda
  commission_net DECIMAL(10,2), -- Commissione netta (dopo tasse)
  commission_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'

  -- Payment Tracking
  expected_payment_date DATE,
  actual_payment_date DATE,
  payment_reference TEXT, -- Riferimento bonifico/pagamento

  -- Contract Status
  contract_status TEXT DEFAULT 'submitted', -- 'submitted', 'active', 'cancelled', 'expired'
  activation_date DATE,
  expiration_date DATE,

  -- Documents
  contract_pdf_url TEXT, -- URL documento contratto firmato
  documents JSONB, -- Array di documenti allegati

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_commission_contracts_reseller ON commission_contracts(reseller_id);
CREATE INDEX idx_commission_contracts_pos ON commission_contracts(pos_terminal_id);
CREATE INDEX idx_commission_contracts_agent ON commission_contracts(agent_id);
CREATE INDEX idx_commission_contracts_status ON commission_contracts(commission_status);
CREATE INDEX idx_commission_contracts_type ON commission_contracts(contract_type);
CREATE INDEX idx_commission_contracts_date ON commission_contracts(created_at DESC);
```

### 5. POS Sessions (Cash Management)

```sql
-- Sessioni operative POS (turno cassiere)
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_terminal_id UUID REFERENCES users(id) NOT NULL,
  location_id UUID REFERENCES inventory_locations(id),
  operator_name TEXT,

  -- Session Tracking
  session_start TIMESTAMPTZ DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'CLOSED'

  -- Cash Drawer (se POS gestisce contanti)
  opening_cash DECIMAL(10,2) DEFAULT 0.00, -- Fondo cassa iniziale
  closing_cash DECIMAL(10,2), -- Contante finale contato
  expected_cash DECIMAL(10,2), -- Contante atteso (opening + incassi cash)
  cash_variance DECIMAL(10,2), -- Differenza (closing - expected)

  -- Payment Breakdown
  total_cash_payments DECIMAL(10,2) DEFAULT 0.00,
  total_card_payments DECIMAL(10,2) DEFAULT 0.00,
  total_wallet_payments DECIMAL(10,2) DEFAULT 0.00,
  total_refunds DECIMAL(10,2) DEFAULT 0.00,

  -- Sales Stats
  total_orders_count INTEGER DEFAULT 0,
  total_shipments_count INTEGER DEFAULT 0,
  total_products_sold INTEGER DEFAULT 0,
  total_commissions_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0.00,

  -- Closure
  closed_by UUID REFERENCES users(id),
  closure_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_sessions_terminal ON pos_sessions(pos_terminal_id);
CREATE INDEX idx_pos_sessions_location ON pos_sessions(location_id);
CREATE INDEX idx_pos_sessions_status ON pos_sessions(status);
CREATE INDEX idx_pos_sessions_date ON pos_sessions(session_start DESC);
```

---

## 🔄 Pattern Architetturali (da tan-pos)

### 1. Cart Management (Local State)

**Pattern:** Carrello React local state → DB solo al checkout

```typescript
interface CartItem {
  id: string; // product_id
  product_type: 'physical' | 'shipment' | 'commission_service';
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;

  // Type-specific data
  shipment_data?: {
    weight: number;
    destination_zip: string;
    courier_id: string;
  };
  commission_data?: {
    customer_name: string;
    customer_phone: string;
    contract_type: string;
  };
}

const [cart, setCart] = useState<CartItem[]>([]);

// Add to cart
const addProductToCart = (product: Product) => {
  if (product.product_type === 'shipment') {
    // Mostra modal per inserire peso/destinazione
    openShipmentModal(product);
  } else {
    // Add diretto
    setCart(prev => [...prev, {
      id: product.id,
      product_type: product.product_type,
      name: product.name,
      quantity: 1,
      unit_price: product.base_price!,
      subtotal: product.base_price!
    }]);
  }
};
```

### 2. Order Creation Flow

**Pattern:** Atomic transaction (tan-pos: create order + add items)

```typescript
// 1. Create POS Order
const order = await createPOSOrder({
  reseller_id: context.target.id,
  pos_terminal_id: context.actor.id,
  location_id: currentLocationId,
  status: 'draft'
});

// 2. Add Order Items (batch)
for (const item of cart) {
  if (item.product_type === 'shipment') {
    // Crea shipment PRIMA
    const shipment = await createShipment({
      user_id: context.target.id,
      weight: item.shipment_data.weight,
      recipient_zip: item.shipment_data.destination_zip,
      courier_id: item.shipment_data.courier_id,
      // ... altri campi
    });

    // Poi link order item
    await createPOSOrderItem({
      order_id: order.id,
      product_id: item.id,
      quantity: 1,
      unit_price: shipment.final_price,
      shipment_id: shipment.id
    });
  } else if (item.product_type === 'physical') {
    // Decrementa stock
    await decrementInventoryStock({
      product_id: item.id,
      location_id: currentLocationId,
      quantity: item.quantity
    });

    await createPOSOrderItem({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price
    });
  } else if (item.product_type === 'commission_service') {
    // Crea commission contract
    const contract = await createCommissionContract({
      reseller_id: context.target.id,
      pos_terminal_id: context.actor.id,
      contract_type: item.commission_data.contract_type,
      customer_name: item.commission_data.customer_name,
      commission_gross: item.unit_price
    });

    await createPOSOrderItem({
      order_id: order.id,
      product_id: item.id,
      quantity: 1,
      unit_price: item.unit_price,
      commission_contract_id: contract.id
    });
  }
}

// 3. Calculate totals
await recalculatePOSOrderTotals(order.id);

// 4. Mark as completed
await updatePOSOrder(order.id, { status: 'completed', completed_at: new Date() });
```

### 3. Payment Processing

**Pattern:** Payment methods (tan-pos: cash/card/digital_wallet)

```typescript
const handleProcessPayment = async (paymentMethod: 'cash' | 'card' | 'wallet') => {
  // 1. Validate order
  if (grandTotal === 0) throw new Error('No items to pay');

  // 2. Create order if cart not empty
  const orderId = await ensureOrderExists();

  // 3. Process payment based on method
  if (paymentMethod === 'wallet') {
    // Debit reseller wallet (già implementato in SpediReSicuro)
    await decrementWalletBalance(resellerId, grandTotal);
  }

  // 4. Update order
  await updatePOSOrder(orderId, {
    payment_method: paymentMethod,
    payment_status: 'paid',
    paid_at: new Date(),
    status: 'completed'
  });

  // 5. Update POS session stats
  await updatePOSSession(sessionId, {
    [`total_${paymentMethod}_payments`]: increment(grandTotal),
    total_orders_count: increment(1),
    total_revenue: increment(grandTotal)
  });

  // 6. Clear cart & show internal receipt
  clearCart();
  printInternalReceipt(orderId); // Ricevuta interna (non fiscale)
};
```

### 4. Real-Time Inventory Sync

**Pattern:** Socket.IO per sync multi-terminal (tan-pos: orderItemStatusChanged)

```typescript
// Server: Emit inventory update when stock changes
socket.emit('inventoryUpdated', {
  product_id: productId,
  location_id: locationId,
  quantity_available: newQuantity
});

// Client: Listen and update UI
useEffect(() => {
  if (!socket) return;

  const handleInventoryUpdate = (data: InventoryUpdate) => {
    // Update local products cache
    queryClient.setQueryData(['products'], (old) => {
      return old.map(p =>
        p.id === data.product_id
          ? { ...p, stock: data.quantity_available }
          : p
      );
    });

    // Show toast if low stock
    if (data.quantity_available <= reorderPoint) {
      toast.warning(`Low stock: ${data.product_name} (${data.quantity_available} left)`);
    }
  };

  socket.on('inventoryUpdated', handleInventoryUpdate);
  return () => socket.off('inventoryUpdated', handleInventoryUpdate);
}, [socket]);
```

---

## 🎨 UI/UX Design (Tablet-First)

### Layout Principale (Split View - da tan-pos)

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: POS Terminal 1 | Mario Rossi | Session #123 | €487.50  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────┐  ┌─────────────────────────┐│
│  │  CATALOGO PRODOTTI/SERVIZI      │  │  CARRELLO ORDINE        ││
│  │  (60% width)                    │  │  (40% width)            ││
│  │                                 │  │                         ││
│  │  [Search: "cavo usb..."]        │  │  📦 GLS Express         ││
│  │                                 │  │     1.2kg → 20100       ││
│  │  ┌──────────────┐               │  │     €9.50               ││
│  │  │ Categorie    │               │  │                         ││
│  │  │ ─────────────│               │  │  🔌 Cavo USB-C 2m      ││
│  │  │ ✓ Tutti      │               │  │     Qty: 2  €7.98      ││
│  │  │   📦 Spedizioni│              │  │                         ││
│  │  │   📝 Cartoleria│              │  │  💡 Contratto TIM      ││
│  │  │   🔌 Elettronica│             │  │     Fibra 1Gbit        ││
│  │  │   💡 Servizi  │              │  │     €50.00 comm.       ││
│  │  └──────────────┘               │  │                         ││
│  │                                 │  │  ─────────────────      ││
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │  │  Subtotale:  €67.48    ││
│  │  │📦  │ │🔌  │ │📝  │ │💡  │   │  │  IVA (22%):  €14.85    ││
│  │  │GLS │ │Cavo│ │Penna│ │TIM │   │  │  ─────────────────    ││
│  │  │Std │ │USB │ │Bic │ │Fibra│  │  │  TOTALE:    €82.33    ││
│  │  │€8  │ │€4  │ │€1  │ │€50 │   │  │                         ││
│  │  └────┘ └────┘ └────┘ └────┘   │  │  ┌───────────────────┐ ││
│  │                                 │  │  │ 💵 PAGA CONTANTI  │ ││
│  │  ┌────┐ ┌────┐ ┌────┐          │  │  └───────────────────┘ ││
│  │  │🔌  │ │📚  │ │✉️  │          │  │  ┌───────────────────┐ ││
│  │  │Power│ │Libro│ │Buste│        │  │  │ 💳 PAGA CARTA     │ ││
│  │  │Bank│ │€15 │ │€2  │          │  │  └───────────────────┘ ││
│  │  │€12 │ │    │ │    │          │  │  ┌───────────────────┐ ││
│  │  └────┘ └────┘ └────┘          │  │  │ 💰 PAGA WALLET    │ ││
│  │                                 │  │  └───────────────────┘ ││
│  └─────────────────────────────────┘  └─────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Shipment Modal (per product_type='shipment')

Quando utente clicca su prodotto spedizione (es. "GLS Standard"), mostra modal:

```
┌───────────────────────────────────────────┐
│  📦 Nuova Spedizione - GLS Standard       │
├───────────────────────────────────────────┤
│                                           │
│  Destinatario:                            │
│  ┌─────────────────────────────────────┐  │
│  │ Nome: [________________]            │  │
│  │ Telefono: [___________]             │  │
│  │ Indirizzo: [__________________]     │  │
│  │ CAP: [_____]  Città: [________]     │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Pacco:                                   │
│  ┌─────────────────────────────────────┐  │
│  │ Peso (kg): [____]                   │  │
│  │ ☐ Assicurazione  ☐ Contrassegno    │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  💰 Prezzo: €9.50 (calcolato da listino) │
│                                           │
│  ┌────────────┐  ┌────────────┐          │
│  │  Annulla   │  │  Aggiungi  │          │
│  └────────────┘  └────────────┘          │
└───────────────────────────────────────────┘
```

### Commission Service Modal (per product_type='commission_service')

```
┌───────────────────────────────────────────┐
│  💡 Contratto Energia - Enel              │
├───────────────────────────────────────────┤
│                                           │
│  Cliente:                                 │
│  ┌─────────────────────────────────────┐  │
│  │ Nome: [____________________]        │  │
│  │ CF: [_______________]               │  │
│  │ Telefono: [___________]             │  │
│  │ Email: [__________________]         │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Contratto:                               │
│  ┌─────────────────────────────────────┐  │
│  │ Tipo: [Energia v]                   │  │
│  │ Piano: [Mono-orario v]              │  │
│  │ Potenza: [3 kW v]                   │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  💰 Commissione: €50.00                   │
│  📄 Documenti: [Upload CI + Bolletta]    │
│                                           │
│  ┌────────────┐  ┌────────────┐          │
│  │  Annulla   │  │  Registra  │          │
│  └────────────┘  └────────────┘          │
└───────────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Product Catalog

```typescript
// GET /api/pos/products
// Query: ?category_id=xxx&product_type=physical&search=usb
{
  products: Product[];
  total: number;
}

// GET /api/pos/categories
{
  categories: ProductCategory[];
}
```

### Cart & Orders

```typescript
// POST /api/pos/orders/create
// Body: { items: CartItem[], payment_method, customer_info? }
{
  order: POSOrder;
  internal_receipt_url: string; // PDF ricevuta interna (non fiscale)
  shipment_labels?: string[]; // Array PDF labels se ci sono spedizioni
}

// GET /api/pos/orders?status=completed&date_from=2026-01-01
{
  orders: POSOrder[];
  total: number;
}

// GET /api/pos/orders/[id]
{
  order: POSOrder & {
    items: POSOrderItem[];
    shipments?: Shipment[];
    commissions?: CommissionContract[];
  };
}
```

### Inventory

```typescript
// GET /api/pos/inventory?location_id=xxx
{
  stocks: (InventoryStock & { product: Product })[];
}

// POST /api/pos/inventory/adjust
// Body: { product_id, location_id, quantity_delta, reason }
{
  new_stock: InventoryStock;
}

// GET /api/pos/inventory/low-stock?location_id=xxx
{
  low_stock_products: (Product & { stock: InventoryStock })[];
}
```

### Sessions

```typescript
// POST /api/pos/sessions/start
// Body: { pos_terminal_id, opening_cash }
{
  session: POSSession;
}

// POST /api/pos/sessions/[id]/close
// Body: { closing_cash, closure_notes }
{
  session: POSSession;
  cash_variance: number;
  daily_report: DailyReport;
}

// GET /api/pos/sessions/current
{
  session: POSSession | null;
}
```

### Commissions

```typescript
// POST /api/pos/commissions/create
// Body: CommissionContractInput
{
  contract: CommissionContract;
}

// GET /api/pos/commissions?status=pending&date_from=xxx
{
  contracts: CommissionContract[];
  total_commission_pending: number;
}

// PATCH /api/pos/commissions/[id]/approve
{
  contract: CommissionContract;
}
```

---

## 🚀 Integration Plan

### Phase 1: Database Setup ✅

```bash
# 1. Create migrations
supabase/migrations/200_pos_product_catalog.sql
supabase/migrations/201_pos_inventory.sql
supabase/migrations/202_pos_orders.sql
supabase/migrations/203_pos_commissions.sql
supabase/migrations/204_pos_sessions.sql

# 2. Apply migrations
npx supabase db push

# 3. Seed demo data
supabase/seed/pos_demo_products.sql
```

### Phase 2: API Layer

```bash
# Create API routes
app/api/pos/products/route.ts
app/api/pos/categories/route.ts
app/api/pos/orders/route.ts
app/api/pos/inventory/route.ts
app/api/pos/sessions/route.ts
app/api/pos/commissions/route.ts

# Server actions
actions/pos-orders.ts
actions/inventory.ts
actions/commissions.ts
```

### Phase 3: UI Components

```bash
# POS Terminal Pages
app/(authenticated)/pos/page.tsx          # Main POS interface
app/(authenticated)/pos/inventory/page.tsx
app/(authenticated)/pos/orders/page.tsx
app/(authenticated)/pos/commissions/page.tsx
app/(authenticated)/pos/reports/page.tsx

# Components
components/pos/ProductGrid.tsx
components/pos/Cart.tsx
components/pos/ShipmentModal.tsx
components/pos/CommissionModal.tsx
components/pos/PaymentSelector.tsx
components/pos/ReceiptPrinter.tsx
```

### Phase 4: Real-Time (Socket.IO)

```bash
# Add to existing Socket.IO server
lib/socket-server.ts
  - emit('inventoryUpdated', { product_id, quantity })
  - emit('orderCompleted', { order_id })

# Client hook
hooks/usePOSSocket.ts
```

---

## 🔒 Security & Authorization

### RLS Policies

```sql
-- products: Reseller vede solo prodotti globali + propri custom
CREATE POLICY products_select ON products FOR SELECT USING (
  is_super_admin(auth.uid())
  OR is_global = true
  OR owner_id::text = auth.uid()::text
  OR (owner_id IN (SELECT get_reseller_id(auth.uid())))
);

-- inventory_stocks: Reseller vede solo stock proprie locations
CREATE POLICY inventory_stocks_select ON inventory_stocks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM inventory_locations il
    WHERE il.id = inventory_stocks.location_id
    AND (il.reseller_id::text = auth.uid()::text OR is_super_admin(auth.uid()))
  )
);

-- pos_orders: Reseller vede solo propri ordini
CREATE POLICY pos_orders_select ON pos_orders FOR SELECT USING (
  is_super_admin(auth.uid())
  OR reseller_id::text = auth.uid()::text
  OR pos_terminal_id::text = auth.uid()::text
);
```

### Role Guards (Client)

```typescript
// Only POS terminals can access POS interface
<RoleGuard allowedRoles={['pos_terminal', 'reseller', 'superadmin']}>
  <POSPage />
</RoleGuard>
```

---

## 📊 Reporting & Analytics

### Daily POS Report

```sql
-- Vista aggregata per report giornaliero
CREATE VIEW pos_daily_reports AS
SELECT
  s.pos_terminal_id,
  s.location_id,
  DATE(s.session_start) as report_date,

  -- Sessions
  COUNT(DISTINCT s.id) as sessions_count,
  SUM(s.total_orders_count) as total_orders,

  -- Revenue
  SUM(s.total_revenue) as total_revenue,
  SUM(s.total_cash_payments) as cash_revenue,
  SUM(s.total_card_payments) as card_revenue,
  SUM(s.total_wallet_payments) as wallet_revenue,

  -- Products
  SUM(s.total_shipments_count) as shipments_sold,
  SUM(s.total_products_sold) as products_sold,
  SUM(s.total_commissions_count) as commissions_sold,

  -- Cash Variance
  SUM(s.cash_variance) as total_cash_variance

FROM pos_sessions s
WHERE s.status = 'CLOSED'
GROUP BY s.pos_terminal_id, s.location_id, DATE(s.session_start);
```

---

## 🎯 Metriche di Successo

### KPI Operativi

- **Tempo medio checkout:** < 2 minuti (dalla selezione prodotti al pagamento)
- **Uptime POS:** > 99.5% (resilienza offline-first con sync)
- **Accuracy inventario:** > 98% (discrepanza fisica vs sistema)
- **Conversion rate commissioni:** > 5% (contratti procacciati / clienti totali)

### KPI Business

- **Revenue per POS:** Target €500+/giorno
- **Mix prodotti:** 40% spedizioni, 30% retail, 30% commissioni
- **Average basket:** €15-20
- **Repeat customers:** > 30%

---

## 📚 References

### Pattern Source

- **tan-pos:** https://github.com/kadekdodikwirawan/tan-pos
  - Schema: `/src/db/schema.ts`
  - POS UI: `/src/routes/dashboard/pos.tsx`
  - Order Flow: tRPC mutations `orders.create`, `orders.addItem`

### SpediReSicuro Docs

- `/docs/2-ARCHITECTURE/OVERVIEW.md` - Architettura generale
- `/docs/11-FEATURES/RESELLER_HIERARCHY.md` - Sistema reseller
- `/lib/shipments/create-shipment-core.ts` - Creazione spedizioni
- `/lib/pricing/calculator.ts` - Pricing engine

---

## 🚧 Next Steps

### Immediate (Week 1)
1. ✅ Review architettura con team
2. ⏳ Approvazione schema database
3. ⏳ Setup migrations

### Short-term (Month 1)
1. Implementare API layer completo
2. Build POS UI (tablet-optimized)
3. Testing con 1 reseller pilota

### Long-term (Quarter 1)
1. Rollout graduale a tutti i reseller
2. Dashboard analytics avanzata (vendite, margini, commissioni)
3. Mobile app nativa (React Native)
4. **[FUTURO]** Integrazione fiscale quando necessario (oltre soglia volume)

---

**Fine Documento**
*Versione: 1.0*
*Ultima modifica: 2026-01-18*
