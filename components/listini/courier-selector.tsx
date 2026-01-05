/**
 * Courier Selector per Account Spedisci.Online
 * 
 * Permette di abilitare/disabilitare corrieri specifici per ogni configurazione.
 * I corrieri disabilitati non vengono sincronizzati nel listino.
 * 
 * @security Le preferenze sono salvate in courier_configs.automation_settings.enabled_carriers
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CourierSelectorProps {
  configId: string;
  configName: string;
  /** Corrieri disponibili dall'API (rilevati durante test) */
  availableCouriers: string[];
  /** Corrieri già abilitati (da automation_settings) */
  enabledCouriers?: string[];
  /** Callback quando le preferenze vengono salvate */
  onSave?: (enabledCouriers: string[]) => void;
}

// Mapping per nomi display corrieri
const COURIER_DISPLAY_NAMES: Record<string, string> = {
  gls: "GLS",
  postedeliverybusiness: "Poste Delivery Business",
  brt: "BRT/Bartolini",
  dhl: "DHL",
  ups: "UPS",
  fedex: "FedEx",
  tnt: "TNT",
  sda: "SDA",
  interno: "Corriere Interno",
};

export function CourierSelector({
  configId,
  configName,
  availableCouriers,
  enabledCouriers: initialEnabled,
  onSave,
}: CourierSelectorProps) {
  const [selectedCouriers, setSelectedCouriers] = useState<Set<string>>(
    new Set(initialEnabled ?? availableCouriers)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Traccia modifiche
  useEffect(() => {
    const initial = new Set(initialEnabled ?? availableCouriers);
    const current = selectedCouriers;
    
    const isDifferent = 
      initial.size !== current.size ||
      [...initial].some(c => !current.has(c)) ||
      [...current].some(c => !initial.has(c));
    
    setHasChanges(isDifferent);
  }, [selectedCouriers, initialEnabled, availableCouriers]);

  const handleToggle = (courier: string) => {
    setSelectedCouriers(prev => {
      const next = new Set(prev);
      if (next.has(courier)) {
        // Non permettere di disabilitare tutti
        if (next.size <= 1) {
          toast.error("Devi mantenere almeno un corriere abilitato");
          return prev;
        }
        next.delete(courier);
      } else {
        next.add(courier);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCouriers(new Set(availableCouriers));
  };

  const handleDeselectAll = () => {
    // Mantieni almeno il primo
    if (availableCouriers.length > 0) {
      setSelectedCouriers(new Set([availableCouriers[0]]));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/configurations/update-courier-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configId,
          enabledCouriers: [...selectedCouriers],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore salvataggio");
      }

      toast.success("Preferenze corrieri salvate");
      onSave?.([...selectedCouriers]);
      setHasChanges(false);
    } catch (error: any) {
      console.error("Errore salvataggio preferenze:", error);
      toast.error(error.message || "Errore salvataggio preferenze");
    } finally {
      setIsSaving(false);
    }
  };

  if (availableCouriers.length === 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Nessun corriere rilevato. Esegui un test per rilevare i corrieri disponibili.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Corrieri per {configName}
            </CardTitle>
            <CardDescription className="text-sm">
              Seleziona quali corrieri sincronizzare dal listino
            </CardDescription>
          </div>
          {hasChanges && (
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
              Modifiche non salvate
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Azioni rapide */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isSaving}
          >
            Seleziona tutti
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={isSaving}
          >
            Deseleziona tutti
          </Button>
        </div>

        {/* Lista corrieri */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {availableCouriers.map((courier) => {
            const isChecked = selectedCouriers.has(courier);
            const displayName = COURIER_DISPLAY_NAMES[courier.toLowerCase()] || courier;

            return (
              <div
                key={courier}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                  ${isChecked 
                    ? "bg-green-50 border-green-200 hover:bg-green-100" 
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }
                `}
                onClick={() => handleToggle(courier)}
              >
                <input
                  type="checkbox"
                  id={`courier-${configId}-${courier}`}
                  checked={isChecked}
                  onChange={() => handleToggle(courier)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <Label
                  htmlFor={`courier-${configId}-${courier}`}
                  className="cursor-pointer flex-1 text-sm font-medium"
                >
                  {displayName}
                </Label>
                {isChecked && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* Info e salvataggio */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {selectedCouriers.size} di {availableCouriers.length} corrieri selezionati
          </span>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salva preferenze
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
