/**
 * API Route per Creare Utente Admin Demo (SOLO PER PRODUZIONE)
 * 
 * ⚠️ ENDPOINT TEMPORANEO - Da rimuovere dopo aver creato l'utente admin
 * 
 * Questo endpoint crea l'utente admin demo in produzione.
 * Usa solo una volta, poi elimina questo file per sicurezza.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail, updateUser } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // ⚠️ SICUREZZA: Verifica che sia una richiesta autorizzata
    // In produzione, potresti voler aggiungere un token segreto
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.ADMIN_CREATE_SECRET || 'temporary-secret-change-me';
    
    if (authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json(
        { error: 'Non autorizzato. Usa: Authorization: Bearer temporary-secret-change-me' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email = 'admin@spediresicuro.it', password = 'admin123', name = 'Admin' } = body;

    // Verifica se l'utente esiste già
    const existingUser = await findUserByEmail(email);
    
    if (existingUser) {
      // Se esiste già, aggiorna il ruolo ad admin se necessario
      if (existingUser.role !== 'admin') {
        await updateUser(existingUser.id, { role: 'admin' });
        return NextResponse.json(
          {
            success: true,
            message: `Utente ${email} aggiornato a admin`,
            user: { ...existingUser, role: 'admin' },
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            success: true,
            message: `Utente admin ${email} già esistente`,
            user: existingUser,
          },
          { status: 200 }
        );
      }
    }

    // Crea nuovo utente admin
    const newUser = await createUser({
      email,
      password,
      name,
      role: 'admin',
    });

    // Rimuovi password dalla risposta
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(
      {
        success: true,
        user: userWithoutPassword,
        message: 'Utente admin creato con successo',
        warning: '⚠️ RICORDA: Elimina questo endpoint dopo aver creato l\'utente!',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Errore creazione utente admin:', error);
    
    return NextResponse.json(
      { error: 'Errore durante la creazione dell\'utente admin. Riprova.' },
      { status: 500 }
    );
  }
}

