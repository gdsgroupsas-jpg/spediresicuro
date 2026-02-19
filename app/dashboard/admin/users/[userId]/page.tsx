/**
 * User Detail Page - SuperAdmin
 *
 * Mostra dettagli utente e permette gestione:
 * - Informazioni base
 * - Platform Fee (BYOC)
 * - Storico modifiche fee
 */

import { AiFeaturesCard } from '@/components/admin/ai-features/AiFeaturesCard';
import { ManageWalletCard } from '@/components/admin/manage-wallet-card';
import { CurrentFeeDisplay, FeeHistoryTable } from '@/components/admin/platform-fee';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';
import { getPlatformFee, getPlatformFeeHistory } from '@/lib/services/pricing/platform-fee';
import { ArrowLeft, Calendar, CreditCard, Mail, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  // Await params (Next.js 15)
  const { userId } = await params;

  // Verifica autenticazione
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  // Verifica ruolo SUPERADMIN
  const { data: adminUser } = await supabaseAdmin
    .from('users')
    .select('role, account_type')
    .eq('email', session.user.email)
    .single();

  const isSuperAdmin =
    adminUser?.account_type === 'superadmin' || adminUser?.account_type === 'admin';

  if (!isSuperAdmin) {
    redirect('/dashboard');
  }

  // Recupera dati utente
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select(
      'id, email, name, role, account_type, is_reseller, wallet_balance, created_at, provider, metadata'
    )
    .eq('id', userId)
    .single();

  if (userError || !user) {
    notFound();
  }

  // Recupera dati platform fee
  let feeData: { fee: number; isCustom: boolean; notes: string | null };
  let feeHistory: Awaited<ReturnType<typeof getPlatformFeeHistory>>;

  try {
    feeData = await getPlatformFee(userId);
    feeHistory = await getPlatformFeeHistory(userId);
  } catch (error) {
    console.error('[UserDetail] Error fetching fee data:', error);
    feeData = { fee: 0.5, isCustom: false, notes: null };
    feeHistory = [];
  }

  // Formatta data
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(dateString));
  };

  // Formatta valuta
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const userMetadata = user.metadata || {};
  const canManagePriceLists = userMetadata.ai_can_manage_pricelists === true;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/admin">
            <Button variant="ghost" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Torna a Admin Dashboard
            </Button>
          </Link>

          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.name || 'Utente'}</h1>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Informazioni Base */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-600" />
              Informazioni Utente
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500 mb-1">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>
            </div>

            {/* Ruolo */}
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500 mb-1">Ruolo</p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const { RoleBadge } = require('@/lib/utils/role-badges');
                    return (
                      <RoleBadge
                        accountType={user.account_type}
                        isReseller={user.is_reseller}
                        role={user.role}
                      />
                    );
                  })()}
                  {user.provider && user.provider !== 'credentials' && (
                    <Badge variant="outline">{user.provider}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Wallet */}
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500 mb-1">Saldo Wallet</p>
                <p className="font-medium text-gray-900">
                  {formatCurrency(user.wallet_balance || 0)}
                </p>
              </div>
            </div>

            {/* Data registrazione */}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500 mb-1">Registrato il</p>
                <p className="font-medium text-gray-900">{formatDate(user.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gestione Wallet */}
        <ManageWalletCard
          userId={userId}
          userName={user.name || user.email}
          currentBalance={user.wallet_balance || 0}
        />

        {/* AI Capabilities */}
        {user.is_reseller && (
          <AiFeaturesCard
            userId={userId}
            initialCanManagePriceLists={canManagePriceLists}
            userName={user.name || user.email}
          />
        )}

        {/* Platform Fee */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              Platform Fee (BYOC)
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Fee addebitata per ogni spedizione con modello BYOC (Bring Your Own Courier)
            </p>
          </div>

          <div className="space-y-6">
            {/* Current Fee Display */}
            <CurrentFeeDisplay
              userId={userId}
              fee={feeData.fee}
              isCustom={feeData.isCustom}
              notes={feeData.notes}
            />

            {/* Fee History */}
            <div>
              <h3 className="text-lg font-medium mb-4 text-gray-900">Storico Modifiche</h3>
              <FeeHistoryTable history={feeHistory} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
