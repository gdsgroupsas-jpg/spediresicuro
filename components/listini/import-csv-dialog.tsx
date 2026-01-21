/**
 * Dialog per import CSV/Excel entries listino
 *
 * ✨ FASE 2: Permette import di entries da file CSV/Excel
 * Supporta preview e mapping colonne → campi DB
 *
 * ✨ FASE 3: Conversione automatica formati:
 * - Auto-detect separatore (virgola, punto e virgola, tab)
 * - Rilevamento formato matrice vs formato long
 * - Conversione automatica matrice → long
 */

'use client';

import { createPriceListEntryAction } from '@/actions/price-list-entries';
import { upsertSupplierPriceListConfig } from '@/actions/supplier-price-list-config';
import { getPriceListByIdAction } from '@/actions/price-lists';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, FileText, Loader2, Upload, X, RefreshCw, Info } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListId: string;
  onSuccess: () => void;
}

interface ParsedEntry {
  zone_code?: string;
  weight_from?: number;
  weight_to?: number;
  base_price?: number;
  service_type?: string;
  fuel_surcharge_percent?: number;
  cash_on_delivery_surcharge?: number;
  insurance_rate_percent?: number;
  island_surcharge?: number;
  ztl_surcharge?: number;
  estimated_delivery_days_min?: number;
  estimated_delivery_days_max?: number;
  _rowIndex: number; // Per tracking errori
  _errors?: string[]; // Errori validazione
}

// ✨ Tipo per il formato rilevato
type CsvFormat = 'long' | 'matrix' | 'multi-section';

// ✨ Info sul formato rilevato
interface FormatInfo {
  format: CsvFormat;
  separator: string;
  separatorName: string;
  zoneColumns?: string[]; // Colonne zona nel formato matrice
  weightColumn?: string; // Colonna peso nel formato matrice
  fuelColumn?: string; // Colonna fuel nel formato matrice
  sectionColumn?: string; // Colonna sezione nel formato multi-section
  keyColumn?: string; // Colonna chiave nel formato multi-section
}

// ✨ Zone note per rilevamento automatico
const KNOWN_ZONE_PATTERNS = [
  'italia',
  'sardegna',
  'sicilia',
  'isole_minori',
  'isole',
  'livigno',
  'campione',
  'europa1',
  'europa2',
  'europa3',
  'europa',
  'mondo',
  'extra_ue',
  'ue',
  'zone_a',
  'zone_b',
  'zone_c',
  'zone_d',
  'zone_e',
  'zone_f',
  'zona_1',
  'zona_2',
  'zona_3',
  'zona_4',
  'zona_5',
  'nord',
  'centro',
  'sud',
  'isole_maggiori',
];

// ✨ Pattern per colonna peso
const WEIGHT_COLUMN_PATTERNS = [
  'peso',
  'peso_fino_a',
  'peso_fino_a_kg',
  'weight',
  'weight_to',
  'kg',
  'fino_a_kg',
];

// ✨ Pattern per colonna fuel
const FUEL_COLUMN_PATTERNS = [
  'fuel',
  'fuel_pct',
  'fuel_percent',
  'fuel_surcharge',
  'carburante',
  'supplemento_carburante',
];

// ✨ Auto-detect separatore CSV
function detectSeparator(firstLine: string): { separator: string; name: string } {
  // Conta occorrenze di ogni separatore
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  // Usa il separatore più frequente
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    return { separator: ';', name: 'punto e virgola (;)' };
  }
  if (tabCount > commaCount && tabCount > semicolonCount) {
    return { separator: '\t', name: 'tab' };
  }
  return { separator: ',', name: 'virgola (,)' };
}

// ✨ Rileva se una colonna è una zona
function isZoneColumn(header: string): boolean {
  const headerLower = header.toLowerCase().replace(/[_\-\s]+/g, '_');

  // Pattern esatti per zone note
  for (const pattern of KNOWN_ZONE_PATTERNS) {
    if (headerLower.includes(pattern)) {
      return true;
    }
  }

  // Pattern con suffisso prezzo (_eur, _price, _costo)
  if (headerLower.match(/_eur$|_price$|_costo$|_prezzo$/)) {
    return true;
  }

  return false;
}

// ✨ Estrai nome zona pulito dalla colonna
function extractZoneName(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-\s]+/g, '_')
    .replace(/_eur$|_price$|_costo$|_prezzo$/, '')
    .replace(/^zona_|^zone_/, '');
}

// ✨ Converti nome zona in codice zona standard
function normalizeZoneCodeFromName(zoneName: string): string {
  const normalized = zoneName.toLowerCase().replace(/[_\-\s]+/g, '_');

  const nameMap: Record<string, string> = {
    italia: 'IT-ITALIA',
    sardegna: 'IT-SARDEGNA',
    calabria: 'IT-CALABRIA',
    sicilia: 'IT-SICILIA',
    livigno: 'IT-LIVIGNO',
    campione: 'IT-LIVIGNO',
    livigno_campione: 'IT-LIVIGNO',
    isole_minori: 'IT-ISOLE-MINORI',
    isole: 'IT-ISOLE-MINORI',
    localita_disagiate: 'IT-DISAGIATE',
    disagiate: 'IT-DISAGIATE',
    europa1: 'EU-ZONA1',
    europa_1: 'EU-ZONA1',
    europa_zona_1: 'EU-ZONA1',
    europa2: 'EU-ZONA2',
    europa_2: 'EU-ZONA2',
    europa_zona_2: 'EU-ZONA2',
  };

  return nameMap[normalized] || zoneName.toUpperCase();
}

// ✨ Rileva se una colonna è la colonna peso
function isWeightColumn(header: string): boolean {
  const headerLower = header.toLowerCase().replace(/[_\-\s]+/g, '_');
  return WEIGHT_COLUMN_PATTERNS.some((pattern) => headerLower.includes(pattern));
}

// ✨ Rileva se una colonna è la colonna fuel
function isFuelColumn(header: string): boolean {
  const headerLower = header.toLowerCase().replace(/[_\-\s]+/g, '_');
  return FUEL_COLUMN_PATTERNS.some((pattern) => headerLower.includes(pattern));
}

// ✨ Rileva formato CSV (matrice vs long vs multi-section)
function detectFormat(
  headers: string[]
): FormatInfo & { separator: string; separatorName: string } {
  const headersLower = headers.map((h) => h.toLowerCase());

  // ✨ NUOVO: Rileva formato multi-section (ha colonna "sezione" e "chiave")
  const hasSectionColumn = headersLower.some((h) => h === 'sezione' || h === 'section');
  const hasKeyColumn = headersLower.some((h) => h === 'chiave' || h === 'key');

  if (hasSectionColumn && hasKeyColumn) {
    const sectionColumn =
      headers.find((h) => h.toLowerCase() === 'sezione' || h.toLowerCase() === 'section') ||
      'sezione';
    const keyColumn =
      headers.find((h) => h.toLowerCase() === 'chiave' || h.toLowerCase() === 'key') || 'chiave';

    // Cerca colonne zona per PESI_ZONE
    const zoneColumns = headers.filter((h) => isZoneColumn(h));
    const fuelColumn = headers.find((h) => isFuelColumn(h));

    return {
      format: 'multi-section',
      separator: ';',
      separatorName: 'punto e virgola',
      sectionColumn,
      keyColumn,
      zoneColumns,
      fuelColumn,
    };
  }

  // Cerca colonne tipiche del formato long
  const hasZoneCode = headersLower.some(
    (h) => h.includes('zone_code') || h === 'zona' || h === 'zone'
  );
  const hasWeightFrom = headersLower.some(
    (h) => h.includes('weight_from') || h.includes('peso_da')
  );
  const hasWeightTo = headersLower.some(
    (h) => h.includes('weight_to') || h.includes('peso_a') || h.includes('peso_fino')
  );
  const hasBasePrice = headersLower.some((h) => h.includes('base_price') || h.includes('prezzo'));

  // Se ha le colonne tipiche del formato long, è formato long
  if (hasZoneCode && (hasWeightFrom || hasWeightTo) && hasBasePrice) {
    return { format: 'long', separator: ',', separatorName: 'virgola' };
  }

  // Cerca colonne zona (formato matrice)
  const zoneColumns = headers.filter((h) => isZoneColumn(h));
  const weightColumn = headers.find((h) => isWeightColumn(h));
  const fuelColumn = headers.find((h) => isFuelColumn(h));

  // Se ha almeno 2 colonne zona e una colonna peso, è formato matrice
  if (zoneColumns.length >= 2 && weightColumn) {
    return {
      format: 'matrix',
      separator: ',',
      separatorName: 'virgola',
      zoneColumns,
      weightColumn,
      fuelColumn,
    };
  }

  // Default: formato long
  return { format: 'long', separator: ',', separatorName: 'virgola' };
}

// ✨ Converti formato matrice in formato long
function convertMatrixToLong(
  lines: string[],
  headers: string[],
  formatInfo: FormatInfo,
  separator: string
): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const zoneColumns = formatInfo.zoneColumns || [];
  const weightColumn = formatInfo.weightColumn || '';
  const fuelColumn = formatInfo.fuelColumn;

  // Trova indici colonne
  const weightIndex = headers.findIndex((h) => h === weightColumn);
  const fuelIndex = fuelColumn ? headers.findIndex((h) => h === fuelColumn) : -1;
  const zoneIndices = zoneColumns.map((col) => ({
    name: extractZoneName(col),
    index: headers.indexOf(col),
  }));

  // Parse ogni riga (peso) e crea entries per ogni zona
  let previousWeight = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));

    // Estrai peso
    const weightValue = values[weightIndex];
    let weightTo = 0;
    let isOpenRange = false;

    // Gestione peso speciale (oltre_ogni_50kg, >100, etc.)
    if (weightValue.toLowerCase().includes('oltre') || weightValue.startsWith('>')) {
      const numMatch = weightValue.match(/\d+/);
      weightTo = numMatch ? parseFloat(numMatch[0]) + 9999 : 999999;
      isOpenRange = true;
    } else {
      weightTo = parseFloat(weightValue.replace(',', '.')) || 0;
    }

    const weightFrom = previousWeight;
    if (!isOpenRange) {
      previousWeight = weightTo;
    }

    // Estrai fuel se presente
    const fuelPercent =
      fuelIndex >= 0 ? parseFloat(values[fuelIndex]?.replace(',', '.') || '0') || 0 : 0;

    // Crea entry per ogni zona
    for (const zone of zoneIndices) {
      const priceValue = values[zone.index];
      const basePrice = parseFloat(priceValue?.replace(',', '.') || '0') || 0;

      // Salta zone con prezzo 0 o vuoto (es. europa1, europa2 nel tuo CSV)
      if (basePrice === 0) continue;

      const entry: ParsedEntry = {
        _rowIndex: i + 1,
        zone_code: normalizeZoneCodeFromName(zone.name),
        weight_from: weightFrom,
        weight_to: weightTo,
        base_price: basePrice,
        fuel_surcharge_percent: fuelPercent,
        service_type: 'standard',
      };

      entries.push(entry);
    }
  }

  return entries;
}

// ✨ Converti formato multi-section (PESI_ZONE + configurazioni)
interface ParsedMultiSectionResult {
  entries: ParsedEntry[];
  config?: {
    insurance_config?: any;
    cod_config?: any[];
    accessory_services_config?: any[];
    storage_config?: any;
  };
}

function parseMultiSectionFormat(
  lines: string[],
  headers: string[],
  formatInfo: FormatInfo,
  separator: string
): ParsedMultiSectionResult {
  const entries: ParsedEntry[] = [];
  const config: ParsedMultiSectionResult['config'] = {};

  const sectionIndex = headers.findIndex((h) => h === formatInfo.sectionColumn);
  const keyIndex = headers.findIndex((h) => h === formatInfo.keyColumn);
  const zoneColumns = formatInfo.zoneColumns || [];
  const fuelIndex = formatInfo.fuelColumn
    ? headers.findIndex((h) => h === formatInfo.fuelColumn)
    : -1;

  // Trova indici colonne configurazione
  const prezzoFissoIndex = headers.findIndex(
    (h) => h.toLowerCase() === 'prezzo_fisso_eur' || h.toLowerCase() === 'prezzo_fisso'
  );
  const percentualeIndex = headers.findIndex(
    (h) => h.toLowerCase() === 'percentuale' || h.toLowerCase() === 'percent'
  );
  const calcoloSuIndex = headers.findIndex(
    (h) => h.toLowerCase() === 'calcolo_su' || h.toLowerCase() === 'calcolo'
  );

  // Raggruppa righe per sezione
  const sections: Record<string, string[]> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
    const section = values[sectionIndex]?.toUpperCase() || '';

    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(line);
  }

  // Parse PESI_ZONE come matrice
  if (sections['PESI_ZONE']) {
    // Per PESI_ZONE, la colonna "chiave" contiene il peso
    let previousWeight = 0;

    sections['PESI_ZONE'].forEach((line, idx) => {
      const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
      const weightValue = values[keyIndex];

      let weightTo = 0;
      let isOpenRange = false;

      // Gestione peso speciale (oltre_ogni_100kg, >100, etc.)
      if (weightValue.toLowerCase().includes('oltre') || weightValue.startsWith('>')) {
        const numMatch = weightValue.match(/\d+/);
        weightTo = numMatch ? parseFloat(numMatch[0]) + 9999 : 999999;
        isOpenRange = true;
      } else {
        weightTo = parseFloat(weightValue.replace(',', '.')) || 0;
      }

      const weightFrom = previousWeight;
      if (!isOpenRange) {
        previousWeight = weightTo;
      }

      // Estrai fuel se presente
      const fuelPercent =
        fuelIndex >= 0 ? parseFloat(values[fuelIndex]?.replace(',', '.') || '0') || 0 : 0;

      // Crea entry per ogni zona
      for (const zoneCol of zoneColumns) {
        const zoneIndex = headers.indexOf(zoneCol);
        if (zoneIndex < 0) continue;

        const priceValue = values[zoneIndex];
        const basePrice = parseFloat(priceValue?.replace(',', '.') || '0') || 0;

        // Salta zone con prezzo 0 o vuoto
        if (basePrice === 0) continue;

        const entry: ParsedEntry = {
          _rowIndex: idx + 2, // +2 perché header è riga 1 e questo è idx+1
          zone_code: normalizeZoneCodeFromName(extractZoneName(zoneCol)),
          weight_from: weightFrom,
          weight_to: weightTo,
          base_price: basePrice,
          fuel_surcharge_percent: fuelPercent,
          service_type: 'standard',
        };

        entries.push(entry);
      }
    });
  }

  // Parse ASSICURAZIONE
  if (sections['ASSICURAZIONE'] && sections['ASSICURAZIONE'].length > 0) {
    const assicurazioneLine = sections['ASSICURAZIONE'][0];
    const values = assicurazioneLine.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));

    config.insurance_config = {
      max_value: 0, // Non presente nel CSV, default
      fixed_price:
        prezzoFissoIndex >= 0
          ? parseFloat(values[prezzoFissoIndex]?.replace(',', '.') || '0') || 0
          : 0,
      percent:
        percentualeIndex >= 0
          ? parseFloat(values[percentualeIndex]?.replace(',', '.') || '0') || 0
          : 0,
      percent_on:
        calcoloSuIndex >= 0
          ? values[calcoloSuIndex]?.toLowerCase() === 'totale'
            ? 'totale'
            : 'base'
          : 'totale',
    };
  }

  // Parse CONTRASSEGNO (array)
  if (sections['CONTRASSEGNO']) {
    config.cod_config = sections['CONTRASSEGNO'].map((line) => {
      const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
      const maxValue = parseFloat(values[keyIndex]?.replace(',', '.') || '0') || 0;

      return {
        max_value: maxValue,
        fixed_price:
          prezzoFissoIndex >= 0
            ? parseFloat(values[prezzoFissoIndex]?.replace(',', '.') || '0') || 0
            : 0,
        percent:
          percentualeIndex >= 0
            ? parseFloat(values[percentualeIndex]?.replace(',', '.') || '0') || 0
            : 0,
        percent_on:
          calcoloSuIndex >= 0
            ? values[calcoloSuIndex]?.toLowerCase() === 'totale'
              ? 'totale'
              : 'base'
            : 'totale',
      };
    });
  }

  // Parse SERVIZIO_ACCESSORIO (array)
  if (sections['SERVIZIO_ACCESSORIO']) {
    config.accessory_services_config = sections['SERVIZIO_ACCESSORIO'].map((line) => {
      const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
      const serviceName = values[keyIndex] || '';

      return {
        service: serviceName,
        price:
          prezzoFissoIndex >= 0
            ? parseFloat(values[prezzoFissoIndex]?.replace(',', '.') || '0') || 0
            : 0,
        percent:
          percentualeIndex >= 0
            ? parseFloat(values[percentualeIndex]?.replace(',', '.') || '0') || 0
            : 0,
      };
    });
  }

  // Parse GIACENZA (array + dossier_opening_cost)
  if (sections['GIACENZA']) {
    const storageServices: any[] = [];
    let dossierOpeningCost = 0;

    sections['GIACENZA'].forEach((line) => {
      const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
      const serviceName = values[keyIndex] || '';

      if (serviceName.toLowerCase().includes('apertura dossier')) {
        dossierOpeningCost =
          prezzoFissoIndex >= 0
            ? parseFloat(values[prezzoFissoIndex]?.replace(',', '.') || '0') || 0
            : 0;
      } else {
        storageServices.push({
          service: serviceName,
          price:
            prezzoFissoIndex >= 0
              ? parseFloat(values[prezzoFissoIndex]?.replace(',', '.') || '0') || 0
              : 0,
          percent:
            percentualeIndex >= 0
              ? parseFloat(values[percentualeIndex]?.replace(',', '.') || '0') || 0
              : 0,
        });
      }
    });

    config.storage_config = {
      services: storageServices,
      dossier_opening_cost: dossierOpeningCost,
    };
  }

  return { entries, config: Object.keys(config).length > 0 ? config : undefined };
}

export function ImportCsvDialog({
  open,
  onOpenChange,
  priceListId,
  onSuccess,
}: ImportCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [parsedConfig, setParsedConfig] = useState<ParsedMultiSectionResult['config'] | undefined>(
    undefined
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<FormatInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campi disponibili per mapping
  const availableFields = [
    { key: 'zone_code', label: 'Zona (zone_code)', required: true },
    { key: 'weight_from', label: 'Peso da (weight_from)', required: true },
    { key: 'weight_to', label: 'Peso a (weight_to)', required: true },
    { key: 'base_price', label: 'Prezzo base (base_price)', required: true },
    {
      key: 'service_type',
      label: 'Tipo servizio (service_type)',
      required: false,
    },
    {
      key: 'fuel_surcharge_percent',
      label: 'Supplemento carburante %',
      required: false,
    },
    {
      key: 'cash_on_delivery_surcharge',
      label: 'Supplemento contrassegno €',
      required: false,
    },
    {
      key: 'insurance_rate_percent',
      label: 'Tasso assicurazione %',
      required: false,
    },
    { key: 'island_surcharge', label: 'Supplemento isole €', required: false },
    { key: 'ztl_surcharge', label: 'Supplemento ZTL €', required: false },
    {
      key: 'estimated_delivery_days_min',
      label: 'Giorni consegna (min)',
      required: false,
    },
    {
      key: 'estimated_delivery_days_max',
      label: 'Giorni consegna (max)',
      required: false,
    },
  ];

  // Reset form
  const resetForm = () => {
    setFile(null);
    setParsedEntries([]);
    setParsedConfig(undefined);
    setColumnMapping({});
    setCsvHeaders([]);
    setDetectedFormat(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ✨ Parse CSV file con auto-detect formato e conversione automatica
  const parseCsvFile = async (file: File) => {
    setIsParsing(true);
    try {
      const text = await file.text();

      // Normalizza line endings
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalizedText.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error('File CSV deve avere almeno header + 1 riga dati');
        setIsParsing(false);
        return;
      }

      // ✨ STEP 1: Auto-detect separatore
      const { separator, name: separatorName } = detectSeparator(lines[0]);

      // Parse header con separatore rilevato
      const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      // ✨ STEP 2: Rileva formato (matrice vs long)
      const formatInfo = detectFormat(headers);
      formatInfo.separator = separator;
      formatInfo.separatorName = separatorName;
      setDetectedFormat(formatInfo);

      let entries: ParsedEntry[] = [];
      let config: ParsedMultiSectionResult['config'] | undefined = undefined;

      // ✨ STEP 3: Parse in base al formato rilevato
      if (formatInfo.format === 'multi-section') {
        // Formato multi-section: parse entries + configurazioni
        toast.info(
          `Rilevato formato MULTI-SECTION con separatore ${separatorName}. Parsing in corso...`
        );

        const result = parseMultiSectionFormat(lines, headers, formatInfo, separator);
        entries = result.entries;
        config = result.config;

        // Le entries da matrice sono già validate, aggiungi solo validazione base
        entries = entries.map((entry) => {
          const errors: string[] = [];
          if (!entry.zone_code) errors.push('Zona mancante');
          if (entry.base_price === undefined || entry.base_price <= 0) {
            errors.push('Prezzo non valido');
          }
          if (errors.length > 0) {
            return { ...entry, _errors: errors };
          }
          return entry;
        });

        const configParts: string[] = [];
        if (config?.insurance_config) configParts.push('Assicurazione');
        if (config?.cod_config && config.cod_config.length > 0) configParts.push('Contrassegni');
        if (config?.accessory_services_config && config.accessory_services_config.length > 0)
          configParts.push('Servizi Accessori');
        if (config?.storage_config) configParts.push('Giacenze');

        toast.success(
          `Parsate ${entries.length} entries da PESI_ZONE${configParts.length > 0 ? ` e ${configParts.length} configurazioni (${configParts.join(', ')})` : ''}`
        );
      } else if (formatInfo.format === 'matrix') {
        // Formato matrice: converti automaticamente
        toast.info(
          `Rilevato formato MATRICE con separatore ${separatorName}. Conversione automatica in corso...`
        );

        entries = convertMatrixToLong(lines, headers, formatInfo, separator);

        // Le entries da matrice sono già validate, aggiungi solo validazione base
        entries = entries.map((entry) => {
          const errors: string[] = [];
          if (!entry.zone_code) errors.push('Zona mancante');
          if (entry.base_price === undefined || entry.base_price <= 0) {
            errors.push('Prezzo non valido');
          }
          if (errors.length > 0) {
            return { ...entry, _errors: errors };
          }
          return entry;
        });

        toast.success(
          `Convertite ${entries.length} entries da formato matrice (${formatInfo.zoneColumns?.length || 0} zone × ${lines.length - 1} pesi)`
        );
      } else {
        // Formato long: parsing normale
        toast.info(`Rilevato formato LONG con separatore ${separatorName}`);

        // Auto-detect column mapping (case-insensitive)
        const autoMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const headerLower = header.toLowerCase();
          for (const field of availableFields) {
            if (
              headerLower.includes(field.key.toLowerCase()) ||
              headerLower === field.label.toLowerCase() ||
              headerLower === field.key
            ) {
              autoMapping[header] = field.key;
              break;
            }
          }
        });
        setColumnMapping(autoMapping);

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));

          const entry: ParsedEntry = { _rowIndex: i + 1 };
          const errors: string[] = [];

          // Map values to fields
          headers.forEach((header, index) => {
            const fieldKey = autoMapping[header];
            if (fieldKey && values[index]) {
              const value = values[index].trim();

              // Parse based on field type
              if (
                fieldKey.includes('weight') ||
                fieldKey.includes('price') ||
                fieldKey.includes('surcharge') ||
                fieldKey.includes('rate') ||
                fieldKey.includes('days')
              ) {
                // Supporta sia punto che virgola come decimale
                const numValue = parseFloat(value.replace(',', '.'));
                if (isNaN(numValue)) {
                  errors.push(`${fieldKey}: valore non numerico "${value}"`);
                } else {
                  (entry as any)[fieldKey] = numValue;
                }
              } else {
                (entry as any)[fieldKey] = value;
              }
            }
          });

          // Validate required fields
          for (const field of availableFields) {
            if (field.required && !entry[field.key as keyof ParsedEntry]) {
              errors.push(`Campo obbligatorio mancante: ${field.label}`);
            }
          }

          if (errors.length > 0) {
            entry._errors = errors;
          }

          entries.push(entry);
        }
      }

      setParsedEntries(entries);
      setParsedConfig(config);

      const validCount = entries.filter((e) => !e._errors || e._errors.length === 0).length;
      const errorCount = entries.length - validCount;

      if (errorCount > 0) {
        toast.warning(
          `File parsato: ${validCount} righe valide, ${errorCount} con errori. Controlla la preview.`
        );
      } else if (formatInfo.format !== 'matrix') {
        // Solo per formato long (matrice già notificato sopra)
        toast.success(`${entries.length} righe parsate correttamente`);
      }
    } catch (error: any) {
      console.error('Errore parsing CSV:', error);
      toast.error(`Errore parsing file: ${error.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Solo file CSV sono supportati');
      return;
    }

    setFile(selectedFile);
    parseCsvFile(selectedFile);
  };

  // Update column mapping
  const updateColumnMapping = (csvColumn: string, fieldKey: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [csvColumn]: fieldKey,
    }));

    // Re-parse entries with new mapping
    if (file) {
      parseCsvFile(file);
    }
  };

  // Import entries
  const handleImport = async () => {
    const validEntries = parsedEntries.filter((e) => !e._errors || e._errors.length === 0);

    if (validEntries.length === 0 && !parsedConfig) {
      toast.error('Nessuna entry valida da importare');
      return;
    }

    setIsImporting(true);
    try {
      // Import entries se presenti
      if (validEntries.length > 0) {
        const results = await Promise.all(
          validEntries.map((entry) =>
            createPriceListEntryAction(priceListId, {
              zone_code: entry.zone_code || '',
              weight_from: entry.weight_from || 0,
              weight_to: entry.weight_to || 0,
              base_price: entry.base_price || 0,
              service_type: (entry.service_type as any) || 'standard',
              fuel_surcharge_percent: entry.fuel_surcharge_percent || 0,
              cash_on_delivery_surcharge: entry.cash_on_delivery_surcharge || 0,
              insurance_rate_percent: entry.insurance_rate_percent || 0,
              island_surcharge: entry.island_surcharge || 0,
              ztl_surcharge: entry.ztl_surcharge || 0,
              estimated_delivery_days_min: entry.estimated_delivery_days_min,
              estimated_delivery_days_max: entry.estimated_delivery_days_max,
            })
          )
        );

        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          toast.error(
            `${failed.length} entry non importate: ${failed[0].error || 'Errore sconosciuto'}`
          );
          setIsImporting(false);
          return;
        }
      }

      // Import configurazioni se presenti
      if (parsedConfig) {
        // Recupera priceList per ottenere carrier_code e contract_code
        const priceListResult = await getPriceListByIdAction(priceListId);
        if (!priceListResult.success || !priceListResult.priceList) {
          toast.error('Errore recupero listino per configurazioni');
          setIsImporting(false);
          return;
        }

        const priceList = priceListResult.priceList;
        const metadata = (priceList.metadata as any) || {};

        const configResult = await upsertSupplierPriceListConfig({
          price_list_id: priceListId,
          carrier_code: metadata.carrierCode || priceList.courier?.code || '',
          contract_code: metadata.contractCode || undefined,
          courier_config_id: metadata.configId || undefined,
          insurance_config: parsedConfig.insurance_config,
          cod_config: parsedConfig.cod_config,
          accessory_services_config: parsedConfig.accessory_services_config,
          storage_config: parsedConfig.storage_config,
        });

        if (!configResult.success) {
          toast.error(`Errore import configurazioni: ${configResult.error}`);
          setIsImporting(false);
          return;
        }
      }

      const successMessages: string[] = [];
      if (validEntries.length > 0) {
        successMessages.push(`${validEntries.length} entry importate`);
      }
      if (parsedConfig) {
        successMessages.push('configurazioni importate');
      }
      toast.success(successMessages.join(' e ') + ' con successo');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Errore import entries:', error);
      toast.error('Errore imprevisto durante import. Riprova più tardi.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa Entries da CSV</DialogTitle>
          <DialogDescription>
            Carica un file CSV con le entries del listino. Supporta:
            <br />• <strong>Formato matrice</strong>: peso nelle righe, zone nelle colonne
            (auto-convertito)
            <br />• <strong>Formato long</strong>: una riga per ogni combinazione peso/zona
            <br />• <strong>Formato multi-sezione</strong>: PESI_ZONE + ASSICURAZIONE + CONTRASSEGNO
            + SERVIZIO_ACCESSORIO + GIACENZA
            <br />• Separatori: virgola (,), punto e virgola (;), tab
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          <div>
            <Label htmlFor="csv-file">File CSV</Label>
            <div className="mt-2 flex items-center gap-4">
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || isImporting}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {file ? file.name : 'Seleziona file CSV'}
              </Button>
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  disabled={isParsing || isImporting}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              {isParsing && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing file...
                </div>
              )}
            </div>
          </div>

          {/* ✨ Info formato rilevato */}
          {detectedFormat && (
            <div
              className={`p-4 rounded-lg border ${
                detectedFormat.format === 'matrix'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <Info
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    detectedFormat.format === 'matrix' ? 'text-blue-600' : 'text-gray-600'
                  }`}
                />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">
                    Formato rilevato: {detectedFormat.format === 'matrix' ? 'MATRICE' : 'LONG'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Separatore: <strong>{detectedFormat.separatorName}</strong>
                  </p>
                  {detectedFormat.format === 'matrix' && (
                    <div className="text-sm text-gray-600">
                      <p className="mb-1">
                        <strong>Colonna peso:</strong> {detectedFormat.weightColumn}
                      </p>
                      <p className="mb-1">
                        <strong>Zone rilevate ({detectedFormat.zoneColumns?.length || 0}):</strong>{' '}
                        {detectedFormat.zoneColumns?.map((z) => extractZoneName(z)).join(', ')}
                      </p>
                      {detectedFormat.fuelColumn && (
                        <p>
                          <strong>Colonna fuel:</strong> {detectedFormat.fuelColumn}
                        </p>
                      )}
                      <p className="mt-2 text-blue-700 font-medium">
                        ✅ Conversione automatica completata!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Column Mapping (solo per formato long) */}
          {csvHeaders.length > 0 && detectedFormat?.format === 'long' && (
            <div>
              <Label>Mapping Colonne CSV → Campi DB</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                {csvHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-4 py-2">
                    <span className="w-48 text-sm font-medium">{header}</span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={columnMapping[header] || ''}
                      onChange={(e) => updateColumnMapping(header, e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 p-2 text-sm"
                    >
                      <option value="">-- Non mappare --</option>
                      {availableFields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label} {field.required && '*'}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Entries */}
          {parsedEntries.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Preview Entries ({parsedEntries.length} righe)</Label>
                <span className="text-sm text-gray-500">
                  {parsedEntries.filter((e) => !e._errors || e._errors.length === 0).length} valide,{' '}
                  {parsedEntries.filter((e) => e._errors && e._errors.length > 0).length} con errori
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Riga</th>
                      <th className="px-3 py-2 text-left">Zona</th>
                      <th className="px-3 py-2 text-left">Peso da</th>
                      <th className="px-3 py-2 text-left">Peso a</th>
                      <th className="px-3 py-2 text-left">Prezzo</th>
                      <th className="px-3 py-2 text-left">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedEntries.slice(0, 20).map((entry, idx) => (
                      <tr
                        key={idx}
                        className={`border-t ${
                          entry._errors && entry._errors.length > 0 ? 'bg-red-50' : 'bg-white'
                        }`}
                      >
                        <td className="px-3 py-2">{entry._rowIndex}</td>
                        <td className="px-3 py-2">{entry.zone_code || '-'}</td>
                        <td className="px-3 py-2">{entry.weight_from || '-'}</td>
                        <td className="px-3 py-2">{entry.weight_to || '-'}</td>
                        <td className="px-3 py-2">{entry.base_price || '-'}</td>
                        <td className="px-3 py-2">
                          {entry._errors && entry._errors.length > 0 ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs">{entry._errors.length} errore/i</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <Check className="w-4 h-4" />
                              <span className="text-xs">OK</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedEntries.length > 20 && (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center border-t">
                    ... e altre {parsedEntries.length - 20} righe
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isImporting}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={
                isImporting ||
                parsedEntries.length === 0 ||
                parsedEntries.filter((e) => !e._errors || e._errors.length === 0).length === 0
              }
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importazione...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Importa {
                    parsedEntries.filter((e) => !e._errors || e._errors.length === 0).length
                  }{' '}
                  Entries
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
