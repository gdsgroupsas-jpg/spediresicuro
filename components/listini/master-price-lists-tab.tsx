/**
 * Tab: Listini Master (superadmin only)
 * Estratto da app/dashboard/super-admin/listini-master/page.tsx
 */

'use client';

import {
  assignPriceListToUserViaTableAction,
  clonePriceListAction,
  listAssignmentsForPriceListAction,
  listMasterPriceListsAction,
  listUsersForAssignmentAction,
  revokePriceListAssignmentAction,
} from '@/actions/price-lists';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PriceList, PriceListAssignment } from '@/types/listini';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Eye,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface MasterPriceList extends PriceList {
  derived_count?: number;
  assignment_count?: number;
  courier?: { id: string; code: string; name: string };
}

interface AssignmentUser {
  id: string;
  email: string;
  name?: string;
  account_type: string;
  is_reseller: boolean;
}

export function MasterPriceListsTab() {
  const [masterLists, setMasterLists] = useState<MasterPriceList[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<AssignmentUser[]>([]);

  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAssignmentsDialog, setShowAssignmentsDialog] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<MasterPriceList | null>(null);
  const [assignments, setAssignments] = useState<PriceListAssignment[]>([]);

  const [cloneName, setCloneName] = useState('');
  const [cloneTargetUser, setCloneTargetUser] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [listsResult, usersResult] = await Promise.all([
        listMasterPriceListsAction(),
        listUsersForAssignmentAction(),
      ]);

      if (listsResult.success) {
        setMasterLists(listsResult.priceLists || []);
      } else {
        toast.error('Errore caricamento listini: ' + listsResult.error);
      }

      if (usersResult.success) {
        setUsers(usersResult.users || []);
      }
    } catch (error: any) {
      toast.error('Errore caricamento dati: ' + error.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClone = async () => {
    if (!selectedPriceList || !cloneName.trim()) {
      toast.error('Inserisci un nome per il listino clonato');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await clonePriceListAction({
        source_price_list_id: selectedPriceList.id,
        name: cloneName.trim(),
        target_user_id: cloneTargetUser || undefined,
      });

      if (result.success) {
        toast.success(`Listino "${cloneName}" creato con successo da "${selectedPriceList.name}"`);
        setShowCloneDialog(false);
        setCloneName('');
        setCloneTargetUser('');
        loadData();
      } else {
        toast.error('Errore clonazione: ' + result.error);
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedPriceList || !assignUserId) {
      toast.error('Seleziona un utente');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await assignPriceListToUserViaTableAction({
        price_list_id: selectedPriceList.id,
        user_id: assignUserId,
        notes: assignNotes || undefined,
      });

      if (result.success) {
        const user = users.find((u) => u.id === assignUserId);
        toast.success(`Listino assegnato a ${user?.name || user?.email || assignUserId}`);
        setShowAssignDialog(false);
        setAssignUserId('');
        setAssignNotes('');
        loadData();
      } else {
        toast.error('Errore assegnazione: ' + result.error);
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadAssignments = async (priceList: MasterPriceList) => {
    setSelectedPriceList(priceList);
    try {
      const result = await listAssignmentsForPriceListAction(priceList.id);
      if (result.success) {
        setAssignments(result.assignments || []);
        setShowAssignmentsDialog(true);
      } else {
        toast.error('Errore caricamento assegnazioni: ' + result.error);
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  const handleRevoke = async (assignmentId: string) => {
    if (!confirm('Sei sicuro di voler revocare questa assegnazione?')) return;

    try {
      const result = await revokePriceListAssignmentAction(assignmentId);
      if (result.success) {
        toast.success('Assegnazione revocata');
        if (selectedPriceList) {
          loadAssignments(selectedPriceList);
        }
        loadData();
      } else {
        toast.error('Errore revoca: ' + result.error);
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  const filteredLists = masterLists.filter(
    (list) =>
      list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      list.courier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <GitBranch className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Clona, assegna e gestisci i listini template</p>
          </div>
        </div>
        <Button onClick={() => loadData()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Cerca listino..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Master Lists Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Nome Listino
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Corriere
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Derivazioni
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Assegnazioni
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Nessun listino master trovato</p>
                  </td>
                </tr>
              ) : (
                filteredLists.map((list) => (
                  <tr key={list.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{list.name}</p>
                        <p className="text-xs text-gray-500">v{list.version}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {list.courier?.name || <span className="text-gray-400">Multi-corriere</span>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          list.list_type === 'global'
                            ? 'default'
                            : list.list_type === 'supplier'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {list.list_type || 'default'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {list.status === 'active' ? (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-200 bg-green-50"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Attivo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          {list.status}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="secondary">{list.derived_count || 0}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-gray-200"
                        onClick={() => loadAssignments(list)}
                      >
                        {list.assignment_count || 0}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPriceList(list);
                            setCloneName(`${list.name} - Copia`);
                            setShowCloneDialog(true);
                          }}
                          title="Clona listino"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPriceList(list);
                            setShowAssignDialog(true);
                          }}
                          title="Assegna a utente"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => loadAssignments(list)}
                          title="Visualizza assegnazioni"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clona Listino Master</DialogTitle>
            <DialogDescription>
              Crea una copia del listino &quot;{selectedPriceList?.name}&quot; con tracciabilità
              completa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cloneName">Nome nuovo listino</Label>
              <Input
                id="cloneName"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Es: Listino GLS Custom - Reseller A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloneTarget">Assegna a utente (opzionale)</Label>
              <Select value={cloneTargetUser} onChange={(e) => setCloneTargetUser(e.target.value)}>
                <option value="">Nessuna assegnazione</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.account_type})
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-500">
                Il listino sarà creato e opzionalmente assegnato direttamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCloneDialog(false)}
              disabled={isSubmitting}
            >
              Annulla
            </Button>
            <Button onClick={handleClone} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              Clona
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna Listino</DialogTitle>
            <DialogDescription>
              Assegna &quot;{selectedPriceList?.name}&quot; a un reseller o BYOC.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assignUser">Seleziona utente</Label>
              <Select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">Seleziona utente...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.is_reseller ? 'Reseller' : user.account_type})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignNotes">Note (opzionale)</Label>
              <Textarea
                id="assignNotes"
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Note sull'assegnazione..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignDialog(false)}
              disabled={isSubmitting}
            >
              Annulla
            </Button>
            <Button onClick={handleAssign} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Assegna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments Dialog */}
      <Dialog open={showAssignmentsDialog} onOpenChange={setShowAssignmentsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assegnazioni: {selectedPriceList?.name}</DialogTitle>
            <DialogDescription>Utenti a cui è assegnato questo listino</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {assignments.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Nessuna assegnazione attiva</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                        Utente
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                        Assegnato da
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                        Data
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                        Stato
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {assignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-sm">
                              {assignment.user?.name || assignment.user?.email}
                            </p>
                            <p className="text-xs text-gray-500">{assignment.user?.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {assignment.assigner?.email || 'Sistema'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(assignment.assigned_at).toLocaleDateString('it-IT')}
                        </td>
                        <td className="px-4 py-3">
                          {assignment.revoked_at ? (
                            <Badge variant="outline" className="text-red-600 border-red-200">
                              <XCircle className="w-3 h-3 mr-1" />
                              Revocata
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Attiva
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!assignment.revoked_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRevoke(assignment.id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Revoca
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentsDialog(false)}>
              Chiudi
            </Button>
            <Button
              onClick={() => {
                setShowAssignmentsDialog(false);
                setShowAssignDialog(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Nuova Assegnazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
