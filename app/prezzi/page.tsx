import Header from '@/components/header';
import Footer from '@/components/footer';

export default function PrezziPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Prezzi</h1>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Piano Gratuito</h2>
            <p className="text-gray-700 mb-4">
              Inizia subito senza costi. Nessuna carta di credito richiesta.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
              <li>Calcolo preventivi illimitati</li>
              <li>Gestione spedizioni</li>
              <li>Tracking automatico</li>
              <li>Supporto AI per estrazione dati</li>
            </ul>
            <p className="text-sm text-gray-500">
              I prezzi delle spedizioni vengono calcolati in base al corriere e alle dimensioni del
              pacco. Appliciamo un margine configurabile sul costo base.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
