import Header from '@/components/header'
import Footer from '@/components/footer'

export default function ComeFunzionaPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Come Funziona</h1>
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Carica lo Screenshot</h2>
              <p className="text-gray-700">
                Carica uno screenshot di WhatsApp o un'immagine con i dati della spedizione. La nostra AI legge automaticamente tutte le informazioni.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Verifica e Modifica</h2>
              <p className="text-gray-700">
                Controlla i dati estratti dall'AI e modifica se necessario. Tutto è già compilato automaticamente!
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Crea la Spedizione</h2>
              <p className="text-gray-700">
                In pochi secondi hai la spedizione pronta con etichetta e tracking. Zero form, zero stress!
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

