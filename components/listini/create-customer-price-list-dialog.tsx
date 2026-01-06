/**
 * Dialog: Crea Listino Cliente
 * 
 * Permette al reseller di creare un nuovo listino cliente vuoto
 * per un suo sub-user, con margine percentuale configurabile.
 */

"use client";

import {
  createCustomerPriceListAction,
  getResellerSubUsersAction,
} from "@/actions/customer-price-lists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CreateCustomerPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCustomerPriceListDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCustomerPriceListDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subUsers, setSubUsers] = useState<
    Array<{ id: string; email: string; name?: string }>
  >([]);

  // Form fields
  const [name, setName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [marginPercent, setMarginPercent] = useState<number>(0);
  const [description, setDescription] = useState("");

  // Carica sub-users quando si apre il dialog
  useEffect(() => {
    if (open) {
      loadSubUsers();
    }
  }, [open]);

  async function loadSubUsers() {
    setIsLoading(true);
    try {
      const result = await getResellerSubUsersAction();
      if (result.success && result.subUsers) {
        setSubUsers(result.subUsers);
      } else {
        toast.error(result.error || "Errore caricamento clienti");
      }
    } catch (error) {
      console.error("Errore caricamento sub-users:", error);
      toast.error("Errore caricamento clienti");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Il nome del listino è obbligatorio");
      return;
    }

    if (!selectedClientId) {
      toast.error("Seleziona un cliente");
      return;
    }

    if (marginPercent < 0) {
      toast.error("Il margine percentuale non può essere negativo");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createCustomerPriceListAction({
        name: name.trim(),
        assigned_to_user_id: selectedClientId,
        default_margin_percent: marginPercent,
        description: description.trim() || undefined,
      });

      if (result.success) {
        toast.success("Listino cliente creato con successo");
        // Reset form
        setName("");
        setSelectedClientId("");
        setMarginPercent(0);
        setDescription("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Errore creazione listino");
      }
    } catch (error: any) {
      console.error("Errore creazione listino cliente:", error);
      toast.error("Errore durante la creazione del listino");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Listino Cliente</DialogTitle>
          <DialogDescription>
            Crea un nuovo listino personalizzato per un tuo cliente. Il listino
            partirà vuoto e potrai completarlo manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Nome listino */}
          <div>
            <Label htmlFor="list-name">Nome Listino *</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Listino Cliente A - GLS"
              disabled={isSaving}
            />
          </div>

          {/* Cliente */}
          <div>
            <Label htmlFor="client-select">Cliente *</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-500">
                  Caricamento clienti...
                </span>
              </div>
            ) : (
              <Select
                id="client-select"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                disabled={isSaving || subUsers.length === 0}
              >
                <option value="">Seleziona un cliente</option>
                {subUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.email})
                  </option>
                ))}
              </Select>
            )}
            {subUsers.length === 0 && !isLoading && (
              <p className="text-xs text-gray-500 mt-1">
                Nessun cliente disponibile. Crea prima un sub-user.
              </p>
            )}
          </div>

          {/* Margine percentuale */}
          <div>
            <Label htmlFor="margin-percent">Margine Percentuale (%) *</Label>
            <Input
              id="margin-percent"
              type="number"
              step="0.01"
              min="0"
              value={marginPercent}
              onChange={(e) =>
                setMarginPercent(parseFloat(e.target.value) || 0)
              }
              placeholder="es. 20 per +20%"
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Margine di ricarico applicato al prezzo base. Es: 20 = +20% sul
              costo
            </p>
          </div>

          {/* Descrizione (opzionale) */}
          <div>
            <Label htmlFor="description">Descrizione (opzionale)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note aggiuntive sul listino"
              disabled={isSaving}
            />
          </div>

          {/* Info creazione */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>Data creazione:</strong> {new Date().toLocaleString("it-IT")}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Il listino partirà vuoto. Dopo la creazione, potrai completare
              manualmente la matrice dei prezzi.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isSaving || !name.trim() || !selectedClientId}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creazione...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Crea Listino
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
