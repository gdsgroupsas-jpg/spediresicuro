/**
 * Pagina: Dettaglio Spedizione / Modifica Ordine Importato
 * 
 * Permette di visualizzare e modificare una spedizione
 * Con supporto speciale per ordini importati (verifica e modifica)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';

interface Spedizione {
  id: string;
  mittente: {
    nome: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
  };
  destinatario: {
    nome: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
  };
  peso: number;
  dimensioni?: {
    lunghezza: number;
    larghezza: number;
    altezza: number;
  };
  tipoSpedizione: string;
  prezzoFinale: number;
  createdAt: string;
  tracking?: string;
  status?: string;
  corriere?: string;
  contrassegno?: number;
  assicurazione?: number;
  note?: string;
  imported?: boolean;
  importSource?: string;
  importPlatform?: string;
  verified?: boolean;
  order_id?: string;
  totale_ordine?: number;
  rif_mittente?: string;
  rif_destinatario?: string;
  colli?: number;
}

export default function DettaglioSpedizionePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const isImported = searchParams.get('imported') === 'true';

  const [spedizione, setSpedizione] = useState<Spedizione | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [spedizioneId, setSpedizioneId] = useState<string>('');

  // Gestisci params (può essere Promise in Next.js 15+)
  useEffect(() => {
    async function resolveParams() {
      const resolvedParams = params instanceof Promise ? await params : params;
      setSpedizioneId(resolvedParams.id);
    }
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!spedizioneId) return;
    
    async function loadSpedizione() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/spedizioni?id=${spedizioneId}`);
        if (!response.ok) {
          throw new Error('Spedizione non trovata');
        }

        const result = await response.json();
        const data = result.data;
        setSpedizione(data);
        
        // Prepara form data per modifica
        if (isEditMode) {
          setFormData({
            destinatarioNome: data.destinatario?.nome || '',
            destinatarioIndirizzo: data.destinatario?.indirizzo || '',
            destinatarioCitta: data.destinatario?.citta || '',
            destinatarioProvincia: data.destinatario?.provincia || '',
            destinatarioCap: data.destinatario?.cap || '',
            destinatarioTelefono: data.destinatario?.telefono || '',
            destinatarioEmail: data.destinatario?.email || '',
            peso: data.peso || '',
            lunghezza: data.dimensioni?.lunghezza || '',
            larghezza: data.dimensioni?.larghezza || '',
            altezza: data.dimensioni?.altezza || '',
            contrassegno: data.contrassegno || '',
            assicurazione: data.assicurazione || '',
            note: data.note || '',
            order_id: data.order_id || '',
            totale_ordine: data.totale_ordine || '',
            rif_mittente: data.rif_mittente || '',
            rif_destinatario: data.rif_destinatario || '',
            colli: data.colli || 1,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setIsLoading(false);
      }
    }

    loadSpedizione();
  }, [spedizioneId, isEditMode]);

  const handleSave = async () => {
    if (!spedizione) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/spedizioni/${spedizioneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          verified: true, // Marca come verificato dopo la modifica
        }),
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      // Ricarica spedizione
      const result = await response.json();
      setSpedizione(result.data);
      
      // Esci dalla modalità modifica
      router.push(`/dashboard/spedizioni/${spedizioneId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF9500] animate-spin" />
      </div>
    );
  }

  if (error || !spedizione) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'Spedizione non trovata'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title={isEditMode ? 'Modifica Ordine Importato' : 'Dettaglio Spedizione'}
          subtitle={isImported ? 'Verifica e modifica i dati prima dell\'export' : ''}
          showBackButton={true}
        />

        {/* Banner Ordine Importato */}
        {spedizione.imported && (
          <div className={`mb-6 p-4 rounded-xl border-2 ${
            spedizione.verified
              ? 'bg-green-50 border-green-300'
              : 'bg-purple-50 border-purple-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                spedizione.verified ? 'bg-green-100' : 'bg-purple-100'
              }`}>
                {spedizione.verified ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-purple-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {spedizione.verified ? 'Ordine Verificato' : 'Ordine Importato - Verifica Richiesta'}
                </h3>
                <p className="text-sm text-gray-600">
                  {spedizione.verified
                    ? 'Questo ordine è stato verificato e può essere esportato.'
                    : 'Verifica e modifica i dati prima di esportare. Dopo la modifica, l\'ordine sarà marcato come verificato.'}
                </p>
                {spedizione.importPlatform && (
                  <p className="text-xs text-gray-500 mt-1">
                    Importato da: <strong>{spedizione.importPlatform}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form Modifica */}
        {isEditMode ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Modifica Dati Ordine</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Destinatario */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Destinatario</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={formData.destinatarioNome || ''}
                      onChange={(e) => setFormData({ ...formData, destinatarioNome: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                    <input
                      type="text"
                      value={formData.destinatarioIndirizzo || ''}
                      onChange={(e) => setFormData({ ...formData, destinatarioIndirizzo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                      <input
                        type="text"
                        value={formData.destinatarioCap || ''}
                        onChange={(e) => setFormData({ ...formData, destinatarioCap: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                      <input
                        type="text"
                        value={formData.destinatarioCitta || ''}
                        onChange={(e) => setFormData({ ...formData, destinatarioCitta: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                      <input
                        type="text"
                        value={formData.destinatarioProvincia || ''}
                        onChange={(e) => setFormData({ ...formData, destinatarioProvincia: e.target.value.toUpperCase().slice(0, 2) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                      <input
                        type="text"
                        value={formData.destinatarioTelefono || ''}
                        onChange={(e) => setFormData({ ...formData, destinatarioTelefono: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.destinatarioEmail || ''}
                        onChange={(e) => setFormData({ ...formData, destinatarioEmail: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dettagli Pacco */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Dettagli Pacco</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.peso || ''}
                      onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lunghezza (cm)</label>
                    <input
                      type="number"
                      value={formData.lunghezza || ''}
                      onChange={(e) => setFormData({ ...formData, lunghezza: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Larghezza (cm)</label>
                    <input
                      type="number"
                      value={formData.larghezza || ''}
                      onChange={(e) => setFormData({ ...formData, larghezza: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Altezza (cm)</label>
                    <input
                      type="number"
                      value={formData.altezza || ''}
                      onChange={(e) => setFormData({ ...formData, altezza: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Opzioni */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Opzioni</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contrassegno (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.contrassegno || ''}
                      onChange={(e) => setFormData({ ...formData, contrassegno: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assicurazione (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.assicurazione || ''}
                      onChange={(e) => setFormData({ ...formData, assicurazione: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={formData.note || ''}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent text-gray-900"
                />
              </div>
            </div>

            {/* Azioni */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salva e Verifica
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Vista Dettaglio */
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Dettagli Spedizione</h2>
              {spedizione.imported && !spedizione.verified && (
                <button
                  onClick={() => router.push(`/dashboard/spedizioni/${spedizioneId}?edit=true&imported=true`)}
                  className="px-4 py-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg hover:shadow-lg transition-all"
                >
                  Verifica e Modifica
                </button>
              )}
            </div>
            
            {/* Mostra dati spedizione */}
            <div className="space-y-6">
              {/* Destinatario */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Destinatario</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-lg font-semibold text-gray-900">{spedizione.destinatario?.nome || 'N/A'}</p>
                  <p className="text-gray-700">{spedizione.destinatario?.indirizzo || 'N/A'}</p>
                  <p className="text-gray-600">
                    {spedizione.destinatario?.cap || ''} {spedizione.destinatario?.citta || ''} ({spedizione.destinatario?.provincia || ''})
                  </p>
                  {spedizione.destinatario?.telefono && (
                    <p className="text-gray-600">Tel: {spedizione.destinatario.telefono}</p>
                  )}
                  {spedizione.destinatario?.email && (
                    <p className="text-gray-600">Email: {spedizione.destinatario.email}</p>
                  )}
                </div>
              </div>

              {/* Mittente */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Mittente</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-lg font-semibold text-gray-900">{spedizione.mittente?.nome || 'N/A'}</p>
                  {spedizione.mittente?.indirizzo && (
                    <p className="text-gray-700">{spedizione.mittente.indirizzo}</p>
                  )}
                  {(spedizione.mittente?.citta || spedizione.mittente?.provincia) && (
                    <p className="text-gray-600">
                      {spedizione.mittente?.cap || ''} {spedizione.mittente?.citta || ''} ({spedizione.mittente?.provincia || ''})
                    </p>
                  )}
                </div>
              </div>

              {/* Dettagli Spedizione */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Dettagli Spedizione</h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Tracking / LDV</p>
                    <p className="text-sm font-mono text-gray-900 font-semibold">
                      {spedizione.tracking || (spedizione as any).ldv || 'N/A'}
                    </p>
                    {spedizione.imported && !spedizione.tracking && !(spedizione as any).ldv && (
                      <p className="text-xs text-orange-600 mt-1">⚠️ Tracking non disponibile</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
                    <p className="text-sm font-medium text-gray-900">{spedizione.status || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Peso</p>
                    <p className="text-sm font-medium text-gray-900">{spedizione.peso || 0} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Prezzo</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(spedizione.prezzoFinale || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order ID (se presente) */}
              {spedizione.order_id && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order ID</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-mono text-gray-900">{spedizione.order_id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

