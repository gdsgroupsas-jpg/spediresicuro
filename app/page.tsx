import HeroSection from '@/components/hero-section'
import Header from '@/components/header'
import Footer from '@/components/footer'
import FeaturesSection from '@/components/homepage/features-section'
import StatsSection from '@/components/homepage/stats-section'
import HowItWorks from '@/components/homepage/how-it-works'
import TestimonialsSection from '@/components/homepage/testimonials-section'
import CTASection from '@/components/homepage/cta-section'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        {/* Hero Section - Variante Brand (con colori ufficiali) */}
        <HeroSection variant="brand" />
        
        {/* Stats Section - Numeri e Risultati */}
        <StatsSection />
        
        {/* Features Section */}
        <FeaturesSection />
        
        {/* How It Works */}
        <HowItWorks />
        
        {/* Testimonials */}
        <TestimonialsSection />
        
        {/* Final CTA */}
        <CTASection />
      </main>
      <Footer />
    </>
  )
}

