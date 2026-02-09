'use client';

/**
 * Bacheca — Annunci workspace broadcast
 *
 * Reseller/admin: crea, modifica, elimina, fissa annunci
 * Client/team: legge annunci, segna come letti
 * Filtri per target (tutti/team/clienti) e priorità
 */

import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Megaphone,
  Plus,
  Pin,
  Trash2,
  Edit3,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Users,
  Globe,
  UserCheck,
  Eye,
  Clock,
  X,
} from 'lucide-react';

// ─── TYPES ───

interface Announcement {
  id: string;
  workspace_id: string;
  author_id: string;
  title: string;
  body_html: string;
  body_text?: string;
  target: 'all' | 'team' | 'clients';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  pinned: boolean;
  channels: string[];
  read_by: string[];
  is_read: boolean;
  read_count: number;
  created_at: string;
  updated_at: string;
}

interface ComposerData {
  title: string;
  body: string;
  target: 'all' | 'team' | 'clients';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  pinned: boolean;
  channels: string[];
}

// ─── CONSTANTS ───

const TARGET_OPTIONS = [
  { id: 'all' as const, label: 'Tutti', icon: Globe, description: 'Team + clienti' },
  { id: 'team' as const, label: 'Solo Team', icon: Users, description: 'Solo membri workspace' },
  {
    id: 'clients' as const,
    label: 'Solo Clienti',
    icon: UserCheck,
    description: 'Solo clienti child',
  },
];

const PRIORITY_OPTIONS = [
  { id: 'low' as const, label: 'Bassa', color: 'bg-gray-100 text-gray-600' },
  { id: 'normal' as const, label: 'Normale', color: 'bg-blue-100 text-blue-700' },
  { id: 'high' as const, label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { id: 'urgent' as const, label: 'Urgente', color: 'bg-red-100 text-red-700' },
];

const FILTER_TABS = [
  { id: null, label: 'Tutti' },
  { id: 'all', label: 'Broadcast' },
  { id: 'team', label: 'Team' },
  { id: 'clients', label: 'Clienti' },
];

const PAGE_SIZE = 20;

// ─── COMPONENT ───

export default function BachecaPage() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.workspace_id;

  // Stato
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [filterTarget, setFilterTarget] = useState<string | null>(null);

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [composerData, setComposerData] = useState<ComposerData>({
    title: '',
    body: '',
    target: 'all',
    priority: 'normal',
    pinned: false,
    channels: ['in_app'],
  });

  // Detail
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Determina se può creare (owner/admin)
  const canManage = ['owner', 'admin'].includes(workspace?.role || '');

  // ─── Fetch annunci ───

  const fetchAnnouncements = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' });
      if (filterTarget) params.set('target', filterTarget);

      const res = await fetch(`/api/workspaces/${workspaceId}/announcements?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();

      setAnnouncements(data.announcements || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
      setPage(0);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filterTarget]);

  const loadMore = async () => {
    if (!workspaceId) return;
    const nextPage = page + 1;
    const offset = nextPage * PAGE_SIZE;
    if (offset >= total) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (filterTarget) params.set('target', filterTarget);

      const res = await fetch(`/api/workspaces/${workspaceId}/announcements?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setAnnouncements((prev) => [...prev, ...(data.announcements || [])]);
      setPage(nextPage);
    } catch {
      /* noop */
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ─── Open detail + mark read ───

  const openAnnouncement = async (a: Announcement) => {
    setSelectedAnnouncement(a);

    if (!a.is_read && workspaceId) {
      // Mark read via GET detail (auto mark-read)
      await fetch(`/api/workspaces/${workspaceId}/announcements/${a.id}`);
      // Aggiorna stato locale
      setAnnouncements((prev) =>
        prev.map((ann) => (ann.id === a.id ? { ...ann, is_read: true } : ann))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  // ─── Crea / Modifica annuncio ───

  const handleSave = async () => {
    if (!workspaceId || !composerData.title.trim() || !composerData.body.trim()) return;
    setSaving(true);

    try {
      const payload = {
        title: composerData.title,
        bodyHtml: `<div style="font-family: sans-serif; white-space: pre-wrap;">${composerData.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`,
        bodyText: composerData.body,
        target: composerData.target,
        priority: composerData.priority,
        pinned: composerData.pinned,
        channels: composerData.channels,
      };

      const url = editingId
        ? `/api/workspaces/${workspaceId}/announcements/${editingId}`
        : `/api/workspaces/${workspaceId}/announcements`;

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetComposer();
        fetchAnnouncements();
      }
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const resetComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setComposerData({
      title: '',
      body: '',
      target: 'all',
      priority: 'normal',
      pinned: false,
      channels: ['in_app'],
    });
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setComposerData({
      title: a.title,
      body: a.body_text || '',
      target: a.target,
      priority: a.priority,
      pinned: a.pinned,
      channels: a.channels,
    });
    setComposerOpen(true);
    setSelectedAnnouncement(null);
  };

  // ─── Toggle pin ───

  const togglePin = async (a: Announcement) => {
    if (!workspaceId) return;
    const newPinned = !a.pinned;
    setAnnouncements((prev) =>
      prev.map((ann) => (ann.id === a.id ? { ...ann, pinned: newPinned } : ann))
    );
    await fetch(`/api/workspaces/${workspaceId}/announcements/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: newPinned }),
    });
  };

  // ─── Delete ───

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/announcements/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    setSelectedAnnouncement(null);
    fetchAnnouncements();
  };

  // ─── Helpers ───

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m fa`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h fa`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}g fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const targetIcon = (t: string) => {
    const opt = TARGET_OPTIONS.find((o) => o.id === t);
    if (!opt) return Globe;
    return opt.icon;
  };

  const targetLabel = (t: string) => TARGET_OPTIONS.find((o) => o.id === t)?.label || t;

  const priorityStyle = (p: string) =>
    PRIORITY_OPTIONS.find((o) => o.id === p)?.color || 'bg-gray-100 text-gray-600';

  const hasMore = (page + 1) * PAGE_SIZE < total;

  // ─── RENDER ───

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-orange-500" />
            Bacheca
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} non letti · ` : ''}
            {total} annunc{total === 1 ? 'io' : 'i'}
          </p>
        </div>
        {canManage && (
          <Button
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-md"
            onClick={() => {
              resetComposer();
              setComposerOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Nuovo Annuncio
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id || 'all-filter'}
            onClick={() => setFilterTarget(tab.id)}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterTarget === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Announcement list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : announcements.length === 0 ? (
          <Card className="p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nessun annuncio</p>
            {canManage && (
              <p className="text-sm text-gray-400 mt-1">
                Crea il primo annuncio per il tuo team o i tuoi clienti
              </p>
            )}
          </Card>
        ) : (
          announcements.map((a) => {
            const TargetIcon = targetIcon(a.target);
            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                className={`rounded-xl border bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                  !a.is_read ? 'border-l-4 border-l-orange-400 bg-orange-50/30' : ''
                } ${a.pinned ? 'ring-1 ring-amber-200' : ''}`}
                onClick={() => openAnnouncement(a)}
                onKeyDown={(e) => e.key === 'Enter' && openAnnouncement(a)}
              >
                <div className="flex items-start gap-3">
                  {/* Priority indicator */}
                  {a.priority === 'urgent' && (
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  {a.priority === 'high' && (
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                      <h3
                        className={`text-sm truncate ${!a.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}
                      >
                        {a.title}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {a.body_text || '(nessun contenuto)'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <TargetIcon className="w-3 h-3" />
                        {targetLabel(a.target)}
                      </Badge>
                      {a.priority !== 'normal' && (
                        <Badge className={`text-xs ${priorityStyle(a.priority)}`}>
                          {PRIORITY_OPTIONS.find((o) => o.id === a.priority)?.label}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                        <Eye className="w-3 h-3" /> {a.read_count}
                        <span className="mx-1">·</span>
                        <Clock className="w-3 h-3" /> {formatDate(a.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {hasMore && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-1" />
              )}
              Carica altri
            </Button>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog
        open={!!selectedAnnouncement}
        onOpenChange={(open) => !open && setSelectedAnnouncement(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {selectedAnnouncement.pinned && <Pin className="w-4 h-4 text-amber-500" />}
                  <DialogTitle>{selectedAnnouncement.title}</DialogTitle>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {targetLabel(selectedAnnouncement.target)}
                  </Badge>
                  {selectedAnnouncement.priority !== 'normal' && (
                    <Badge className={`text-xs ${priorityStyle(selectedAnnouncement.priority)}`}>
                      {PRIORITY_OPTIONS.find((o) => o.id === selectedAnnouncement.priority)?.label}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(selectedAnnouncement.created_at).toLocaleString('it-IT')}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Letto da {selectedAnnouncement.read_count}
                  </span>
                </div>
              </DialogHeader>

              <div className="mt-4">
                {selectedAnnouncement.body_html ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedAnnouncement.body_html }}
                  />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedAnnouncement.body_text || '(nessun contenuto)'}
                  </pre>
                )}
              </div>

              {canManage && (
                <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(selectedAnnouncement)}
                  >
                    <Edit3 className="w-4 h-4 mr-1" /> Modifica
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePin(selectedAnnouncement)}
                  >
                    <Pin className="w-4 h-4 mr-1" />
                    {selectedAnnouncement.pinned ? 'Rimuovi pin' : 'Fissa'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 ml-auto"
                    onClick={() => setDeleteConfirm(selectedAnnouncement.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Elimina
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Composer dialog */}
      <Dialog open={composerOpen} onOpenChange={(open) => !open && resetComposer()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifica Annuncio' : 'Nuovo Annuncio'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Titolo */}
            <div>
              <label className="text-sm font-medium text-gray-700">Titolo</label>
              <Input
                value={composerData.title}
                onChange={(e) => setComposerData((d) => ({ ...d, title: e.target.value }))}
                placeholder="Titolo dell'annuncio"
                className="mt-1"
                maxLength={200}
              />
            </div>

            {/* Contenuto */}
            <div>
              <label className="text-sm font-medium text-gray-700">Contenuto</label>
              <Textarea
                value={composerData.body}
                onChange={(e) => setComposerData((d) => ({ ...d, body: e.target.value }))}
                placeholder="Scrivi il messaggio..."
                rows={6}
                className="mt-1"
              />
            </div>

            {/* Target */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Destinatari</label>
              <div className="flex gap-2">
                {TARGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setComposerData((d) => ({ ...d, target: opt.id }))}
                    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                      composerData.target === opt.id
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priorità */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Priorità</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setComposerData((d) => ({ ...d, priority: opt.id }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      composerData.priority === opt.id
                        ? `${opt.color} ring-2 ring-offset-1 ring-gray-300`
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pin toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={composerData.pinned}
                onChange={(e) => setComposerData((d) => ({ ...d, pinned: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Pin className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-gray-700">Fissa in cima</span>
            </label>

            {/* Azioni */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || !composerData.title.trim() || !composerData.body.trim()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingId ? 'Salva Modifiche' : 'Pubblica'}
              </Button>
              <Button variant="outline" onClick={resetComposer}>
                Annulla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare annuncio?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Questa azione non può essere annullata.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
