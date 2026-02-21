'use client';

import { CheckCircle2, User, MapPin, Building2, CreditCard, FileText } from 'lucide-react';
import { useWizard } from '../WizardContext';

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-[#FACC15]" />
        <h3 className="font-semibold text-gray-200">{title}</h3>
      </div>
      <div className="text-sm text-gray-300 space-y-1">{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span className="font-medium text-gray-200">{value}</span>
    </div>
  );
}

export function StepRiepilogo() {
  const { formData, mode, targetUserEmail } = useWizard();
  const { tipoCliente, anagrafica, indirizzo, azienda, bancari, documento } = formData;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Riepilogo Dati</h2>
        <p className="text-gray-400">
          {mode === 'admin'
            ? `Verifica i dati per ${targetUserEmail}`
            : 'Verifica i tuoi dati prima di confermare'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tipo Cliente */}
        <SectionCard icon={User} title="Tipo Account">
          <p className="text-lg font-semibold text-[#FACC15]">
            {tipoCliente === 'persona' ? 'Persona Fisica' : 'Azienda'}
          </p>
        </SectionCard>

        {/* Dati Anagrafici */}
        <SectionCard icon={User} title="Dati Anagrafici">
          <DataRow label="Nome" value={`${anagrafica.nome} ${anagrafica.cognome}`} />
          <DataRow label="Codice Fiscale" value={anagrafica.codiceFiscale} />
          <DataRow label="Telefono" value={anagrafica.telefono} />
          {anagrafica.cellulare && <DataRow label="Cellulare" value={anagrafica.cellulare} />}
        </SectionCard>

        {/* Indirizzo */}
        <SectionCard icon={MapPin} title="Indirizzo">
          <p>{indirizzo.indirizzo}</p>
          <p>
            {indirizzo.cap} {indirizzo.citta} ({indirizzo.provincia})
          </p>
          <p>{indirizzo.nazione}</p>
        </SectionCard>

        {/* Dati Azienda */}
        {tipoCliente === 'azienda' && (
          <SectionCard icon={Building2} title="Dati Azienda">
            <DataRow label="Ragione Sociale" value={azienda.ragioneSociale} />
            <DataRow label="Partita IVA" value={azienda.partitaIva} />
            {azienda.codiceSDI && <DataRow label="Codice SDI" value={azienda.codiceSDI} />}
            {azienda.pec && <DataRow label="PEC" value={azienda.pec} />}
          </SectionCard>
        )}

        {/* Dati Bancari */}
        {(bancari.iban || bancari.banca) && (
          <SectionCard icon={CreditCard} title="Dati Bancari">
            {bancari.iban && <DataRow label="IBAN" value={bancari.iban} />}
            {bancari.banca && <DataRow label="Banca" value={bancari.banca} />}
            {bancari.nomeIntestatario && (
              <DataRow label="Intestatario" value={bancari.nomeIntestatario} />
            )}
          </SectionCard>
        )}

        {/* Documento */}
        {documento.tipoDocumento && (
          <SectionCard icon={FileText} title="Documento">
            <DataRow
              label="Tipo"
              value={
                documento.tipoDocumento === 'carta_identita'
                  ? "Carta d'Identità"
                  : documento.tipoDocumento === 'patente'
                    ? 'Patente'
                    : 'Passaporto'
              }
            />
            {documento.numeroDocumento && (
              <DataRow label="Numero" value={documento.numeroDocumento} />
            )}
            {documento.rilasciatoDa && (
              <DataRow label="Rilasciato da" value={documento.rilasciatoDa} />
            )}
          </SectionCard>
        )}
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-6">
        <p className="text-sm text-green-300 text-center">
          Cliccando &quot;Conferma e Salva&quot; i dati verranno salvati e l&apos;account sarà
          attivato.
        </p>
      </div>
    </div>
  );
}
