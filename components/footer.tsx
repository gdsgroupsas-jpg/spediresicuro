import Link from 'next/link';
import { LogoWhite } from '@/components/logo';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrizione */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <LogoWhite width={300} height={100} className="h-10 w-auto" />
            </Link>
            <p className="text-gray-400 mb-4 max-w-md">
              SpedireSicuro.it - La piattaforma di spedizioni intelligente che usa AI per
              trasformare screenshot WhatsApp in spedizioni pronte. Zero form, zero stress.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 text-[#00B8D4]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Powered by AI</span>
            </div>
          </div>

          {/* Link Utili */}
          <div>
            <h3 className="text-white font-semibold mb-4">Link Utili</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/preventivi" className="hover:text-[#00B8D4] transition-colors">
                  Preventivi
                </Link>
              </li>
              <li>
                <Link href="/come-funziona" className="hover:text-[#00B8D4] transition-colors">
                  Come Funziona
                </Link>
              </li>
              <li>
                <Link href="/prezzi" className="hover:text-[#00B8D4] transition-colors">
                  Prezzi
                </Link>
              </li>
              <li>
                <Link href="/contatti" className="hover:text-[#00B8D4] transition-colors">
                  Contatti
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="hover:text-[#00B8D4] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/termini" className="hover:text-[#00B8D4] transition-colors">
                  Termini di Servizio
                </Link>
              </li>
              <li>
                <Link href="/cookie" className="hover:text-[#00B8D4] transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} SpedireSicuro.it - Tutti i diritti riservati</p>
        </div>
      </div>
    </footer>
  );
}
