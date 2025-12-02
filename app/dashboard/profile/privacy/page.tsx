/**
 * Pagina: Privacy & Dati Personali
 * 
 * Gestione diritti GDPR:
 * - Export dati (Diritto alla Portabilità - Art. 20)
 * - Cancellazione account (Diritto all'Oblio - Art. 17)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Download,
  Trash2,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { exportUserData, requestAccountDeletion } from '@/actions/privacy';

export default function PrivacyPage() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Export dati utente
  const handleExportData = async () => {
    setIsExporting(true);
    setExportError('');
    setExportSuccess(false);

    try {
      const result = await exportUserData();

      if (!result.success) {
        setExportError(result.error || 'Errore durante l&apos;export dei dati');
        return;
      }

      if (!result.data || !result.filename) {
        setExportError('Dati non disponibili');
        return;
      }

      // Crea blob e scarica file
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (error: any) {
      console.error('Errore export:', error);
        setExportError(error.message || 'Errore durante l&apos;export dei dati');
    } finally {
      setIsExporting(false);
    }
  };

  // Cancellazione account
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'ELIMINA') {
      setDeleteError('Devi digitare "ELIMINA" per confermare');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const result = await requestAccountDeletion(deleteConfirmation);

      if (!result.success) {
        setDeleteError(result.error || 'Errore durante la cancellazione');
        setIsDeleting(false);
        return;
      }

      // Successo: logout e redirect
      setTimeout(async () => {
        await signOut({ callbackUrl: '/login' });
      }, 2000);
    } catch (error: any) {
      console.error('Errore cancellazione:', error);
      setDeleteError(error.message || 'Errore durante la cancellazione');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DashboardNav
        title="Privacy & Dati Personali"
        subtitle="Gestisci i tuoi dati personali e i tuoi diritti GDPR"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Privacy', href: '/dashboard/profile/privacy' },
        ]}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header informativo */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-blue-900 mb-2">
                  I tuoi diritti GDPR
                </h2>
                <p className="text-sm text-blue-800 leading-relaxed">
                  In conformità al Regolamento Generale sulla Protezione dei Dati (GDPR), 
                  hai il diritto di accedere, esportare e cancellare i tuoi dati personali. 
                  Utilizza le funzionalità qui sotto per esercitare i tuoi diritti.
                </p>
              </div>
            </div>
          </div>

          {/* Sezione Export Dati */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <Download className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Esporta i tuoi dati (Diritto alla Portabilità)
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Scarica una copia completa di tutti i tuoi dati in formato JSON. 
                  Il file include il tuo profilo, storico spedizioni, preventivi e configurazioni.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-600">
                      <p className="font-medium mb-1">Cosa viene esportato:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Profilo utente completo</li>
                        <li>Storico spedizioni</li>
                        <li>Preventivi salvati</li>
                        <li>Configurazioni e preferenze</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {exportSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  ✅ Export completato! Il file è stato scaricato.
                </p>
              </div>
            )}

            {exportError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{exportError}</p>
              </div>
            )}

            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Esportazione in corso...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Scarica i miei dati
                </>
              )}
            </button>
          </div>

          {/* Sezione Cancellazione Account */}
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Elimina il mio account (Diritto all'Oblio)
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Puoi richiedere la cancellazione del tuo account. I tuoi dati personali 
                  verranno anonimizzati, mentre i dati delle spedizioni (necessari per 
                  tracciabilità fiscale) verranno mantenuti in forma anonima.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-medium mb-1">⚠️ Attenzione:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Questa azione è <strong>irreversibile</strong></li>
                        <li>Il tuo profilo verrà anonimizzato (email e nome rimossi)</li>
                        <li>Le spedizioni verranno anonimizzate ma mantenute per obblighi fiscali</li>
                        <li>Verrai disconnesso immediatamente dopo la cancellazione</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Elimina il mio account
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-900 mb-3">
                    Conferma la cancellazione
                  </p>
                  <p className="text-xs text-red-800 mb-4">
                    Per confermare, digita <strong className="font-mono">ELIMINA</strong> nel campo sottostante:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Digita ELIMINA"
                    className="w-full px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                    disabled={isDeleting}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmation !== 'ELIMINA'}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Eliminazione in corso...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Conferma eliminazione
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmation('');
                      setDeleteError('');
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Link pagine legali */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Documenti legali
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <h4 className="font-medium text-gray-900 mb-1">Privacy Policy</h4>
                <p className="text-xs text-gray-600">
                  Informativa sul trattamento dei dati personali
                </p>
              </a>
              <a
                href="/terms-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <h4 className="font-medium text-gray-900 mb-1">Termini e Condizioni</h4>
                <p className="text-xs text-gray-600">
                  Condizioni di utilizzo del servizio
                </p>
              </a>
              <a
                href="/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <h4 className="font-medium text-gray-900 mb-1">Cookie Policy</h4>
                <p className="text-xs text-gray-600">
                  Informativa sull&apos;utilizzo dei cookie
                </p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

