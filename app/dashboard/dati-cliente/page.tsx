'use client';

/**
 * Pagina Dati Cliente - Completamento Obbligatorio
 *
 * Questa pagina viene mostrata obbligatoriamente ai nuovi utenti
 * dopo la registrazione per completare tutti i dati anagrafici,
 * fiscali e bancari necessari.
 *
 * Utilizza il componente OnboardingWizard per un'esperienza guidata.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { User } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { OnboardingWizard, OnboardingFormData, EMPTY_FORM_DATA } from '@/components/onboarding';

export default function DatiClientePage() {
  const { data: session, status } = useSession();
  const [initialData, setInitialData] = useState<Partial<OnboardingFormData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          // Map existing data to wizard format
          const existing = data.datiCliente;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <DashboardNav
        title="Completa il tuo Profilo"
        subtitle="Compila i dati per attivare tutte le funzionalità"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
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
            }}
          />
        </div>
      </div>
    </div>
  );
}
