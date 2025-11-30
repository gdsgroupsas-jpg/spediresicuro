/**
 * Pagina: Impostazioni Account
 *
 * Configurazione mittente predefinito, preferenze utente, profilo
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Building2, User, Mail, Phone, MapPin } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';

// Interfaccia mittente predefinito
interface DefaultSender {
  nome: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  telefono: string;
  email?: string;
}

export default function ImpostazioniPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form mittente predefinito
  const [senderForm, setSenderForm] = useState<DefaultSender>({
    nome: '',
    indirizzo: '',
    citta: '',
    provincia: '',
    cap: '',
    telefono: '',
    email: '',
  });

  // Carica impostazioni attuali
  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);

        const response = await fetch('/api/user/settings');

        if (!response.ok) {
          throw new Error('Errore caricamento impostazioni');
        }

        const data = await response.json();

        if (data.defaultSender) {
          setSenderForm(data.defaultSender);
        }
      } catch (error) {
        console.error('Errore caricamento:', error);
        setErrorMessage('Impossibile caricare le impostazioni');
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Salva mittente predefinito
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validazione base
    if (!senderForm.nome || !senderForm.indirizzo || !senderForm.citta || !senderForm.cap) {
      setErrorMessage('Compila tutti i campi obbligatori');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          defaultSender: senderForm,
        }),
      });

      if (!response.ok) {
        throw new Error('Errore salvataggio impostazioni');
      }

      setSuccessMessage('✅ Impostazioni salvate con successo!');

      // Nascondi messaggio dopo 3 secondi
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Errore salvataggio:', error);
      setErrorMessage('❌ Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Impostazioni"
          subtitle="Configura il tuo account e le preferenze"
          showBackButton={true}
        />

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-sm text-gray-600">Caricamento impostazioni...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Messaggi */}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errorMessage}
              </div>
            )}

            {/* Card Mittente Predefinito */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Mittente Predefinito</h2>
                    <p className="text-sm text-gray-600">
                      Compila automaticamente i dati mittente in ogni nuova spedizione
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Nome/Ragione Sociale */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nome / Ragione Sociale *
                      </div>
                    </label>
                    <input
                      type="text"
                      value={senderForm.nome}
                      onChange={(e) => setSenderForm({ ...senderForm, nome: e.target.value })}
                      placeholder="es. Mario Rossi / Azienda S.r.l."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Indirizzo */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Indirizzo *
                      </div>
                    </label>
                    <input
                      type="text"
                      value={senderForm.indirizzo}
                      onChange={(e) => setSenderForm({ ...senderForm, indirizzo: e.target.value })}
                      placeholder="es. Via Roma, 123"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Città */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Città *
                    </label>
                    <input
                      type="text"
                      value={senderForm.citta}
                      onChange={(e) => setSenderForm({ ...senderForm, citta: e.target.value })}
                      placeholder="es. Milano"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Provincia */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provincia *
                    </label>
                    <input
                      type="text"
                      value={senderForm.provincia}
                      onChange={(e) => setSenderForm({ ...senderForm, provincia: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="es. MI"
                      maxLength={2}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      required
                    />
                  </div>

                  {/* CAP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CAP *
                    </label>
                    <input
                      type="text"
                      value={senderForm.cap}
                      onChange={(e) => setSenderForm({ ...senderForm, cap: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                      placeholder="es. 20100"
                      maxLength={5}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Telefono */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Telefono *
                      </div>
                    </label>
                    <input
                      type="tel"
                      value={senderForm.telefono}
                      onChange={(e) => setSenderForm({ ...senderForm, telefono: e.target.value })}
                      placeholder="es. 3331234567"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email (opzionale)
                      </div>
                    </label>
                    <input
                      type="email"
                      value={senderForm.email || ''}
                      onChange={(e) => setSenderForm({ ...senderForm, email: e.target.value })}
                      placeholder="es. info@azienda.it"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Bottone Salva */}
                <div className="mt-8 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Salvataggio...' : 'Salva Impostazioni'}
                  </button>
                </div>
              </form>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Come funziona il mittente predefinito?</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-600">
                    <li>I dati salvati saranno automaticamente precompilati in ogni nuova spedizione</li>
                    <li>Puoi comunque modificarli manualmente per spedizioni specifiche</li>
                    <li>Ogni LDV rimane tracciata al tuo account, anche se cambi il mittente</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
