'use client';

import { User, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AddressFields from '@/components/ui/address-fields';
import { useShipmentWizard } from '../ShipmentWizardContext';

export function SenderStep() {
  const { data, setMittente, validateStep } = useShipmentWizard();
  const validation = validateStep('sender');

  const hasError = (field: string) => {
    return validation.errors.some((e) => e.toLowerCase().includes(field.toLowerCase()));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dati Mittente</h2>
          <p className="text-sm text-gray-500">Chi spedisce il pacco</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="sender-nome" className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            Nome Completo *
          </Label>
          <Input
            id="sender-nome"
            value={data.mittente.nome}
            onChange={(e) => setMittente({ nome: e.target.value })}
            placeholder="Mario Rossi"
            className={hasError('nome') ? 'border-red-500' : ''}
          />
          {hasError('nome') && (
            <p className="text-sm text-red-500">Nome deve avere almeno 2 caratteri</p>
          )}
        </div>

        {/* Azienda */}
        <div className="space-y-2">
          <Label htmlFor="sender-company" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            Azienda (opzionale)
          </Label>
          <Input
            id="sender-company"
            value={data.mittente.company || ''}
            onChange={(e) => setMittente({ company: e.target.value })}
            placeholder="Nome Azienda Srl"
          />
        </div>

        {/* Indirizzo */}
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="sender-indirizzo" className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            Indirizzo *
          </Label>
          <Input
            id="sender-indirizzo"
            value={data.mittente.indirizzo}
            onChange={(e) => setMittente({ indirizzo: e.target.value })}
            placeholder="Via Roma 123"
            className={hasError('indirizzo') ? 'border-red-500' : ''}
          />
          {hasError('indirizzo') && (
            <p className="text-sm text-red-500">Indirizzo deve avere almeno 5 caratteri</p>
          )}
        </div>

        {/* Città, Provincia, CAP */}
        <div className="md:col-span-2">
          <AddressFields
            cityValue={data.mittente.citta}
            provinceValue={data.mittente.provincia}
            postalCodeValue={data.mittente.cap}
            onCityChange={(city: string) => setMittente({ citta: city })}
            onProvinceChange={(province: string) => setMittente({ provincia: province })}
            onPostalCodeChange={(cap: string) => setMittente({ cap: cap })}
            cityValid={!hasError('città')}
            provinceValid={!hasError('provincia')}
            postalCodeValid={!hasError('cap')}
          />
        </div>

        {/* Telefono */}
        <div className="space-y-2">
          <Label htmlFor="sender-telefono" className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-500" />
            Telefono *
          </Label>
          <Input
            id="sender-telefono"
            type="tel"
            value={data.mittente.telefono}
            onChange={(e) => setMittente({ telefono: e.target.value })}
            placeholder="+39 123 456 7890"
            className={hasError('telefono') ? 'border-red-500' : ''}
          />
          {hasError('telefono') && (
            <p className="text-sm text-red-500">Telefono deve avere almeno 8 caratteri</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="sender-email" className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500" />
            Email
          </Label>
          <Input
            id="sender-email"
            type="email"
            value={data.mittente.email}
            onChange={(e) => setMittente({ email: e.target.value })}
            placeholder="mittente@email.com"
            className={hasError('email') ? 'border-red-500' : ''}
          />
          {hasError('email') && <p className="text-sm text-red-500">Email non valida</p>}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <p className="text-sm text-blue-800">
          <strong>Suggerimento:</strong> I tuoi dati mittente verranno salvati automaticamente per
          le prossime spedizioni.
        </p>
      </div>
    </div>
  );
}
