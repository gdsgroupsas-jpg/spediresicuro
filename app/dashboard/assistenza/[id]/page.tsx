/**
 * Pagina Dettaglio Ticket
 * 
 * Visualizzazione completa ticket con chat e azioni
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TicketChat } from '@/components/support/TicketChat';
import { getSafeAuth } from '@/lib/safe-auth';
import { getTicketDetail } from '@/lib/actions/support';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '@/types/support';
import {
  ArrowLeft,
  Calendar,
  User,
  Package,
  FileText,
  Wallet,
  Loader2,
  Star,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

const priorityColors = {
  bassa: 'bg-gray-100 text-gray-800',
  media: 'bg-blue-100 text-blue-800',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
};

const statusColors = {
  nuovo: 'bg-purple-100 text-purple-800',
  in_lavorazione: 'bg-blue-100 text-blue-800',
  attesa_cliente: 'bg-yellow-100 text-yellow-800',
  attesa_corriere: 'bg-amber-100 text-amber-800',
  risolto: 'bg-green-100 text-green-800',
  chiuso: 'bg-gray-100 text-gray-800',
};

async function TicketDetail({ ticketId }: { ticketId: string }) {
  const auth = await getSafeAuth();
  
  if (!auth.user) {
    redirect('/login');
  }
  
  const result = await getTicketDetail(ticketId);
  
  if (!result.success || !result.data) {
    notFound();
  }
  
  const { ticket, messages, attachments } = result.data;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content - Chat */}
      <div className="lg:col-span-2">
        <Card className="h-[calc(100vh-12rem)]">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-mono text-muted-foreground">
                    {ticket.ticket_number}
                  </span>
                  <Badge className={statusColors[ticket.status]}>
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{ticket.subject}</CardTitle>
              </div>
            </div>
          </CardHeader>
          
          <TicketChat
            ticket={ticket}
            messages={messages}
            currentUserId={auth.user.id}
            isOperator={false}
          />
        </Card>
      </div>
      
      {/* Sidebar - Info */}
      <div className="space-y-4">
        {/* Dettagli Ticket */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dettagli Ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Categoria */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Categoria
              </p>
              <Badge variant="outline">
                {TICKET_CATEGORY_LABELS[ticket.category]}
              </Badge>
            </div>
            
            {/* Priorità */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Priorità
              </p>
              <Badge className={priorityColors[ticket.priority]}>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </Badge>
            </div>
            
            {/* Creato */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Creato
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDistanceToNow(new Date(ticket.created_at), {
                    addSuffix: true,
                    locale: it,
                  })}
                </span>
              </div>
            </div>
            
            {/* Assegnato a */}
            {ticket.assigned_to_user && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Assegnato a
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  <span>{ticket.assigned_to_user.name}</span>
                </div>
              </div>
            )}
            
            {/* Rating */}
            {ticket.rating && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Valutazione
                </p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < ticket.rating!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                {ticket.feedback && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {ticket.feedback}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Riferimenti */}
        {(ticket.shipment_id || ticket.invoice_id || ticket.wallet_transaction_id) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riferimenti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.shipment_id && (
                <Link
                  href={`/dashboard/spedizioni/${ticket.shipment_id}`}
                  className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
                >
                  <Package className="h-4 w-4" />
                  <span>Vai alla Spedizione</span>
                </Link>
              )}
              
              {ticket.invoice_id && (
                <Link
                  href={`/dashboard/fatture/${ticket.invoice_id}`}
                  className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>Vai alla Fattura</span>
                </Link>
              )}
              
              {ticket.wallet_transaction_id && (
                <Link
                  href="/dashboard/wallet"
                  className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Vai al Wallet</span>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Descrizione Iniziale */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descrizione Iniziale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {ticket.description}
            </p>
          </CardContent>
        </Card>
        
        {/* Allegati */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allegati ({attachments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{attachment.file_name}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="container max-w-7xl py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/assistenza">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna ai Ticket
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
        <TicketDetail ticketId={params.id} />
      </Suspense>
    </div>
  );
}
