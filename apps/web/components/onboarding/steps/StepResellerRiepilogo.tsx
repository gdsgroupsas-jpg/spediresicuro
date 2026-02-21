'use client';

/**
 * Step: Riepilogo Reseller (Solo SuperAdmin)
 *
 * Mostra il riepilogo completo dei dati inseriti per il nuovo reseller
 */

import {
  Store,
  Mail,
  Key,
  Wallet,
  CheckCircle2,
  User,
  Building2,
  MapPin,
  Phone,
  FileText,
  CreditCard,
  Package,
} from 'lucide-react';
import { useWizard } from '../WizardContext';
import { formatCurrency } from '@/lib/utils';

export function StepResellerRiepilogo() {
  const { resellerFormData } = useWizard();

  const isAzienda = resellerFormData.tipoCliente === 'azienda';
  const nomeCompleto =
    `${resellerFormData.anagrafica.nome} ${resellerFormData.anagrafica.cognome}`.trim();

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Riepilogo Reseller</h2>
        <p className="text-gray-400">Verifica tutti i dati prima di creare l&apos;account</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header Card */}
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Store className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-100">
                {isAzienda ? resellerFormData.azienda.ragioneSociale || nomeCompleto : nomeCompleto}
              </h3>
              <p className="text-purple-400">
                {isAzienda ? 'Reseller Azienda' : 'Reseller Persona Fisica'}
              </p>
              <p className="text-sm text-gray-400">{resellerFormData.email}</p>
            </div>
          </div>
        </div>

        {/* Grid con sezioni */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Account */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-purple-400" />
              <h4 className="font-medium text-gray-200">Account</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="text-gray-200">{resellerFormData.email || 'N/D'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Password:</span>
                <span className="text-gray-200 font-mono">••••••••</span>
              </div>
            </div>
          </div>

          {/* Credito */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-green-400" />
              <h4 className="font-medium text-gray-200">Credito Iniziale</h4>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(resellerFormData.initialCredit || 0)}
            </p>
          </div>

          {/* Anagrafica */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-blue-400" />
              <h4 className="font-medium text-gray-200">Anagrafica</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nome:</span>
                <span className="text-gray-200">{nomeCompleto || 'N/D'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">C.F.:</span>
                <span className="text-gray-200 font-mono text-xs">
                  {resellerFormData.anagrafica.codiceFiscale || 'N/D'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Telefono:</span>
                <span className="text-gray-200">
                  {resellerFormData.anagrafica.telefono || 'N/D'}
                </span>
              </div>
            </div>
          </div>

          {/* Indirizzo */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-red-400" />
              <h4 className="font-medium text-gray-200">Indirizzo</h4>
            </div>
            <div className="text-sm text-gray-200">
              <p>{resellerFormData.indirizzo.indirizzo || 'N/D'}</p>
              <p>
                {resellerFormData.indirizzo.cap} {resellerFormData.indirizzo.citta} (
                {resellerFormData.indirizzo.provincia})
              </p>
              <p className="text-gray-400">{resellerFormData.indirizzo.nazione}</p>
            </div>
          </div>

          {/* Dati Azienda (solo se azienda) */}
          {isAzienda && (
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-orange-400" />
                <h4 className="font-medium text-gray-200">Dati Azienda</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ragione Sociale:</span>
                  <span className="text-gray-200">
                    {resellerFormData.azienda.ragioneSociale || 'N/D'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">P.IVA:</span>
                  <span className="text-gray-200 font-mono">
                    {resellerFormData.azienda.partitaIva || 'N/D'}
                  </span>
                </div>
                {resellerFormData.azienda.codiceSDI && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">SDI:</span>
                    <span className="text-gray-200 font-mono">
                      {resellerFormData.azienda.codiceSDI}
                    </span>
                  </div>
                )}
                {resellerFormData.azienda.pec && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">PEC:</span>
                    <span className="text-gray-200 text-xs">{resellerFormData.azienda.pec}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dati Bancari (se compilati) */}
          {resellerFormData.bancari.iban && (
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <h4 className="font-medium text-gray-200">Dati Bancari</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">IBAN:</span>
                  <p className="text-gray-200 font-mono text-xs mt-1">
                    {resellerFormData.bancari.iban}
                  </p>
                </div>
                {resellerFormData.bancari.banca && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Banca:</span>
                    <span className="text-gray-200">{resellerFormData.bancari.banca}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Listino Assegnato */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-purple-400" />
              <h4 className="font-medium text-gray-200">Listino Iniziale</h4>
            </div>
            <p className="text-sm text-gray-200">
              {resellerFormData.selectedPriceListId
                ? 'Listino assegnato'
                : 'Nessun listino - configurera i propri corrieri'}
            </p>
          </div>
        </div>

        {/* Note */}
        {resellerFormData.notes && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Note Interne</p>
            <p className="text-gray-300 text-sm">{resellerFormData.notes}</p>
          </div>
        )}

        {/* Cosa succede dopo */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h4 className="font-medium text-gray-200 mb-3">Dopo la creazione:</h4>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Account reseller attivato automaticamente
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Credito wallet disponibile immediatamente
            </li>
            {resellerFormData.selectedPriceListId && (
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Potra spedire subito con il listino assegnato
              </li>
            )}
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Potra creare e gestire propri clienti
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-400">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Accesso alla dashboard reseller
            </li>
          </ul>
        </div>

        {/* Warning Password */}
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
          <p className="text-sm text-amber-300">
            Assicurati di aver salvato la password! Non sara piu visibile dopo la creazione.
          </p>
        </div>
      </div>
    </div>
  );
}
