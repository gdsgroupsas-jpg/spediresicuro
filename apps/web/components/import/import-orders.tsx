/**
 * Componente Import Ordini da CSV/XLS
 *
 * Permette di importare ordini da file CSV o XLS/XLSX
 * e convertirli automaticamente in spedizioni
 *
 * Layout ispirato a spedisci.online con:
 * - Layout a 2 colonne (upload a sinistra, istruzioni a destra)
 * - Istruzioni dettagliate con esempi scaricabili
 * - Checkbox per salvare destinatari in rubrica
 * - Preview dati strutturata
 */

'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Info,
} from 'lucide-react';
import { parseCSV, parseXLS, normalizeImportedOrder, ImportedOrder } from '@/lib/utils/file-parser';

interface ImportOrdersProps {
  onImportComplete?: (importedCount: number, errors: string[]) => void;
  onCancel?: () => void;
}

export default function ImportOrders({ onImportComplete, onCancel }: ImportOrdersProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedOrders, setImportedOrders] = useState<ImportedOrder[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [saveToAddressBook, setSaveToAddressBook] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFileName(files[0].name);
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrors([]);
    setImportedOrders([]);
    setPreviewData([]);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (!fileExtension || !['csv', 'xls', 'xlsx'].includes(fileExtension)) {
        throw new Error('Formato file non supportato. Usa CSV, XLS o XLSX');
      }

      let orders: ImportedOrder[] = [];

      if (fileExtension === 'csv') {
        // Parsa CSV
        const text = await file.text();
        orders = await parseCSV(text);
      } else {
        // Parsa XLS/XLSX
        orders = await parseXLS(file);
      }

      if (orders.length === 0) {
        throw new Error('Nessun ordine trovato nel file');
      }

      // Normalizza e valida ordini
      const normalizedOrders = orders
        .map((order, index) => {
          try {
            return normalizeImportedOrder(order);
          } catch (error) {
            setErrors((prev) => [
              ...prev,
              `Riga ${index + 2}: ${error instanceof Error ? error.message : 'Errore di normalizzazione'}`,
            ]);
            return null;
          }
        })
        .filter(Boolean) as any[];

      // Filtra ordini validi (devono avere almeno nome destinatario)
      const validOrders = normalizedOrders.filter((order) => {
        const nomeDestinatario = order.destinatario?.nome || order.destinatarioNome;
        if (!nomeDestinatario || nomeDestinatario.trim() === '') {
          setErrors((prev) => [...prev, `Ordine senza nome destinatario ignorato`]);
          return false;
        }
        return true;
      });

      setImportedOrders(validOrders);

      // Prepara preview (prime 5 righe) - normalizzaImportedOrder restituisce oggetti annidati
      setPreviewData(
        validOrders.slice(0, 5).map((order) => ({
          nome: order.destinatario?.nome || '',
          indirizzo: order.destinatario?.indirizzo || '',
          citta: order.destinatario?.citta || '',
          cap: order.destinatario?.cap || '',
          peso: order.peso || 0,
          tracking: order.tracking || order.ldv || 'N/A',
        }))
      );
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Errore durante il parsing del file']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (importedOrders.length === 0) {
      return;
    }

    setIsProcessing(true);
    const importErrors: string[] = [];

    try {
      // Importa ogni ordine come spedizione
      for (let i = 0; i < importedOrders.length; i++) {
        const order = importedOrders[i];

        try {
          // normalizeImportedOrder restituisce oggetti annidati {destinatario: {...}, mittente: {...}}
          // ma l'API import si aspetta campi flat (destinatarioNome, destinatarioIndirizzo, ecc.)
          // Quindi dobbiamo flattare la struttura prima di inviarla

          const flatOrder = {
            // Destinatario (da oggetto annidato a campi flat)
            destinatarioNome: order.destinatario?.nome || '',
            destinatarioIndirizzo: order.destinatario?.indirizzo || '',
            destinatarioCitta: order.destinatario?.citta || '',
            destinatarioProvincia: order.destinatario?.provincia || '',
            destinatarioCap: order.destinatario?.cap || '',
            destinatarioTelefono: order.destinatario?.telefono || '',
            destinatarioEmail: order.destinatario?.email || '',

            // Mittente (da oggetto annidato a campi flat)
            mittenteNome: order.mittente?.nome || '',
            mittenteIndirizzo: order.mittente?.indirizzo || '',
            mittenteCitta: order.mittente?.citta || '',
            mittenteProvincia: order.mittente?.provincia || '',
            mittenteCap: order.mittente?.cap || '',
            mittenteTelefono: order.mittente?.telefono || '',
            mittenteEmail: order.mittente?.email || '',

            // Dettagli spedizione
            peso: order.peso || 0,
            colli: order.colli || 1,
            contrassegno: order.contrassegno || 0,
            assicurazione: order.assicurazione || 0,
            note: order.note || '',
            contenuto: order.contenuto || '',

            // ⚠️ CRITICO: Tracking/LDV - PRIORITÀ: ldv > tracking
            ldv: order.ldv || '',
            tracking: order.tracking || order.ldv || '',
            order_id: order.order_id || '',

            // Riferimenti
            rif_mittente: order.rif_mittente || order.mittente?.nome || '',
            rif_destinatario: order.rif_destinatario || order.destinatario?.nome || '',

            // Metadata
            importSource: 'file_csv_xls',
            importPlatform: 'File Import',
            saveToAddressBook,
          };

          // ⚠️ DEBUG: Log per verificare cosa viene inviato
          console.log('📦 Ordine da importare (flat):', {
            ldv: flatOrder.ldv,
            tracking: flatOrder.tracking,
            order_id: flatOrder.order_id,
            destinatarioNome: flatOrder.destinatarioNome,
          });

          const response = await fetch('/api/spedizioni/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flatOrder),
          });

          if (!response.ok) {
            const errorData = await response.json();
            importErrors.push(
              `Ordine ${i + 1} (${flatOrder.destinatarioNome}): ${errorData.message || "Errore durante l'importazione"}`
            );
          }
        } catch (error) {
          const nomeDestinatario = order.destinatario?.nome || 'N/A';
          importErrors.push(
            `Ordine ${i + 1} (${nomeDestinatario}): ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
          );
        }
      }

      const successCount = importedOrders.length - importErrors.length;

      if (onImportComplete) {
        onImportComplete(successCount, importErrors);
      }

      // Reset
      setImportedOrders([]);
      setPreviewData([]);
      setErrors([]);
      setSelectedFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // ⚠️ IMPORTANTE: Ricarica la pagina per vedere le spedizioni importate
      // In alternativa, potresti aggiornare lo stato senza ricaricare
      if (successCount > 0) {
        // Forza ricaricamento della lista spedizioni
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Errore durante l'importazione"]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Genera file CSV di esempio
  const downloadExampleFile = (type: 'simple' | 'complete') => {
    let csvContent = '';

    if (type === 'simple') {
      // Esempio semplificato
      csvContent = `destinatario,indirizzo,localita,cap,provincia
Mario Rossi,"Via Roma, n 20",Grosseto,58100,GR
Luigi Verdi,"Corso Italia 15",Milano,20100,MI`;
    } else {
      // Esempio completo
      csvContent = `destinatario,indirizzo,localita,cap,provincia,peso,colli,contrassegno,rif_mittente,rif_destinatario,note,telefono,email_destinatario,order_id,totale_ordine
Mario Rossi,"Via Roma, n 20",Grosseto,58100,GR,1,1,25.5,MITTENTE,Mario Rossi,FRAGILE,3276621781,mario.rossi@gmail.com,21545-45454-5454,25.5
Luigi Verdi,"Corso Italia 15",Milano,20100,MI,2,1,0,MITTENTE,Luigi Verdi,,3291234567,luigi.verdi@email.com,21546-45455-5455,0`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      type === 'simple' ? 'esempio_semplificato.csv' : 'esempio_completo.csv'
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header con bordo inferiore */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Importa Ordini da File</h3>
            <p className="text-sm text-gray-600 mt-1">
              Genera nuove spedizioni importandole da file CSV o Excel
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Chiudi"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Layout a 2 colonne come spedisci.online */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
          {/* COLONNA SINISTRA: Upload File */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="bg-[#FF9500] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                  1
                </span>
                Seleziona file
              </h4>

              {/* Area Upload */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                  isDragging
                    ? 'border-[#FF9500] bg-[#FFD700]/10'
                    : 'border-gray-300 hover:border-[#FF9500] hover:bg-gray-50'
                }`}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 text-[#FF9500] animate-spin" />
                    <p className="text-gray-600 font-medium">Elaborazione file in corso...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gradient-to-br from-[#FFD700]/20 to-[#FF9500]/20 rounded-full">
                        <Upload className="w-8 h-8 text-[#FF9500]" />
                      </div>
                      <div className="w-full">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.xls,.xlsx"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg cursor-pointer hover:shadow-lg transition-all transform hover:scale-105"
                        >
                          <FileText className="w-5 h-5" />
                          Scegli file
                        </label>
                        {selectedFileName && (
                          <p className="mt-2 text-sm text-gray-600">{selectedFileName}</p>
                        )}
                        {!selectedFileName && (
                          <p className="mt-2 text-sm text-gray-500">Nessun file selezionato</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          CSV
                        </div>
                        <div className="flex items-center gap-1">
                          <FileSpreadsheet className="w-4 h-4" />
                          XLS/XLSX
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Checkbox salva in rubrica */}
              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={saveToAddressBook}
                    onChange={(e) => setSaveToAddressBook(e.target.checked)}
                    className="w-4 h-4 text-[#FF9500] border-gray-300 rounded focus:ring-[#FF9500] focus:ring-2"
                  />
                  <span>Salva destinatari in rubrica</span>
                </label>
              </div>

              {/* Pulsante Carica File */}
              {selectedFileName && !isProcessing && (
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Carica file
                </button>
              )}
            </div>
          </div>

          {/* COLONNA DESTRA: Istruzioni e Esempi */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-[#FF9500]" />
                Istruzioni e Formato
              </h4>

              <div className="bg-gray-50 rounded-lg p-5 space-y-4 text-sm text-gray-700 border border-gray-200">
                <p className="leading-relaxed">
                  Permette di generare nuove lettere di vettura importandole da qualsiasi file CSV o
                  Excel.
                </p>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    📋 Colonne obbligatorie (prima riga):
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                    <li>
                      <strong>destinatario</strong> (o nome, nominativo, recipient_name)
                    </li>
                    <li>
                      <strong>indirizzo</strong> (o address, recipient_address)
                    </li>
                    <li>
                      <strong>localita</strong> (o citta, city, recipient_city)
                    </li>
                    <li>
                      <strong>cap</strong> (o zip, recipient_zip)
                    </li>
                    <li>
                      <strong>provincia</strong> (o province, recipient_province)
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">📦 Colonne opzionali:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                    <li>
                      <strong>peso</strong>, <strong>colli</strong>, <strong>contrassegno</strong>
                    </li>
                    <li>
                      <strong>rif_mittente</strong> (o rif_mitt), <strong>rif_destinatario</strong>{' '}
                      (o rif_dest)
                    </li>
                    <li>
                      <strong>note</strong>, <strong>telefono</strong>,{' '}
                      <strong>email_destinatario</strong> (o email_dest)
                    </li>
                    <li>
                      <strong>order_id</strong>, <strong>totale_ordine</strong> (o costo)
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">
                    ✅ <strong>Compatibile con:</strong> spedisci.online, Amazon, eBay, marketplace
                    vari
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-300 space-y-2">
                  <p className="font-semibold text-gray-900 text-xs">📥 Scarica file di esempio:</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => downloadExampleFile('simple')}
                      className="text-left px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium text-[#FF9500] flex items-center gap-2"
                    >
                      <Download className="w-3 h-3" />
                      Esempio semplificato
                    </button>
                    <button
                      onClick={() => downloadExampleFile('complete')}
                      className="text-left px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium text-[#FF9500] flex items-center gap-2"
                    >
                      <Download className="w-3 h-3" />
                      Esempio completo
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    💡 <strong>Suggerimento:</strong> Se importi da marketplace come eBay, Amazon,
                    ecc., assicurati che la prima riga contenga i nomi delle colonne obbligatorie.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Dati - Solo se ci sono ordini */}
        {previewData.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FF9500]" />
                Anteprima ({previewData.length} di {importedOrders.length} ordini)
              </h4>
              <span className="text-xs text-gray-500">Verifica i dati prima di importare</span>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Indirizzo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Città
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CAP
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Peso
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking/LDV
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((order, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {order.nome}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.indirizzo}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.citta}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.cap}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.peso} kg</td>
                        <td className="px-4 py-3 text-sm font-mono text-blue-600">
                          {order.tracking}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {importedOrders.length > 5 && (
              <p className="mt-2 text-xs text-gray-500 text-center">
                ... e altri {importedOrders.length - 5} ordini
              </p>
            )}
          </div>
        )}

        {/* Errori */}
        {errors.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-900 mb-2">Errori rilevati:</h4>
                <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Pulsanti Azione */}
        {importedOrders.length > 0 && (
          <div className="mt-6 flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setImportedOrders([]);
                setPreviewData([]);
                setErrors([]);
                setSelectedFileName('');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importazione...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Importa {importedOrders.length} Ordini
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
