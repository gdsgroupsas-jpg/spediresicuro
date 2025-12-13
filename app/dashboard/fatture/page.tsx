'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, Calendar, ArrowUpRight, Search, FileDown } from 'lucide-react';
import { getUserInvoices } from '@/app/actions/invoices';
import { Invoice } from '@/types/invoices';
import Link from 'next/link';

export default function FatturePage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setIsLoading(true);
        const data = await getUserInvoices();
        setInvoices(data);
      } catch (err) {
        console.error('Errore caricamento fatture:', err);
        setError('Impossibile caricare le fatture. Riprova più tardi.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      issued: 'bg-blue-50 text-blue-700',
      paid: 'bg-green-50 text-green-700',
      overdue: 'bg-red-50 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500 line-through',
      refunded: 'bg-purple-50 text-purple-700',
    };
    
    const labels = {
      draft: 'Bozza',
      issued: 'Emessa',
      paid: 'Pagata',
      overdue: 'Scaduta',
      cancelled: 'Annullata',
      refunded: 'Rimborsata',
    };

    const style = styles[status as keyof typeof styles] || styles.draft;
    const label = labels[status as keyof typeof styles] || status;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-orange-600" />
            Le Mie Fatture
          </h1>
          <p className="text-gray-500 mt-1">
            Visualizza e scarica le tue fatture e note di credito.
          </p>
        </div>
        {/* Placeholder per azioni o filtri futuri */}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Storico Documenti</h2>
            {/* Possibile search bar qui */}
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-gray-500">Caricamento fatture...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 bg-red-50">
            <p>{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Nessuna fattura trovata</h3>
            <p className="text-gray-500 mt-1">Non hai ancora ricevuto fatture.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-4 font-medium text-gray-500">Numero</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Data</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Scadenza</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Importo</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Stato</th>
                  <th className="px-6 py-4 font-medium text-gray-500 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {invoice.invoice_number || 'Bozza'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(invoice.invoice_date || invoice.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                         {/* Link dettaglio futuro */}
                         <Link href={`/dashboard/fatture/${invoice.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Dettagli">
                            <ArrowUpRight className="w-4 h-4" />
                         </Link>
                         {/* Download Button (Mock per ora o link reale se esiste campo url) */}
                         <button 
                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" 
                            title="Scarica PDF"
                            onClick={() => alert(`Download PDF fattura ${invoice.invoice_number} non ancora implementato.`)}
                         >
                            <Download className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
