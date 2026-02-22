/**
 * Dashboard: Posta Workspace — Email Client per Reseller/Platform
 *
 * Inbox Gmail-style workspace-scoped.
 * FROM dinamici da workspace_email_addresses.
 * Usa useWorkspace() per workspace corrente.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Mail,
  Send,
  Inbox,
  Trash2,
  FileEdit,
  Star,
  StarOff,
  Search,
  RefreshCw,
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Loader2,
  ChevronDown,
  Menu,
  X,
  AlertCircle,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { sanitizeHtmlClient } from '@/lib/security/sanitize-html-client';

// ─── Types ───

interface Email {
  id: string;
  message_id: string | null;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_address: string[];
  cc?: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  status: string;
  read: boolean;
  starred: boolean;
  folder: string;
  created_at: string;
}

interface EmailAddress {
  id: string;
  workspace_id: string;
  email_address: string;
  display_name: string;
  is_primary: boolean;
  is_verified: boolean;
}

interface FolderConfig {
  id: string;
  label: string;
  icon: typeof Inbox;
}

const FOLDERS: FolderConfig[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Inviati', icon: Send },
  { id: 'drafts', label: 'Bozze', icon: FileEdit },
  { id: 'trash', label: 'Cestino', icon: Trash2 },
];

const POLL_INTERVAL = 30_000;
const PAGE_SIZE = 50;

// ─── Component ───

export default function PostaWorkspacePage() {
  const { workspace, isLoading: wsLoading } = useWorkspace();

  const [folder, setFolder] = useState('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedEmailFull, setSelectedEmailFull] = useState<Email | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalEmails, setTotalEmails] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Indirizzi email workspace
  const [wsAddresses, setWsAddresses] = useState<EmailAddress[]>([]);
  const [composerData, setComposerData] = useState({
    fromAddressId: '',
    to: '',
    cc: '',
    subject: '',
    body: '',
    replyToEmailId: null as string | null,
  });

  // Contact autocomplete
  const [contactSuggestions, setContactSuggestions] = useState<
    { id: string; name: string; email: string; company: string | null }[]
  >([]);
  const [activeAutoField, setActiveAutoField] = useState<'to' | 'cc' | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const workspaceId = workspace?.workspace_id;

  // ─── Carica indirizzi email workspace ───

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/email-addresses`);
        if (res.ok) {
          const data = await res.json();
          setWsAddresses(data.addresses || []);
          // Seleziona primario come default
          const primary = data.addresses?.find((a: EmailAddress) => a.is_primary);
          if (primary) {
            setComposerData((d) => ({ ...d, fromAddressId: primary.id }));
          } else if (data.addresses?.length > 0) {
            setComposerData((d) => ({ ...d, fromAddressId: data.addresses[0].id }));
          }
        }
      } catch {
        // Silenzioso — workspace potrebbe non avere indirizzi configurati
      }
    })();
  }, [workspaceId]);

  // ─── Contact autocomplete ───

  const searchContacts = useCallback((query: string, field: 'to' | 'cc') => {
    if (autoRef.current) clearTimeout(autoRef.current);
    const parts = query.split(',');
    const current = parts[parts.length - 1].trim();
    if (current.length < 2) {
      setContactSuggestions([]);
      setActiveAutoField(null);
      return;
    }
    setActiveAutoField(field);
    autoRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(current)}&limit=5`);
        const data = await res.json();
        if (res.ok) setContactSuggestions(data.results || []);
      } catch {
        /* noop */
      }
    }, 200);
  }, []);

  const selectContact = (email: string, field: 'to' | 'cc') => {
    setComposerData((d) => {
      const current = d[field];
      const parts = current
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      parts[parts.length > 0 ? parts.length - 1 : 0] = email;
      return { ...d, [field]: parts.join(', ') + ', ' };
    });
    setContactSuggestions([]);
    setActiveAutoField(null);
  };

  // ─── Fetch emails ───

  const fetchEmails = useCallback(
    async (silent = false) => {
      if (!workspaceId) return;
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ folder, limit: String(PAGE_SIZE), offset: '0' });
        if (searchQuery) params.set('search', searchQuery);

        const res = await fetch(`/api/workspaces/${workspaceId}/emails?${params}`);
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        setEmails(data.emails || []);
        setTotalEmails(data.total || 0);
        setUnreadCounts(data.unreadCounts || {});
        setPage(0);
      } catch {
        // Silenzioso
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [workspaceId, folder, searchQuery]
  );

  const loadMore = async () => {
    if (!workspaceId) return;
    const nextPage = page + 1;
    const offset = nextPage * PAGE_SIZE;
    if (offset >= totalEmails) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        folder,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/workspaces/${workspaceId}/emails?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setEmails((prev) => [...prev, ...(data.emails || [])]);
      setPage(nextPage);
    } catch {
      /* noop */
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchEmails(true);
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchEmails]);

  // ─── Operazioni email ───

  const openEmail = async (email: Email) => {
    if (!workspaceId) return;
    setSelectedEmail(email);
    setMobileView('detail');
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/emails/${email.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedEmailFull(full);
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, read: true } : e)));
        setUnreadCounts((prev) => {
          const current = prev[email.folder] || 0;
          if (!email.read && current > 0) return { ...prev, [email.folder]: current - 1 };
          return prev;
        });
      }
    } catch {
      setSelectedEmailFull(email);
    }
  };

  const toggleStar = async (email: Email, e: React.MouseEvent) => {
    if (!workspaceId) return;
    e.stopPropagation();
    const newStarred = !email.starred;
    setEmails((prev) =>
      prev.map((em) => (em.id === email.id ? { ...em, starred: newStarred } : em))
    );
    await fetch(`/api/workspaces/${workspaceId}/emails/${email.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: newStarred }),
    });
  };

  const trashEmail = async (emailId: string) => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/emails/${emailId}`, { method: 'DELETE' });
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
      setSelectedEmailFull(null);
      setMobileView('list');
    }
    setDeleteConfirm(null);
  };

  // ─── Invio email ───

  const handleSend = async () => {
    if (!workspaceId || !composerData.to || !composerData.subject || !composerData.fromAddressId)
      return;
    setSending(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddressId: composerData.fromAddressId,
          to: composerData.to
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          cc: composerData.cc
            ? composerData.cc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          subject: composerData.subject,
          bodyHtml: `<div style="font-family: sans-serif; white-space: pre-wrap;">${composerData.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`,
          bodyText: composerData.body,
          replyToEmailId: composerData.replyToEmailId,
        }),
      });

      if (res.ok) {
        resetComposer();
        fetchEmails();
      }
    } catch {
      /* noop */
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!workspaceId || !composerData.fromAddressId) return;
    if (!composerData.subject && !composerData.body && !composerData.to) return;
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddressId: composerData.fromAddressId,
          to: composerData.to
            ? composerData.to
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          subject: composerData.subject || '(bozza)',
          bodyHtml: composerData.body
            ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${composerData.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`
            : undefined,
          bodyText: composerData.body || undefined,
          isDraft: true,
        }),
      });
      if (res.ok) {
        resetComposer();
        fetchEmails();
      }
    } catch {
      /* noop */
    } finally {
      setSavingDraft(false);
    }
  };

  const resetComposer = () => {
    const primary = wsAddresses.find((a) => a.is_primary);
    setComposerOpen(false);
    setComposerData({
      fromAddressId: primary?.id || wsAddresses[0]?.id || '',
      to: '',
      cc: '',
      subject: '',
      body: '',
      replyToEmailId: null,
    });
  };

  // ─── Reply / Forward ───

  const getOurAddresses = () => wsAddresses.map((a) => a.email_address);

  const handleReply = (email: Email) => {
    const primary = wsAddresses.find((a) => a.is_primary);
    setComposerData({
      fromAddressId: primary?.id || wsAddresses[0]?.id || '',
      to: email.direction === 'inbound' ? email.from_address : email.to_address.join(', '),
      cc: '',
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Messaggio originale ---\nDa: ${email.from_address}\nData: ${new Date(email.created_at).toLocaleString('it-IT')}\n\n${email.body_text || ''}`,
      replyToEmailId: email.id,
    });
    setComposerOpen(true);
  };

  const handleReplyAll = (email: Email) => {
    const allRecipients = new Set<string>();
    if (email.direction === 'inbound') allRecipients.add(email.from_address);
    email.to_address?.forEach((a) => allRecipients.add(a));
    const ours = getOurAddresses();
    ours.forEach((a) => allRecipients.delete(a));
    const ccAddresses = (email.cc || []).filter((a) => !ours.includes(a));

    const primary = wsAddresses.find((a) => a.is_primary);
    setComposerData({
      fromAddressId: primary?.id || wsAddresses[0]?.id || '',
      to: Array.from(allRecipients).join(', '),
      cc: ccAddresses.join(', '),
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Messaggio originale ---\nDa: ${email.from_address}\nData: ${new Date(email.created_at).toLocaleString('it-IT')}\n\n${email.body_text || ''}`,
      replyToEmailId: email.id,
    });
    setComposerOpen(true);
  };

  const handleForward = (email: Email) => {
    const primary = wsAddresses.find((a) => a.is_primary);
    setComposerData({
      fromAddressId: primary?.id || wsAddresses[0]?.id || '',
      to: '',
      cc: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n--- Messaggio inoltrato ---\nDa: ${email.from_address}\nA: ${email.to_address.join(', ')}\nData: ${new Date(email.created_at).toLocaleString('it-IT')}\nOggetto: ${email.subject}\n\n${email.body_text || ''}`,
      replyToEmailId: null,
    });
    setComposerOpen(true);
  };

  // ─── Helpers ───

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const extractName = (addr: string) => {
    if (!addr) return '—';
    const match = addr.match(/^(.+?)\s*</);
    return match ? match[1].trim() : addr.split('@')[0];
  };

  const previewText = (email: Email) => {
    const text = email.body_text || '';
    return text.substring(0, 100).replace(/\n/g, ' ');
  };

  const hasMore = emails.length < totalEmails;

  // ─── Stato iniziale ───

  if (wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Nessun workspace selezionato</p>
      </div>
    );
  }

  const noAddresses = wsAddresses.length === 0;

  // ─── Render ───

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <DashboardNav
          title="Posta"
          subtitle={`Email ${workspace.workspace_name || 'Workspace'}`}
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Posta', href: '/dashboard/posta-workspace' },
          ]}
        />

        {/* Avviso se nessun indirizzo configurato */}
        {noAddresses && (
          <Card className="p-4 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Nessun indirizzo email configurato</p>
                <p className="text-sm text-amber-600">
                  Per inviare email, configura un indirizzo email nelle impostazioni del workspace.
                  Puoi comunque ricevere e leggere le email in arrivo.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Mobile folder toggle */}
        <div className="lg:hidden flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-4 h-4 mr-1" />
            {FOLDERS.find((f) => f.id === folder)?.label || 'Inbox'}
          </Button>
          {mobileView === 'detail' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMobileView('list');
                setSelectedEmail(null);
                setSelectedEmailFull(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Lista
            </Button>
          )}
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl p-4 space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">Cartelle</span>
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {!noAddresses && (
                <Button
                  className="w-full mb-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-md transition-all"
                  onClick={() => {
                    resetComposer();
                    setComposerOpen(true);
                    setSidebarOpen(false);
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" /> Nuova Email
                </Button>
              )}
              {FOLDERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFolder(f.id);
                    setSidebarOpen(false);
                    setSelectedEmail(null);
                    setSelectedEmailFull(null);
                    setMobileView('list');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${folder === f.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <f.icon className="w-4 h-4" />
                  {f.label}
                  {unreadCounts[f.id] > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {unreadCounts[f.id]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main layout: 3 panels */}
        <div className="flex gap-4 min-h-[70vh]">
          {/* Sidebar folders (desktop) */}
          <div className="hidden lg:flex flex-col w-52 shrink-0 space-y-1">
            {!noAddresses && (
              <Button
                className="w-full mb-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-md transition-all"
                onClick={() => {
                  resetComposer();
                  setComposerOpen(true);
                }}
              >
                <Mail className="w-4 h-4 mr-2" /> Nuova Email
              </Button>
            )}
            {FOLDERS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFolder(f.id);
                  setSelectedEmail(null);
                  setSelectedEmailFull(null);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${folder === f.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <f.icon className="w-4 h-4" />
                {f.label}
                {unreadCounts[f.id] > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {unreadCounts[f.id]}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Email list */}
          <Card
            className={`flex-1 overflow-hidden ${mobileView === 'detail' && selectedEmail ? 'hidden lg:flex' : 'flex'} flex-col`}
          >
            {/* Search bar */}
            <div className="p-3 border-b flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Cerca email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchEmails()}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchEmails()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Email rows */}
            <div className="flex-1 overflow-y-auto">
              {loading && emails.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Mail className="w-12 h-12 mb-3 opacity-30" />
                  <p>
                    Nessuna email in {FOLDERS.find((f) => f.id === folder)?.label?.toLowerCase()}
                  </p>
                </div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => openEmail(email)}
                    className={`flex items-center px-4 py-3 border-b cursor-pointer transition-colors hover:bg-blue-50/50 ${!email.read ? 'bg-blue-50/30 font-medium' : ''} ${selectedEmail?.id === email.id ? 'bg-blue-100/50' : ''}`}
                  >
                    <button onClick={(e) => toggleStar(email, e)} className="mr-3 shrink-0">
                      {email.starred ? (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <StarOff className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm truncate ${!email.read ? 'text-gray-900' : 'text-gray-600'}`}
                        >
                          {email.direction === 'inbound'
                            ? extractName(email.from_address)
                            : `A: ${email.to_address[0]?.split('@')[0] || '—'}`}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">
                          {formatDate(email.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 truncate">
                          {email.subject || '(nessun oggetto)'}
                        </span>
                        {email.status === 'draft' && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Bozza
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{previewText(email)}</p>
                    </div>
                  </div>
                ))
              )}
              {hasMore && (
                <div className="p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 mr-1" />
                    )}
                    Carica altre
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Detail panel */}
          <Card
            className={`flex-1 overflow-hidden ${!selectedEmail ? 'hidden lg:flex' : mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col`}
          >
            {!selectedEmailFull ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Mail className="w-16 h-16 mx-auto mb-3 opacity-20" />
                  <p>Seleziona un&apos;email per leggerla</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                      {selectedEmailFull.subject || '(nessun oggetto)'}
                    </h2>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReply(selectedEmailFull)}
                      >
                        <Reply className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReplyAll(selectedEmailFull)}
                      >
                        <ReplyAll className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleForward(selectedEmailFull)}
                      >
                        <Forward className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => setDeleteConfirm(selectedEmailFull.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>
                      <span className="font-medium">Da:</span> {selectedEmailFull.from_address}
                    </p>
                    <p>
                      <span className="font-medium">A:</span>{' '}
                      {selectedEmailFull.to_address?.join(', ')}
                    </p>
                    {(selectedEmailFull.cc?.length ?? 0) > 0 && (
                      <p>
                        <span className="font-medium">CC:</span> {selectedEmailFull.cc!.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(selectedEmailFull.created_at).toLocaleString('it-IT')}
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedEmailFull.body_html ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtmlClient(selectedEmailFull.body_html) }}
                    />
                  ) : (
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedEmailFull.body_text || '(nessun contenuto)'}
                    </pre>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Composer modal */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuova Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* FROM selector */}
            <div>
              <label className="text-sm font-medium text-gray-700">Da</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-white"
                value={composerData.fromAddressId}
                onChange={(e) => setComposerData((d) => ({ ...d, fromAddressId: e.target.value }))}
              >
                {wsAddresses
                  .filter((a) => a.is_verified)
                  .map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.display_name} &lt;{addr.email_address}&gt;
                    </option>
                  ))}
              </select>
            </div>

            {/* TO with autocomplete */}
            <div className="relative">
              <label className="text-sm font-medium text-gray-700">A</label>
              <Input
                value={composerData.to}
                onChange={(e) => {
                  setComposerData((d) => ({ ...d, to: e.target.value }));
                  searchContacts(e.target.value, 'to');
                }}
                placeholder="email@esempio.it"
                className="mt-1"
              />
              {activeAutoField === 'to' && contactSuggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {contactSuggestions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectContact(c.email, 'to')}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      <span className="font-medium">{c.name}</span>{' '}
                      <span className="text-gray-400">&lt;{c.email}&gt;</span>
                      {c.company && <span className="text-gray-400 ml-1">({c.company})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CC with autocomplete */}
            <div className="relative">
              <label className="text-sm font-medium text-gray-700">CC</label>
              <Input
                value={composerData.cc}
                onChange={(e) => {
                  setComposerData((d) => ({ ...d, cc: e.target.value }));
                  searchContacts(e.target.value, 'cc');
                }}
                placeholder="cc@esempio.it (opzionale)"
                className="mt-1"
              />
              {activeAutoField === 'cc' && contactSuggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {contactSuggestions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectContact(c.email, 'cc')}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      <span className="font-medium">{c.name}</span>{' '}
                      <span className="text-gray-400">&lt;{c.email}&gt;</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium text-gray-700">Oggetto</label>
              <Input
                value={composerData.subject}
                onChange={(e) => setComposerData((d) => ({ ...d, subject: e.target.value }))}
                placeholder="Oggetto"
                className="mt-1"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-sm font-medium text-gray-700">Messaggio</label>
              <Textarea
                value={composerData.body}
                onChange={(e) => setComposerData((d) => ({ ...d, body: e.target.value }))}
                placeholder="Scrivi il messaggio..."
                rows={10}
                className="mt-1"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSend}
                disabled={sending || !composerData.to || !composerData.subject}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Invia
              </Button>
              <Button variant="outline" onClick={handleSaveDraft} disabled={savingDraft}>
                {savingDraft ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <FileEdit className="w-4 h-4 mr-2" />
                )}
                Salva bozza
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina email</AlertDialogTitle>
            <AlertDialogDescription>
              {folder === 'trash'
                ? 'Questa email verrà eliminata definitivamente. Continuare?'
                : 'Questa email verrà spostata nel cestino. Continuare?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && trashEmail(deleteConfirm)}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
