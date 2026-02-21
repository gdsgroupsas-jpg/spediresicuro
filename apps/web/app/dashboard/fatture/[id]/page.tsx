'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getInvoiceById } from '@/app/actions/invoices';
import { Invoice } from '@/types/invoices';
import { ArrowLeft, Download, Printer, FileText } from 'lucide-react';
import Link from 'next/link';

export default function FatturaDettaglioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getInvoiceById(id);
        setInvoice(data);
      } catch (err: any) {
        console.error(err);
        setError('Impossibile caricare la fattura.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) return <div className="p-12 text-center text-gray-500">Caricamento...</div>;
  if (error || !invoice)
    return <div className="p-12 text-center text-red-600">{error || 'Fattura non trovata'}</div>;

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('it-IT') : '-');
  const formatMoney = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <Link
        href="/dashboard/fatture"
        className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Torna alle fatture
      </Link>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Top Bar */}
        <div className="bg-gray-50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Fattura {invoice.invoice_number || '(Bozza)'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Emessa il {formatDate(invoice.invoice_date || invoice.created_at)} • Stato:{' '}
              <span className="font-semibold uppercase">{invoice.status}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4" /> Stampa
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-sm shadow-orange-200">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-8">
          {/* Intestazioni */}
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div className="flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Emittente
              </h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-bold text-gray-900 text-lg">SpediRe Sicuro s.r.l.</p>
                <p>Via Esempio 123</p>
                <p>Milano, MI 20100</p>
                <p>P.IVA: 12345678901</p>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Intestatario
              </h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-bold text-gray-900 text-lg">
                  {invoice.recipient_name || invoice.user?.company_name || invoice.user?.name}
                </p>
                <p>{invoice.recipient_address || invoice.user?.address}</p>
                <p>
                  {invoice.recipient_city} {invoice.recipient_province} {invoice.recipient_zip}
                </p>
                <p>P.IVA / CF: {invoice.recipient_vat_number || invoice.user?.vat_number || '-'}</p>
                <p>{invoice.recipient_sdi_code ? `SDI: ${invoice.recipient_sdi_code}` : ''}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo Servizi</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-3">Descrizione</th>
                    <th className="px-6 py-3 w-24 text-center">Quantità</th>
                    <th className="px-6 py-3 w-32 text-right">Prezzo Unit.</th>
                    <th className="px-6 py-3 w-24 text-right">IVA %</th>
                    <th className="px-6 py-3 w-32 text-right">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.description}</td>
                      <td className="px-6 py-4 text-center">{item.quantity}</td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {formatMoney(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">{item.tax_rate}%</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {formatMoney(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full md:w-1/3 bg-gray-50 rounded-xl p-6 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Imponibile</span>
                <span>{formatMoney(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA (22%)</span>
                <span>{formatMoney(invoice.tax_amount)}</span>
              </div>
              <div className="pt-3 border-t border-gray-200 flex justify-between text-lg font-bold text-gray-900">
                <span>Totale Fattura</span>
                <span>{formatMoney(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="pt-8 border-t border-gray-100 text-sm text-gray-500">
              <span className="font-semibold block mb-1">Note:</span>
              {invoice.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
