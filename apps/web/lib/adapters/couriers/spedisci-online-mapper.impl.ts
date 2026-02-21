import { toCarrierCodeFromContract } from '@ss/domain-couriers';

import type { CreateShipmentInput, Shipment } from '@/types/shipments';

import type {
  SpedisciOnlineOpenAPIPayload,
  SpedisciOnlineShipmentPayload,
} from './spedisci-online';

export function findContractCodeImpl(
  adapter: any,
  data: Shipment | CreateShipmentInput | any
): string | undefined {
  // Estrai il corriere dai dati
  const courier = (
    data.corriere ||
    data.courier_id ||
    data.courier?.code ||
    data.courier?.name ||
    ''
  )
    .toLowerCase()
    .trim();

  if (!courier || !adapter.CONTRACT_MAPPING || Object.keys(adapter.CONTRACT_MAPPING).length === 0) {
    console.warn('⚠️ [SPEDISCI.ONLINE] Nessun contratto configurato o corriere mancante');
    return undefined;
  }

  // Normalizza nomi corrieri comuni (generico, non specifico per utente)
  const courierAliases: Record<string, string[]> = {
    poste: ['poste', 'poste italiane', 'posteitaliane'],
    gls: ['gls'],
    brt: ['brt', 'bartolini'],
    sda: ['sda'],
    ups: ['ups'],
    dhl: ['dhl'],
  };

  // Trova il nome base del corriere
  let normalizedCourier = courier;
  for (const [baseName, aliases] of Object.entries(courierAliases)) {
    if (aliases.some((alias) => courier.includes(alias) || alias.includes(courier))) {
      normalizedCourier = baseName;
      break;
    }
  }

  console.log(
    `🔍 [SPEDISCI.ONLINE] Cerca contratto per corriere: "${courier}" (normalizzato: "${normalizedCourier}")`
  );
  console.log(
    `🔍 [SPEDISCI.ONLINE] Mapping disponibile:`,
    Object.keys(adapter.CONTRACT_MAPPING).map((k) => `${k} -> ${adapter.CONTRACT_MAPPING[k]}`)
  );

  // Cerca un contratto che corrisponde al corriere
  // Il mapping è: codice contratto -> nome corriere (es: "postedeliverybusiness-Solution-and-Shipment" -> "PosteDeliveryBusiness")
  // Ogni utente ha i propri contratti personali nel proprio account Spedisci.online

  // STRATEGIA 1: Cerca match esatto nel VALORE (nome corriere nel mapping)
  // Es: "Poste Italiane" -> cerca valore che contiene "poste" o simile
  for (const [contractCode, courierName] of Object.entries(adapter.CONTRACT_MAPPING)) {
    const normalizedCourierName = String(courierName).toLowerCase().trim();

    // Match esatto
    if (normalizedCourierName === courier || normalizedCourierName === normalizedCourier) {
      console.log(
        `✅ Codice contratto trovato (match esatto valore) per ${courier}: ${contractCode}`
      );
      return contractCode;
    }

    // Match intelligente: se il corriere normalizzato è "poste" e il valore contiene "poste"
    // Questo funziona per qualsiasi utente che ha un contratto con "poste" nel nome
    if (normalizedCourier === 'poste' && normalizedCourierName.includes('poste')) {
      console.log(
        `✅ Codice contratto trovato (match Poste generico) per ${courier}: ${contractCode} (valore: ${courierName})`
      );
      return contractCode;
    }

    // Match intelligente generico: se il corriere contiene parte del nome corriere nel mapping
    // Es: "GLS" trova "Gls", "GLS Express", ecc.
    const courierWords = courier.split(/\s+/).filter((w: string) => w.length > 2); // Parole significative
    const courierNameWords = normalizedCourierName.split(/\s+/).filter((w: string) => w.length > 2);

    // Se una parola significativa del corriere è nel nome corriere del mapping
    if (
      courierWords.some((word: string) => normalizedCourierName.includes(word.toLowerCase())) ||
      courierNameWords.some((word: string) => courier.includes(word.toLowerCase()))
    ) {
      console.log(
        `✅ Codice contratto trovato (match parziale parole) per ${courier}: ${contractCode} (valore: ${courierName})`
      );
      return contractCode;
    }
  }

  // STRATEGIA 2: Cerca match esatto nella CHIAVE (codice contratto che contiene il nome corriere)
  for (const [contractCode] of Object.entries(adapter.CONTRACT_MAPPING)) {
    const normalizedContractCode = contractCode.toLowerCase();
    if (
      normalizedContractCode === courier ||
      normalizedContractCode === normalizedCourier ||
      normalizedContractCode.startsWith(courier + '-') ||
      normalizedContractCode.startsWith(normalizedCourier + '-')
    ) {
      console.log(`✅ Codice contratto trovato (match chiave) per ${courier}: ${contractCode}`);
      return contractCode;
    }
  }

  // STRATEGIA 3: Cerca match parziale nel codice contratto (es: "sda" in "sda-XXX-YYY")
  for (const [contractCode] of Object.entries(adapter.CONTRACT_MAPPING)) {
    const normalizedContractCode = contractCode.toLowerCase();
    // Cerca se il codice contratto inizia con il nome del corriere o lo contiene dopo un trattino
    if (
      normalizedContractCode.includes(courier) ||
      normalizedContractCode.includes(normalizedCourier)
    ) {
      if (
        normalizedContractCode.startsWith(courier) ||
        normalizedContractCode.startsWith(normalizedCourier) ||
        normalizedContractCode.includes('-' + courier + '-') ||
        normalizedContractCode.includes('-' + normalizedCourier + '-') ||
        normalizedContractCode.endsWith('-' + courier) ||
        normalizedContractCode.endsWith('-' + normalizedCourier)
      ) {
        console.log(`✅ Codice contratto trovato (parziale) per ${courier}: ${contractCode}`);
        return contractCode;
      }
    }
  }

  // STRATEGIA 4: Cerca match parziale nel nome corriere (generico per tutti gli utenti)
  // Funziona per qualsiasi nome corriere, non hardcoded
  for (const [contractCode, courierName] of Object.entries(adapter.CONTRACT_MAPPING)) {
    const normalizedCourierName = String(courierName).toLowerCase();

    // Match parziale standard: se il nome corriere contiene il corriere o viceversa
    if (
      normalizedCourierName.includes(courier) ||
      courier.includes(normalizedCourierName.split(' ')[0])
    ) {
      console.log(
        `✅ Codice contratto trovato (match parziale nome) per ${courier}: ${contractCode}`
      );
      return contractCode;
    }

    // Match per parole chiave comuni: estrai la prima parola significativa
    const courierFirstWord = courier.split(/\s+/)[0].toLowerCase();
    const courierNameFirstWord = normalizedCourierName.split(/\s+/)[0].toLowerCase();

    if (courierFirstWord.length > 2 && courierNameFirstWord.length > 2) {
      if (
        courierFirstWord === courierNameFirstWord ||
        courierFirstWord.includes(courierNameFirstWord) ||
        courierNameFirstWord.includes(courierFirstWord)
      ) {
        console.log(
          `✅ Codice contratto trovato (match prima parola) per ${courier}: ${contractCode} (valore: ${courierName})`
        );
        return contractCode;
      }
    }
  }

  // STRATEGIA 5: Se c'è un solo contratto disponibile, usalo come fallback
  // (alcuni contratti sono unici e servono per tutti i corrieri)
  const contractKeys = Object.keys(adapter.CONTRACT_MAPPING);
  if (contractKeys.length === 1) {
    const fallbackContract = contractKeys[0];
    console.warn(
      `⚠️ Nessun match specifico trovato per ${courier}, uso contratto unico disponibile: ${fallbackContract}`
    );
    return fallbackContract;
  }

  // Se non trovato, log warning con dettagli
  console.warn(`⚠️ Nessun codice contratto trovato per corriere: ${courier}`);
  console.warn(`⚠️ Mapping disponibile:`, contractKeys);
  return undefined;
}

export function mapToOpenAPIFormatImpl(
  adapter: any,
  data: Shipment | CreateShipmentInput | any,
  contractCode?: string
): SpedisciOnlineOpenAPIPayload {
  if (!contractCode) {
    throw new Error(
      'Spedisci.Online: Codice contratto mancante. Configura i contratti nel wizard.'
    );
  }

  // Estrai carrierCode dal contractCode (prima parte prima del primo '-')
  const carrierCode = toCarrierCodeFromContract(contractCode);

  // Estrai dati mittente
  const senderName =
    'sender_name' in data
      ? data.sender_name
      : data.mittente?.nome || data.sender?.nome || 'Mittente';
  const senderAddress =
    'sender_address' in data
      ? data.sender_address
      : data.mittente?.indirizzo || data.sender?.indirizzo || '';
  const senderCity =
    'sender_city' in data ? data.sender_city : data.mittente?.citta || data.sender?.citta || '';
  const senderZip =
    'sender_zip' in data ? data.sender_zip : data.mittente?.cap || data.sender?.cap || '';
  const senderProvince =
    'sender_province' in data
      ? data.sender_province
      : data.mittente?.provincia || data.sender?.provincia || '';
  const senderPhone =
    'sender_phone' in data
      ? data.sender_phone
      : data.mittente?.telefono || data.sender?.telefono || '';
  const senderEmail =
    'sender_email' in data ? data.sender_email : data.mittente?.email || data.sender?.email || '';

  // Estrai dati destinatario
  const recipientName =
    'recipient_name' in data
      ? data.recipient_name
      : data.destinatario?.nome || data.recipient?.nome || '';
  const recipientAddress =
    'recipient_address' in data
      ? data.recipient_address
      : data.destinatario?.indirizzo || data.recipient?.indirizzo || '';
  const recipientCity =
    'recipient_city' in data
      ? data.recipient_city
      : data.destinatario?.citta || data.recipient?.citta || '';
  const recipientZip =
    'recipient_zip' in data
      ? data.recipient_zip
      : data.destinatario?.cap || data.recipient?.cap || '';
  const recipientProvince =
    'recipient_province' in data
      ? data.recipient_province
      : data.destinatario?.provincia || data.recipient?.provincia || '';
  const recipientPhone =
    'recipient_phone' in data
      ? data.recipient_phone
      : data.destinatario?.telefono || data.recipient?.telefono || '';
  const recipientEmail =
    'recipient_email' in data
      ? data.recipient_email
      : data.destinatario?.email || data.recipient?.email || '';

  // Estrai dimensioni e peso
  const weight = 'weight' in data ? Number(data.weight) || 1 : Number(data.peso) || 1;
  const length =
    'length' in data ? Number(data.length) || 10 : Number(data.dimensioni?.lunghezza) || 10;
  const width =
    'width' in data ? Number(data.width) || 10 : Number(data.dimensioni?.larghezza) || 10;
  const height =
    'height' in data ? Number(data.height) || 10 : Number(data.dimensioni?.altezza) || 10;

  // Determina COD e Insurance
  let codAmount = 0;
  if ('codValue' in data && data.codValue != null) {
    codAmount = Number(data.codValue) || 0;
  } else if ('contrassegnoAmount' in data && data.contrassegnoAmount != null) {
    codAmount = parseFloat(String(data.contrassegnoAmount)) || 0;
  } else if ('cash_on_delivery_amount' in data && data.cash_on_delivery_amount != null) {
    codAmount = Number(data.cash_on_delivery_amount) || 0;
  } else if ('contrassegno' in data && typeof data.contrassegno === 'number') {
    codAmount = Number(data.contrassegno) || 0;
  }

  const insuranceValue =
    'declared_value' in data && data.declared_value
      ? Number(data.declared_value)
      : 'assicurazione' in data && data.assicurazione && typeof data.assicurazione === 'number'
        ? Number(data.assicurazione)
        : 'insurance' in data && data.insurance && typeof data.insurance === 'number'
          ? Number(data.insurance)
          : 0;

  const notes = 'notes' in data ? data.notes || 'N/A' : data.note || 'N/A';

  return {
    carrierCode: carrierCode,
    contractCode: contractCode,
    packages: [
      {
        length: length,
        width: width,
        height: height,
        weight: weight,
      },
    ],
    shipFrom: {
      name: senderName || 'Mittente',
      street1: senderAddress || 'N/A',
      city: senderCity || 'N/A',
      state: senderProvince ? senderProvince.toUpperCase().slice(0, 2) : 'RM',
      postalCode: senderZip || '00000',
      country: 'IT',
      email: senderEmail || undefined,
      phone: senderPhone || undefined,
    },
    shipTo: {
      name: recipientName || 'Destinatario',
      street1: recipientAddress || 'N/A',
      city: recipientCity || 'N/A',
      state: recipientProvince ? recipientProvince.toUpperCase().slice(0, 2) : 'RM',
      postalCode: recipientZip || '00000',
      country: 'IT',
      email: recipientEmail || undefined,
      phone: recipientPhone || undefined,
    },
    notes: notes,
    insuranceValue: insuranceValue,
    codValue: codAmount,
    // ✨ FIX: Servizi accessori per /shipping/create
    // 🎯 SCOPERTA: I servizi accessori usano ID NUMERICI, non nomi stringa!
    // Dal pannello Spedisci.Online: Exchange=200001, Document Return=200002, etc.
    accessoriServices: (() => {
      // Mappatura nome servizio → ID numerico (dal pannello Spedisci.Online)
      const SERVICE_NAME_TO_ID: Record<string, number> = {
        Exchange: 200001,
        exchange: 200001,
        EXCHANGE: 200001,
        'Document Return': 200002,
        'document return': 200002,
        'DOCUMENT RETURN': 200002,
        'Saturday Service': 200003,
        'saturday service': 200003,
        'SATURDAY SERVICE': 200003,
        Express12: 200004,
        express12: 200004,
        EXPRESS12: 200004,
        'Preavviso Telefonico': 200005,
        'preavviso telefonico': 200005,
        'PREAVVISO TELEFONICO': 200005,
      };

      const services = Array.isArray(data.serviziAccessori)
        ? data.serviziAccessori
        : Array.isArray(data.accessoriServices)
          ? data.accessoriServices
          : [];

      if (services.length === 0) {
        return []; // Nessun servizio richiesto
      }

      // ✨ CONVERSIONE: Nome servizio → ID numerico
      const serviceIds = services
        .map((s: any) => {
          // Se già un numero, usalo direttamente
          if (typeof s === 'number') {
            return s;
          }
          // Se stringa numerica, converti
          if (typeof s === 'string' && /^\d+$/.test(s)) {
            return parseInt(s, 10);
          }
          // Se oggetto con id numerico, estrai
          if (s && typeof s === 'object') {
            if (typeof s.id === 'number') return s.id;
            if (typeof s.value === 'number') return s.value;
            if (typeof s.service_id === 'number') return s.service_id;
            if (typeof s.vector_service_id === 'number') return s.vector_service_id;
            // Se ha un nome, convertilo
            const name = s.name || s.service || s.value || s.code || String(s);
            if (typeof name === 'string' && SERVICE_NAME_TO_ID[name]) {
              return SERVICE_NAME_TO_ID[name];
            }
          }
          // Se è una stringa con nome, convertila
          if (typeof s === 'string') {
            return SERVICE_NAME_TO_ID[s] || null;
          }
          return null;
        })
        .filter((id: any): id is number => id !== null && typeof id === 'number');

      if (serviceIds.length === 0) {
        console.warn(
          '⚠️ [SPEDISCI.ONLINE] Nessun servizio accessorio valido trovato dopo conversione:',
          { original: services }
        );
        return [];
      }

      console.log('📋 [SPEDISCI.ONLINE] Servizi accessori convertiti (nome → ID numerico):', {
        original: services,
        converted: serviceIds,
        format_type: 'number[]',
      });

      // ✨ FORMATO CORRETTO: Array di numeri [200001, 200002, ...]
      return serviceIds;
    })(),
    label_format: 'PDF',
  };
}

export function mapToSpedisciOnlineFormatImpl(
  adapter: any,
  data: Shipment | CreateShipmentInput | any,
  contractCode?: string
): SpedisciOnlineShipmentPayload {
  // Normalizza dati da diverse fonti
  const recipientName =
    'recipient_name' in data
      ? data.recipient_name
      : data.destinatario?.nome || data.recipient?.nome || '';

  const recipientAddress =
    'recipient_address' in data
      ? data.recipient_address
      : data.destinatario?.indirizzo || data.recipient?.indirizzo || '';

  const recipientCity =
    'recipient_city' in data
      ? data.recipient_city
      : data.destinatario?.citta || data.recipient?.citta || '';

  const recipientZip =
    'recipient_zip' in data
      ? data.recipient_zip
      : data.destinatario?.cap || data.recipient?.cap || '';

  const recipientProvince =
    'recipient_province' in data
      ? data.recipient_province
      : data.destinatario?.provincia || data.recipient?.provincia || '';

  const weight = 'weight' in data ? data.weight : data.peso || 0;

  // Determina importo COD leggendo in ordine: codValue -> contrassegnoAmount -> cash_on_delivery_amount -> contrassegno (se numero)
  let codAmount = 0;
  if ('codValue' in data && data.codValue != null) {
    codAmount = Number(data.codValue) || 0;
  } else if ('contrassegnoAmount' in data && data.contrassegnoAmount != null) {
    codAmount = parseFloat(String(data.contrassegnoAmount)) || 0;
  } else if ('cash_on_delivery_amount' in data && data.cash_on_delivery_amount != null) {
    codAmount = Number(data.cash_on_delivery_amount) || 0;
  } else if ('contrassegno' in data && typeof data.contrassegno === 'number') {
    codAmount = Number(data.contrassegno) || 0;
  } else if ('cash_on_delivery' in data && data.cash_on_delivery === true) {
    // Se cash_on_delivery è true ma non c'è importo, usa 0
    codAmount = 0;
  }

  // cashOnDelivery è true se l'importo COD > 0
  const cashOnDelivery = codAmount > 0;

  // codValue: REQUIRED, sempre presente (0 se non attivo, importo se attivo)
  const codValue = cashOnDelivery ? Number(codAmount) : 0;

  // insuranceValue: REQUIRED, sempre presente (0 se non presente)
  const insuranceValue =
    'declared_value' in data && data.declared_value
      ? Number(data.declared_value)
      : 'assicurazione' in data && data.assicurazione && typeof data.assicurazione === 'number'
        ? Number(data.assicurazione)
        : 'insurance' in data && data.insurance && typeof data.insurance === 'number'
          ? Number(data.insurance)
          : 0;

  const notes = 'notes' in data ? data.notes : data.note || '';
  const recipientPhone =
    'recipient_phone' in data
      ? data.recipient_phone
      : data.destinatario?.telefono || data.recipient?.telefono || '';
  const recipientEmail =
    'recipient_email' in data
      ? data.recipient_email
      : data.destinatario?.email || data.recipient?.email || '';
  const senderName =
    'sender_name' in data ? data.sender_name : data.mittente?.nome || data.sender?.nome || '';
  const tracking = 'tracking_number' in data ? data.tracking_number : data.tracking || '';
  const finalPrice = 'final_price' in data ? data.final_price : data.prezzoFinale || 0;

  // Helper per formattare valori (virgola -> punto per decimali)
  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return String(value).replace(',', '.');
    if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
      return value.replace(',', '.');
    }
    return String(value);
  };

  return {
    destinatario: recipientName,
    indirizzo: recipientAddress,
    cap: recipientZip,
    localita: recipientCity,
    provincia: recipientProvince.toUpperCase().slice(0, 2),
    country: 'IT',
    peso: formatValue(weight),
    colli: '1', // Default 1 collo
    codValue: codValue, // REQUIRED: number, sempre presente (0 se non attivo)
    insuranceValue: insuranceValue, // REQUIRED: number, sempre presente (0 se non presente)
    // ✨ FIX: Leggi servizi accessori da data (serviziAccessori o accessoriServices)
    accessoriServices: Array.isArray(data.serviziAccessori)
      ? data.serviziAccessori
      : Array.isArray(data.accessoriServices)
        ? data.accessoriServices
        : [], // REQUIRED: array, sempre presente (vuoto se non ci sono servizi aggiuntivi)
    rif_mittente: senderName,
    rif_destinatario: recipientName,
    note: notes,
    telefono: recipientPhone,
    email_destinatario: recipientEmail,
    contenuto: '',
    order_id: tracking,
    totale_ordine: formatValue(finalPrice),
    codice_contratto: contractCode, // Codice contratto completo (es: "gls-NN6-STANDARD-(TR-VE)")
    label_format: 'PDF', // Optional: formato etichetta per /shipping/create
  };
}

export function generateCSVImpl(adapter: any, payload: SpedisciOnlineShipmentPayload): string {
  const header =
    'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';

  // Helper per escape CSV
  const escapeCSV = (value: string | undefined): string => {
    if (!value) return '';
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Mappa codValue a contrassegno per formato CSV legacy
  const contrassegnoValue = payload.codValue > 0 ? String(payload.codValue) : '0';

  const row =
    [
      escapeCSV(payload.destinatario),
      escapeCSV(payload.indirizzo),
      payload.cap,
      escapeCSV(payload.localita),
      payload.provincia,
      payload.country,
      payload.peso,
      payload.colli,
      contrassegnoValue,
      escapeCSV(payload.rif_mittente || ''),
      escapeCSV(payload.rif_destinatario || ''),
      escapeCSV(payload.note || ''),
      payload.telefono || '',
      payload.email_destinatario || '',
      escapeCSV(payload.contenuto || ''),
      escapeCSV(payload.order_id || ''),
      payload.totale_ordine || '',
    ].join(';') + ';';

  return header + '\n' + row;
}

export function extractTrackingNumberImpl(adapter: any, data: any): string | null {
  return data.tracking_number || data.tracking || null;
}

export function generateTrackingNumberImpl(adapter: any): string {
  return `SPED${Date.now().toString().slice(-8)}${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;
}
