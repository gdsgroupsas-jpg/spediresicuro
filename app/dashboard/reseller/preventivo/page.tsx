/**
 * Dashboard Reseller: Preventivatore Semplice
 *
 * Preventivatore con chiamata API reale che:
 * - Per Reseller: confronta API Reseller vs API Master e seleziona il migliore
 * - Per BYOC/Reseller senza listino: usa configurazioni API master del superadmin
 * - Mostra output basato sulla matrice del listino impostato
 */

"use client";

import {
  calculateQuoteAction,
  getAvailableCouriersForUserAction,
} from "@/actions/price-lists";
import DashboardNav from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PRICING_MATRIX } from "@/lib/constants/pricing-matrix";
import type { CourierServiceType } from "@/types/shipments";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  Package,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Formatta valuta
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

interface QuoteResult {
  success: boolean;
  result?: {
    basePrice: number;
    surcharges: number;
    margin: number;
    totalCost: number;
    finalPrice: number;
    priceListId: string;
    calculationDetails: {
      weight: number;
      destination: {
        zip?: string;
        province?: string;
        country?: string;
      };
      courierId?: string;
      serviceType?: CourierServiceType;
      options?: {
        declaredValue?: number;
        cashOnDelivery?: boolean;
        insurance?: boolean;
      };
    };
  };
  resellerComparison?: {
    apiSource: "reseller" | "master" | "default";
    resellerPrice?: {
      finalPrice: number;
      basePrice: number;
    };
    masterPrice?: {
      finalPrice: number;
      basePrice: number;
    };
    priceDifference?: number;
  };
  error?: string;
}

export default function PreventivoPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [availableCouriers, setAvailableCouriers] = useState<
    Array<{ courierId: string; courierName: string }>
  >([]);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);

  // Form state
  const [destinationType, setDestinationType] = useState<"italia" | "europa">(
    "italia"
  );
  const [mittenteCitta, setMittenteCitta] = useState("");
  const [mittenteCap, setMittenteCap] = useState("");
  const [mittenteProvincia, setMittenteProvincia] = useState("");
  const [destinatarioCitta, setDestinatarioCitta] = useState("");
  const [destinatarioCap, setDestinatarioCap] = useState("");
  const [destinatarioProvincia, setDestinatarioProvincia] = useState("");
  const [peso, setPeso] = useState("");
  const [lunghezza, setLunghezza] = useState("");
  const [larghezza, setLarghezza] = useState("");
  const [altezza, setAltezza] = useState("");
  const [courierId, setCourierId] = useState("");
  const [serviceType, setServiceType] =
    useState<CourierServiceType>("standard");
  const [assicurazione, setAssicurazione] = useState("");
  const [contrassegno, setContrassegno] = useState("");

  // Carica corrieri disponibili
  useEffect(() => {
    async function loadCouriers() {
      try {
        const result = await getAvailableCouriersForUserAction();
        if (result.success && result.couriers) {
          setAvailableCouriers(
            result.couriers.map((c) => ({
              courierId: c.courierId,
              courierName: c.courierName,
            }))
          );
        }
      } catch (error) {
        console.error("Errore caricamento corrieri:", error);
      }
    }
    loadCouriers();
  }, []);

  // Calcola preventivo
  const handleCalculate = async () => {
    // Validazione
    if (!peso || parseFloat(peso) <= 0) {
      toast.error("Inserisci un peso valido");
      return;
    }

    if (!destinatarioCap) {
      toast.error("Inserisci il CAP destinatario");
      return;
    }

    if (!courierId) {
      toast.error("Seleziona un corriere");
      return;
    }

    setIsLoading(true);
    setQuoteResult(null);

    try {
      // Calcola volume se misure disponibili
      let volume: number | undefined;
      if (lunghezza && larghezza && altezza) {
        const l = parseFloat(lunghezza);
        const w = parseFloat(larghezza);
        const h = parseFloat(altezza);
        if (!isNaN(l) && !isNaN(w) && !isNaN(h) && l > 0 && w > 0 && h > 0) {
          volume = (l * w * h) / 1000000; // Converti cm³ in m³
        }
      }

      const result = await calculateQuoteAction(
        {
          weight: parseFloat(peso),
          volume,
          destination: {
            zip: destinatarioCap,
            province: destinatarioProvincia || undefined,
            country: destinationType === "italia" ? "IT" : "EU",
          },
          courierId,
          serviceType,
          options: {
            declaredValue: assicurazione
              ? parseFloat(assicurazione)
              : undefined,
            cashOnDelivery: contrassegno ? parseFloat(contrassegno) > 0 : false,
            insurance: assicurazione ? parseFloat(assicurazione) > 0 : false,
          },
        }
        // Non passiamo priceListId per permettere confronto automatico reseller
      );

      setQuoteResult(result);

      if (result.success && result.result) {
        toast.success("Preventivo calcolato con successo");
      } else {
        toast.error(result.error || "Errore nel calcolo del preventivo");
      }
    } catch (error: any) {
      console.error("Errore calcolo preventivo:", error);
      toast.error("Errore imprevisto durante il calcolo");
      setQuoteResult({
        success: false,
        error: error.message || "Errore sconosciuto",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Trova zona geografica dal CAP
  const getZoneFromCap = (cap: string): string => {
    if (!cap) return "Sconosciuta";
    const capNum = parseInt(cap);
    if (isNaN(capNum)) return "Sconosciuta";

    // Logica semplificata per determinare zona
    // In produzione, usare geocoding o lookup table
    const zone = PRICING_MATRIX.ZONES.find((z) => {
      // Cerca per pattern CAP (es. Sardegna: 07xxx, 08xxx, 09xxx)
      if (z.code.includes("sardegna") && capNum >= 7000 && capNum < 10000) {
        return true;
      }
      if (z.code.includes("sicilia") && capNum >= 9000 && capNum < 10000) {
        return true;
      }
      // Default: Italia
      if (z.code.includes("italia") && capNum >= 1000 && capNum < 100000) {
        return true;
      }
      return false;
    });

    return zone?.name || "Italia";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Preventivatore"
        subtitle="Calcola preventivi basati sulla matrice del tuo listino"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form Sinistra */}
          <div className="lg:col-span-1">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Calculator className="h-5 w-5" />
                  Dati Spedizione
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Inserisci i dati per calcolare il preventivo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Destinazione: Italia/Europa */}
                <div>
                  <Label>Destinazione</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={
                        destinationType === "italia" ? "default" : "outline"
                      }
                      onClick={() => setDestinationType("italia")}
                      className="flex-1"
                    >
                      Italia
                    </Button>
                    <Button
                      type="button"
                      variant={
                        destinationType === "europa" ? "default" : "outline"
                      }
                      onClick={() => setDestinationType("europa")}
                      className="flex-1"
                    >
                      Europa
                    </Button>
                  </div>
                </div>

                {/* Mittente */}
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Mittente
                  </h3>
                  <div>
                    <Label htmlFor="mittente-citta">Città</Label>
                    <Input
                      id="mittente-citta"
                      value={mittenteCitta}
                      onChange={(e) => setMittenteCitta(e.target.value)}
                      placeholder="Es. Roma"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="mittente-cap">CAP</Label>
                      <Input
                        id="mittente-cap"
                        value={mittenteCap}
                        onChange={(e) => setMittenteCap(e.target.value)}
                        placeholder="00100"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="mittente-provincia">Provincia</Label>
                      <Input
                        id="mittente-provincia"
                        value={mittenteProvincia}
                        onChange={(e) =>
                          setMittenteProvincia(e.target.value.toUpperCase())
                        }
                        placeholder="RM"
                        maxLength={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Destinatario */}
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Destinatario
                  </h3>
                  <div>
                    <Label htmlFor="destinatario-citta">Città *</Label>
                    <Input
                      id="destinatario-citta"
                      value={destinatarioCitta}
                      onChange={(e) => setDestinatarioCitta(e.target.value)}
                      placeholder="Es. Milano"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="destinatario-cap">CAP *</Label>
                      <Input
                        id="destinatario-cap"
                        value={destinatarioCap}
                        onChange={(e) => setDestinatarioCap(e.target.value)}
                        placeholder="20100"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="destinatario-provincia">Provincia</Label>
                      <Input
                        id="destinatario-provincia"
                        value={destinatarioProvincia}
                        onChange={(e) =>
                          setDestinatarioProvincia(e.target.value.toUpperCase())
                        }
                        placeholder="MI"
                        maxLength={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Peso e Misure */}
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-700">Pacco</h3>
                  <div>
                    <Label htmlFor="peso">Peso (kg) *</Label>
                    <Input
                      id="peso"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      placeholder="Es. 2.5"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">
                      Misure (opzionale, in cm)
                    </Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={lunghezza}
                        onChange={(e) => setLunghezza(e.target.value)}
                        placeholder="L"
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={larghezza}
                        onChange={(e) => setLarghezza(e.target.value)}
                        placeholder="W"
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={altezza}
                        onChange={(e) => setAltezza(e.target.value)}
                        placeholder="H"
                      />
                    </div>
                  </div>
                </div>

                {/* Corriere e Servizio */}
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Corriere
                  </h3>
                  <div>
                    <Label htmlFor="corriere">Corriere *</Label>
                    <Select
                      id="corriere"
                      value={courierId}
                      onChange={(e) => setCourierId(e.target.value)}
                      required
                      className="mt-1"
                    >
                      <option value="">Seleziona corriere</option>
                      {availableCouriers.map((courier) => (
                        <option
                          key={courier.courierId}
                          value={courier.courierId}
                        >
                          {courier.courierName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="service-type">Tipo Servizio</Label>
                    <Select
                      id="service-type"
                      value={serviceType}
                      onChange={(e) =>
                        setServiceType(e.target.value as CourierServiceType)
                      }
                      className="mt-1"
                    >
                      <option value="standard">Standard</option>
                      <option value="express">Express</option>
                      <option value="economy">Economy</option>
                      <option value="same_day">Same Day</option>
                      <option value="next_day">Next Day</option>
                    </Select>
                  </div>
                </div>

                {/* Accessori */}
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Accessori
                  </h3>
                  <div>
                    <Label htmlFor="assicurazione">Assicurazione (€)</Label>
                    <Input
                      id="assicurazione"
                      type="number"
                      step="0.01"
                      min="0"
                      value={assicurazione}
                      onChange={(e) => setAssicurazione(e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Valore dichiarato da assicurare
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="contrassegno">Contrassegno (€)</Label>
                    <Input
                      id="contrassegno"
                      type="number"
                      step="0.01"
                      min="0"
                      value={contrassegno}
                      onChange={(e) => setContrassegno(e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Importo da riscuotere alla consegna
                    </p>
                  </div>
                </div>

                {/* Pulsante Calcola */}
                <Button
                  onClick={handleCalculate}
                  disabled={
                    isLoading || !peso || !destinatarioCap || !courierId
                  }
                  className="w-full mt-4"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calcolo in corso...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Calcola Preventivo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Risultato Destra */}
          <div className="lg:col-span-2">
            {!quoteResult ? (
              <Card className="bg-white border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-600">
                  <Package className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-600 text-lg mb-2">
                    Inserisci i dati della spedizione
                  </p>
                  <p className="text-sm text-gray-500">
                    Compila il form e clicca &quot;Calcola Preventivo&quot; per
                    vedere i risultati
                  </p>
                </CardContent>
              </Card>
            ) : quoteResult.success && quoteResult.result ? (
              <div className="space-y-4">
                {/* Card Risultato Principale */}
                <Card className="border-2 border-green-200 bg-green-50/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Preventivo Calcolato
                      </h3>
                      <div className="text-3xl font-bold text-green-700">
                        {formatCurrency(quoteResult.result.finalPrice)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Dettaglio Prezzo */}
                    <div className="space-y-3 bg-white rounded-lg p-4 border border-green-200">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Prezzo Base</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(quoteResult.result.basePrice)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Supplementi</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(quoteResult.result.surcharges)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Margine</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(quoteResult.result.margin)}
                        </span>
                      </div>
                      <div className="border-t pt-3 flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">
                          Totale
                        </span>
                        <span className="text-2xl font-bold text-green-700">
                          {formatCurrency(quoteResult.result.finalPrice)}
                        </span>
                      </div>
                    </div>

                    {/* Info Zona e Peso */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-900">
                            Zona Rilevata
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-blue-700">
                          {getZoneFromCap(destinatarioCap)}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-purple-600" />
                          <span className="text-xs font-medium text-purple-900">
                            Peso
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-purple-700">
                          {peso} kg
                        </p>
                      </div>
                    </div>

                    {/* Confronto Reseller vs Master (solo se reseller) */}
                    {quoteResult.resellerComparison &&
                      quoteResult.resellerComparison.apiSource !==
                        "default" && (
                        <div className="mt-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                          <div className="flex items-start gap-2 mb-2">
                            <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-yellow-900 mb-1">
                                Confronto Prezzi
                              </h4>
                              <p className="text-sm text-yellow-700 mb-3">
                                Prezzo selezionato da:{" "}
                                <strong>
                                  {quoteResult.resellerComparison.apiSource ===
                                  "reseller"
                                    ? "API Reseller (tuo contratto)"
                                    : "API Master (listino assegnato)"}
                                </strong>
                              </p>
                              {quoteResult.resellerComparison.resellerPrice &&
                                quoteResult.resellerComparison.masterPrice && (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-yellow-700">
                                        API Reseller:
                                      </span>
                                      <span className="font-semibold text-yellow-900">
                                        {formatCurrency(
                                          quoteResult.resellerComparison
                                            .resellerPrice.finalPrice
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-yellow-700">
                                        API Master:
                                      </span>
                                      <span className="font-semibold text-yellow-900">
                                        {formatCurrency(
                                          quoteResult.resellerComparison
                                            .masterPrice.finalPrice
                                        )}
                                      </span>
                                    </div>
                                    {quoteResult.resellerComparison
                                      .priceDifference && (
                                      <div className="flex justify-between pt-2 border-t border-yellow-300">
                                        <span className="text-yellow-700">
                                          Differenza:
                                        </span>
                                        <span className="font-semibold text-yellow-900">
                                          {formatCurrency(
                                            quoteResult.resellerComparison
                                              .priceDifference
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Dettagli Calcolo */}
                    <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Dettagli Calcolo
                      </h4>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Destinazione:</span>
                          <span className="font-medium">
                            {destinatarioCitta || "N/A"} ({destinatarioCap})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Corriere:</span>
                          <span className="font-medium">
                            {availableCouriers.find(
                              (c) => c.courierId === courierId
                            )?.courierName || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Servizio:</span>
                          <span className="font-medium capitalize">
                            {serviceType}
                          </span>
                        </div>
                        {quoteResult.result.calculationDetails.options
                          ?.declaredValue && (
                          <div className="flex justify-between">
                            <span>Assicurazione:</span>
                            <span className="font-medium">
                              {formatCurrency(
                                quoteResult.result.calculationDetails.options
                                  .declaredValue
                              )}
                            </span>
                          </div>
                        )}
                        {quoteResult.result.calculationDetails.options
                          ?.cashOnDelivery && (
                          <div className="flex justify-between">
                            <span>Contrassegno:</span>
                            <span className="font-medium">Attivo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                  <p className="text-red-700 text-lg font-semibold mb-2">
                    Errore nel calcolo
                  </p>
                  <p className="text-red-600 text-sm text-center">
                    {quoteResult.error || "Impossibile calcolare il preventivo"}
                  </p>
                  <p className="text-xs text-red-500 mt-2 text-center">
                    Verifica che il listino sia configurato correttamente
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
