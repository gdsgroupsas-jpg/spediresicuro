/**
 * TicketForm Component
 * 
 * Form per creare un nuovo ticket di assistenza
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createTicket } from '@/lib/actions/support';
import { createTicketSchema, type CreateTicketSchema } from '@/lib/validations/support';
import {
  TicketCategory,
  TicketPriority,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
} from '@/types/support';
import { Loader2 } from 'lucide-react';

interface TicketFormProps {
  shipmentId?: string;
  invoiceId?: string;
  walletTransactionId?: string;
}

export function TicketForm({
  shipmentId,
  invoiceId,
  walletTransactionId,
}: TicketFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTicketSchema>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      priority: TicketPriority.MEDIA,
      shipment_id: shipmentId,
      invoice_id: invoiceId,
      wallet_transaction_id: walletTransactionId,
      tags: [],
    },
  });
  
  const category = watch('category');
  const priority = watch('priority');
  
  const onSubmit = async (data: CreateTicketSchema) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await createTicket(data);
      
      if (!result.success) {
        setError(result.error || 'Errore durante la creazione del ticket');
        return;
      }
      
      // Redirect al ticket creato
      router.push(`/dashboard/assistenza/${result.data.id}`);
    } catch (err) {
      console.error('Errore submit:', err);
      setError('Errore durante la creazione del ticket');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuovo Ticket di Assistenza</CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Categoria <span className="text-red-500">*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(value) => setValue('category', value as any)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleziona una categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-500">{errors.category.message}</p>
            )}
          </div>
          
          {/* Priorità */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priorità</Label>
            <Select
              value={priority}
              onValueChange={(value) => setValue('priority', value as any)}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-red-500">{errors.priority.message}</p>
            )}
          </div>
          
          {/* Oggetto */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Oggetto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              {...register('subject')}
              placeholder="Breve descrizione del problema"
              maxLength={200}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>
          
          {/* Descrizione */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Descrizione <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descrivi dettagliatamente il problema..."
              rows={8}
              maxLength={5000}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimo 20 caratteri, massimo 5000
            </p>
          </div>
          
          {/* Riferimenti (se presenti) */}
          {(shipmentId || invoiceId || walletTransactionId) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Riferimenti collegati:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                {shipmentId && <li>• Spedizione: {shipmentId}</li>}
                {invoiceId && <li>• Fattura: {invoiceId}</li>}
                {walletTransactionId && <li>• Transazione: {walletTransactionId}</li>}
              </ul>
            </div>
          )}
          
          {/* Errore */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {/* Azioni */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea Ticket
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Annulla
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
