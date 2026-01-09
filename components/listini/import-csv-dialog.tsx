/**
 * Dialog per import CSV/Excel entries listino
 *
 * ✨ FASE 2: Permette import di entries da file CSV/Excel
 * Supporta preview e mapping colonne → campi DB
 */

"use client";

import { createPriceListEntryAction } from "@/actions/price-list-entries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

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

export function ImportCsvDialog({
  open,
  onOpenChange,
  priceListId,
  onSuccess,
}: ImportCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    {}
  );
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campi disponibili per mapping
  const availableFields = [
    { key: "zone_code", label: "Zona (zone_code)", required: true },
    { key: "weight_from", label: "Peso da (weight_from)", required: true },
    { key: "weight_to", label: "Peso a (weight_to)", required: true },
    { key: "base_price", label: "Prezzo base (base_price)", required: true },
    {
      key: "service_type",
      label: "Tipo servizio (service_type)",
      required: false,
    },
    {
      key: "fuel_surcharge_percent",
      label: "Supplemento carburante %",
      required: false,
    },
    {
      key: "cash_on_delivery_surcharge",
      label: "Supplemento contrassegno €",
      required: false,
    },
    {
      key: "insurance_rate_percent",
      label: "Tasso assicurazione %",
      required: false,
    },
    { key: "island_surcharge", label: "Supplemento isole €", required: false },
    { key: "ztl_surcharge", label: "Supplemento ZTL €", required: false },
    {
      key: "estimated_delivery_days_min",
      label: "Giorni consegna (min)",
      required: false,
    },
    {
      key: "estimated_delivery_days_max",
      label: "Giorni consegna (max)",
      required: false,
    },
  ];

  // Reset form
  const resetForm = () => {
    setFile(null);
    setParsedEntries([]);
    setColumnMapping({});
    setCsvHeaders([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Parse CSV file
  const parseCsvFile = async (file: File) => {
    setIsParsing(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("File CSV deve avere almeno header + 1 riga dati");
        setIsParsing(false);
        return;
      }

      // Parse header
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/^"|"$/g, ""));
      setCsvHeaders(headers);

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
      const entries: ParsedEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]
          .split(",")
          .map((v) => v.trim().replace(/^"|"$/g, ""));

        const entry: ParsedEntry = { _rowIndex: i + 1 };
        const errors: string[] = [];

        // Map values to fields
        headers.forEach((header, index) => {
          const fieldKey = autoMapping[header];
          if (fieldKey && values[index]) {
            const value = values[index].trim();

            // Parse based on field type
            if (
              fieldKey.includes("weight") ||
              fieldKey.includes("price") ||
              fieldKey.includes("surcharge") ||
              fieldKey.includes("rate") ||
              fieldKey.includes("days")
            ) {
              const numValue = parseFloat(value);
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

      setParsedEntries(entries);

      const validCount = entries.filter(
        (e) => !e._errors || e._errors.length === 0
      ).length;
      const errorCount = entries.length - validCount;

      if (errorCount > 0) {
        toast.warning(
          `File parsato: ${validCount} righe valide, ${errorCount} con errori. Controlla la preview.`
        );
      } else {
        toast.success(`${entries.length} righe parsate correttamente`);
      }
    } catch (error: any) {
      console.error("Errore parsing CSV:", error);
      toast.error(`Errore parsing file: ${error.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Solo file CSV sono supportati");
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
    const validEntries = parsedEntries.filter(
      (e) => !e._errors || e._errors.length === 0
    );

    if (validEntries.length === 0) {
      toast.error("Nessuna entry valida da importare");
      return;
    }

    setIsImporting(true);
    try {
      const results = await Promise.all(
        validEntries.map((entry) =>
          createPriceListEntryAction(priceListId, {
            zone_code: entry.zone_code || "",
            weight_from: entry.weight_from || 0,
            weight_to: entry.weight_to || 0,
            base_price: entry.base_price || 0,
            service_type: (entry.service_type as any) || "standard",
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
          `${failed.length} entry non importate: ${
            failed[0].error || "Errore sconosciuto"
          }`
        );
        setIsImporting(false);
        return;
      }

      toast.success(`${validEntries.length} entry importate con successo`);
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Errore import entries:", error);
      toast.error("Errore imprevisto durante import. Riprova più tardi.");
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
            Carica un file CSV con le entries del listino. Il file deve avere
            header nella prima riga.
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
                {file ? file.name : "Seleziona file CSV"}
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

          {/* Column Mapping (solo se file caricato) */}
          {csvHeaders.length > 0 && (
            <div>
              <Label>Mapping Colonne CSV → Campi DB</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                {csvHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-4 py-2">
                    <span className="w-48 text-sm font-medium">{header}</span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={columnMapping[header] || ""}
                      onChange={(e) =>
                        updateColumnMapping(header, e.target.value)
                      }
                      className="flex-1 rounded-md border border-gray-300 p-2 text-sm"
                    >
                      <option value="">-- Non mappare --</option>
                      {availableFields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label} {field.required && "*"}
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
                  {
                    parsedEntries.filter(
                      (e) => !e._errors || e._errors.length === 0
                    ).length
                  }{" "}
                  valide,{" "}
                  {
                    parsedEntries.filter(
                      (e) => e._errors && e._errors.length > 0
                    ).length
                  }{" "}
                  con errori
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
                          entry._errors && entry._errors.length > 0
                            ? "bg-red-50"
                            : "bg-white"
                        }`}
                      >
                        <td className="px-3 py-2">{entry._rowIndex}</td>
                        <td className="px-3 py-2">{entry.zone_code || "-"}</td>
                        <td className="px-3 py-2">
                          {entry.weight_from || "-"}
                        </td>
                        <td className="px-3 py-2">{entry.weight_to || "-"}</td>
                        <td className="px-3 py-2">{entry.base_price || "-"}</td>
                        <td className="px-3 py-2">
                          {entry._errors && entry._errors.length > 0 ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs">
                                {entry._errors.length} errore/i
                              </span>
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
                parsedEntries.filter(
                  (e) => !e._errors || e._errors.length === 0
                ).length === 0
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
                  Importa{" "}
                  {
                    parsedEntries.filter(
                      (e) => !e._errors || e._errors.length === 0
                    ).length
                  }{" "}
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
