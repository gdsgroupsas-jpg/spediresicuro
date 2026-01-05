/**
 * Account Selector per Booking Multi-Account
 *
 * Quando l'utente ha più configurazioni Spedisci.Online attive,
 * questo componente permette di scegliere quale account usare per il booking.
 *
 * @security Mostra solo configurazioni attive dell'utente corrente
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle2, Loader2, Server } from "lucide-react";
import { useEffect, useState } from "react";

interface AccountConfig {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
  couriers: string[];
}

interface AccountSelectorProps {
  /** ID account attualmente selezionato */
  selectedAccountId?: string;
  /** Callback quando viene selezionato un account */
  onSelect: (accountId: string, accountName: string) => void;
  /** Mostra solo se ci sono più account (default: true) */
  hideIfSingle?: boolean;
  /** Classe CSS aggiuntiva */
  className?: string;
}

// Mapping nomi display corrieri
const COURIER_DISPLAY: Record<string, string> = {
  gls: "GLS",
  postedeliverybusiness: "Poste",
  brt: "BRT",
  dhl: "DHL",
  ups: "UPS",
  fedex: "FedEx",
  interno: "Interno",
};

export function AccountSelector({
  selectedAccountId,
  onSelect,
  hideIfSingle = true,
  className = "",
}: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectedAccountId
  );

  // Carica configurazioni
  useEffect(() => {
    async function loadAccounts() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/configurations/list-for-booking");

        if (!response.ok) {
          throw new Error("Errore caricamento account");
        }

        const data = await response.json();

        if (data.configs && data.configs.length > 0) {
          setAccounts(data.configs);

          // Seleziona default o il primo
          if (!selectedId) {
            const defaultAccount = data.configs.find(
              (c: AccountConfig) => c.isDefault
            );
            const firstAccount = data.configs[0];
            const toSelect = defaultAccount || firstAccount;
            setSelectedId(toSelect.id);
            onSelect(toSelect.id, toSelect.name);
          }
        }
      } catch (err: any) {
        console.error("Errore caricamento account:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, []);

  // Sincronizza selectedAccountId esterno
  useEffect(() => {
    if (selectedAccountId && selectedAccountId !== selectedId) {
      setSelectedId(selectedAccountId);
    }
  }, [selectedAccountId]);

  const handleSelect = (account: AccountConfig) => {
    setSelectedId(account.id);
    onSelect(account.id, account.name);
  };

  // Non mostrare se c'è un solo account e hideIfSingle è true
  if (hideIfSingle && accounts.length <= 1 && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-2 p-4 bg-gray-50 rounded-lg ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Caricamento account...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 ${className}`}
      >
        {error}
      </div>
    );
  }

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider flex items-center gap-2">
        <Server className="h-3.5 w-3.5" />
        Account Spedizioni ({accounts.length})
      </Label>

      <div className="grid gap-2">
        {accounts.map((account) => {
          const isSelected = selectedId === account.id;
          const courierList = account.couriers
            .map((c) => COURIER_DISPLAY[c.toLowerCase()] || c)
            .join(", ");

          return (
            <div
              key={account.id}
              onClick={() => handleSelect(account)}
              className={`
                relative p-3 rounded-lg border-2 cursor-pointer transition-all
                ${
                  isSelected
                    ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2
                      className={`h-4 w-4 ${
                        isSelected ? "text-amber-600" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        isSelected ? "text-amber-900" : "text-gray-700"
                      }`}
                    >
                      {account.name}
                    </span>
                    {account.isDefault && (
                      <Badge variant="outline" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                  {courierList && (
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Corrieri: {courierList}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-amber-600" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
