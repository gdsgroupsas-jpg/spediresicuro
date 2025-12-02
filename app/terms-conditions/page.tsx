/**
 * Termini e Condizioni - Condizioni di Utilizzo del Servizio
 * 
 * Pagina statica con termini di utilizzo.
 * Il contenuto è placeholder e deve essere sostituito con testi legali reali.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termini e Condizioni - SpedireSicuro.it',
  description: 'Condizioni di utilizzo del servizio SpedireSicuro.it',
};

export default function TermsConditionsPage() {
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
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Termini e Condizioni
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Condizioni di utilizzo del servizio
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenuto */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
          {/* Sezione 1: Accettazione */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Accettazione dei Termini
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                L'accesso e l'utilizzo del servizio SpedireSicuro.it implica l'accettazione 
                di questi Termini e Condizioni. Se non accetti questi termini, non utilizzare 
                il servizio.
              </p>
            </div>
          </section>

          {/* Sezione 2: Descrizione Servizio */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Descrizione del Servizio
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                SpedireSicuro.it è una piattaforma che consente di:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Richiedere preventivi per spedizioni</li>
                <li>Creare e gestire spedizioni</li>
                <li>Tracciare spedizioni in tempo reale</li>
                <li>Gestire resi e rimborsi</li>
                <li>Accedere a funzionalità avanzate tramite integrazioni</li>
              </ul>
            </div>
          </section>

          {/* Sezione 3: Registrazione Account */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Registrazione e Account
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  3.1 Creazione Account
                </h3>
                <p>
                  Per utilizzare il servizio, devi creare un account fornendo informazioni 
                  accurate e aggiornate. Sei responsabile della sicurezza del tuo account 
                  e della password.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  3.2 Obblighi Utente
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Fornire informazioni veritiere e accurate</li>
                  <li>Mantenere aggiornati i dati del profilo</li>
                  <li>Non condividere le credenziali di accesso</li>
                  <li>Notificare immediatamente accessi non autorizzati</li>
                  <li>Utilizzare il servizio in conformità alla legge</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Sezione 4: Utilizzo del Servizio */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Utilizzo del Servizio
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  4.1 Utilizzi Consentiti
                </h3>
                <p>
                  Puoi utilizzare il servizio per scopi legittimi e in conformità a questi termini.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  4.2 Utilizzi Vietati
                </h3>
                <p>È vietato:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Utilizzare il servizio per attività illegali</li>
                  <li>Spedire merci proibite o pericolose</li>
                  <li>Tentare di accedere a sistemi o dati non autorizzati</li>
                  <li>Interferire con il funzionamento del servizio</li>
                  <li>Utilizzare bot, script o strumenti automatizzati non autorizzati</li>
                  <li>Violare diritti di proprietà intellettuale</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Sezione 5: Prezzi e Pagamenti */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Prezzi e Pagamenti
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  5.1 Prezzi
                </h3>
                <p>
                  I prezzi delle spedizioni sono calcolati in base a peso, dimensioni, 
                  destinazione e servizio selezionato. I prezzi possono variare e sono 
                  indicati prima della conferma dell'ordine.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  5.2 Pagamenti
                </h3>
                <p>
                  I pagamenti vengono elaborati tramite provider di pagamento sicuri. 
                  Accettiamo [metodi di pagamento da specificare]. Il pagamento è dovuto 
                  al momento della conferma della spedizione.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  5.3 Rimborsi
                </h3>
                <p>
                  Le politiche di rimborso sono regolate dalle condizioni del corriere 
                  selezionato e dalle nostre politiche interne. Contattaci per richieste 
                  di rimborso.
                </p>
              </div>
            </div>
          </section>

          {/* Sezione 6: Responsabilità */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Limitazione di Responsabilità
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                SpedireSicuro.it agisce come intermediario tra te e i corrieri. 
                Non siamo responsabili per:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Ritardi, perdite o danni alle spedizioni (responsabilità del corriere)</li>
                <li>Errori nelle informazioni fornite dall'utente</li>
                <li>Interruzioni o malfunzionamenti temporanei del servizio</li>
                <li>Danni indiretti o consequenziali</li>
              </ul>
              <p className="mt-4">
                La responsabilità massima è limitata all'importo pagato per il servizio 
                specifico.
              </p>
            </div>
          </section>

          {/* Sezione 7: Proprietà Intellettuale */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Proprietà Intellettuale
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Tutti i contenuti del servizio (logo, design, software, testi) sono 
                di proprietà di SpedireSicuro.it o dei rispettivi proprietari. 
                È vietata la riproduzione senza autorizzazione.
              </p>
            </div>
          </section>

          {/* Sezione 8: Modifiche Servizio */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Modifiche al Servizio
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Ci riserviamo il diritto di modificare, sospendere o interrompere 
                il servizio in qualsiasi momento, con o senza preavviso. Non siamo 
                responsabili per eventuali danni derivanti da modifiche o interruzioni.
              </p>
            </div>
          </section>

          {/* Sezione 9: Risoluzione */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Risoluzione del Contratto
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Possiamo sospendere o chiudere il tuo account in caso di violazione 
                di questi termini. Puoi cancellare il tuo account in qualsiasi momento 
                dalla sezione{' '}
                <Link href="/dashboard/profile/privacy" className="text-blue-600 hover:underline">
                  Privacy & Dati Personali
                </Link>.
              </p>
            </div>
          </section>

          {/* Sezione 10: Legge Applicabile */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Legge Applicabile e Foro Competente
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Questi termini sono governati dalla legge italiana. Per qualsiasi 
                controversia, è competente il foro di [CITTÀ DA SPECIFICARE].
              </p>
            </div>
          </section>

          {/* Sezione 11: Modifiche Termini */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Modifiche ai Termini
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Ci riserviamo il diritto di modificare questi termini in qualsiasi momento. 
                Le modifiche saranno pubblicate su questa pagina. L'utilizzo continuato 
                del servizio dopo le modifiche implica l'accettazione dei nuovi termini.
              </p>
              <p className="mt-4">
                <strong>Ultimo aggiornamento:</strong> [DATA]
              </p>
            </div>
          </section>

          {/* Sezione 12: Contatti */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              12. Contatti
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Per domande sui termini e condizioni:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li><strong>Email:</strong> support@spediresicuro.it</li>
                <li><strong>Indirizzo:</strong> [DA COMPILARE]</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

