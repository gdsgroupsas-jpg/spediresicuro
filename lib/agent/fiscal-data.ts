import { createServerActionClient } from "@/lib/supabase-server";
// import { UserRole } from '@/types/user'; // Removed as it seems missing, using string for now

export interface FiscalContext {
  userId: string;
  role: string;
  shipments?: any[];
  wallet?: any;
  cod?: any[];
  globalStats?: any;
  networkStats?: any;
}

/**
 * Recupera l'elenco degli ID dei sub-utenti per un reseller
 */
async function getSubUserIds(resellerId: string): Promise<string[]> {
  const supabase = createServerActionClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("parent_reseller_id", resellerId);

  return data ? data.map((u) => u.id) : [];
}

/**
 * Esegue query spedizioni filtrata rigorosamente per utente/ruolo
 */
export async function getShipmentsByPeriod(
  userId: string,
  role: string,
  startDate: string, // ISO Date string
  endDate: string // ISO Date string
) {
  const supabase = createServerActionClient();
  let query = supabase
    .from("shipments")
    .select(
      "id, created_at, status, total_price, courier_cost, margin, cash_on_delivery, cod_status, user_id"
    )
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .is("deleted_at", null);

  switch (role) {
    case "superadmin":
      // Superadmin vede tutto, ma potrebbe voler filtrare.
      // Se funzione chiamata genericamente, ritorna tutto.
      // Se volessi filtrare per specifico utente, passerei userId diverso.
      // Qui manteniamo logica: se superadmin chiama per SE STESSO, vede tutto analytics.
      break;

    case "reseller":
      const subUserIds = await getSubUserIds(userId);
      // Filtra per se stesso O i suoi sub-utenti
      query = query.in("user_id", [userId, ...subUserIds]);
      break;

    case "admin":
      // Admin (non super) vede aggregati?
      // Per sicurezza, trattiamolo come User Standard se non specificato diversamente
      // o diamogli accesso simile a Superadmin ma limitato.
      // Da specifica utente: "Admin vede dati aggregati".
      // Per semplificare qui ritorniamo dati raw filtrati, l'aggregazione la fa l'AI o un wrapper.
      // Mettiamo stessa logica User Standard per sicurezza default.
      query = query.eq("user_id", userId);
      break;

    case "user":
    default:
      // USER STANDARD: SOLO I SUOI DATI
      query = query.eq("user_id", userId);
      break;
  }

  const { data, error } = await query;
  if (error) throw new Error(`Errore recupero spedizioni: ${error.message}`);
  return data;
}

/**
 * Recupera scadenze fiscali statiche (calendario) + eventuali dinamiche
 */
export function getFiscalDeadlines() {
  const currentYear = new Date().getFullYear();
  // Calendario statico come da specifica
  return [
    {
      date: `${currentYear}-01-16`,
      description: "F24 IVA mensile / Ritenute",
      type: "F24",
    },
    {
      date: `${currentYear}-02-16`,
      description: "F24 IVA mensile / Ritenute",
      type: "F24",
    },
    {
      date: `${currentYear}-03-16`,
      description: "F24 IVA mensile / Ritenute",
      type: "F24",
    },
    {
      date: `${currentYear}-03-31`,
      description: "LIPE Q4 Anno Prec.",
      type: "LIPE",
    },
    {
      date: `${currentYear}-04-16`,
      description: "F24 IVA mensile / Ritenute",
      type: "F24",
    },
    {
      date: `${currentYear}-04-30`,
      description: "Dichiarazione IVA Annuale",
      type: "Dichiarazione",
    },
    {
      date: `${currentYear}-05-16`,
      description: "F24 IVA mensile / Ritenute",
      type: "F24",
    },
    { date: `${currentYear}-05-31`, description: "LIPE Q1", type: "LIPE" },
    {
      date: `${currentYear}-06-16`,
      description: "F24 IVA mensile / Ritenute",
      type: "F24",
    },
    {
      date: `${currentYear}-06-30`,
      description: "Saldo Imposte / IRES / IRAP",
      type: "Imposte",
    },
    // ... altri mesi ...
    {
      date: `${currentYear}-12-16`,
      description: "Acconto IVA / F24 Mensile",
      type: "F24",
    },
  ];
}

/**
 * Recupera stato COD (Contrassegni) per l'utente, isolato.
 */
export async function getPendingCOD(userId: string, role: string) {
  const supabase = createServerActionClient();
  let query = supabase
    .from("shipments")
    .select("id, created_at, cash_on_delivery, cod_status, user_id")
    .eq("cash_on_delivery", true) // Solo contrassegni
    .neq("cod_status", "paid") // Non ancora pagati al merchant
    .is("deleted_at", null);

  // Applicazione filtri di ruolo (simile a getShipmentsByPeriod)
  if (role === "reseller") {
    const subUserIds = await getSubUserIds(userId);
    query = query.in("user_id", [userId, ...subUserIds]);
  } else if (role !== "superadmin") {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Errore recupero COD: ${error.message}`);
  return data;
}

/**
 * Costruisce il contesto completo per l'AI
 */
export async function getFiscalContext(userId: string, role: string) {
  const today = new Date();
  // Default last 30 days context
  const startDate = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  ).toISOString();
  const endDate = today.toISOString();

  const supabase = createServerActionClient();

  const shipments = await getShipmentsByPeriod(
    userId,
    role,
    startDate,
    endDate
  );
  const cods = await getPendingCOD(userId, role);
  const deadlines = getFiscalDeadlines(); // Filtrare per data futura volendo

  // ⚠️ NUOVO: Recupera wallet_balance dell'utente
  let wallet_balance = 0;
  try {
    const { data: userData, error: walletError } = await supabase
      .from("users")
      .select("wallet_balance")
      .eq("id", userId)
      .single();

    if (!walletError && userData) {
      wallet_balance = parseFloat(userData.wallet_balance || "0") || 0;
    }
  } catch (error: any) {
    console.warn(
      "⚠️ [FiscalContext] Errore recupero wallet_balance (non critico):",
      error.message
    );
    // Continua anche se il wallet fallisce
  }

  // Calcolo margini grezzi al volo per non passare troppi dati all'LLM se non servono
  // ma l'LLM vuole "vedere" i dati per rispondere.
  // Ottimizzazione token: passiamo aggregati se la lista è enorme?
  // Per ora passiamo raw limitati, o aggregati settimanali.

  return {
    userId,
    role,
    period: { start: startDate, end: endDate },
    wallet: {
      balance: wallet_balance,
    },
    shipmentsSummary: {
      count: shipments?.length || 0,
      total_margin:
        shipments?.reduce((acc: number, s: any) => acc + (s.margin || 0), 0) ||
        0,
      total_revenue:
        shipments?.reduce(
          (acc: number, s: any) => acc + (s.total_price || 0),
          0
        ) || 0,
    },
    pending_cod_count: cods?.length || 0,
    pending_cod_value:
      cods?.reduce(
        (acc: number, s: any) => acc + (s.cash_on_delivery || 0),
        0
      ) || 0,
    deadlines: deadlines
      .filter((d) => d.date >= new Date().toISOString().split("T")[0])
      .slice(0, 3), // Prossime 3 scadenze
  };
}
