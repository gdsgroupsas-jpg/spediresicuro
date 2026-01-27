'use client';

import { useState } from 'react';
import { Truck, Calendar, Clock, MapPin, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useShipmentWizard } from '../ShipmentWizardContext';
import { cn } from '@/lib/utils';

// Opzioni orario ritiro (come da API Spedisci.online)
const PICKUP_TIME_OPTIONS = [
  { value: 'AM', label: 'Mattino', description: '09:00 - 13:00' },
  { value: 'PM', label: 'Pomeriggio', description: '14:00 - 18:00' },
];

// Funzione per ottenere la data minima (domani)
const getMinDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

// Funzione per ottenere la data massima (30 giorni)
const getMaxDate = (): string => {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  return maxDate.toISOString().split('T')[0];
};

// Funzione per formattare la data in DD/MM/YYYY (formato API)
const formatDateForAPI = (isoDate: string): string => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

// Funzione per convertire DD/MM/YYYY in ISO
const parseAPIDate = (apiDate: string): string => {
  if (!apiDate) return '';
  const [day, month, year] = apiDate.split('/');
  return `${year}-${month}-${day}`;
};

export function PickupStep() {
  const { data, setPickup, validateStep } = useShipmentWizard();
  const validation = validateStep('pickup');

  // Stato locale per il date picker (formato ISO)
  const [localDate, setLocalDate] = useState(() => {
    return data.pickup.pickupDate ? parseAPIDate(data.pickup.pickupDate) : '';
  });

  const handleDateChange = (isoDate: string) => {
    setLocalDate(isoDate);
    setPickup({ pickupDate: formatDateForAPI(isoDate) });
  };

  const handleTimeSelect = (time: 'AM' | 'PM') => {
    setPickup({ pickupTime: time });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
          <Truck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Prenotazione Ritiro</h2>
          <p className="text-sm text-gray-500">
            Richiedi il ritiro del pacco da parte del corriere
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Quando prenotare il ritiro?</p>
            <p className="mt-1">
              Prenota il ritiro se vuoi che il corriere venga a ritirare il pacco presso
              l&apos;indirizzo del mittente. Altrimenti potrai portare il pacco presso un punto di
              ritiro o in agenzia.
            </p>
          </div>
        </div>
      </div>

      {/* Toggle Ritiro */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Richiedi Ritiro a Domicilio</h3>
              <p className="text-sm text-gray-500">
                Il corriere ritirerà il pacco all&apos;indirizzo del mittente
              </p>
            </div>
          </div>
          <Switch
            checked={data.pickup.requestPickup}
            onCheckedChange={(checked) => setPickup({ requestPickup: checked })}
          />
        </div>

        {/* Indirizzo Ritiro Preview */}
        {data.pickup.requestPickup && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Indirizzo di ritiro:</p>
              <p className="text-sm text-gray-600">
                {data.mittente.nome || 'Nome mittente'}
                <br />
                {data.mittente.indirizzo || 'Via'}, {data.mittente.citta || 'Città'}{' '}
                {data.mittente.cap || 'CAP'}
                <br />
                {data.mittente.provincia || 'Provincia'}, Italia
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dettagli Ritiro (visibili solo se abilitato) */}
      {data.pickup.requestPickup && (
        <>
          {/* Data Ritiro */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Data Ritiro *</h3>
                <p className="text-sm text-gray-500">Seleziona quando il corriere deve passare</p>
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="pickup-date" className="text-sm">
                Data di ritiro desiderata
              </Label>
              <Input
                id="pickup-date"
                type="date"
                value={localDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-2">
                Il ritiro può essere prenotato da domani fino a 30 giorni
              </p>
            </div>
          </div>

          {/* Fascia Oraria */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Fascia Oraria *</h3>
                <p className="text-sm text-gray-500">Scegli quando preferisci il ritiro</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              {PICKUP_TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTimeSelect(option.value as 'AM' | 'PM')}
                  className={cn(
                    'flex flex-col items-center p-4 rounded-xl border-2 transition-all',
                    data.pickup.pickupTime === option.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <Clock
                    className={cn(
                      'w-8 h-8 mb-2',
                      data.pickup.pickupTime === option.value ? 'text-orange-600' : 'text-gray-400'
                    )}
                  />
                  <span
                    className={cn(
                      'font-semibold',
                      data.pickup.pickupTime === option.value ? 'text-orange-700' : 'text-gray-900'
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-sm text-gray-500 mt-1">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Riepilogo Ritiro */}
          {data.pickup.pickupDate && data.pickup.pickupTime && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-5 h-5 text-orange-600" />
                <span className="font-semibold text-orange-800">Riepilogo Ritiro</span>
              </div>
              <p className="text-sm text-orange-700">
                Il corriere passerà il <strong>{data.pickup.pickupDate}</strong> nel{' '}
                <strong>
                  {data.pickup.pickupTime === 'AM'
                    ? 'mattino (09:00-13:00)'
                    : 'pomeriggio (14:00-18:00)'}
                </strong>{' '}
                per ritirare il pacco.
              </p>
            </div>
          )}
        </>
      )}

      {/* Nessun ritiro */}
      {!data.pickup.requestPickup && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="text-center">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Nessun ritiro prenotato</p>
            <p className="text-sm text-gray-500 mt-1">
              Dovrai portare il pacco presso un punto di ritiro o in agenzia
            </p>
          </div>
        </div>
      )}

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
