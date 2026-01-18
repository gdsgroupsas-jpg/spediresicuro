# 🛠️ POS Implementation Guide

**Quick Start Guide** per implementare il sistema POS Multi-Servizio in SpediReSicuro.

---

## 📋 Prerequisiti

- ✅ SpediReSicuro funzionante con sistema reseller
- ✅ Supabase database configurato
- ✅ Next.js 14 + App Router
- ✅ Socket.IO server (opzionale per real-time)

---

## ⚠️ NOTA IMPORTANTE: Gestione Fiscale

**Questo POS NON gestisce la fiscalità diretta.**

È un **sistema gestionale interno** per tracking vendite e inventario.

**Gestione Fiscale:**
- Scontrini/Fatture: tramite registratore di cassa fiscale del reseller
- Il POS genera solo **ricevute interne** (non fiscali)
- Integrazione fiscale: **NON inclusa** (futura quando necessario)

---

## 🚀 Step 1: Database Migrations

### Migration 1: Product Catalog

```sql
-- File: supabase/migrations/200_pos_product_catalog.sql

-- Enums
CREATE TYPE product_type AS ENUM (
  'physical',           -- Prodotto fisico
  'shipment',           -- Servizio spedizione
  'commission_service', -- Servizio commissionale
  'virtual'             -- Servizio digitale
);

-- Categorie
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES product_categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_categories_active ON product_categories(is_active) WHERE is_active = true;

-- Prodotti
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  product_type product_type NOT NULL DEFAULT 'physical',
  base_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  vat_rate DECIMAL(5,2) DEFAULT 22.00,
  vat_included BOOLEAN DEFAULT true,
  commission_type TEXT,
  commission_amount DECIMAL(10,2),
  owner_id UUID REFERENCES users(id),
  is_global BOOLEAN DEFAULT false,
  image_url TEXT,
  emoji TEXT,
  barcode TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_stock BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_owner ON products(owner_id);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select ON product_categories FOR SELECT USING (is_active = true);

CREATE POLICY products_select ON products FOR SELECT USING (
  is_super_admin(auth.uid())
  OR is_global = true
  OR owner_id::text = auth.uid()::text
  OR owner_id IN (
    SELECT parent_id FROM users WHERE id::text = auth.uid()::text
  )
);

CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (
  is_super_admin(auth.uid())
  OR owner_id::text = auth.uid()::text
);

CREATE POLICY products_update ON products FOR UPDATE USING (
  is_super_admin(auth.uid())
  OR owner_id::text = auth.uid()::text
);
```

### Migration 2: Inventory

```sql
-- File: supabase/migrations/201_pos_inventory.sql

CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  reseller_id UUID REFERENCES users(id) NOT NULL,
  location_type TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_locations_reseller ON inventory_locations(reseller_id);

CREATE TABLE inventory_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES inventory_locations(id) ON DELETE CASCADE NOT NULL,
  quantity_available INTEGER DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved INTEGER DEFAULT 0 CHECK (quantity_reserved >= 0),
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  location_price DECIMAL(10,2),
  last_restock_at TIMESTAMPTZ,
  last_restock_quantity INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id)
);

CREATE INDEX idx_inventory_stocks_product ON inventory_stocks(product_id);
CREATE INDEX idx_inventory_stocks_location ON inventory_stocks(location_id);
CREATE INDEX idx_inventory_stocks_low ON inventory_stocks(quantity_available)
  WHERE quantity_available <= reorder_point;

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  location_id UUID REFERENCES inventory_locations(id) NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  order_id UUID,
  reference_id UUID,
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_location ON inventory_movements(location_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at DESC);

-- RLS
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_locations_select ON inventory_locations FOR SELECT USING (
  is_super_admin(auth.uid())
  OR reseller_id::text = auth.uid()::text
  OR reseller_id IN (SELECT parent_id FROM users WHERE id::text = auth.uid()::text)
);

CREATE POLICY inventory_stocks_select ON inventory_stocks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM inventory_locations il
    WHERE il.id = inventory_stocks.location_id
    AND (il.reseller_id::text = auth.uid()::text OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM inventory_locations il
    WHERE il.id = inventory_movements.location_id
    AND (il.reseller_id::text = auth.uid()::text OR is_super_admin(auth.uid()))
  )
);
```

### Migration 3: POS Orders

```sql
-- File: supabase/migrations/202_pos_orders.sql

CREATE TABLE pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  reseller_id UUID REFERENCES users(id) NOT NULL,
  pos_terminal_id UUID REFERENCES users(id) NOT NULL,
  location_id UUID REFERENCES inventory_locations(id),
  operator_name TEXT,
  status TEXT DEFAULT 'draft',
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_fiscal_code TEXT,
  customer_vat_number TEXT,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  internal_receipt_number TEXT, -- Ricevuta interna (non fiscale)
  notes TEXT,
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

CREATE TABLE pos_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES pos_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipment_id UUID REFERENCES shipments(id),
  commission_contract_id UUID,
  item_snapshot JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_order_items_order ON pos_order_items(order_id);
CREATE INDEX idx_pos_order_items_product ON pos_order_items(product_id);
CREATE INDEX idx_pos_order_items_shipment ON pos_order_items(shipment_id);

-- RLS
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_orders_select ON pos_orders FOR SELECT USING (
  is_super_admin(auth.uid())
  OR reseller_id::text = auth.uid()::text
  OR pos_terminal_id::text = auth.uid()::text
);

CREATE POLICY pos_order_items_select ON pos_order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pos_orders po
    WHERE po.id = pos_order_items.order_id
    AND (po.reseller_id::text = auth.uid()::text OR is_super_admin(auth.uid()))
  )
);
```

### Migration 4: Commission Contracts

```sql
-- File: supabase/migrations/203_pos_commissions.sql

CREATE TABLE commission_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID REFERENCES users(id) NOT NULL,
  pos_terminal_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES users(id),
  contract_type TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  contract_number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_fiscal_code TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  commission_type TEXT NOT NULL,
  commission_gross DECIMAL(10,2) NOT NULL,
  commission_net DECIMAL(10,2),
  commission_status TEXT DEFAULT 'pending',
  expected_payment_date DATE,
  actual_payment_date DATE,
  payment_reference TEXT,
  contract_status TEXT DEFAULT 'submitted',
  activation_date DATE,
  expiration_date DATE,
  contract_pdf_url TEXT,
  documents JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_commission_contracts_reseller ON commission_contracts(reseller_id);
CREATE INDEX idx_commission_contracts_status ON commission_contracts(commission_status);
CREATE INDEX idx_commission_contracts_type ON commission_contracts(contract_type);
CREATE INDEX idx_commission_contracts_date ON commission_contracts(created_at DESC);

-- RLS
ALTER TABLE commission_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_contracts_select ON commission_contracts FOR SELECT USING (
  is_super_admin(auth.uid())
  OR reseller_id::text = auth.uid()::text
  OR pos_terminal_id::text = auth.uid()::text
);

-- Update pos_order_items FK
ALTER TABLE pos_order_items
  ADD CONSTRAINT fk_commission_contract
  FOREIGN KEY (commission_contract_id)
  REFERENCES commission_contracts(id);
```

---

## 🎨 Step 2: Seed Demo Data

```sql
-- File: supabase/seed/pos_demo_data.sql

-- 1. Categorie
INSERT INTO product_categories (name, icon, sort_order) VALUES
  ('Spedizioni', '📦', 1),
  ('Cartoleria', '📝', 2),
  ('Cartolibreria', '📚', 3),
  ('Elettronica', '🔌', 4),
  ('Servizi Procacciamento', '💡', 5);

-- 2. Prodotti Fisici (Cartoleria)
INSERT INTO products (
  sku, name, product_type, base_price, cost_price,
  category_id, emoji, is_global, requires_stock
)
SELECT
  'PENNA-BIC-BLU', 'Penna Bic Blu', 'physical', 0.50, 0.20,
  id, '🖊️', true, true
FROM product_categories WHERE name = 'Cartoleria'
UNION ALL
SELECT
  'QUADERNO-A4', 'Quaderno A4 100 Fogli', 'physical', 2.50, 1.00,
  id, '📓', true, true
FROM product_categories WHERE name = 'Cartoleria'
UNION ALL
SELECT
  'BUSTE-A4-100PZ', 'Buste A4 100pz', 'physical', 8.99, 4.50,
  id, '✉️', true, true
FROM product_categories WHERE name = 'Cartoleria';

-- 3. Prodotti Elettronica
INSERT INTO products (
  sku, name, product_type, base_price, cost_price,
  category_id, emoji, is_global, requires_stock
)
SELECT
  'CAVO-USB-C-2M', 'Cavo USB-C 2m', 'physical', 3.99, 1.50,
  id, '🔌', true, true
FROM product_categories WHERE name = 'Elettronica'
UNION ALL
SELECT
  'POWERBANK-10000', 'Powerbank 10000mAh', 'physical', 12.99, 6.00,
  id, '🔋', true, true
FROM product_categories WHERE name = 'Elettronica'
UNION ALL
SELECT
  'CARICABATTERIE-USB', 'Caricabatterie USB 2A', 'physical', 5.99, 2.50,
  id, '🔌', true, true
FROM product_categories WHERE name = 'Elettronica';

-- 4. Servizi Spedizione (prezzo dinamico da listino)
INSERT INTO products (
  sku, name, product_type, base_price,
  category_id, emoji, is_global, requires_stock
)
SELECT
  'SHIP-GLS-STD', 'GLS Standard', 'shipment', NULL,
  id, '📦', true, false
FROM product_categories WHERE name = 'Spedizioni'
UNION ALL
SELECT
  'SHIP-GLS-EXP', 'GLS Express', 'shipment', NULL,
  id, '🚀', true, false
FROM product_categories WHERE name = 'Spedizioni'
UNION ALL
SELECT
  'SHIP-POSTE-STD', 'Poste Standard', 'shipment', NULL,
  id, '📮', true, false
FROM product_categories WHERE name = 'Spedizioni';

-- 5. Servizi Commissioni
INSERT INTO products (
  sku, name, product_type, commission_type, commission_amount,
  category_id, emoji, is_global, requires_stock
)
SELECT
  'COMM-ENERGIA', 'Contratto Energia', 'commission_service', 'fixed', 50.00,
  id, '💡', true, false
FROM product_categories WHERE name = 'Servizi Procacciamento'
UNION ALL
SELECT
  'COMM-TELEFONIA', 'Contratto Telefonia', 'commission_service', 'fixed', 40.00,
  id, '📱', true, false
FROM product_categories WHERE name = 'Servizi Procacciamento'
UNION ALL
SELECT
  'COMM-FIBRA', 'Contratto Fibra Internet', 'commission_service', 'fixed', 60.00,
  id, '🌐', true, false
FROM product_categories WHERE name = 'Servizi Procacciamento';

-- 6. Inventory Location Demo (per testing)
-- NOTA: Sostituire 'RESELLER-UUID-HERE' con un vero reseller ID
-- INSERT INTO inventory_locations (name, reseller_id, location_type) VALUES
--   ('POS Terminal 1', 'RESELLER-UUID-HERE', 'pos_terminal');

-- 7. Stock Iniziale (esempio)
-- INSERT INTO inventory_stocks (product_id, location_id, quantity_available)
-- SELECT p.id, 'LOCATION-UUID-HERE', 100
-- FROM products p
-- WHERE p.product_type = 'physical';
```

---

## 💻 Step 3: TypeScript Types

```typescript
// File: types/pos.ts

export type ProductType = 'physical' | 'shipment' | 'commission_service' | 'virtual';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  product_type: ProductType;
  base_price?: number;
  cost_price?: number;
  vat_rate: number;
  vat_included: boolean;
  commission_type?: 'fixed' | 'percentage';
  commission_amount?: number;
  owner_id?: string;
  is_global: boolean;
  image_url?: string;
  emoji?: string;
  barcode?: string;
  is_active: boolean;
  requires_stock: boolean;
}

export interface CartItem {
  id: string; // product_id
  product_type: ProductType;
  sku: string;
  name: string;
  emoji?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;

  // Type-specific data
  shipment_data?: {
    weight: number;
    recipient_name: string;
    recipient_address: string;
    recipient_city: string;
    recipient_zip: string;
    recipient_phone: string;
  };

  commission_data?: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    customer_fiscal_code?: string;
    contract_type: string;
    provider_name: string;
  };
}

export interface POSOrder {
  id: string;
  order_number: string;
  reseller_id: string;
  pos_terminal_id: string;
  location_id?: string;
  status: 'draft' | 'pending' | 'completed' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method?: 'cash' | 'card' | 'wallet' | 'mixed';
  payment_status: 'pending' | 'paid' | 'refunded';
  created_at: string;
  items?: POSOrderItem[];
}

export interface POSOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  shipment_id?: string;
  commission_contract_id?: string;
  notes?: string;
}
```

---

## 🚀 Step 4: API Implementation

### Example: Products API

```typescript
// File: app/api/pos/products/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSafeAuth } from '@/lib/safe-auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const context = await requireSafeAuth();
    const supabase = await createClient();

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const category_id = searchParams.get('category_id');
    const product_type = searchParams.get('product_type');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('products')
      .select(`
        *,
        category:product_categories(id, name, icon)
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (product_type) {
      query = query.eq('product_type', product_type);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error } = await query;

    if (error) throw error;

    return NextResponse.json({ products, total: products?.length || 0 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Example: Create Order Server Action

```typescript
// File: actions/pos-orders.ts

'use server';

import { requireSafeAuth } from '@/lib/safe-auth';
import { createClient } from '@/lib/supabase/server';
import { createShipmentCore } from '@/lib/shipments/create-shipment-core';
import type { CartItem } from '@/types/pos';

interface CreatePOSOrderInput {
  items: CartItem[];
  payment_method: 'cash' | 'card' | 'wallet';
  customer_info?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  location_id?: string;
}

export async function createPOSOrder(input: CreatePOSOrderInput) {
  const context = await requireSafeAuth();
  const supabase = await createClient();

  // 1. Generate order number
  const orderNumber = `POS-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // 2. Create order
  const { data: order, error: orderError } = await supabase
    .from('pos_orders')
    .insert({
      order_number: orderNumber,
      reseller_id: context.target.id,
      pos_terminal_id: context.actor.id,
      location_id: input.location_id,
      status: 'draft',
      customer_name: input.customer_info?.name,
      customer_email: input.customer_info?.email,
      customer_phone: input.customer_info?.phone,
      payment_method: input.payment_method,
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error('Failed to create order: ' + orderError?.message);
  }

  // 3. Process cart items
  let subtotal = 0;
  let tax_amount = 0;

  for (const item of input.items) {
    let unit_price = item.unit_price;
    let shipment_id: string | null = null;
    let commission_contract_id: string | null = null;

    // Handle shipments
    if (item.product_type === 'shipment' && item.shipment_data) {
      const shipment = await createShipmentCore({
        user_id: context.target.id,
        sender_name: 'POS Default Sender', // TODO: Get from location config
        recipient_name: item.shipment_data.recipient_name,
        recipient_address: item.shipment_data.recipient_address,
        recipient_city: item.shipment_data.recipient_city,
        recipient_zip: item.shipment_data.recipient_zip,
        recipient_phone: item.shipment_data.recipient_phone,
        weight: item.shipment_data.weight,
        // ... other required fields
      });

      shipment_id = shipment.id;
      unit_price = shipment.final_price || 0;
    }

    // Handle commission services
    if (item.product_type === 'commission_service' && item.commission_data) {
      const { data: contract } = await supabase
        .from('commission_contracts')
        .insert({
          reseller_id: context.target.id,
          pos_terminal_id: context.actor.id,
          contract_type: item.commission_data.contract_type,
          provider_name: item.commission_data.provider_name,
          customer_name: item.commission_data.customer_name,
          customer_phone: item.commission_data.customer_phone,
          customer_email: item.commission_data.customer_email,
          customer_fiscal_code: item.commission_data.customer_fiscal_code,
          commission_type: 'fixed',
          commission_gross: item.unit_price,
          commission_status: 'pending',
          contract_status: 'submitted',
        })
        .select()
        .single();

      commission_contract_id = contract?.id || null;
    }

    // Handle physical products (decrement stock)
    if (item.product_type === 'physical' && input.location_id) {
      await decrementInventoryStock(
        item.id,
        input.location_id,
        item.quantity
      );
    }

    // Calculate item totals
    const item_subtotal = unit_price * item.quantity;
    const item_tax = item_subtotal * 0.22; // 22% VAT
    const item_total = item_subtotal + item_tax;

    subtotal += item_subtotal;
    tax_amount += item_tax;

    // Insert order item
    await supabase.from('pos_order_items').insert({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price,
      subtotal: item_subtotal,
      tax_amount: item_tax,
      total: item_total,
      shipment_id,
      commission_contract_id,
      notes: item.notes,
    });
  }

  // 4. Update order totals
  const total = subtotal + tax_amount;

  const { data: updatedOrder } = await supabase
    .from('pos_orders')
    .update({
      subtotal,
      tax_amount,
      total,
      status: 'completed',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select()
    .single();

  return {
    order: updatedOrder,
    order_number: orderNumber,
  };
}

async function decrementInventoryStock(
  product_id: string,
  location_id: string,
  quantity: number
) {
  const supabase = await createClient();

  // Atomic decrement
  const { error } = await supabase.rpc('decrement_inventory_stock', {
    p_product_id: product_id,
    p_location_id: location_id,
    p_quantity: quantity,
  });

  if (error) throw new Error('Insufficient stock');
}
```

### RPC Function for Inventory

```sql
-- File: supabase/migrations/204_inventory_rpc.sql

CREATE OR REPLACE FUNCTION decrement_inventory_stock(
  p_product_id UUID,
  p_location_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory_stocks
  SET quantity_available = quantity_available - p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
    AND location_id = p_location_id
    AND quantity_available >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product % at location %', p_product_id, p_location_id;
  END IF;

  -- Log movement
  INSERT INTO inventory_movements (
    product_id,
    location_id,
    movement_type,
    quantity,
    performed_by
  ) VALUES (
    p_product_id,
    p_location_id,
    'SALE',
    -p_quantity,
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🎨 Step 5: Frontend Components

### POS Main Page (Simplified)

```tsx
// File: app/(authenticated)/pos/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { ShipmentModal } from '@/components/pos/ShipmentModal';
import type { Product, CartItem } from '@/types/pos';

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [selectedShipmentProduct, setSelectedShipmentProduct] = useState<Product | null>(null);

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['pos-products', selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category_id', selectedCategory);
      }
      const res = await fetch(`/api/pos/products?${params}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const products = productsData?.products || [];

  const handleAddToCart = (product: Product) => {
    if (product.product_type === 'shipment') {
      // Open modal per inserire dati spedizione
      setSelectedShipmentProduct(product);
      setShipmentModalOpen(true);
    } else {
      // Add diretto
      setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
          return prev.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
              : item
          );
        }
        return [...prev, {
          id: product.id,
          product_type: product.product_type,
          sku: product.sku,
          name: product.name,
          emoji: product.emoji,
          quantity: 1,
          unit_price: product.base_price || 0,
          subtotal: product.base_price || 0,
        }];
      });
    }
  };

  const handleAddShipment = (shipmentData: any) => {
    if (!selectedShipmentProduct) return;

    // Add shipment to cart with data
    setCart(prev => [...prev, {
      id: selectedShipmentProduct.id,
      product_type: 'shipment',
      sku: selectedShipmentProduct.sku,
      name: `${selectedShipmentProduct.name} - ${shipmentData.recipient_zip}`,
      emoji: selectedShipmentProduct.emoji,
      quantity: 1,
      unit_price: 0, // Will be calculated by backend
      subtotal: 0,
      shipment_data: shipmentData,
    }]);

    setShipmentModalOpen(false);
    setSelectedShipmentProduct(null);
  };

  return (
    <div className="h-screen flex gap-4 p-4">
      {/* Products Section (60%) */}
      <div className="flex-[6] flex flex-col">
        <ProductGrid
          products={products}
          onAddToCart={handleAddToCart}
        />
      </div>

      {/* Cart Section (40%) */}
      <div className="flex-[4]">
        <Cart
          cart={cart}
          onUpdateCart={setCart}
        />
      </div>

      {/* Shipment Modal */}
      <ShipmentModal
        open={shipmentModalOpen}
        product={selectedShipmentProduct}
        onClose={() => setShipmentModalOpen(false)}
        onSubmit={handleAddShipment}
      />
    </div>
  );
}
```

---

## 📚 Next Steps

1. **Apply Migrations:** `npx supabase db push`
2. **Seed Data:** Run seed SQL script
3. **Test API:** Use Postman/Thunder Client
4. **Build UI:** Implement components step-by-step
5. **Test with Reseller:** Create POS terminal user and test full flow

---

**Domande?** Controlla `/docs/POS_ARCHITECTURE.md` per dettagli completi.
