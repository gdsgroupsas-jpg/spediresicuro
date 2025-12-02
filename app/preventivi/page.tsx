import Header from '@/components/header'
import Footer from '@/components/footer'

export default function PreventiviPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Preventivi</h1>
          <p className="text-lg text-gray-600 mb-8">
            Calcola il preventivo per le tue spedizioni direttamente dalla nostra piattaforma.
          </p>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <p className="text-gray-700 mb-4">
              Per calcolare un preventivo, accedi al dashboard e usa la funzione &quot;Nuovo Preventivo&quot;.
            </p>
            <a
              href="/preventivo"
              className="inline-block bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Vai al Calcolo Preventivo
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

