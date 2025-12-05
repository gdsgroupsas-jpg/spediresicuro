/**
 * Dynamic Stats Section
 *
 * Sezione statistiche con:
 * - Counter animati on scroll
 * - Testimonial carousel
 * - Logo cloud dei corrieri
 */

'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Star, Quote, ChevronLeft, ChevronRight, Truck } from 'lucide-react';

// Animated Counter Hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasStarted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, hasStarted]);

  return { count, ref };
}

const stats = [
  { value: 50000, suffix: '+', label: 'Spedizioni al mese', description: 'gestite dalla nostra piattaforma' },
  { value: 1247, suffix: '+', label: 'Aziende attive', description: 'che ci hanno scelto' },
  { value: 99, suffix: '%', label: 'Clienti soddisfatti', description: 'tornerebbero a usarci' },
  { value: 10, suffix: 's', label: 'Tempo medio', description: 'per creare una spedizione' },
];

const testimonials = [
  {
    name: 'Marco Bianchi',
    role: 'E-commerce Manager',
    company: 'FashionStore.it',
    image: null,
    content: 'Da quando usiamo SpedireSicuro abbiamo ridotto del 80% il tempo dedicato alle spedizioni. L\'AI e incredibile!',
    rating: 5
  },
  {
    name: 'Giulia Rossi',
    role: 'Proprietaria',
    company: 'Bottega Artigiana',
    image: null,
    content: 'Finalmente posso concentrarmi sul mio lavoro invece di perdere ore a compilare etichette. Consigliatissimo!',
    rating: 5
  },
  {
    name: 'Alessandro Verdi',
    role: 'Operations Director',
    company: 'LogiTech Solutions',
    image: null,
    content: 'La funzione OCR da screenshot WhatsApp ha rivoluzionato il nostro workflow. I clienti sono stupiti dalla velocita.',
    rating: 5
  },
  {
    name: 'Francesca Neri',
    role: 'CEO',
    company: 'Handmade Italia',
    image: null,
    content: 'Il confronto prezzi automatico ci fa risparmiare centinaia di euro al mese. Un investimento che si ripaga da solo.',
    rating: 5
  }
];

const carriers = [
  'BRT', 'GLS', 'DHL', 'UPS', 'TNT', 'FedEx', 'Poste Italiane', 'SDA'
];

// Componente separato per ogni stat - risolve il problema degli hooks dentro .map()
function StatItem({
  stat,
  index,
  isInView
}: {
  stat: typeof stats[0];
  index: number;
  isInView: boolean;
}) {
  const { count, ref } = useCounter(stat.value, 2000 + index * 200);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="text-center"
    >
      <div className="text-5xl lg:text-6xl font-bold mb-2">
        <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
          {count.toLocaleString()}{stat.suffix}
        </span>
      </div>
      <div className="text-lg font-semibold text-white mb-1">{stat.label}</div>
      <div className="text-sm text-gray-500">{stat.description}</div>
    </motion.div>
  );
}

export default function StatsDynamic() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 bg-[#09090b] overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-24"
        >
          {stats.map((stat, index) => (
            <StatItem
              key={index}
              stat={stat}
              index={index}
              isInView={isInView}
            />
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-24"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Cosa dicono i nostri clienti
            </h3>
            <div className="flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-2 text-white font-semibold">4.9/5</span>
              <span className="text-gray-500 ml-1">su 2.847 recensioni</span>
            </div>
          </div>

          {/* Testimonial Carousel */}
          <div className="relative max-w-4xl mx-auto">
            <div className="overflow-hidden">
              <motion.div
                animate={{ x: `-${currentTestimonial * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="flex"
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-4">
                    <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 md:p-12">
                      <Quote className="w-12 h-12 text-amber-500/30 mb-6" />
                      <p className="text-xl md:text-2xl text-white leading-relaxed mb-8">
                        &quot;{testimonial.content}&quot;
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl font-bold text-white">
                          {testimonial.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{testimonial.name}</div>
                          <div className="text-sm text-gray-400">{testimonial.role} @ {testimonial.company}</div>
                        </div>
                        <div className="ml-auto flex gap-0.5">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Navigation */}
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentTestimonial(prev => (prev - 1 + testimonials.length) % testimonials.length)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      currentTestimonial === index
                        ? 'w-8 bg-amber-500'
                        : 'bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setCurrentTestimonial(prev => (prev + 1) % testimonials.length)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Carrier Logos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 uppercase tracking-wider">
              Integrato con i migliori corrieri
            </p>
          </div>

          <div className="relative overflow-hidden">
            <div className="flex animate-scroll-x">
              {[...carriers, ...carriers].map((carrier, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 mx-8 flex items-center justify-center"
                >
                  <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-xl border border-white/10">
                    <Truck className="w-5 h-5 text-amber-500" />
                    <span className="text-white/70 font-medium whitespace-nowrap">{carrier}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Custom Animation Styles */}
      <style jsx>{`
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-x {
          animation: scroll-x 20s linear infinite;
        }
      `}</style>
    </section>
  );
}
