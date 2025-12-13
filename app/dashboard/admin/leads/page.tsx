'use client';

import { useState, useEffect } from 'react';
import { getLeads, updateLead, deleteLead, createLead } from '@/app/actions/leads';
import { Lead, LeadStatus } from '@/types/leads';
import { 
  Users, Search, Plus, Phone, Mail, MoreVertical, 
  Trash2, UserPlus, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, new: 0, won: 0, value: 0 });

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setIsLoading(true);
    try {
      const data = await getLeads();
      setLeads(data);
      
      // Calculate simple stats
      setStats({
        total: data.length,
        new: data.filter(l => l.status === 'new').length,
        won: data.filter(l => l.status === 'won').length,
        value: data.reduce((acc, curr) => acc + (curr.estimated_value || 0), 0)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleStatusChange = async (id: string, newStatus: LeadStatus) => {
    try {
        setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l)); // Optimistic UI
        await updateLead(id, { status: newStatus });
        loadLeads(); // Refresh stats
    } catch (err) {
        console.error(err);
        loadLeads(); // Revert on error
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Eliminare definitivamente questo lead?')) return;
    try {
        await deleteLead(id);
        setLeads(leads.filter(l => l.id !== id));
    } catch(err) {
        alert('Errore eliminazione');
    }
  };

  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-purple-100 text-purple-700',
    negotiation: 'bg-orange-100 text-orange-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-gray-100 text-gray-500'
  };

  const filteredLeads = leads.filter(l => 
    l.company_name.toLowerCase().includes(search.toLowerCase()) || 
    l.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-7 h-7 text-indigo-600" />
                Lead Management
            </h1>
            <p className="text-gray-500 text-sm">Gestisci i potenziali clienti e traccia le conversioni.</p>
        </div>
        
        <div className="flex gap-4">
             {/* Simple Stats Cards */}
             <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-gray-500 uppercase font-bold">Totali</span>
                <span className="text-xl font-bold text-gray-900">{stats.total}</span>
             </div>
             <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-blue-500 uppercase font-bold">Nuovi</span>
                <span className="text-xl font-bold text-blue-600">{stats.new}</span>
             </div>
             <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-green-500 uppercase font-bold">Vinti</span>
                <span className="text-xl font-bold text-green-600">{stats.won}</span>
             </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Cerca azienda, nome o email..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
         </div>
         <button className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200" onClick={() => alert('Modale creazione non implementata in questa demo')}>
            <Plus className="w-4 h-4" /> Nuovo Lead
         </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         {isLoading ? (
             <div className="p-12 text-center text-gray-400">Caricamento leads...</div>
         ) : filteredLeads.length === 0 ? (
             <div className="p-12 text-center text-gray-400">Nessun lead trovato.</div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
                        <tr>
                            <th className="px-6 py-4 font-medium">Azienda / Contatto</th>
                            <th className="px-6 py-4 font-medium">Contatti</th>
                            <th className="px-6 py-4 font-medium">Stato</th>
                            <th className="px-6 py-4 font-medium">Valore Stimato</th>
                            <th className="px-6 py-4 font-medium">Data Creazione</th>
                            <th className="px-6 py-4 font-medium text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredLeads.map(lead => (
                            <tr key={lead.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-gray-900">{lead.company_name}</div>
                                    <div className="text-gray-500 text-xs">{lead.contact_name || 'Nessun contatto'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {lead.email && (
                                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600">
                                                <Mail className="w-3 h-3" /> {lead.email}
                                            </a>
                                        )}
                                        {lead.phone && (
                                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600">
                                                <Phone className="w-3 h-3" /> {lead.phone}
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <select 
                                        value={lead.status}
                                        onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                                        className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer outline-none ring-1 ring-inset ring-black/5 ${statusColors[lead.status] || 'bg-gray-100'}`}
                                    >
                                        <option value="new">Nuovo</option>
                                        <option value="contacted">Contattato</option>
                                        <option value="qualified">Qualificato</option>
                                        <option value="negotiation">Negoziazione</option>
                                        <option value="won">Vinto</option>
                                        <option value="lost">Perso</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-700">
                                    {lead.estimated_value ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(lead.estimated_value) : '-'}
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: it })}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleDelete(lead.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Elimina"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
         )}
      </div>
    </div>
  );
}
