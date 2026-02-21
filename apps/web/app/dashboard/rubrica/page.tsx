/**
 * Dashboard: Rubrica — Contact Manager
 *
 * Full CRUD contact management for superadmin.
 * Table view with search, tags filter, inline edit, and bulk operations.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Building2,
  Tag,
  ChevronDown,
  X,
  Upload,
  Download,
  UserPlus,
} from 'lucide-react';

// ─── Types ───

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  notes: string;
}

const emptyForm: ContactForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company: '',
  tags: [],
  notes: '',
};

// ─── Main Component ───

export default function RubricaPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Dialog states
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tag input
  const [tagInput, setTagInput] = useState('');

  // All tags for filter
  const [allTags, setAllTags] = useState<string[]>([]);

  // ─── Fetch ───

  const fetchContacts = useCallback(
    async (searchQuery?: string, tag?: string | null, newOffset = 0) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', LIMIT.toString());
        params.set('offset', newOffset.toString());
        if (searchQuery) params.set('search', searchQuery);
        if (tag) params.set('tag', tag);

        const res = await fetch(`/api/contacts?${params}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        if (newOffset === 0) {
          setContacts(data.contacts);
        } else {
          setContacts((prev) => [...prev, ...data.contacts]);
        }
        setTotal(data.total);

        // Collect all unique tags
        if (newOffset === 0) {
          const tags = new Set<string>();
          data.contacts.forEach((c: Contact) => c.tags?.forEach((t: string) => tags.add(t)));
          setAllTags((prev) => {
            const merged = new Set([...prev, ...tags]);
            return Array.from(merged).sort();
          });
        }
      } catch (err: any) {
        console.error('Fetch contacts error:', err.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchContacts(search, activeTag, 0);
    setOffset(0);
  }, [search, activeTag, fetchContacts]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ─── CRUD Handlers ───

  const openCreateForm = () => {
    setEditingContact(null);
    setForm(emptyForm);
    setFormError('');
    setTagInput('');
    setShowForm(true);
  };

  const openEditForm = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone || '',
      company: contact.company || '',
      tags: contact.tags || [],
      notes: contact.notes || '',
    });
    setFormError('');
    setTagInput('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('Nome e cognome obbligatori');
      return;
    }
    if (!form.email.trim()) {
      setFormError('Email obbligatoria');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        tags: form.tags,
        notes: form.notes.trim() || null,
      };

      let res: Response;
      if (editingContact) {
        res = await fetch(`/api/contacts/${editingContact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowForm(false);
      fetchContacts(search, activeTag, 0);
      setOffset(0);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${deleteConfirm.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setDeleteConfirm(null);
      fetchContacts(search, activeTag, 0);
      setOffset(0);
    } catch (err: any) {
      console.error('Delete error:', err.message);
    } finally {
      setDeleting(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  const loadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchContacts(search, activeTag, newOffset);
  };

  // ─── CSV Export ───

  const handleExport = () => {
    if (!contacts.length) return;
    const headers = ['Nome', 'Cognome', 'Email', 'Telefono', 'Azienda', 'Tag', 'Note'];
    const rows = contacts.map((c) => [
      c.first_name,
      c.last_name,
      c.email,
      c.phone || '',
      c.company || '',
      (c.tags || []).join('; '),
      (c.notes || '').replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rubrica_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ───

  const remaining = total - contacts.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-[#FF9500]" />
              Rubrica
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total} contatt{total === 1 ? 'o' : 'i'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!contacts.length}>
              <Download className="h-4 w-4 mr-1" />
              Esporta CSV
            </Button>
            <Button
              size="sm"
              onClick={openCreateForm}
              className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:opacity-90 border-0"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Nuovo Contatto
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <Card className="bg-white p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca per nome, email, azienda..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-gray-400" />
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={activeTag === tag ? 'default' : 'secondary'}
                    className={`cursor-pointer text-xs ${
                      activeTag === tag
                        ? 'bg-[#FF9500] hover:bg-[#FF9500]/90 text-white'
                        : 'hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  >
                    {tag}
                    {activeTag === tag && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Contacts Table */}
        <Card className="bg-white overflow-hidden">
          {loading && contacts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF9500]" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Nessun contatto trovato</p>
              <p className="text-sm mt-1">
                {search || activeTag
                  ? 'Prova a cambiare i filtri di ricerca'
                  : 'Aggiungi il primo contatto alla rubrica'}
              </p>
              {!search && !activeTag && (
                <Button
                  size="sm"
                  onClick={openCreateForm}
                  className="mt-4 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white border-0"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Aggiungi contatto
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Telefono</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Azienda</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tag</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {c.first_name} {c.last_name}
                        </td>
                        <td className="px-4 py-3">
                          <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">
                            {c.email}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.company || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {c.tags?.map((t) => (
                              <Badge key={t} variant="secondary" className="text-xs">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditForm(c)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                              title="Modifica"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(c)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {contacts.map((c) => (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {c.first_name} {c.last_name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditForm(c)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(c)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm space-y-1 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">
                          {c.email}
                        </a>
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <a href={`tel:${c.phone}`} className="hover:underline">
                            {c.phone}
                          </a>
                        </div>
                      )}
                      {c.company && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{c.company}</span>
                        </div>
                      )}
                    </div>
                    {c.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {c.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Load more */}
              {remaining > 0 && (
                <div className="p-4 text-center border-t border-gray-100">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    )}
                    Carica altri ({remaining} rimanenti)
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </main>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent onClose={() => setShowForm(false)}>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Modifica Contatto' : 'Nuovo Contatto'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nome *</label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="Mario"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Cognome *</label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder="Rossi"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="mario.rossi@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Telefono</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+39 333 1234567"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Azienda</label>
                  <Input
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="Acme S.r.l."
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Tag</label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Aggiungi tag e premi Invio"
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addTag} type="button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {form.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs pr-1">
                        {t}
                        <button onClick={() => removeTag(t)} className="ml-1 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Note</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Note aggiuntive..."
                  rows={3}
                />
              </div>
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white border-0"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingContact ? 'Salva' : 'Crea Contatto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina contatto</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare {deleteConfirm?.first_name} {deleteConfirm?.last_name}?
              Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)} disabled={deleting}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
