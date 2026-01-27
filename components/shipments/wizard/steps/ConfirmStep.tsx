'use client';

import {
  User,
  MapPin,
  Package,
  Settings,
  Truck,
  Calendar,
  Check,
  AlertCircle,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShipmentWizard } from '../ShipmentWizardContext';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  onEdit?: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'highlight';
}

function Section({ title, icon, onEdit, children, variant = 'default' }: SectionProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        variant === 'highlight'
          ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-gray-500 hover:text-gray-700"
          >
            <Edit2 className="w-4 h-4 mr-1" />
            Modifica
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function ConfirmStep() {
  const { data, setCurrentStep, isStepComplete } = useShipmentWizard();

  // Verifica completamento di tutti gli step
  const allStepsComplete =
    isStepComplete('sender') &&
    isStepComplete('recipient') &&
    isStepComplete('packages') &&
    isStepComplete('services') &&
    isStepComplete('pickup') &&
    isStepComplete('carrier');

  // Calcoli
  const totalWeight = data.packages.reduce((sum, pkg) => sum + pkg.peso, 0);
  const totalPackages = data.packages.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <Check className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Riepilogo Spedizione</h2>
          <p className="text-sm text-gray-500">Verifica i dati prima di confermare</p>
        </div>
      </div>

      {/* Warning se non completo */}
      {!allStepsComplete && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Dati incompleti</p>
              <p className="text-sm text-yellow-700 mt-1">
                Alcuni passaggi non sono stati completati. Torna indietro per completare tutti i
                campi obbligatori.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mittente */}
        <Section
          title="Mittente"
          icon={<User className="w-5 h-5 text-blue-600" />}
          onEdit={() => setCurrentStep('sender')}
        >
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">{data.mittente.nome || '-'}</p>
            {data.mittente.company && <p className="text-gray-600">{data.mittente.company}</p>}
            <p className="text-gray-600">
              {data.mittente.indirizzo || '-'}, {data.mittente.citta || '-'}{' '}
              {data.mittente.cap || '-'}
            </p>
            <p className="text-gray-600">{data.mittente.provincia || '-'}, Italia</p>
            {data.mittente.telefono && (
              <p className="text-gray-500">Tel: {data.mittente.telefono}</p>
            )}
            {data.mittente.email && <p className="text-gray-500">Email: {data.mittente.email}</p>}
          </div>
        </Section>

        {/* Destinatario */}
        <Section
          title="Destinatario"
          icon={<MapPin className="w-5 h-5 text-red-600" />}
          onEdit={() => setCurrentStep('recipient')}
        >
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">{data.destinatario.nome || '-'}</p>
            {data.destinatario.company && (
              <p className="text-gray-600">{data.destinatario.company}</p>
            )}
            <p className="text-gray-600">
              {data.destinatario.indirizzo || '-'}, {data.destinatario.citta || '-'}{' '}
              {data.destinatario.cap || '-'}
            </p>
            <p className="text-gray-600">{data.destinatario.provincia || '-'}, Italia</p>
            {data.destinatario.telefono && (
              <p className="text-gray-500">Tel: {data.destinatario.telefono}</p>
            )}
            {data.destinatario.email && (
              <p className="text-gray-500">Email: {data.destinatario.email}</p>
            )}
          </div>
        </Section>

        {/* Colli */}
        <Section
          title={`Colli (${totalPackages})`}
          icon={<Package className="w-5 h-5 text-orange-600" />}
          onEdit={() => setCurrentStep('packages')}
        >
          <div className="text-sm space-y-2">
            {data.packages.map((pkg, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-600">Collo {idx + 1}</span>
                <span className="text-gray-900">
                  {pkg.peso}kg - {pkg.lunghezza}x{pkg.larghezza}x{pkg.altezza}cm
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 font-medium">
              <span className="text-gray-700">Peso totale</span>
              <span className="text-gray-900">{totalWeight.toFixed(1)} kg</span>
            </div>
          </div>
        </Section>

        {/* Servizi */}
        <Section
          title="Servizi"
          icon={<Settings className="w-5 h-5 text-purple-600" />}
          onEdit={() => setCurrentStep('services')}
        >
          <div className="text-sm space-y-2">
            {data.services.contrassegnoEnabled && (
              <div className="flex justify-between">
                <span className="text-gray-600">Contrassegno</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(data.services.contrassegnoAmount)}
                </span>
              </div>
            )}
            {data.services.assicurazioneEnabled && (
              <div className="flex justify-between">
                <span className="text-gray-600">Assicurazione</span>
                <span className="font-medium text-blue-600">
                  {formatCurrency(data.services.assicurazioneValue)}
                </span>
              </div>
            )}
            {data.services.serviziAccessori.length > 0 && (
              <div className="pt-1">
                <span className="text-gray-600">Servizi accessori:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.services.serviziAccessori.map((service) => (
                    <span
                      key={service}
                      className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.services.note && (
              <div className="pt-1">
                <span className="text-gray-600">Note:</span>
                <p className="text-gray-700 mt-0.5 italic">&ldquo;{data.services.note}&rdquo;</p>
              </div>
            )}
            {!data.services.contrassegnoEnabled &&
              !data.services.assicurazioneEnabled &&
              data.services.serviziAccessori.length === 0 &&
              !data.services.note && (
                <p className="text-gray-500 italic">Nessun servizio aggiuntivo</p>
              )}
          </div>
        </Section>
      </div>

      {/* Ritiro */}
      {data.pickup.requestPickup && (
        <Section
          title="Ritiro Prenotato"
          icon={<Calendar className="w-5 h-5 text-orange-600" />}
          onEdit={() => setCurrentStep('pickup')}
        >
          <div className="text-sm">
            <p className="text-gray-700">
              <span className="font-medium">Data:</span> {data.pickup.pickupDate || '-'}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Fascia oraria:</span>{' '}
              {data.pickup.pickupTime === 'AM'
                ? 'Mattino (09:00-13:00)'
                : data.pickup.pickupTime === 'PM'
                  ? 'Pomeriggio (14:00-18:00)'
                  : '-'}
            </p>
          </div>
        </Section>
      )}

      {/* Corriere e Totale */}
      <Section
        title="Corriere Selezionato"
        icon={<Truck className="w-5 h-5 text-blue-600" />}
        onEdit={() => setCurrentStep('carrier')}
        variant="highlight"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {data.carrier?.displayName || 'Non selezionato'}
            </p>
            <p className="text-sm text-gray-600">{data.carrier?.carrierCode || '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Costo spedizione</p>
            <p className="text-3xl font-bold text-blue-600">
              {formatCurrency(data.carrier?.finalPrice || 0)}
            </p>
          </div>
        </div>
      </Section>

      {/* Riepilogo Costi Finale */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
        <h3 className="font-semibold text-green-800 mb-4">Riepilogo Costi</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Spedizione ({data.carrier?.displayName || '-'})</span>
            <span className="font-medium">{formatCurrency(data.carrier?.finalPrice || 0)}</span>
          </div>
          {data.services.contrassegnoEnabled && (
            <div className="flex justify-between text-gray-500">
              <span>Contrassegno (servizio)</span>
              <span>incluso</span>
            </div>
          )}
          {data.services.assicurazioneEnabled && (
            <div className="flex justify-between text-gray-500">
              <span>Assicurazione (servizio)</span>
              <span>incluso</span>
            </div>
          )}
          {data.pickup.requestPickup && (
            <div className="flex justify-between text-gray-500">
              <span>Ritiro a domicilio</span>
              <span>incluso</span>
            </div>
          )}
          <div className="border-t border-green-200 pt-3 mt-3 flex justify-between">
            <span className="text-lg font-semibold text-green-800">Totale da pagare</span>
            <span className="text-2xl font-bold text-green-700">
              {formatCurrency(data.carrier?.finalPrice || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Conferma Note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <p>
          Cliccando su &ldquo;Crea Spedizione&rdquo; confermi i dati inseriti e procedi alla
          creazione della lettera di vettura. L&apos;importo verrà scalato dal tuo credito wallet.
        </p>
      </div>
    </div>
  );
}
