/**
 * Privacy Policy - Informativa sul Trattamento dei Dati Personali
 * 
 * Pagina statica con informativa GDPR conforme.
 * Il contenuto è placeholder e deve essere sostituito con testi legali reali.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy - SpedireSicuro.it',
  description: 'Informativa sul trattamento dei dati personali ai sensi del GDPR',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna alla home
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Privacy Policy
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Informativa sul trattamento dei dati personali
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenuto */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
          {/* Sezione 1: Titolare del Trattamento */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Titolare del Trattamento
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Il titolare del trattamento dei dati personali è:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Ragione Sociale:</strong> [DA COMPILARE]</li>
                <li><strong>Indirizzo:</strong> [DA COMPILARE]</li>
                <li><strong>P.IVA:</strong> [DA COMPILARE]</li>
                <li><strong>Email:</strong> privacy@spediresicuro.it</li>
                <li><strong>PEC:</strong> [DA COMPILARE]</li>
              </ul>
            </div>
          </section>

          {/* Sezione 2: Dati Raccoldi */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Dati Raccoldi
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  2.1 Dati forniti direttamente dall&apos;utente
                </h3>
                <p>
                  Raccogliamo i seguenti dati quando utilizzi il nostro servizio:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Dati di identificazione (nome, cognome, email)</li>
                  <li>Dati di contatto (indirizzo, telefono)</li>
                  <li>Dati aziendali (ragione sociale, P.IVA, se applicabile)</li>
                  <li>Dati di spedizione (mittente, destinatario, dettagli pacchi)</li>
                  <li>Dati di pagamento (processati tramite provider esterni sicuri)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  2.2 Dati raccolti automaticamente
                </h3>
                <p>
                  Durante l&apos;utilizzo del servizio, raccogliamo automaticamente:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Dati di utilizzo (pagine visitate, tempo di permanenza)</li>
                  <li>Dati tecnici (indirizzo IP, tipo di browser, dispositivo)</li>
                  <li>Cookie e tecnologie simili (vedi Cookie Policy)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Sezione 3: Finalità del Trattamento */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Finalità del Trattamento
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>I dati personali vengono trattati per le seguenti finalità:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Esecuzione del contratto:</strong> Gestione spedizioni, preventivi, pagamenti</li>
                <li><strong>Adempimenti legali:</strong> Obblighi fiscali, contabili, di tracciabilità</li>
                <li><strong>Miglioramento servizio:</strong> Analisi utilizzo, ottimizzazione funzionalità</li>
                <li><strong>Marketing:</strong> Solo con consenso esplicito (comunicazioni promozionali)</li>
                <li><strong>Sicurezza:</strong> Prevenzione frodi, abusi, violazioni</li>
              </ul>
            </div>
          </section>

          {/* Sezione 4: Base Giuridica */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Base Giuridica del Trattamento
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>Il trattamento dei dati si basa su:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Consenso</strong> (Art. 6.1.a GDPR) - per cookie marketing e comunicazioni promozionali</li>
                <li><strong>Esecuzione contratto</strong> (Art. 6.1.b GDPR) - per fornitura servizio</li>
                <li><strong>Obbligo legale</strong> (Art. 6.1.c GDPR) - per adempimenti fiscali/legali</li>
                <li><strong>Legittimo interesse</strong> (Art. 6.1.f GDPR) - per sicurezza e miglioramento servizio</li>
              </ul>
            </div>
          </section>

          {/* Sezione 5: Conservazione Dati */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Periodo di Conservazione
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>I dati vengono conservati per:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Dati contabili:</strong> 10 anni (obbligo fiscale)</li>
                <li><strong>Dati spedizioni:</strong> 10 anni (tracciabilità fiscale)</li>
                <li><strong>Dati profilo:</strong> Fino alla cancellazione account</li>
                <li><strong>Dati marketing:</strong> Fino alla revoca del consenso</li>
              </ul>
            </div>
          </section>

          {/* Sezione 6: Diritti dell'Interessato */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Diritti dell'Interessato (Art. 15-22 GDPR)
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>Hai diritto a:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Accesso</strong> (Art. 15) - Ottenere copia dei tuoi dati</li>
                <li><strong>Rettifica</strong> (Art. 16) - Correggere dati inesatti</li>
                <li><strong>Cancellazione</strong> (Art. 17) - Richiedere eliminazione dati</li>
                <li><strong>Limitazione</strong> (Art. 18) - Limitare trattamento in casi specifici</li>
                <li><strong>Portabilità</strong> (Art. 20) - Ricevere dati in formato strutturato</li>
                <li><strong>Opposizione</strong> (Art. 21) - Opporti al trattamento per marketing</li>
                <li><strong>Revoca consenso</strong> - Revocare consenso in qualsiasi momento</li>
              </ul>
              <p className="mt-4">
                Per esercitare i tuoi diritti, visita la sezione{' '}
                <Link href="/dashboard/profile/privacy" className="text-blue-600 hover:underline">
                  Privacy & Dati Personali
                </Link>{' '}
                nella dashboard o contatta privacy@spediresicuro.it
              </p>
            </div>
          </section>

          {/* Sezione 7: Trasferimento Dati */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Trasferimento Dati
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                I dati possono essere trasferiti a:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provider di servizi cloud (es. Vercel, Supabase) - con garanzie adeguate</li>
                <li>Corrieri espressi - per esecuzione spedizioni</li>
                <li>Provider di pagamento - per elaborazione transazioni</li>
                <li>Servizi di analisi (solo con consenso) - Google Analytics, Facebook Pixel</li>
              </ul>
              <p className="mt-4">
                I trasferimenti verso paesi extra-UE avvengono solo con garanzie adeguate 
                (Standard Contractual Clauses, Privacy Shield, ecc.).
              </p>
            </div>
          </section>

          {/* Sezione 8: Sicurezza */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Misure di Sicurezza
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Adottiamo misure tecniche e organizzative appropriate per proteggere i dati:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Crittografia dati in transito (HTTPS/TLS)</li>
                <li>Crittografia dati a riposo</li>
                <li>Autenticazione multi-fattore per accessi amministrativi</li>
                <li>Backup regolari e disaster recovery</li>
                <li>Monitoraggio accessi e audit log</li>
              </ul>
            </div>
          </section>

          {/* Sezione 9: Modifiche */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Modifiche alla Privacy Policy
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Ci riserviamo il diritto di modificare questa informativa. Le modifiche 
                saranno pubblicate su questa pagina con data di aggiornamento. 
                Ti consigliamo di consultare periodicamente questa pagina.
              </p>
              <p className="mt-4">
                <strong>Ultimo aggiornamento:</strong> [DATA]
              </p>
            </div>
          </section>

          {/* Sezione 10: Contatti */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Contatti
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Per domande, richieste o reclami relativi al trattamento dei dati personali:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li><strong>Email:</strong> privacy@spediresicuro.it</li>
                <li><strong>PEC:</strong> [DA COMPILARE]</li>
                <li><strong>Indirizzo:</strong> [DA COMPILARE]</li>
              </ul>
              <p className="mt-4">
                Hai anche il diritto di presentare reclamo al Garante per la Protezione 
                dei Dati Personali (www.garanteprivacy.it) se ritieni che il trattamento 
                violi il GDPR.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

