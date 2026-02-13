'use client';

/**
 * Step 1: Dati Prospect
 * Azienda*, referente, email, telefono, settore, volume, note
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PROSPECT_SECTORS } from '@/types/commercial-quotes';
import { Building2 } from 'lucide-react';
import { useQuoteWizard } from '../CommercialQuoteWizardContext';

export function ProspectStep() {
  const { prospect, setProspect } = useQuoteWizard();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Dati Prospect</h3>
      </div>

      <div>
        <Label htmlFor="prospect-company">Azienda *</Label>
        <Input
          id="prospect-company"
          value={prospect.company}
          onChange={(e) => setProspect({ company: e.target.value })}
          placeholder="Es. Azienda Esempio SRL"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="prospect-contact">Referente</Label>
          <Input
            id="prospect-contact"
            value={prospect.contactName}
            onChange={(e) => setProspect({ contactName: e.target.value })}
            placeholder="Mario Rossi"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="prospect-phone">Telefono</Label>
          <Input
            id="prospect-phone"
            value={prospect.phone}
            onChange={(e) => setProspect({ phone: e.target.value })}
            placeholder="+39 333 1234567"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="prospect-email">Email</Label>
        <Input
          id="prospect-email"
          type="email"
          value={prospect.email}
          onChange={(e) => setProspect({ email: e.target.value })}
          placeholder="info@azienda.it"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="prospect-sector">Settore</Label>
          <Select
            id="prospect-sector"
            value={prospect.sector}
            onChange={(e) => setProspect({ sector: e.target.value })}
            className="mt-1"
          >
            <option value="">Seleziona settore</option>
            {PROSPECT_SECTORS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="prospect-volume">Vol. mensile stimato</Label>
          <Input
            id="prospect-volume"
            type="number"
            min="1"
            value={prospect.estimatedVolume}
            onChange={(e) => setProspect({ estimatedVolume: e.target.value })}
            placeholder="Es. 100"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="prospect-notes">Note</Label>
        <textarea
          id="prospect-notes"
          value={prospect.notes}
          onChange={(e) => setProspect({ notes: e.target.value })}
          placeholder="Note aggiuntive sul prospect..."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          rows={2}
        />
      </div>
    </div>
  );
}
