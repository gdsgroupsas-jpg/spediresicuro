/**
 * Testimonials Section
 *
 * Sezione con testimonianze e social proof
 */

'use client';

import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Marco Rossi',
    role: 'E-commerce Manager',
    company: 'Fashion Store',
    image: '👨‍💼',
    rating: 5,
    text: 'Risparmio almeno 2 ore al giorno. Prima impiegavo 10 minuti per ogni spedizione, ora 10 secondi. Incredibile!',
  },
  {
    name: 'Laura Bianchi',
    role: 'Fondatrice',
    company: 'Artisan Shop',
    image: '👩‍💼',
    rating: 5,
    text: 'Finalmente posso concentrarmi sul mio business invece che compilare form. La AI è precisa al 100%.',
  },
  {
    name: 'Giuseppe Verdi',
    role: 'Operations Director',
    company: 'Tech Startup',
    image: '👨‍💻',
    rating: 5,
    text: 'Integrato in 5 minuti. Il team lo adora. Abbiamo ridotto gli errori di spedizione del 95%.',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Cosa Dicono i Nostri Clienti
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Oltre 1.247 aziende si fidano di SpedireSicuro
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {/* Quote Icon */}
              <div className="absolute top-6 right-6 text-gray-200">
                <Quote className="w-12 h-12" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-[#FFD700] text-[#FFD700]" />
                ))}
              </div>

              {/* Testimonial Text */}
              <p className="text-gray-700 mb-6 leading-relaxed relative z-10">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF9500] flex items-center justify-center text-2xl">
                  {testimonial.image}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role} • {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FF9500] mb-2">
              1.247+
            </div>
            <div className="text-gray-600">Aziende Attive</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FF9500] mb-2">
              50K+
            </div>
            <div className="text-gray-600">Spedizioni/Mese</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FF9500] mb-2">
              4.9/5
            </div>
            <div className="text-gray-600">Valutazione Media</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FF9500] mb-2">
              10s
            </div>
            <div className="text-gray-600">Tempo Medio</div>
          </div>
        </div>
      </div>
    </section>
  );
}
