'use client';

import { Settings, Banknote, Shield, FileText, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useShipmentWizard } from '../ShipmentWizardContext';
import { cn } from '@/lib/utils';

// Servizi accessori comuni
const ACCESSORI_SERVICES = [
  { id: 'fragile', label: 'Fragile', description: 'Maneggiare con cura' },
  { id: 'no_stack', label: 'Non impilare', description: 'Non posizionare altri colli sopra' },
  {
    id: 'appointment',
    label: 'Su appuntamento',
    description: 'Consegna solo previo contatto telefonico',
  },
  { id: 'saturday', label: 'Consegna sabato', description: 'Consegna anche di sabato' },
  { id: 'return_receipt', label: 'Ricevuta di ritorno', description: 'Prova di consegna firmata' },
];

export function ServicesStep() {
  const { data, setServices, validateStep } = useShipmentWizard();
  const validation = validateStep('services');

  const toggleService = (serviceId: string) => {
    const current = data.services.serviziAccessori;
    if (current.includes(serviceId)) {
      setServices({ serviziAccessori: current.filter((s) => s !== serviceId) });
    } else {
      setServices({ serviziAccessori: [...current, serviceId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Servizi Aggiuntivi</h2>
          <p className="text-sm text-gray-500">
            Configura contrassegno, assicurazione e altri servizi
          </p>
        </div>
      </div>

      {/* Contrassegno */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Contrassegno (COD)</h3>
              <p className="text-sm text-gray-500">Incassa il pagamento alla consegna</p>
            </div>
          </div>
          <Switch
            checked={data.services.contrassegnoEnabled}
            onCheckedChange={(checked) => setServices({ contrassegnoEnabled: checked })}
          />
        </div>

        {data.services.contrassegnoEnabled && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Label htmlFor="contrassegno-amount" className="text-sm">
              Importo da incassare (EUR) *
            </Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <Input
                id="contrassegno-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={data.services.contrassegnoAmount || ''}
                onChange={(e) =>
                  setServices({ contrassegnoAmount: parseFloat(e.target.value) || 0 })
                }
                className="pl-8"
                placeholder="0.00"
              />
            </div>
            {data.services.contrassegnoEnabled && data.services.contrassegnoAmount <= 0 && (
              <p className="text-sm text-red-500 mt-1">
                Inserisci un importo valido per il contrassegno
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Il telefono del destinatario e obbligatorio per il contrassegno
            </p>
          </div>
        )}
      </div>

      {/* Assicurazione */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Assicurazione</h3>
              <p className="text-sm text-gray-500">Proteggi la tua spedizione</p>
            </div>
          </div>
          <Switch
            checked={data.services.assicurazioneEnabled}
            onCheckedChange={(checked) => setServices({ assicurazioneEnabled: checked })}
          />
        </div>

        {data.services.assicurazioneEnabled && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Label htmlFor="assicurazione-value" className="text-sm">
              Valore da assicurare (EUR) *
            </Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <Input
                id="assicurazione-value"
                type="number"
                step="0.01"
                min="0.01"
                value={data.services.assicurazioneValue || ''}
                onChange={(e) =>
                  setServices({ assicurazioneValue: parseFloat(e.target.value) || 0 })
                }
                className="pl-8"
                placeholder="0.00"
              />
            </div>
            {data.services.assicurazioneEnabled && data.services.assicurazioneValue <= 0 && (
              <p className="text-sm text-red-500 mt-1">Inserisci un valore valido da assicurare</p>
            )}
          </div>
        )}
      </div>

      {/* Servizi Accessori */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Plus className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Servizi Accessori</h3>
            <p className="text-sm text-gray-500">Seleziona i servizi aggiuntivi necessari</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {ACCESSORI_SERVICES.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleService(service.id)}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                data.services.serviziAccessori.includes(service.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  data.services.serviziAccessori.includes(service.id)
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300'
                )}
              >
                {data.services.serviziAccessori.includes(service.id) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div>
                <span className="font-medium text-gray-900">{service.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{service.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Note per il Corriere</h3>
            <p className="text-sm text-gray-500">Istruzioni speciali per la consegna</p>
          </div>
        </div>

        <Textarea
          value={data.services.note}
          onChange={(e) => setServices({ note: e.target.value })}
          placeholder="es. Suonare al citofono 'Rossi', lasciare al portiere, chiamare prima della consegna..."
          rows={3}
          className="mt-2"
        />
      </div>

      {/* Validation errors */}
      {!validation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
