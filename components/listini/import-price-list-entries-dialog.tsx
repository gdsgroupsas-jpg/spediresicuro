/**
 * Dialog: Import CSV Entries per Listini Personalizzati
 * 
 * Permette al reseller di importare entries da file CSV
 * per completare manualmente un listino personalizzato.
 */

"use client";

import { useState, useRef } from "react";
import { FileSpreadsheet, Upload, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ImportPriceListEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListId: string;
  priceListName: string;
  onSuccess: () => void;
}

export function ImportPriceListEntriesDialog({
  open,
  onOpenChange,
  priceListId,
  priceListName,
  onSuccess,
}: ImportPriceListEntriesDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<any>>([]);
  const [data, setData] = useState<Array<any>>([]); // ✨ FIX: Salva tutti i dati, non solo preview
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setData([]); // ✨ FIX: Reset anche data
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Seleziona un file CSV");
      return;
    }

    setError("");
    setIsParsing(true);

    try {
      const text = await selectedFile.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        setError("Il file deve avere almeno una riga di dati oltre all'intestazione");
        setIsParsing(false);
        return;
      }

      // Parse CSV
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const data: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        const row: any = {};

        headers.forEach((header, index) => {
          const value = values[index]?.trim();
          if (header && value) {
            // Mappa colonne
            if (header.includes("weight") || header.includes("peso")) {
              row.weight_from = parseFloat(value) || 0;
              row.weight_to = parseFloat(value) || 0;
            } else if (header.includes("zone") || header.includes("zona")) {
              row.zone_code = value;
            } else if (header.includes("zip") || header.includes("cap")) {
              row.zip_code_from = value;
              row.zip_code_to = value;
            } else if (
              header.includes("province") ||
              header.includes("provincia")
            ) {
              row.province_code = value;
            } else if (header.includes("region") || header.includes("regione")) {
              row.region = value;
            } else if (
              header.includes("price") ||
              header.includes("prezzo") ||
              header.includes("base")
            ) {
              row.base_price = parseFloat(value) || 0;
            } else if (
              header.includes("fuel") ||
              header.includes("carburante")
            ) {
              row.fuel_surcharge_percent = parseFloat(value) || 0;
            } else if (
              header.includes("island") ||
              header.includes("isole")
            ) {
              row.island_surcharge = parseFloat(value) || 0;
            } else if (header.includes("ztl")) {
              row.ztl_surcharge = parseFloat(value) || 0;
            } else if (
              header.includes("cod") ||
              header.includes("contrassegno")
            ) {
              row.cash_on_delivery_surcharge = parseFloat(value) || 0;
            } else if (
              header.includes("insurance") ||
              header.includes("assicurazione")
            ) {
              row.insurance_rate_percent = parseFloat(value) || 0;
            } else if (
              header.includes("service") ||
              header.includes("servizio")
            ) {
              row.service_type = value;
            }
          }
        });

        // Valida riga
        if (row.weight_from !== undefined && row.base_price !== undefined) {
          data.push(row);
        }
      }

      if (data.length === 0) {
        setError("Nessuna riga valida trovata nel file");
        setIsParsing(false);
        return;
      }

      setFile(selectedFile);
      setData(data); // ✨ FIX: Salva TUTTI i dati nello state
      setPreview(data.slice(0, 5)); // Mostra prime 5 righe per preview
      setIsParsing(false);
      toast.success(`Trovate ${data.length} righe nel file`);
    } catch (err) {
      console.error("Errore parsing CSV:", err);
      setError("Errore nella lettura del file CSV");
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!file || data.length === 0) {
      toast.error("Seleziona un file valido");
      return;
    }

    setIsLoading(true);

    try {
      const { importPriceListEntriesAction } = await import(
        "@/actions/reseller-price-lists"
      );

      // ✨ FIX: Usa TUTTI i dati, non solo preview (prime 5 righe)
      const result = await importPriceListEntriesAction(priceListId, data);

      if (!result.success) {
        toast.error(result.error || "Errore durante l'importazione");
        setIsLoading(false);
        return;
      }

      if ((result.inserted || 0) > 0 || (result.updated || 0) > 0) {
        toast.success(
          `Importazione completata: ${result.inserted || 0} nuove, ${result.updated || 0} aggiornate`
        );
        reset();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.warning("Nessuna riga importata o aggiornata");
      }
    } catch (error: any) {
      console.error("Errore importazione:", error);
      toast.error(error.message || "Errore durante l'importazione");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = () => {
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-600" />
            Import CSV Entries
          </DialogTitle>
          <DialogDescription>
            Importa righe di tariffe da file CSV per il listino:{" "}
            <strong>{priceListName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Istruzioni */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-medium text-blue-900 mb-2">
              Istruzioni per il file CSV:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Il file deve avere un'intestazione nella prima riga</li>
              <li>Colonne supportate (case-insensitive):</li>
              <li className="ml-4">
                <strong>Obbligatorie:</strong> weight/peso, price/prezzo/base
              </li>
              <li className="ml-4">
                <strong>Opzionali:</strong> zone/zona, zip/cap, province,
                region, service, fuel/carburante, island/isole, ztl, cod,
                insurance/assicurazione
              </li>
              <li>
                Esempio: weight,zone,price,fuel,island,ztl,cod,insurance
              </li>
            </ul>
          </div>

          {/* File upload */}
          <div>
            <Label htmlFor="csv-file">File CSV *</Label>
            <div className="mt-2">
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isLoading || isParsing}
                className="hidden"
              />
              {!file ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isParsing}
                  className="w-full h-32 border-2 border-dashed"
                >
                  <div className="flex flex-col items-center gap-2">
                    {isParsing ? (
                      <>
                        <Upload className="w-8 h-8 text-orange-600 animate-bounce" />
                        <span className="text-sm text-gray-500">
                          Parsing del file...
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          Clicca per selezionare il file CSV
                        </span>
                        <span className="text-xs text-gray-400">
                          o trascina qui il file
                        </span>
                      </>
                    )}
                  </div>
                </Button>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">{file.name}</p>
                        <p className="text-sm text-green-700">
                          {data.length} righe trovate (mostrate prime {preview.length} in anteprima)
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <Label>Anteprima (prime 5 righe)</Label>
              <div className="mt-2 overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Peso Da
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Peso A
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Zona
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Prezzo Base
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Carburante
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                        Isole
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">
                          {row.weight_from}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {row.weight_to}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {row.zone_code || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          €{(row.base_price || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {row.fuel_surcharge_percent
                            ? `${row.fuel_surcharge_percent}%`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {row.island_surcharge
                            ? `+€${row.island_surcharge.toFixed(2)}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Nota: L'importazione utilizzerà tutte le righe trovate nel file,
                non solo queste 5.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={isLoading}
          >
            Annulla
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || !file || data.length === 0}
          >
            {isLoading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Importazione...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importa CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
