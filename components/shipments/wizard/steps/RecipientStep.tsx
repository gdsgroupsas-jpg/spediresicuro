'use client';

import { MapPin, Phone, Mail, Building2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AddressFields from '@/components/ui/address-fields';
import { useShipmentWizard } from '../ShipmentWizardContext';

export function RecipientStep() {
  const { data, setDestinatario, validateStep } = useShipmentWizard();
  const validation = validateStep('recipient');

  const hasError = (field: string) => {
    return validation.errors.some((e) => e.toLowerCase().includes(field.toLowerCase()));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dati Destinatario</h2>
          <p className="text-sm text-gray-500">Chi riceve il pacco</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="recipient-nome" className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            Nome Completo *
          </Label>
          <Input
            id="recipient-nome"
            value={data.destinatario.nome}
            onChange={(e) => setDestinatario({ nome: e.target.value })}
            placeholder="Luigi Verdi"
            className={hasError('nome') ? 'border-red-500' : ''}
          />
          {hasError('nome') && (
            <p className="text-sm text-red-500">Nome deve avere almeno 2 caratteri</p>
          )}
        </div>

        {/* Azienda */}
        <div className="space-y-2">
          <Label htmlFor="recipient-company" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            Azienda (opzionale)
          </Label>
          <Input
            id="recipient-company"
            value={data.destinatario.company || ''}
            onChange={(e) => setDestinatario({ company: e.target.value })}
            placeholder="Nome Azienda Srl"
          />
        </div>

        {/* Indirizzo */}
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="recipient-indirizzo" className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            Indirizzo *
          </Label>
          <Input
            id="recipient-indirizzo"
            value={data.destinatario.indirizzo}
            onChange={(e) => setDestinatario({ indirizzo: e.target.value })}
            placeholder="Via Milano 456"
            className={hasError('indirizzo') ? 'border-red-500' : ''}
          />
          {hasError('indirizzo') && (
            <p className="text-sm text-red-500">Indirizzo deve avere almeno 5 caratteri</p>
          )}
        </div>

        {/* Città, Provincia, CAP */}
        <div className="md:col-span-2">
          <AddressFields
            cityValue={data.destinatario.citta}
            provinceValue={data.destinatario.provincia}
            postalCodeValue={data.destinatario.cap}
            onCityChange={(city: string) => setDestinatario({ citta: city })}
            onProvinceChange={(province: string) => setDestinatario({ provincia: province })}
            onPostalCodeChange={(cap: string) => setDestinatario({ cap: cap })}
            cityValid={!hasError('città')}
            provinceValid={!hasError('provincia')}
            postalCodeValid={!hasError('cap')}
          />
        </div>

        {/* Telefono */}
        <div className="space-y-2">
          <Label htmlFor="recipient-telefono" className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-500" />
            Telefono *
          </Label>
          <Input
            id="recipient-telefono"
            type="tel"
            value={data.destinatario.telefono}
            onChange={(e) => setDestinatario({ telefono: e.target.value })}
            placeholder="+39 098 765 4321"
            className={hasError('telefono') ? 'border-red-500' : ''}
          />
          {hasError('telefono') && (
            <p className="text-sm text-red-500">Telefono deve avere almeno 8 caratteri</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="recipient-email" className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500" />
            Email (opzionale)
          </Label>
          <Input
            id="recipient-email"
            type="email"
            value={data.destinatario.email}
            onChange={(e) => setDestinatario({ email: e.target.value })}
            placeholder="destinatario@email.com"
            className={hasError('email') ? 'border-red-500' : ''}
          />
          {hasError('email') && <p className="text-sm text-red-500">Email non valida</p>}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
        <p className="text-sm text-green-800">
          <strong>Suggerimento:</strong> Il telefono del destinatario e obbligatorio per la consegna
          e per eventuali contatti da parte del corriere.
        </p>
      </div>
    </div>
  );
}
