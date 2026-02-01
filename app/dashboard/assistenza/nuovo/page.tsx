/**
 * Pagina Creazione Nuovo Ticket
 */

import { TicketForm } from '@/components/support/TicketForm';
import { getSafeAuth } from '@/lib/safe-auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Nuovo Ticket - Assistenza',
  description: 'Crea un nuovo ticket di assistenza',
};

export default async function NuovoTicketPage({
  searchParams,
}: {
  searchParams: { shipment_id?: string; invoice_id?: string; wallet_transaction_id?: string };
}) {
  const auth = await getSafeAuth();
  
  if (!auth.user) {
    redirect('/login');
  }
  
  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nuovo Ticket di Assistenza</h1>
        <p className="text-muted-foreground mt-1">
          Descrivi il tuo problema e il nostro team ti risponderà al più presto
        </p>
      </div>
      
      <TicketForm
        shipmentId={searchParams.shipment_id}
        invoiceId={searchParams.invoice_id}
        walletTransactionId={searchParams.wallet_transaction_id}
      />
    </div>
  );
}
