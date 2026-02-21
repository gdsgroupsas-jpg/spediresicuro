/**
 * Pagina: Dominio Email Custom Workspace
 *
 * Configurazione dominio email personalizzato per reseller.
 * 4 stati: nessun dominio → pendente → verificato → fallito.
 *
 * SECURITY:
 * - Verifica permessi tramite WorkspaceContext
 * - Solo owner può registrare/verificare/rimuovere dominio
 *
 * @module app/dashboard/workspace/email-domain
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  Mail,
  Star,
  Info,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

interface CustomDomain {
  id: string;
  workspace_id: string;
  domain_name: string;
  resend_domain_id: string | null;
  status: 'pending' | 'verified' | 'failed';
  dns_records: DnsRecord[] | null;
  region: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailAddress {
  id: string;
  email_address: string;
  display_name: string;
  is_primary: boolean;
  is_verified: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EmailDomainPage() {
  const { workspace, hasPermission } = useWorkspaceContext();
  const workspaceId = workspace?.workspace_id;
  const canManage = hasPermission('settings:edit');

  const [domain, setDomain] = useState<CustomDomain | null>(null);
  const [addresses, setAddresses] = useState<EmailAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form: registra dominio
  const [domainInput, setDomainInput] = useState('');
  const [registering, setRegistering] = useState(false);

  // Form: aggiungi email
  const [emailLocal, setEmailLocal] = useState('');
  const [emailDisplayName, setEmailDisplayName] = useState('');
  const [emailIsPrimary, setEmailIsPrimary] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);

  // Verifica DNS
  const [verifying, setVerifying] = useState(false);

  // Rimozione
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Cooldown (previene spam chiamate Resend API)
  const COOLDOWN_MS = 30_000; // 30 secondi
  const [verifyCooldown, setVerifyCooldown] = useState(false);
  const [registerCooldown, setRegisterCooldown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clipboard
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  // ─── FETCH ───

  const fetchDomain = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      setError(null);

      const [domainRes, addressesRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/custom-domain`),
        fetch(`/api/workspaces/${workspaceId}/email-addresses`),
      ]);

      if (domainRes.ok) {
        const data = await domainRes.json();
        setDomain(data.domain || null);
      }

      if (addressesRes.ok) {
        const data = await addressesRes.json();
        setAddresses(data.addresses || []);
      }
    } catch {
      setError('Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchDomain();
  }, [fetchDomain]);

  // ─── HANDLERS ───

  const handleRegister = async () => {
    if (!workspaceId || !domainInput.trim() || registerCooldown) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/custom-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName: domainInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore registrazione');
        return;
      }
      setDomain(data.domain);
      setDomainInput('');
    } catch {
      setError('Errore comunicazione');
    } finally {
      setRegistering(false);
      // Cooldown dopo registrazione (evita doppia registrazione accidentale)
      setRegisterCooldown(true);
      setTimeout(() => setRegisterCooldown(false), COOLDOWN_MS);
    }
  };

  const handleVerify = async () => {
    if (!workspaceId || verifyCooldown) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/custom-domain/verify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore verifica');
        return;
      }
      // Aggiorna stato dominio
      await fetchDomain();
    } catch {
      setError('Errore comunicazione');
    } finally {
      setVerifying(false);
      // Cooldown 30s tra verifiche (previene spam Resend API)
      setVerifyCooldown(true);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => setVerifyCooldown(false), COOLDOWN_MS);
    }
  };

  const handleRemove = async () => {
    if (!workspaceId) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/custom-domain`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Errore rimozione');
        return;
      }
      setDomain(null);
      setConfirmRemove(false);
      await fetchDomain();
    } catch {
      setError('Errore comunicazione');
    } finally {
      setRemoving(false);
    }
  };

  const handleAddEmail = async () => {
    if (!workspaceId || !emailLocal.trim() || !emailDisplayName.trim() || !domain) return;
    setAddingEmail(true);
    setError(null);
    try {
      const emailAddress = `${emailLocal.trim()}@${domain.domain_name}`;
      const res = await fetch(`/api/workspaces/${workspaceId}/email-addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAddress,
          displayName: emailDisplayName.trim(),
          isPrimary: emailIsPrimary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore creazione indirizzo');
        return;
      }
      setEmailLocal('');
      setEmailDisplayName('');
      setEmailIsPrimary(false);
      await fetchDomain();
    } catch {
      setError('Errore comunicazione');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleRemoveEmail = async (addressId: string) => {
    if (!workspaceId) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/email-addresses?addressId=${addressId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Errore rimozione indirizzo');
        return;
      }
      await fetchDomain();
    } catch {
      setError('Errore comunicazione');
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(value);
    setTimeout(() => setCopiedValue(null), 2000);
  };

  // ─── RENDER HELPERS ───

  const statusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Verificato
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Verifica fallita
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            In attesa di verifica
          </Badge>
        );
    }
  };

  // ─── LOADING / ERROR ───

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Dominio Email" showBackButton />
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN RENDER ───

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="Dominio Email"
          subtitle="Configura un dominio email personalizzato per il tuo workspace"
          showBackButton
        />
        <div className="space-y-6 mt-6">
          {/* ERROR */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* ====== STATO 1: NESSUN DOMINIO ====== */}
          {!domain && (
            <div className="bg-white border border-gray-200 rounded-xl p-8">
              <div className="text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Nessun dominio configurato
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Registra il tuo dominio per inviare email con il tuo brand. I clienti riceveranno
                  email da <strong>info@iltuodominio.it</strong> invece che da @spediresicuro.it.
                </p>

                {/* Info benefici */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-1">Vantaggi dominio custom:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                        <li>Email con il tuo brand (es. info@tuazienda.it)</li>
                        <li>Maggiore professionalita e fiducia clienti</li>
                        <li>Deliverability migliorata con DNS configurati</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="es. logisticamilano.it"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                    />
                    <button
                      onClick={handleRegister}
                      disabled={registering || registerCooldown || !domainInput.trim()}
                      className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {registering && <Loader2 className="w-4 h-4 animate-spin" />}
                      {registerCooldown ? 'Attendi...' : 'Registra Dominio'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====== STATO 2/3/4: DOMINIO PRESENTE ====== */}
          {domain && (
            <>
              {/* Card dominio */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{domain.domain_name}</h2>
                    <p className="text-gray-500 text-sm">
                      Registrato il{' '}
                      {new Date(domain.created_at).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {statusBadge(domain.status)}
                </div>

                {/* Info verifica */}
                {domain.status === 'verified' && domain.verified_at && (
                  <p className="text-green-600 text-sm mb-4">
                    Verificato il{' '}
                    {new Date(domain.verified_at).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}

                {/* DNS Records */}
                {domain.dns_records && domain.dns_records.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Record DNS da configurare
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">Tipo</th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">Nome</th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">
                              Valore
                            </th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium w-20">
                              Stato
                            </th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {domain.dns_records.map((record, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {record.type}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 font-mono text-xs text-gray-700 max-w-[200px] truncate">
                                {record.name}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs text-gray-700 max-w-[300px] truncate">
                                {record.value}
                              </td>
                              <td className="py-2 px-3">
                                {record.status === 'verified' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : record.status === 'failed' ? (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Clock className="w-4 h-4 text-yellow-500" />
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  onClick={() => copyToClipboard(record.value)}
                                  className="text-gray-400 hover:text-gray-600"
                                  title="Copia valore"
                                >
                                  {copiedValue === record.value ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {domain.status === 'pending' && (
                      <p className="text-gray-500 text-xs mt-3">
                        Configura questi record DNS nel pannello del tuo provider di dominio. La
                        propagazione DNS puo richiedere fino a 48 ore.
                      </p>
                    )}
                  </div>
                )}

                {/* Azioni */}
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                  {canManage && domain.status !== 'verified' && (
                    <button
                      onClick={handleVerify}
                      disabled={verifying || verifyCooldown}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      {verifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {verifyCooldown
                        ? 'Attendi...'
                        : domain.status === 'failed'
                          ? 'Riprova verifica'
                          : 'Verifica DNS'}
                    </button>
                  )}

                  {canManage && (
                    <>
                      {!confirmRemove ? (
                        <button
                          onClick={() => setConfirmRemove(true)}
                          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Rimuovi dominio
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-red-600">Conferma rimozione?</span>
                          <button
                            onClick={handleRemove}
                            disabled={removing}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                          >
                            {removing && <Loader2 className="w-3 h-3 animate-spin" />}
                            Conferma
                          </button>
                          <button
                            onClick={() => setConfirmRemove(false)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                          >
                            Annulla
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ====== INDIRIZZI EMAIL (solo se verificato) ====== */}
              {domain.status === 'verified' && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-orange-500" />
                    Indirizzi Email
                  </h2>
                  <p className="text-gray-500 text-sm mb-4">
                    Gestisci gli indirizzi email sul tuo dominio {domain.domain_name}
                  </p>

                  {/* Lista indirizzi */}
                  {addresses.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                              <Mail className="w-4 h-4 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {addr.display_name}
                              </p>
                              <p className="text-xs text-gray-500">{addr.email_address}</p>
                            </div>
                            {addr.is_primary && (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                <Star className="w-3 h-3 mr-1" />
                                Primario
                              </Badge>
                            )}
                          </div>
                          {canManage && (
                            <button
                              onClick={() => handleRemoveEmail(addr.id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Rimuovi indirizzo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {addresses.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm mb-4">
                      Nessun indirizzo email configurato
                    </div>
                  )}

                  {/* Form aggiungi indirizzo */}
                  {canManage && (
                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                        <Plus className="w-4 h-4" />
                        Nuovo indirizzo
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Indirizzo email
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              value={emailLocal}
                              onChange={(e) => setEmailLocal(e.target.value)}
                              placeholder="info"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                            <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-500">
                              @{domain.domain_name}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Nome visualizzato
                          </label>
                          <input
                            type="text"
                            value={emailDisplayName}
                            onChange={(e) => setEmailDisplayName(e.target.value)}
                            placeholder="Logistica Milano"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emailIsPrimary}
                            onChange={(e) => setEmailIsPrimary(e.target.checked)}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          Indirizzo primario
                        </label>
                        <button
                          onClick={handleAddEmail}
                          disabled={addingEmail || !emailLocal.trim() || !emailDisplayName.trim()}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {addingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                          <Plus className="w-4 h-4" />
                          Aggiungi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
