/**
 * Pagina Dettaglio Listino
 * 
 * Visualizza e modifica listino completo con:
 * - Editor regole PriceRule
 * - Caricamento tariffe
 * - Preview calcolo prezzi
 * - Audit trail
 */

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Trash2,
  Edit,
  Eye,
  Calculator,
  FileText,
  Sparkles,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import DashboardNav from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { getPriceListByIdAction } from '@/actions/price-lists'
import { SupplierPriceListConfigDialog } from '@/components/listini/supplier-price-list-config-dialog'
import type { PriceList, PriceRule } from '@/types/listini'

export default function PriceListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [priceList, setPriceList] = useState<PriceList | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rules, setRules] = useState<PriceRule[]>([])
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadPriceList(params.id as string)
    }
  }, [params.id])

  async function loadPriceList(id: string) {
    try {
      setIsLoading(true)
      const result = await getPriceListByIdAction(id)
      if (result.success && result.priceList) {
        const list = result.priceList as PriceList
        setPriceList(list)
        setRules((list.rules as PriceRule[]) || [])
      } else {
        toast.error(result.error || 'Listino non trovato')
        router.push('/dashboard/listini')
      }
    } catch (error: any) {
      toast.error('Errore caricamento listino')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento listino...</p>
        </div>
      </div>
    )
  }

  if (!priceList) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header con pulsante indietro */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/listini')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </Button>
        </div>

        <DashboardNav
          title={`${priceList.name} - v${priceList.version}`}
          subtitle="Gestione dettaglio listino prezzi"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Configurazione
              </Button>
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifica
                </Button>
              )}
              {isEditing && (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Annulla
                  </Button>
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Salva
                  </Button>
                </>
              )}
            </div>
          }
        />

        <Tabs defaultValue="rules" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="rules">
              <Sparkles className="mr-2 h-4 w-4" />
              Regole
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Carica Tariffe
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Calculator className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="audit">
              <FileText className="mr-2 h-4 w-4" />
              Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-6">
            <PriceRulesEditor
              rules={rules}
              onChange={setRules}
              isEditing={isEditing}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <TariffUploader priceListId={priceList.id} />
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <PriceCalculatorPreview priceListId={priceList.id} />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditTrail priceListId={priceList.id} />
          </TabsContent>
        </Tabs>

        {/* Dialog Configurazione Manuale */}
        {priceList && (
          <SupplierPriceListConfigDialog
            open={showConfigDialog}
            onOpenChange={(open) => {
              setShowConfigDialog(open);
            }}
            priceList={priceList}
            onSaveComplete={() => {
              if (priceList.id) {
                loadPriceList(priceList.id);
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

// Componente Editor Regole
function PriceRulesEditor({ 
  rules, 
  onChange, 
  isEditing 
}: { 
  rules: PriceRule[]
  onChange: (rules: PriceRule[]) => void
  isEditing: boolean
}) {
  const addRule = () => {
    const newRule: PriceRule = {
      id: `rule-${Date.now()}`,
      name: 'Nuova Regola',
      margin_type: 'percent',
      margin_value: 10,
      priority: 0,
      is_active: true,
    }
    onChange([...rules, newRule])
  }

  const updateRule = (index: number, updates: Partial<PriceRule>) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const deleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Regole di Calcolo Prezzi</h2>
          <p className="text-sm text-gray-500">Definisci regole complesse per calcolo dinamico</p>
        </div>
        {isEditing && (
          <Button onClick={addRule} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Regola
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Nessuna regola definita</p>
          {isEditing && (
            <Button onClick={addRule} variant="outline">
              Crea Prima Regola
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div
              key={rule.id || index}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isEditing ? (
                      <Input
                        value={rule.name || ''}
                        onChange={(e) => updateRule(index, { name: e.target.value })}
                        placeholder="Nome regola"
                        className="font-medium"
                      />
                    ) : (
                      <h3 className="font-medium text-gray-900">{rule.name || `Regola ${index + 1}`}</h3>
                    )}
                    <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                      {rule.is_active ? 'Attiva' : 'Disattiva'}
                    </Badge>
                    <Badge variant="outline">Priorità: {rule.priority || 0}</Badge>
                  </div>
                  {isEditing && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <Label className="text-xs">Peso Min (kg)</Label>
                        <Input
                          type="number"
                          value={rule.weight_from || ''}
                          onChange={(e) => updateRule(index, { weight_from: parseFloat(e.target.value) || undefined })}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Peso Max (kg)</Label>
                        <Input
                          type="number"
                          value={rule.weight_to || ''}
                          onChange={(e) => updateRule(index, { weight_to: parseFloat(e.target.value) || undefined })}
                          placeholder="∞"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Margine (%)</Label>
                        <Input
                          type="number"
                          value={rule.margin_value || ''}
                          onChange={(e) => updateRule(index, { margin_value: parseFloat(e.target.value) || undefined })}
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo Margine</Label>
                        <Select
                          value={rule.margin_type}
                          onChange={(e) => updateRule(index, { margin_type: e.target.value as 'percent' | 'fixed' | 'none' })}
                        >
                          <option value="percent">Percentuale</option>
                          <option value="fixed">Fisso (€)</option>
                          <option value="none">Nessuno</option>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Componente Upload Tariffe
function TariffUploader({ priceListId }: { priceListId: string }) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('priceListId', priceListId)

      const response = await fetch('/api/price-lists/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`File processato: ${result.data.length} righe trovate`)
      } else {
        toast.error(result.error || 'Errore upload file')
      }
    } catch (error: any) {
      toast.error('Errore imprevisto durante upload')
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Carica Tariffe</h2>
      <p className="text-sm text-gray-500 mb-6">
        Carica file CSV, Excel, PDF o immagini. Il sistema processerà automaticamente i dati.
      </p>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          const file = e.dataTransfer.files[0]
          if (file) handleUpload(file)
        }}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">
          Trascina file qui o{' '}
          <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
            seleziona file
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
            />
          </label>
        </p>
        <p className="text-xs text-gray-500">
          Supportati: CSV, Excel (.xlsx, .xls), PDF, Immagini (JPG, PNG)
        </p>
        {isUploading && (
          <div className="mt-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Elaborazione in corso...</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente Preview Calcolatore
function PriceCalculatorPreview({ priceListId }: { priceListId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview Calcolo Prezzi</h2>
      <p className="text-sm text-gray-500 mb-6">
        Testa il calcolo prezzi con parametri di esempio
      </p>
      <div className="text-center py-12 text-gray-500">
        <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Calcolatore in sviluppo...</p>
      </div>
    </div>
  )
}

// Componente Audit Trail
function AuditTrail({ priceListId }: { priceListId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h2>
      <p className="text-sm text-gray-500 mb-6">
        Storico utilizzi e modifiche del listino
      </p>
      <div className="text-center py-12 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Audit trail in sviluppo...</p>
      </div>
    </div>
  )
}
