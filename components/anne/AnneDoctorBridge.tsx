import { useEffect } from 'react';
import { useAnneContext } from '@/components/anne/AnneContext';
import { supabase } from '@/lib/supabase';

interface AnneDoctorBridgeProps {
  userRole: 'user' | 'admin' | 'superadmin';
  hasDoctorSubscription?: boolean;
}

export default function AnneDoctorBridge({ userRole, hasDoctorSubscription = false }: AnneDoctorBridgeProps) {
  const { addSuggestion } = useAnneContext();

  useEffect(() => {
    // Only show Doctor alerts to SuperAdmins or paying Resellers
    const canViewDoctorAlerts = userRole === 'superadmin' || hasDoctorSubscription;

    if (!canViewDoctorAlerts) return;

    console.log('🚑 [DOCTOR] Bridge attivo. In attesa di eventi diagnostici...');

    const channel = supabase
      .channel('doctor_diagnostics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diagnostics_events',
          filter: 'severity=eq.critical', // We prefer critical alerts
        },
        (payload: any) => {
          console.log('🚑 [DOCTOR] Nuovo evento critico rilevato:', payload);

          // Simulate "Auto-Fix" message (in reality backend should mark it as fixed)
          // For now we just alert that we detected and "handled" it.
          const eventType = payload.new.type;
          
          addSuggestion({
            id: `doctor-alert-${payload.new.id}`,
            type: 'feature', // Use 'feature' icon or add new type
            message: `👨‍⚕️ Doctor AI: Ho rilevato un problema critico (${eventType}). Sto applicando la procedura di auto-fix...`,
            page: 'global',
            priority: 'high',
            dismissible: true,
          });

          // Simulate follow-up "Fixed" message after 3 seconds
          setTimeout(() => {
             addSuggestion({
              id: `doctor-fixed-${payload.new.id}`,
              type: 'tip', // Green tip
              message: `✅ Doctor AI: Problema ${eventType} risolto con successo! Nessun impatto sui clienti.`,
              page: 'global',
              priority: 'high',
              dismissible: true,
            });
          }, 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, hasDoctorSubscription, addSuggestion]);

  return null; // Invisible component
}
