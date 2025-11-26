import HeroSection from '@/components/hero-section'
import Header from '@/components/header'
import Footer from '@/components/footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        {/* Hero Section - Variante Brand (con colori ufficiali) */}
        <HeroSection variant="brand" />
        
        {/* 
          PROVA LE ALTRE VARIANTI:
          <HeroSection variant="energy-professional" />
          <HeroSection variant="modern-minimal" />
        */}
      </main>
      <Footer />
    </>
  )
}

