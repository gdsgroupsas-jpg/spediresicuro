'use client';

/**
 * Pagina Dati Cliente
 *
 * Due modalita':
 * 1. Onboarding (dati non completati): wizard guidato obbligatorio
 * 2. Revisione (dati completati): riepilogo con possibilita' di modifica
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, CheckCircle, Pencil, Building2, MapPin, CreditCard, ArrowLeft } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { OnboardingWizard, OnboardingFormData, EMPTY_FORM_DATA } from '@/components/onboarding';

export default function DatiClientePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [initialData, setInitialData] = useState<Partial<OnboardingFormData> | null>(null);
  const [rawDatiCliente, setRawDatiCliente] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datiCompletati, setDatiCompletati] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Carica dati esistenti se presenti
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      loadExistingData();
    } else if (status === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [status, session]);

  const loadExistingData = async () => {
    try {
      const response = await fetch('/api/user/dati-cliente', {
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.datiCliente) {
          const existing = data.datiCliente;
          setRawDatiCliente(existing);
          setDatiCompletati(existing.datiCompletati === true);
          setInitialData({
            tipoCliente: existing.tipoCliente || 'persona',
            anagrafica: {
              nome: existing.nome || '',
              cognome: existing.cognome || '',
              codiceFiscale: existing.codiceFiscale || '',
              dataNascita: existing.dataNascita || '',
              luogoNascita: existing.luogoNascita || '',
              sesso: existing.sesso || '',
              telefono: existing.telefono || '',
              cellulare: existing.cellulare || '',
            },
            indirizzo: {
              indirizzo: existing.indirizzo || '',
              citta: existing.citta || '',
              provincia: existing.provincia || '',
              cap: existing.cap || '',
              nazione: existing.nazione || 'Italia',
            },
            azienda: {
              ragioneSociale: existing.ragioneSociale || '',
              partitaIva: existing.partitaIva || '',
              codiceSDI: existing.codiceSDI || '',
              pec: existing.pec || '',
              indirizzoFatturazione: existing.indirizzoFatturazione || '',
              cittaFatturazione: existing.cittaFatturazione || '',
              provinciaFatturazione: existing.provinciaFatturazione || '',
              capFatturazione: existing.capFatturazione || '',
            },
            bancari: {
              iban: existing.iban || '',
              banca: existing.banca || '',
              nomeIntestatario: existing.nomeIntestatario || '',
            },
            documento: {
              tipoDocumento: existing.documentoIdentita?.tipo || '',
              numeroDocumento: existing.documentoIdentita?.numero || '',
              rilasciatoDa: existing.documentoIdentita?.rilasciatoDa || '',
              dataRilascio: existing.documentoIdentita?.dataRilascio || '',
              dataScadenza: existing.documentoIdentita?.dataScadenza || '',
            },
          });
        }
      }
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 p-8 rounded-2xl shadow-xl border border-gray-700 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#FACC15] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-300 font-medium">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-[#FACC15]/30 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#FACC15]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-[#FACC15]" />
          </div>
          <h2 className="text-xl font-bold text-gray-100 mb-2">Sessione in corso...</h2>
          <p className="text-gray-400 mb-6">
            La tua sessione è in fase di sincronizzazione. Se la pagina non cambia, prova a
            ricaricare.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-[#FACC15] hover:bg-[#FBBF24] text-black font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Ricarica Pagina
          </button>
        </div>
      </div>
    );
  }

  // Se dati completati e NON in edit mode → mostra riepilogo
  if (datiCompletati && !editMode && rawDatiCliente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <DashboardNav title="Il Mio Profilo" subtitle="Riepilogo dati cliente" />

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header con status */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Torna alla Dashboard</span>
            </button>
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#FF9500] text-black font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <Pencil className="w-4 h-4" />
              Modifica Dati
            </button>
          </div>

          {/* Status completamento */}
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Profilo completato</p>
              {rawDatiCliente.dataCompletamento && (
                <p className="text-xs text-emerald-400/70">
                  Completato il{' '}
                  {new Date(rawDatiCliente.dataCompletamento).toLocaleDateString('it-IT')}
                </p>
              )}
            </div>
          </div>

          {/* Dati Anagrafici */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[#FACC15]" />
              <h3 className="text-lg font-semibold text-white">Dati Anagrafici</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField label="Nome" value={rawDatiCliente.nome} />
              <ProfileField label="Cognome" value={rawDatiCliente.cognome} />
              <ProfileField label="Codice Fiscale" value={rawDatiCliente.codiceFiscale} />
              <ProfileField
                label="Data di Nascita"
                value={
                  rawDatiCliente.dataNascita
                    ? new Date(rawDatiCliente.dataNascita).toLocaleDateString('it-IT')
                    : ''
                }
              />
              <ProfileField label="Luogo di Nascita" value={rawDatiCliente.luogoNascita} />
              <ProfileField label="Email" value={rawDatiCliente.email} />
              <ProfileField label="Telefono" value={rawDatiCliente.telefono} />
              <ProfileField label="Cellulare" value={rawDatiCliente.cellulare} />
            </div>
          </div>

          {/* Indirizzo */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-[#FACC15]" />
              <h3 className="text-lg font-semibold text-white">Indirizzo</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField label="Indirizzo" value={rawDatiCliente.indirizzo} />
              <ProfileField label="Citta" value={rawDatiCliente.citta} />
              <ProfileField label="Provincia" value={rawDatiCliente.provincia} />
              <ProfileField label="CAP" value={rawDatiCliente.cap} />
              <ProfileField label="Nazione" value={rawDatiCliente.nazione} />
            </div>
          </div>

          {/* Dati Aziendali (se azienda) */}
          {rawDatiCliente.tipoCliente === 'azienda' && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-[#FACC15]" />
                <h3 className="text-lg font-semibold text-white">Dati Aziendali</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProfileField label="Ragione Sociale" value={rawDatiCliente.ragioneSociale} />
                <ProfileField label="Partita IVA" value={rawDatiCliente.partitaIva} />
                <ProfileField label="Codice SDI" value={rawDatiCliente.codiceSDI} />
                <ProfileField label="PEC" value={rawDatiCliente.pec} />
                <ProfileField
                  label="Indirizzo Fatturazione"
                  value={rawDatiCliente.indirizzoFatturazione}
                />
                <ProfileField label="Citta Fatturazione" value={rawDatiCliente.cittaFatturazione} />
                <ProfileField
                  label="Provincia Fatturazione"
                  value={rawDatiCliente.provinciaFatturazione}
                />
                <ProfileField label="CAP Fatturazione" value={rawDatiCliente.capFatturazione} />
              </div>
            </div>
          )}

          {/* Dati Bancari */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-[#FACC15]" />
              <h3 className="text-lg font-semibold text-white">Dati Bancari</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField label="IBAN" value={rawDatiCliente.iban} />
              <ProfileField label="Banca" value={rawDatiCliente.banca} />
              <ProfileField label="Intestatario" value={rawDatiCliente.nomeIntestatario} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wizard onboarding (primo accesso o modifica)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <DashboardNav
        title={editMode ? 'Modifica Profilo' : 'Completa il tuo Profilo'}
        subtitle={
          editMode ? 'Aggiorna i tuoi dati' : 'Compila i dati per attivare tutte le funzionalita'
        }
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {editMode && (
          <button
            onClick={() => setEditMode(false)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Torna al riepilogo</span>
          </button>
        )}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 md:p-8">
          <OnboardingWizard
            mode="self"
            initialData={initialData || undefined}
            onComplete={(data) => {
              console.log('✅ Onboarding completato:', data);
              // Salva in localStorage come backup
              if (typeof window !== 'undefined' && session?.user?.email) {
                localStorage.setItem(`datiCompletati_${session.user.email}`, 'true');
              }
              // Se in edit mode, torna al riepilogo
              if (editMode) {
                setEditMode(false);
                setDatiCompletati(true);
                loadExistingData();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Componente helper per campo profilo nel riepilogo
function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-200">
        {value || <span className="text-gray-600 italic">Non specificato</span>}
      </p>
    </div>
  );
}
