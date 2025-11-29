'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LogoHorizontal, LogoIcon } from '@/components/logo'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 min-h-[80px]">
          {/* Logo - Desktop */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity py-2 overflow-visible">
            <div className="hidden sm:block h-16 flex items-center overflow-visible">
              <LogoHorizontal
                className="h-full w-auto max-h-[64px]"
                width={400}
                height={133}
              />
            </div>
            {/* Logo Icon - Mobile */}
            <div className="sm:hidden flex items-center">
              <LogoIcon
                className="h-12 w-12"
                width={48}
                height={48}
              />
            </div>
          </Link>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/preventivi" className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium">
              Preventivi
            </Link>
            <Link href="/come-funziona" className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium">
              Come Funziona
            </Link>
            <Link href="/prezzi" className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium">
              Prezzi
            </Link>
            <Link href="/contatti" className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium">
              Contatti
            </Link>
            <Link
              href="/login"
              className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transform transition-all duration-200 hover:scale-105"
            >
              Accedi
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-700 hover:text-[#FF9500] transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col gap-4">
              <Link
                href="/preventivi"
                className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium px-4 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Preventivi
              </Link>
              <Link
                href="/come-funziona"
                className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium px-4 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Come Funziona
              </Link>
              <Link
                href="/prezzi"
                className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium px-4 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Prezzi
              </Link>
              <Link
                href="/contatti"
                className="text-gray-700 hover:text-[#FF9500] transition-colors font-medium px-4 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Contatti
              </Link>
              <Link
                href="/login"
                className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white px-6 py-2 rounded-lg font-semibold mx-4 mt-2 block text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Accedi
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}

