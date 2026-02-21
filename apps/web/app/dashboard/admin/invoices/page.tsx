'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Search,
  Plus,
  Filter,
  User,
} from 'lucide-react';
import {
  getInvoices,
  issueInvoice,
  updateInvoiceStatus,
  createInvoice,
} from '@/app/actions/invoices';
import { Invoice, InvoiceStatus } from '@/types/invoices';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load Invoices
  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      setIsLoading(true);
      const data = await getInvoices(100); // Load last 100
      setInvoices(data);
    } catch (err) {
      console.error(err);
      setError('Errore caricamento fatture admin');
    } finally {
      setIsLoading(false);
    }
  }

  // Actions
  const handleIssue = async (id: string) => {
    if (
      !confirm('Sei sicuro di voler emettere questa fattura? Verrà generato il numero progressivo.')
    )
      return;

    try {
      setIsUpdating(true);
      await issueInvoice(id);
      await loadInvoices(); // Reload to see new number/status
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      setIsUpdating(true);
      await updateInvoiceStatus(id, 'paid');
      await loadInvoices();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
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
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.draft}`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-8 h-8 text-blue-600" />
            Gestione Fatture (Admin)
          </h1>
          <p className="text-gray-500 mt-1">
            Pannello di controllo per tutte le fatture emesse e in bozza.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadInvoices}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Aggiorna
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuova Fattura
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar/Filters - Placeholder */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca cliente o numero..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Filters */}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Caricamento...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Numero</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Data Emiss.</th>
                  <th className="px-6 py-4">Importo</th>
                  <th className="px-6 py-4">Stato</th>
                  <th className="px-6 py-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 group transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {inv.invoice_number || <span className="text-gray-400 italic">Bozza</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {inv.user?.company_name || inv.user?.name || 'N/A'}
                        </span>
                        <span className="text-xs text-gray-500">{inv.user?.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {inv.invoice_date
                        ? format(new Date(inv.invoice_date), 'dd MMM yyyy', { locale: it })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleIssue(inv.id)}
                            disabled={isUpdating}
                            className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            Emetti
                          </button>
                        )}
                        {inv.status === 'issued' && (
                          <button
                            onClick={() => handleMarkPaid(inv.id)}
                            disabled={isUpdating}
                            className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                          >
                            Segna Pagata
                          </button>
                        )}
                        <Link
                          href={`/dashboard/admin/invoices/${inv.id}`}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Dettagli
                        </Link>
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
