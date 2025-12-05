/**
 * SpedireSicuro Homepage
 *
 * Homepage dinamica con effetti WOW:
 * - Hero con particelle e typing effect
 * - Sezioni animate on scroll
 * - Annie AI showcase
 * - Statistiche con counter animati
 * - Design premium
 */

import Header from '@/components/header';
import Footer from '@/components/footer';
import {
  HeroDynamic,
  FeaturesDynamic,
  HowItWorksDynamic,
  AnnieShowcase,
  StatsDynamic,
  CTADynamic
} from '@/components/homepage/dynamic';

export default function Home() {
  return (
    <>
      <Header />
      <main className="overflow-hidden">
        {/* Hero Section - Ultra Dynamic */}
        <HeroDynamic />

        {/* Features Section - Scroll Animated */}
        <FeaturesDynamic />

        {/* How It Works - Interactive Steps */}
        <HowItWorksDynamic />

        {/* Annie AI Showcase */}
        <AnnieShowcase />

        {/* Stats & Testimonials */}
        <StatsDynamic />

        {/* Final CTA */}
        <CTADynamic />
      </main>
      <Footer />
    </>
  );
}

