/**
 * TicketChat Component
 * 
 * Chat per messaggi del ticket con supporto note interne
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { addMessage } from '@/lib/actions/support';
import { createMessageSchema, type CreateMessageSchema } from '@/lib/validations/support';
import type { SupportMessageWithUser, SupportTicket } from '@/types/support';
import { Loader2, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketChatProps {
  ticket: SupportTicket;
  messages: SupportMessageWithUser[];
  currentUserId: string;
  isOperator?: boolean;
}

export function TicketChat({
  ticket,
  messages,
  currentUserId,
  isOperator = false,
}: TicketChatProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateMessageSchema>({
    resolver: zodResolver(createMessageSchema),
    defaultValues: {
      ticket_id: ticket.id,
      message: '',
      is_internal: false,
    },
  });
  
  const isInternal = watch('is_internal');
  
  // Auto-scroll al nuovo messaggio
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const onSubmit = async (data: CreateMessageSchema) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await addMessage(data);
      
      if (!result.success) {
        setError(result.error || 'Errore durante l\'invio del messaggio');
        return;
      }
      
      // Reset form
      reset({
        ticket_id: ticket.id,
        message: '',
        is_internal: false,
      });
    } catch (err) {
      console.error('Errore submit:', err);
      setError('Errore durante l\'invio del messaggio');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Nessun messaggio ancora.</p>
            <p className="text-sm mt-1">Inizia la conversazione qui sotto.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = msg.user_id === currentUserId;
            const isCustomer = msg.user_role === 'customer';
            
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={cn(
                    isCustomer ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {getInitials(msg.user.name, msg.user.email)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Message */}
                <div className={cn(
                  'flex flex-col gap-1 max-w-[70%]',
                  isCurrentUser ? 'items-end' : 'items-start'
                )}>
                  {/* Header */}
                  <div className={cn(
                    'flex items-center gap-2 text-xs',
                    isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                  )}>
                    <span className="font-medium">
                      {msg.user.name || msg.user.email}
                    </span>
                    
                    {!isCustomer && (
                      <Badge variant="secondary" className="text-xs">
                        Operatore
                      </Badge>
                    )}
                    
                    {msg.is_internal && (
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                        Nota Interna
                      </Badge>
                    )}
                  </div>
                  
                  {/* Bubble */}
                  <div
                    className={cn(
                      'rounded-lg px-4 py-2',
                      msg.is_internal
                        ? 'bg-yellow-50 border border-yellow-200'
                        : isCurrentUser
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                  </div>
                  
                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="border-t bg-white p-4">
        {ticket.status === 'chiuso' ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">
              Questo ticket è stato chiuso. Non è possibile inviare nuovi messaggi.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            <Textarea
              {...register('message')}
              placeholder="Scrivi un messaggio..."
              rows={3}
              disabled={isSubmitting}
              className="resize-none"
            />
            
            {errors.message && (
              <p className="text-sm text-red-500">{errors.message.message}</p>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isOperator && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('is_internal')}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Nota interna (non visibile al cliente)
                    </span>
                  </label>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Invia
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
