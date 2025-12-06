import Header from '@/components/header'
import Footer from '@/components/footer'

export default function ContattiPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Contatti</h1>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Hai bisogno di aiuto?</h2>
            <p className="text-gray-700 mb-6">
              Per assistenza o informazioni, puoi contattarci tramite:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Email</h3>
                <p className="text-gray-700">supporto@spediresicuro.it</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Orari</h3>
                <p className="text-gray-700">Lunedì - Venerdì: 9:00 - 18:00</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}






