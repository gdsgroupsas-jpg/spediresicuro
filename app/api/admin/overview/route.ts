/**
 * API Route: Admin Overview (God View)
 * 
 * Restituisce statistiche globali e dati completi per la dashboard admin:
 * - Tutti gli utenti
 * - Tutte le spedizioni
 * - Statistiche globali
 * 
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di restituire i dati
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Verifica che l'utente sia admin
    const user = await findUserByEmail(session.user.email);
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono accedere a questa risorsa.' },
        { status: 403 }
      );
    }

    // 3. Carica tutti gli utenti
    let allUsers: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data: users, error: usersError } = await supabaseAdmin
          .from('users')
          .select('id, email, name, role, provider, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (!usersError && users) {
          allUsers = users;
        }
      } catch (error) {
        console.error('Errore caricamento utenti:', error);
      }
    }

    // 4. Carica tutte le spedizioni (senza filtri user_id)
    let allShipments: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data: shipments, error: shipmentsError } = await supabaseAdmin
          .from('shipments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000); // Limita a 1000 per performance

        if (!shipmentsError && shipments) {
          allShipments = shipments;
        }
      } catch (error) {
        console.error('Errore caricamento spedizioni:', error);
      }
    }

    // 5. Calcola statistiche globali
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      // Utenti
      totalUsers: allUsers.length,
      adminUsers: allUsers.filter(u => u.role === 'admin').length,
      regularUsers: allUsers.filter(u => u.role === 'user').length,
      newUsersToday: allUsers.filter(u => {
        const created = new Date(u.created_at);
        return created >= today;
      }).length,
      newUsersThisWeek: allUsers.filter(u => {
        const created = new Date(u.created_at);
        return created >= weekAgo;
      }).length,
      newUsersThisMonth: allUsers.filter(u => {
        const created = new Date(u.created_at);
        return created >= monthAgo;
      }).length,

      // Spedizioni
      totalShipments: allShipments.length,
      shipmentsToday: allShipments.filter((s: any) => {
        const date = new Date(s.created_at);
        return date >= today;
      }).length,
      shipmentsThisWeek: allShipments.filter((s: any) => {
        const date = new Date(s.created_at);
        return date >= weekAgo;
      }).length,
      shipmentsThisMonth: allShipments.filter((s: any) => {
        const date = new Date(s.created_at);
        return date >= monthAgo;
      }).length,

      // Status spedizioni
      shipmentsPending: allShipments.filter((s: any) => 
        s.status === 'pending' || s.status === 'draft'
      ).length,
      shipmentsInTransit: allShipments.filter((s: any) => 
        s.status === 'in_transit' || s.status === 'shipped'
      ).length,
      shipmentsDelivered: allShipments.filter((s: any) => 
        s.status === 'delivered'
      ).length,
      shipmentsFailed: allShipments.filter((s: any) => 
        s.status === 'failed' || s.status === 'cancelled'
      ).length,

      // Fatturato
      totalRevenue: allShipments.reduce((sum: number, s: any) => 
        sum + (parseFloat(s.final_price || 0) || 0), 0
      ),
      revenueToday: allShipments
        .filter((s: any) => {
          const date = new Date(s.created_at);
          return date >= today;
        })
        .reduce((sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0), 0),
      revenueThisWeek: allShipments
        .filter((s: any) => {
          const date = new Date(s.created_at);
          return date >= weekAgo;
        })
        .reduce((sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0), 0),
      revenueThisMonth: allShipments
        .filter((s: any) => {
          const date = new Date(s.created_at);
          return date >= monthAgo;
        })
        .reduce((sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0), 0),
    };

    return NextResponse.json({
      success: true,
      stats,
      users: allUsers,
      shipments: allShipments.slice(0, 100), // Limita a 100 per la risposta
      totalShipments: allShipments.length,
    });

  } catch (error: any) {
    console.error('Errore API admin overview:', error);
    return NextResponse.json(
      { error: 'Errore durante il caricamento dei dati admin' },
      { status: 500 }
    );
  }
}

