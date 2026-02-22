/**
 * Dashboard: Posta — Email Client
 *
 * Full email inbox/compose for superadmin.
 * Gmail-style layout: sidebar folders, email list, detail panel.
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
} from 'lucide-react';
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

const FROM_OPTIONS = [
  'SpedireSicuro <noreply@spediresicuro.it>',
  'SpedireSicuro Amministrazione <amministrazione@spediresicuro.it>',
  'SpedireSicuro Commerciale <commerciale@spediresicuro.it>',
  'SpedireSicuro Assistenza <assistenza@spediresicuro.it>',
  'SpedireSicuro Info <info@spediresicuro.it>',
];

const POLL_INTERVAL = 30_000; // 30 seconds
const PAGE_SIZE = 50;

// ─── Component ───

export default function PostaPage() {
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
  const [composerData, setComposerData] = useState({
    from: FROM_OPTIONS[0],
    to: '',
    cc: '',
    subject: '',
    body: '',
    replyToEmailId: null as string | null,
  });
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Contact autocomplete ───
  const [contactSuggestions, setContactSuggestions] = useState<
    { id: string; name: string; email: string; company: string | null }[]
  >([]);
  const [activeAutoField, setActiveAutoField] = useState<'to' | 'cc' | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchContacts = useCallback((query: string, field: 'to' | 'cc') => {
    if (autoRef.current) clearTimeout(autoRef.current);
    // Get last email segment (after last comma)
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
      } catch {}
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
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ folder, limit: String(PAGE_SIZE), offset: '0' });
        if (searchQuery) params.set('search', searchQuery);

        const res = await fetch(`/api/email?${params}`);
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        setEmails(data.emails || []);
        setTotalEmails(data.total || 0);
        setUnreadCounts(data.unreadCounts || {});
        setPage(0);
      } catch {
        console.error('Failed to fetch emails');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [folder, searchQuery]
  );

  const loadMore = async () => {
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

      const res = await fetch(`/api/email?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setEmails((prev) => [...prev, ...(data.emails || [])]);
      setPage(nextPage);
    } catch {
      console.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // ─── Auto-refresh polling ───

  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchEmails(true);
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchEmails]);

  // ─── Select email ───

  const openEmail = async (email: Email) => {
    setSelectedEmail(email);
    setMobileView('detail');
    try {
      const res = await fetch(`/api/email/${email.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedEmailFull(full);
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, read: true } : e)));
        setUnreadCounts((prev) => {
          const current = prev[email.folder] || 0;
          if (!email.read && current > 0) {
            return { ...prev, [email.folder]: current - 1 };
          }
          return prev;
        });
      }
    } catch {
      setSelectedEmailFull(email);
    }
  };

  // ─── Toggle star ───

  const toggleStar = async (email: Email, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStarred = !email.starred;
    setEmails((prev) =>
      prev.map((em) => (em.id === email.id ? { ...em, starred: newStarred } : em))
    );
    await fetch(`/api/email/${email.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: newStarred }),
    });
  };

  // ─── Delete / Trash ───

  const trashEmail = async (emailId: string) => {
    await fetch(`/api/email/${emailId}`, { method: 'DELETE' });
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
      setSelectedEmailFull(null);
      setMobileView('list');
    }
    setDeleteConfirm(null);
  };

  // ─── Send email ───

  const handleSend = async () => {
    if (!composerData.to || !composerData.subject) return;
    setSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: composerData.from,
          to: composerData.to.split(',').map((s) => s.trim()),
          cc: composerData.cc ? composerData.cc.split(',').map((s) => s.trim()) : [],
          subject: composerData.subject,
          html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${composerData.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`,
          text: composerData.body,
          replyToEmailId: composerData.replyToEmailId,
        }),
      });

      if (res.ok) {
        setComposerOpen(false);
        setComposerData({
          from: FROM_OPTIONS[0],
          to: '',
          cc: '',
          subject: '',
          body: '',
          replyToEmailId: null,
        });
        fetchEmails();
      }
    } catch {
      console.error('Send failed');
    } finally {
      setSending(false);
    }
  };

  // ─── Save draft ───

  const handleSaveDraft = async () => {
    if (!composerData.subject && !composerData.body && !composerData.to) return;
    setSavingDraft(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: composerData.from,
          to: composerData.to ? composerData.to.split(',').map((s) => s.trim()) : [''],
          subject: composerData.subject || '(bozza)',
          html: composerData.body
            ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${composerData.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`
            : undefined,
          text: composerData.body || undefined,
          draft: true,
        }),
      });
      if (res.ok) {
        setComposerOpen(false);
        setComposerData({
          from: FROM_OPTIONS[0],
          to: '',
          cc: '',
          subject: '',
          body: '',
          replyToEmailId: null,
        });
        fetchEmails();
      }
    } catch {
      console.error('Save draft failed');
    } finally {
      setSavingDraft(false);
    }
  };

  // ─── Reply ───

  const handleReply = (email: Email) => {
    setComposerData({
      from: FROM_OPTIONS[0],
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
    if (email.direction === 'inbound') {
      allRecipients.add(email.from_address);
    }
    email.to_address?.forEach((a) => allRecipients.add(a));
    // Remove our own addresses
    const ours = FROM_OPTIONS.map((o) => {
      const m = o.match(/<(.+)>/);
      return m ? m[1] : '';
    });
    ours.forEach((a) => allRecipients.delete(a));

    const ccAddresses = (email.cc || []).filter((a) => !ours.includes(a));

    setComposerData({
      from: FROM_OPTIONS[0],
      to: Array.from(allRecipients).join(', '),
      cc: ccAddresses.join(', '),
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Messaggio originale ---\nDa: ${email.from_address}\nData: ${new Date(email.created_at).toLocaleString('it-IT')}\n\n${email.body_text || ''}`,
      replyToEmailId: email.id,
    });
    setComposerOpen(true);
  };

  const handleForward = (email: Email) => {
    setComposerData({
      from: FROM_OPTIONS[0],
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

  // ─── Render ───

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <DashboardNav
          title="Posta"
          subtitle="Gestione email @spediresicuro.it"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Posta', href: '/dashboard/posta' },
          ]}
        />

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
              <ArrowLeft className="w-4 h-4 mr-1" />
              Lista
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
              <Button
                className="w-full mb-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:shadow-md transition-all"
                onClick={() => {
                  setComposerData({
                    from: FROM_OPTIONS[0],
                    to: '',
                    cc: '',
                    subject: '',
                    body: '',
                    replyToEmailId: null,
                  });
                  setComposerOpen(true);
                  setSidebarOpen(false);
                }}
              >
                <Mail className="w-4 h-4 mr-2" />
                Componi
              </Button>
              {FOLDERS.map((f) => {
                const Icon = f.icon;
                const isActive = folder === f.id;
                const unread = unreadCounts[f.id] || 0;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFolder(f.id);
                      setSelectedEmail(null);
                      setSelectedEmailFull(null);
                      setMobileView('list');
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-[#FF9500] font-semibold'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{f.label}</span>
                    {unread > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">
          {/* ── Sidebar Folders (desktop) ── */}
          <div className="w-52 flex-shrink-0 space-y-1 hidden lg:block">
            <Button
              className="w-full mb-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:shadow-md transition-all"
              onClick={() => {
                setComposerData({
                  from: FROM_OPTIONS[0],
                  to: '',
                  cc: '',
                  subject: '',
                  body: '',
                  replyToEmailId: null,
                });
                setComposerOpen(true);
              }}
            >
              <Mail className="w-4 h-4 mr-2" />
              Componi
            </Button>

            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const isActive = folder === f.id;
              const unread = unreadCounts[f.id] || 0;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFolder(f.id);
                    setSelectedEmail(null);
                    setSelectedEmailFull(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-[#FF9500] font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{f.label}</span>
                  {unread > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {unread}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Email List ── */}
          <Card
            className={`flex-1 flex flex-col overflow-hidden min-w-0 bg-white ${
              mobileView === 'detail' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-3 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Cerca email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                  onKeyDown={(e) => e.key === 'Enter' && fetchEmails()}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchEmails()}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {loading && emails.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Caricamento...
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Mail className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm font-medium">Nessuna email</p>
                  <p className="text-xs mt-1">
                    {folder === 'inbox'
                      ? 'Le email in arrivo appariranno qui'
                      : folder === 'sent'
                        ? 'Le email inviate appariranno qui'
                        : folder === 'drafts'
                          ? 'Le bozze salvate appariranno qui'
                          : 'Il cestino è vuoto'}
                  </p>
                </div>
              ) : (
                <>
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => openEmail(email)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-orange-50/50' : ''
                      } ${!email.read ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <button
                        onClick={(e) => toggleStar(email, e)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {email.starred ? (
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-300 hover:text-amber-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm truncate ${!email.read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                          >
                            {folder === 'sent' || folder === 'drafts'
                              ? `A: ${email.to_address[0] ? extractName(email.to_address[0]) : '—'}`
                              : extractName(email.from_address)}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatDate(email.created_at)}
                          </span>
                        </div>
                        <p
                          className={`text-sm truncate ${!email.read ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                        >
                          {email.subject || '(nessun oggetto)'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {previewText(email) || '\u00A0'}
                        </p>
                      </div>
                      {!email.read && (
                        <div className="w-2 h-2 rounded-full bg-[#FF9500] mt-2 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  {/* Pagination */}
                  {hasMore && (
                    <div className="p-3 text-center border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="text-[#FF9500] hover:text-[#FF9500] hover:bg-orange-50"
                      >
                        {loadingMore ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <ChevronDown className="w-4 h-4 mr-1" />
                        )}
                        Carica altre ({totalEmails - emails.length} rimanenti)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* ── Detail Panel ── */}
          {selectedEmailFull ? (
            <Card
              className={`w-full lg:w-[420px] flex-shrink-0 flex flex-col overflow-hidden bg-white ${
                mobileView === 'list' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="p-3 border-b flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEmail(null);
                    setSelectedEmailFull(null);
                    setMobileView('list');
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReply(selectedEmailFull)}
                  title="Rispondi"
                >
                  <Reply className="w-4 h-4" />
                </Button>
                {selectedEmailFull.cc && selectedEmailFull.cc.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReplyAll(selectedEmailFull)}
                    title="Rispondi a tutti"
                  >
                    <ReplyAll className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleForward(selectedEmailFull)}
                  title="Inoltra"
                >
                  <Forward className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(selectedEmailFull.id)}
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>

              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedEmailFull.subject || '(nessun oggetto)'}
                </h2>
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Da:</span>{' '}
                    {selectedEmailFull.from_address || '—'}
                  </p>
                  <p>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">A:</span>{' '}
                    {selectedEmailFull.to_address?.join(', ') || '—'}
                  </p>
                  {selectedEmailFull.cc && selectedEmailFull.cc.length > 0 && (
                    <p>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">CC:</span>{' '}
                      {selectedEmailFull.cc.join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(selectedEmailFull.created_at).toLocaleString('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-white">
                {selectedEmailFull.body_html ? (
                  <div
                    className="prose prose-sm max-w-none text-gray-800"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtmlClient(selectedEmailFull.body_html),
                    }}
                  />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedEmailFull.body_text || '(nessun contenuto)'}
                  </pre>
                )}
              </div>

              {/* Quick reply */}
              <div className="p-3 border-t bg-gray-50">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-gray-500"
                  onClick={() => handleReply(selectedEmailFull)}
                >
                  <Reply className="w-4 h-4 mr-2" />
                  Rispondi...
                </Button>
              </div>
            </Card>
          ) : (
            /* Empty state when no email selected (desktop only) */
            <Card className="w-[420px] flex-shrink-0 hidden lg:flex flex-col items-center justify-center bg-white">
              <Mail className="w-16 h-16 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Seleziona un&apos;email per leggerla</p>
            </Card>
          )}
        </div>
      </div>

      {/* ── Composer Modal ── */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuova Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Da</label>
              <select
                value={composerData.from}
                onChange={(e) => setComposerData((d) => ({ ...d, from: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
              >
                {FROM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="text-xs text-gray-500 mb-1 block">A</label>
              <Input
                placeholder="destinatario@email.com"
                value={composerData.to}
                onChange={(e) => {
                  setComposerData((d) => ({ ...d, to: e.target.value }));
                  searchContacts(e.target.value, 'to');
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (activeAutoField === 'to') setActiveAutoField(null);
                  }, 200)
                }
              />
              {activeAutoField === 'to' && contactSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {contactSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center justify-between"
                      onMouseDown={() => selectContact(c.email, 'to')}
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-gray-500 text-xs">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-xs text-gray-500 mb-1 block">CC</label>
              <Input
                placeholder="cc@email.com (opzionale)"
                value={composerData.cc}
                onChange={(e) => {
                  setComposerData((d) => ({ ...d, cc: e.target.value }));
                  searchContacts(e.target.value, 'cc');
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (activeAutoField === 'cc') setActiveAutoField(null);
                  }, 200)
                }
              />
              {activeAutoField === 'cc' && contactSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {contactSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center justify-between"
                      onMouseDown={() => selectContact(c.email, 'cc')}
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-gray-500 text-xs">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Oggetto</label>
              <Input
                placeholder="Oggetto"
                value={composerData.subject}
                onChange={(e) => setComposerData((d) => ({ ...d, subject: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Messaggio</label>
              <Textarea
                placeholder="Scrivi il tuo messaggio..."
                value={composerData.body}
                onChange={(e) => setComposerData((d) => ({ ...d, body: e.target.value }))}
                rows={12}
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="text-gray-500"
              >
                {savingDraft ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <FileEdit className="w-4 h-4 mr-1" />
                )}
                Salva bozza
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setComposerOpen(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending || !composerData.to || !composerData.subject}
                  className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:shadow-md transition-all disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Invia
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa email?</AlertDialogTitle>
            <AlertDialogDescription>
              {folder === 'trash'
                ? "L'email verrà eliminata definitivamente e non potrà essere recuperata."
                : "L'email verrà spostata nel cestino."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && trashEmail(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              {folder === 'trash' ? 'Elimina definitivamente' : 'Sposta nel cestino'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
