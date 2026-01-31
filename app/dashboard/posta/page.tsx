/**
 * Dashboard: Posta — Email Client
 *
 * Full email inbox/compose for superadmin.
 * Gmail-style layout: sidebar folders, email list, detail panel.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Forward,
  Loader2,
} from 'lucide-react';

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

// ─── Component ───

export default function PostaPage() {
  const [folder, setFolder] = useState('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedEmailFull, setSelectedEmailFull] = useState<Email | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
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

  // ─── Fetch emails ───

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ folder });
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/email?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setEmails(data.emails || []);
      setUnreadCounts(data.unreadCounts || {});
    } catch {
      console.error('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [folder, searchQuery]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // ─── Select email ───

  const openEmail = async (email: Email) => {
    setSelectedEmail(email);
    try {
      const res = await fetch(`/api/email/${email.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedEmailFull(full);
        // Update local read state
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
    }
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
    const match = addr.match(/^(.+?)\s*</);
    return match ? match[1].trim() : addr.split('@')[0];
  };

  const previewText = (email: Email) => {
    const text = email.body_text || '';
    return text.substring(0, 100).replace(/\n/g, ' ');
  };

  // ─── Render ───

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="Posta"
          subtitle="Gestione email @spediresicuro.it"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Posta', href: '/dashboard/posta' },
          ]}
        />

        <div className="mt-6 flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
          {/* ── Sidebar Folders ── */}
          <div className="w-52 flex-shrink-0 space-y-1">
            <Button
              className="w-full mb-3"
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
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
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
          <Card className="flex-1 flex flex-col overflow-hidden min-w-0">
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
              <Button variant="outline" size="sm" onClick={fetchEmails}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y">
              {loading && emails.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Caricamento...
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Mail className="w-10 h-10 mb-2" />
                  <p>Nessuna email</p>
                </div>
              ) : (
                emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => openEmail(email)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                      selectedEmail?.id === email.id ? 'bg-blue-50/50' : ''
                    } ${!email.read ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <button onClick={(e) => toggleStar(email, e)} className="mt-0.5 flex-shrink-0">
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
                        {email.subject}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{previewText(email)}</p>
                    </div>
                    {!email.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* ── Detail Panel ── */}
          {selectedEmailFull && (
            <Card className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEmail(null);
                    setSelectedEmailFull(null);
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
                  onClick={() => trashEmail(selectedEmailFull.id)}
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>

              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedEmailFull.subject}
                </h2>
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p>
                    <span className="text-gray-400">Da:</span> {selectedEmailFull.from_address}
                  </p>
                  <p>
                    <span className="text-gray-400">A:</span>{' '}
                    {selectedEmailFull.to_address?.join(', ')}
                  </p>
                  {selectedEmailFull.cc && selectedEmailFull.cc.length > 0 && (
                    <p>
                      <span className="text-gray-400">CC:</span> {selectedEmailFull.cc.join(', ')}
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
                    dangerouslySetInnerHTML={{
                      __html: selectedEmailFull.body_html
                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/on\w+="[^"]*"/gi, '')
                        .replace(/on\w+='[^']*'/gi, ''),
                    }}
                  />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {selectedEmailFull.body_text || '(nessun contenuto)'}
                  </pre>
                )}
              </div>
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {FROM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">A</label>
              <Input
                placeholder="destinatario@email.com"
                value={composerData.to}
                onChange={(e) => setComposerData((d) => ({ ...d, to: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">CC</label>
              <Input
                placeholder="cc@email.com (opzionale)"
                value={composerData.cc}
                onChange={(e) => setComposerData((d) => ({ ...d, cc: e.target.value }))}
              />
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setComposerOpen(false)}>
                Annulla
              </Button>
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
