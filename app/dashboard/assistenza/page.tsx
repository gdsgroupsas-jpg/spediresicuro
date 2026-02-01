/**
 * Dashboard Assistenza Cliente
 * 
 * Lista ticket dell'utente con filtri e ricerca
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TicketCard } from '@/components/support/TicketCard';
import { getSafeAuth } from '@/lib/safe-auth';
import { getTickets, getSupportStats } from '@/lib/actions/support';
import { Plus, Loader2, HelpCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Assistenza - SpedireSecuro',
  description: 'Gestisci i tuoi ticket di assistenza',
};

async function TicketsList() {
  const auth = await getSafeAuth();
  
  if (!auth.user) {
    redirect('/login');
  }
  
  // Ottieni ticket dell'utente
  const ticketsResult = await getTickets({
    page: 1,
    limit: 50,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  
  // Ottieni statistiche
  const statsResult = await getSupportStats(auth.user.id);
  
  if (!ticketsResult.success) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Errore durante il caricamento dei ticket</p>
      </div>
    );
  }
  
  const { tickets, total } = ticketsResult.data;
  const stats = statsResult.success ? statsResult.data : null;
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ticket Totali
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_tickets}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aperti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.open_tickets}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Attesa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.awaiting_customer}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Risolti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.resolved_tickets}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Tickets List */}
      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nessun ticket ancora
            </h3>
            <p className="text-muted-foreground mb-6">
              Hai bisogno di assistenza? Crea il tuo primo ticket.
            </p>
            <Button asChild>
              <Link href="/dashboard/assistenza/nuovo">
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AssistenzaPage() {
  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Assistenza</h1>
          <p className="text-muted-foreground mt-1">
            Gestisci i tuoi ticket di supporto
          </p>
        </div>
        
        <Button asChild>
          <Link href="/dashboard/assistenza/nuovo">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Ticket
          </Link>
        </Button>
      </div>
      
      {/* Content */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <TicketsList />
      </Suspense>
    </div>
  );
}
