/**
 * TicketCard Component
 * 
 * Card per visualizzare un ticket nella lista
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  MessageSquare,
  Paperclip,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import type { SupportTicketWithRelations } from '@/types/support';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '@/types/support';

interface TicketCardProps {
  ticket: SupportTicketWithRelations;
  href?: string;
}

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

const categoryColors = {
  spedizione: 'bg-indigo-100 text-indigo-800',
  giacenza: 'bg-orange-100 text-orange-800',
  wallet: 'bg-green-100 text-green-800',
  fattura: 'bg-purple-100 text-purple-800',
  tecnico: 'bg-red-100 text-red-800',
  configurazione: 'bg-blue-100 text-blue-800',
  altro: 'bg-gray-100 text-gray-800',
};

export function TicketCard({ ticket, href }: TicketCardProps) {
  const defaultHref = `/dashboard/assistenza/${ticket.id}`;
  const linkHref = href || defaultHref;
  
  return (
    <Link href={linkHref}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono text-muted-foreground">
                  {ticket.ticket_number}
                </span>
                
                <Badge className={priorityColors[ticket.priority]}>
                  {TICKET_PRIORITY_LABELS[ticket.priority]}
                </Badge>
                
                <Badge className={statusColors[ticket.status]}>
                  {TICKET_STATUS_LABELS[ticket.status]}
                </Badge>
              </div>
              
              <h3 className="font-semibold text-lg line-clamp-1">
                {ticket.subject}
              </h3>
              
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {ticket.description}
              </p>
            </div>
            
            {ticket.priority === 'urgente' && (
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className={categoryColors[ticket.category]}>
                {TICKET_CATEGORY_LABELS[ticket.category]}
              </Badge>
              
              {ticket._count && (
                <>
                  {ticket._count.messages > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>{ticket._count.messages}</span>
                    </div>
                  )}
                  
                  {ticket._count.attachments > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span>{ticket._count.attachments}</span>
                    </div>
                  )}
                </>
              )}
              
              {ticket.assigned_to_user && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="text-xs">{ticket.assigned_to_user.name}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">
                {formatDistanceToNow(new Date(ticket.created_at), {
                  addSuffix: true,
                  locale: it,
                })}
              </span>
            </div>
          </div>
          
          {ticket.tags && ticket.tags.length > 0 && (
            <div className="flex gap-1 mt-3 flex-wrap">
              {ticket.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {ticket.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{ticket.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
