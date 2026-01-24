import { createServerActionClient } from '@/lib/supabase-server';
import { computeMargin } from '@/lib/financial';
import type {
  UserRole,
  Shipment,
  CODShipment,
  FiscalDeadline,
  FiscalContext,
  FiscalDataError,
  MarginUnavailableReason,
} from './fiscal-data.types';

export type {
  UserRole,
  Shipment,
  CODShipment,
  FiscalDeadline,
  FiscalContext,
  FiscalDataError,
  MarginUnavailableReason,
} from './fiscal-data.types';

/**
 * Recupera l'elenco degli ID dei sub-utenti per un reseller
 */
async function getSubUserIds(resellerId: string): Promise<string[]> {
  const supabase = createServerActionClient();
  const { data } = await supabase.from('users').select('id').eq('parent_id', resellerId);

  return data ? data.map((u) => u.id) : [];
}

/**
 * Esegue query spedizioni filtrata rigorosamente per utente/ruolo
 * @throws {FiscalDataError} Se la query fallisce
 */
export async function getShipmentsByPeriod(
  userId: string,
  role: UserRole,
  startDate: string, // ISO Date string
  endDate: string // ISO Date string
): Promise<Shipment[]> {
  const supabase = createServerActionClient();
  // ⚠️ FIX: Usa colonne reali della tabella shipments
  // total_cost/final_price = prezzo vendita, base_price = costo fornitore
  // Se base_price non è popolato, usiamo platform_provider_costs
  let query = supabase
    .from('shipments')
    .select(
      'id, created_at, status, total_cost, final_price, base_price, margin_percent, cash_on_delivery, cod_status, user_id'
    )
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('deleted', false);

  switch (role) {
    case 'superadmin':
      // Superadmin vede tutto, ma potrebbe voler filtrare.
      // Se funzione chiamata genericamente, ritorna tutto.
      // Se volessi filtrare per specifico utente, passerei userId diverso.
      // Qui manteniamo logica: se superadmin chiama per SE STESSO, vede tutto analytics.
      break;

    case 'reseller':
      const subUserIds = await getSubUserIds(userId);
      // Filtra per se stesso O i suoi sub-utenti
      query = query.in('user_id', [userId, ...subUserIds]);
      break;

    case 'admin':
      // Admin (non super) vede aggregati?
      // Per sicurezza, trattiamolo come User Standard se non specificato diversamente
      // o diamogli accesso simile a Superadmin ma limitato.
      // Da specifica utente: "Admin vede dati aggregati".
      // Per semplificare qui ritorniamo dati raw filtrati, l'aggregazione la fa l'AI o un wrapper.
      // Mettiamo stessa logica User Standard per sicurezza default.
      query = query.eq('user_id', userId);
      break;

    case 'user':
    default:
      // USER STANDARD: SOLO I SUOI DATI
      query = query.eq('user_id', userId);
      break;
  }

  const { data, error } = await query;
  if (error) {
    const fiscalError = new Error(
      `Errore recupero spedizioni: ${error.message}`
    ) as FiscalDataError;
    fiscalError.code = 'DATABASE_ERROR';
    fiscalError.context = { userId, role, startDate, endDate };
    throw fiscalError;
  }

  // Recupera provider costs da platform_provider_costs per calcolo margine accurato
  const shipmentIds = (data || []).map((s: any) => s.id);
  let providerCostMap = new Map<string, number>();

  if (shipmentIds.length > 0) {
    const { data: providerCosts, error: providerCostsError } = await supabase
      .from('platform_provider_costs')
      .select('shipment_id, provider_cost')
      .in('shipment_id', shipmentIds);

    if (!providerCostsError && providerCosts) {
      for (const pc of providerCosts) {
        if (pc.shipment_id && pc.provider_cost != null) {
          providerCostMap.set(pc.shipment_id, parseFloat(pc.provider_cost));
        }
      }
    }
  }

  // ✅ NUOVO: Usa computeMargin per calcolo strict (no calcoli inversi)
  // PRINCIPIO: Un margine esiste SOLO se esistono dati reali
  const mappedData = (data || []).map((s: any) => {
    // Prezzo vendita
    const total_price = parseFloat(s.final_price) || parseFloat(s.total_cost) || 0;

    // Costo fornitore: SOLO da dati reali
    const basePrice = parseFloat(s.base_price) || null;
    const providerCost = providerCostMap.get(s.id) ?? null;

    // Usa computeMargin per calcolo strict
    // ⚠️ RIMOSSO: calcolo inverso courier_cost = total_price / (1 + margin_percent/100)
    const marginResult = computeMargin({
      finalPrice: total_price,
      providerCost: providerCost,
      basePrice: basePrice,
      apiSource: s.api_source || 'platform',
    });

    // Determina courier_cost dal source usato
    const courier_cost =
      marginResult.costSource === 'provider_cost'
        ? providerCost
        : marginResult.costSource === 'base_price'
          ? basePrice
          : null;

    // Converti reason a tipo compatibile
    let margin_reason: MarginUnavailableReason | null = null;
    if (!marginResult.isCalculable && marginResult.reason) {
      if (
        marginResult.reason === 'MISSING_COST_DATA' ||
        marginResult.reason === 'NOT_APPLICABLE_FOR_MODEL' ||
        marginResult.reason === 'MISSING_FINAL_PRICE'
      ) {
        margin_reason = marginResult.reason;
      }
    }

    return {
      ...s,
      total_price: Math.round(total_price * 100) / 100,
      courier_cost: courier_cost !== null ? Math.round(courier_cost * 100) / 100 : null,
      margin: marginResult.margin,
      margin_reason,
      cod_status: s.cod_status || null,
    };
  });

  return mappedData as Shipment[];
}

/**
 * Recupera scadenze fiscali statiche (calendario) + eventuali dinamiche
 */
export function getFiscalDeadlines(): FiscalDeadline[] {
  const currentYear = new Date().getFullYear();
  // Calendario statico come da specifica
  return [
    {
      date: `${currentYear}-01-16`,
      description: 'F24 IVA mensile / Ritenute',
      type: 'F24',
    },
    {
      date: `${currentYear}-02-16`,
      description: 'F24 IVA mensile / Ritenute',
      type: 'F24',
    },
    {
      date: `${currentYear}-03-16`,
      description: 'F24 IVA mensile / Ritenute',
      type: 'F24',
    },
    {
      date: `${currentYear}-03-31`,
      description: 'LIPE Q4 Anno Prec.',
      type: 'LIPE',
    },
    {
      date: `${currentYear}-04-16`,
      description: 'F24 IVA mensile / Ritenute',
      type: 'F24',
    },
    {
      date: `${currentYear}-04-30`,
      description: 'Dichiarazione IVA Annuale',
      type: 'Dichiarazione',
    },
    {
      date: `${currentYear}-05-16`,
      description: 'F24 IVA mensile / Ritenute',
      type: 'F24',
    },
    { date: `${currentYear}-05-31`, description: 'LIPE Q1', type: 'LIPE' },
    {
      date: `${currentYear}-06-16`,
      description: 'F24 IVA mensile / Ritenute',
      type: 'F24',
    },
    {
      date: `${currentYear}-06-30`,
      description: 'Saldo Imposte / IRES / IRAP',
      type: 'Imposte',
    },
    // ... altri mesi ...
    {
      date: `${currentYear}-12-16`,
      description: 'Acconto IVA / F24 Mensile',
      type: 'F24',
    },
  ];
}

/**
 * Recupera stato COD (Contrassegni) per l'utente, isolato.
 * @throws {FiscalDataError} Se la query fallisce
 */
export async function getPendingCOD(userId: string, role: UserRole): Promise<CODShipment[]> {
  const supabase = createServerActionClient();
  // ⚠️ FIX: cod_status ora esiste nel database (dopo migrazione 105_add_fiscal_columns_to_shipments.sql)
  let query = supabase
    .from('shipments')
    .select('id, created_at, cash_on_delivery, cash_on_delivery_amount, cod_status, user_id')
    .eq('cash_on_delivery', true) // Solo contrassegni
    .neq('cod_status', 'paid') // Non ancora pagati al merchant
    .eq('deleted', false);

  // Applicazione filtri di ruolo (simile a getShipmentsByPeriod)
  if (role === 'reseller') {
    const subUserIds = await getSubUserIds(userId);
    query = query.in('user_id', [userId, ...subUserIds]);
  } else if (role !== 'superadmin') {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    const fiscalError = new Error(`Errore recupero COD: ${error.message}`) as FiscalDataError;
    fiscalError.code = 'DATABASE_ERROR';
    fiscalError.context = { userId, role };
    throw fiscalError;
  }

  // ⚠️ FIX: cod_status ora esiste nel database (dopo migrazione 105_add_fiscal_columns_to_shipments.sql)
  // cash_on_delivery nel tipo è number (importo), nel DB è boolean, usiamo cash_on_delivery_amount
  const mappedData = (data || []).map((s: any) => ({
    id: s.id,
    created_at: s.created_at,
    user_id: s.user_id,
    cod_status: (s.cod_status || 'pending') as 'pending' | 'collected' | 'paid',
    cash_on_delivery: parseFloat(s.cash_on_delivery_amount || '0') || 0, // Importo COD
  }));

  return mappedData as CODShipment[];
}

/**
 * Costruisce il contesto completo per l'AI
 * @throws {FiscalDataError} Se il recupero dati fallisce
 */
export async function getFiscalContext(userId: string, role: UserRole): Promise<FiscalContext> {
  const today = new Date();
  // Default last 30 days context
  const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
  const endDate = today.toISOString();

  const supabase = createServerActionClient();

  const shipments = await getShipmentsByPeriod(userId, role, startDate, endDate);
  const cods = await getPendingCOD(userId, role);
  const deadlines = getFiscalDeadlines(); // Filtrare per data futura volendo

  // ⚠️ NUOVO: Recupera wallet_balance dell'utente
  let wallet_balance = 0;
  try {
    const { data: userData, error: walletError } = await supabase
      .from('users')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (!walletError && userData) {
      wallet_balance = parseFloat(userData.wallet_balance || '0') || 0;
    }
  } catch (error: any) {
    console.warn('⚠️ [FiscalContext] Errore recupero wallet_balance (non critico):', error.message);
    // Continua anche se il wallet fallisce
  }

  // ✅ NUOVO: Calcola margini SOLO da spedizioni con dati reali
  // NON sommare 0 per spedizioni senza costo
  const shipmentsWithMargin = shipments?.filter((s) => s.margin !== null) || [];
  const shipmentsExcluded = shipments?.filter((s) => s.margin === null) || [];

  const margin_calculable_count = shipmentsWithMargin.length;
  const margin_excluded_count = shipmentsExcluded.length;

  // Margine totale (null se nessuna spedizione calcolabile)
  const total_margin =
    margin_calculable_count > 0
      ? shipmentsWithMargin.reduce((acc, s) => acc + (s.margin ?? 0), 0)
      : null;

  return {
    userId,
    role,
    period: { start: startDate, end: endDate },
    wallet: {
      balance: wallet_balance,
    },
    shipmentsSummary: {
      count: shipments?.length || 0,
      total_margin: total_margin !== null ? Math.round(total_margin * 100) / 100 : null,
      total_revenue: shipments?.reduce((acc, s) => acc + (s.total_price || 0), 0) || 0,
      margin_calculable_count,
      margin_excluded_count,
    },
    pending_cod_count: cods?.length || 0,
    pending_cod_value: cods?.reduce((acc, s) => acc + (Number(s.cash_on_delivery) || 0), 0) || 0,
    deadlines: deadlines
      .filter((d) => d.date >= new Date().toISOString().split('T')[0])
      .slice(0, 3), // Prossime 3 scadenze
  };
}
