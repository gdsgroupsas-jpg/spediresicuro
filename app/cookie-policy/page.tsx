/**
 * Cookie Policy - Informativa sull'Utilizzo dei Cookie
 * 
 * Pagina statica con informativa sui cookie.
 * Il contenuto è placeholder e deve essere sostituito con testi legali reali.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Cookie, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cookie Policy - SpedireSicuro.it',
  description: 'Informativa sull\'utilizzo dei cookie su SpedireSicuro.it',
};

export default function CookiePolicyPage() {
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
            <Cookie className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Cookie Policy
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Informativa sull&apos;utilizzo dei cookie
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenuto */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
          {/* Sezione 1: Cosa sono i Cookie */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Cosa sono i Cookie
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo 
                quando visiti un sito web. I cookie permettono al sito di ricordare le tue 
                azioni e preferenze per un periodo di tempo, così non devi reinserirle ogni 
                volta che torni sul sito o navighi da una pagina all&apos;altra.
              </p>
            </div>
          </section>

          {/* Sezione 2: Tipi di Cookie Utilizzati */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Tipi di Cookie Utilizzati
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
              {/* Cookie Necessari */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  2.1 Cookie Necessari (Sempre Attivi)
                </h3>
                <p>
                  Questi cookie sono essenziali per il funzionamento del sito e non possono 
                  essere disattivati. Vengono generalmente impostati solo in risposta ad azioni 
                  da te effettuate, come l&apos;impostazione delle preferenze di privacy, l&apos;accesso 
                  o la compilazione di moduli.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Esempi di utilizzo:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 ml-2">
                    <li>Memorizzazione preferenze cookie</li>
                    <li>Gestione sessione utente</li>
                    <li>Sicurezza e prevenzione frodi</li>
                    <li>Funzionalità base del sito</li>
                  </ul>
                </div>
              </div>

              {/* Cookie Analitici */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  2.2 Cookie Analitici (Opzionali)
                </h3>
                <p>
                  Questi cookie ci aiutano a capire come i visitatori interagiscono con il sito, 
                  fornendoci informazioni su aree visitate, tempo di permanenza, problemi 
                  riscontrati, ecc. Questi dati ci aiutano a migliorare il funzionamento del sito.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Servizi utilizzati:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 ml-2">
                    <li><strong>Google Analytics:</strong> Analisi traffico e comportamento utenti</li>
                    <li>Raccolta dati aggregati e anonimi</li>
                    <li>Nessun dato personale identificabile</li>
                  </ul>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Puoi gestire questi cookie dal banner cookie o dalle impostazioni del browser.
                </p>
              </div>

              {/* Cookie Marketing */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  2.3 Cookie Marketing (Opzionali)
                </h3>
                <p>
                  Questi cookie vengono utilizzati per tracciare i visitatori attraverso i siti 
                  web. L&apos;intento è mostrare annunci rilevanti e coinvolgenti per il singolo 
                  utente e quindi più preziosi per editori e inserzionisti di terze parti.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Servizi utilizzati:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 ml-2">
                    <li><strong>Facebook Pixel:</strong> Tracciamento conversioni e remarketing</li>
                    <li><strong>Google Ads:</strong> Pubblicità mirata e remarketing</li>
                    <li>Tracciamento interazioni con annunci</li>
                  </ul>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Questi cookie richiedono il tuo consenso esplicito. Puoi gestirli dal banner cookie.
                </p>
              </div>
            </div>
          </section>

          {/* Sezione 3: Durata dei Cookie */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Durata dei Cookie
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>I cookie possono essere:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Cookie di sessione:</strong> Temporanei, vengono eliminati quando chiudi il browser</li>
                <li><strong>Cookie persistenti:</strong> Rimangono sul dispositivo per un periodo definito o fino alla cancellazione manuale</li>
              </ul>
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Durata tipica:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 ml-2">
                  <li>Cookie necessari: Durata sessione o 1 anno</li>
                  <li>Cookie analitici: 2 anni (Google Analytics)</li>
                  <li>Cookie marketing: 90 giorni - 2 anni (dipende dal servizio)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Sezione 4: Gestione Cookie */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Come Gestire i Cookie
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  4.1 Banner Cookie
                </h3>
                <p>
                  Al primo accesso, vedrai un banner che ti permette di:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Accettare tutti i cookie</li>
                  <li>Rifiutare i cookie opzionali</li>
                  <li>Personalizzare le preferenze per categoria</li>
                </ul>
                <p className="mt-3">
                  Puoi modificare le tue preferenze in qualsiasi momento cliccando sul banner 
                  cookie o visitando questa pagina.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  4.2 Impostazioni Browser
                </h3>
                <p>
                  Puoi anche gestire i cookie direttamente dalle impostazioni del browser:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Chrome:</strong> Impostazioni → Privacy e sicurezza → Cookie</li>
                  <li><strong>Firefox:</strong> Opzioni → Privacy e sicurezza → Cookie</li>
                  <li><strong>Safari:</strong> Preferenze → Privacy → Cookie</li>
                  <li><strong>Edge:</strong> Impostazioni → Privacy → Cookie</li>
                </ul>
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                  ⚠️ <strong>Nota:</strong> Disabilitare i cookie necessari potrebbe compromettere 
                  il funzionamento del sito.
                </p>
              </div>
            </div>
          </section>

          {/* Sezione 5: Cookie di Terze Parti */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Cookie di Terze Parti
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Alcuni cookie sono impostati da servizi di terze parti. Questi cookie sono 
                soggetti alle rispettive privacy policy:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>Google Analytics:</strong>{' '}
                  <a 
                    href="https://policies.google.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Privacy Policy Google
                  </a>
                </li>
                <li>
                  <strong>Facebook Pixel:</strong>{' '}
                  <a 
                    href="https://www.facebook.com/privacy/explanation" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Privacy Policy Facebook
                  </a>
                </li>
              </ul>
            </div>
          </section>

          {/* Sezione 6: Aggiornamenti */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Aggiornamenti alla Cookie Policy
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Ci riserviamo il diritto di modificare questa Cookie Policy in qualsiasi momento. 
                Le modifiche saranno pubblicate su questa pagina. Ti consigliamo di consultare 
                periodicamente questa pagina per rimanere informato.
              </p>
              <p className="mt-4">
                <strong>Ultimo aggiornamento:</strong> [DATA]
              </p>
            </div>
          </section>

          {/* Sezione 7: Contatti */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Contatti
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                Per domande sulla Cookie Policy:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li><strong>Email:</strong> privacy@spediresicuro.it</li>
                <li><strong>Indirizzo:</strong> [DA COMPILARE]</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

