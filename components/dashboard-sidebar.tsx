'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Truck,
  PlusCircle,
  BarChart3,
  Settings
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Spedizioni', href: '/dashboard/spedizioni', icon: Truck },
  { name: 'Nuova Spedizione', href: '/dashboard/spedizioni/nuova', icon: PlusCircle },
  { name: 'Statistiche', href: '/dashboard/statistiche', icon: BarChart3 },
  { name: 'Impostazioni', href: '/dashboard/impostazioni', icon: Settings },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <Link href="/dashboard" className="text-xl font-bold text-blue-600">
          SpedireSicuro.it
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors duration-150
                ${isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              Utente
            </p>
            <p className="text-xs text-gray-500 truncate">
              user@spediresicuro.it
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
