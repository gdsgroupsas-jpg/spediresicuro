'use client'

import { useState, useEffect } from 'react'
import { FileText, Check, AlertTriangle, Plus, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { listPriceListsAction, assignPriceListAction } from '@/actions/price-lists'
import type { PriceList } from '@/types/listini'

interface AssignListinoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName: string
  currentListinoId?: string
  onSuccess: () => void
  onCreateNew: () => void
}

export function AssignListinoDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentListinoId,
  onSuccess,
  onCreateNew,
}: AssignListinoDialogProps) {
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedListinoId, setSelectedListinoId] = useState<string | null>(currentListinoId || null)

  // Carica listini disponibili
  useEffect(() => {
    async function loadPriceLists() {
      if (!open) return
      
      setIsLoading(true)
      try {
        const result = await listPriceListsAction()
        if (result.success && result.priceLists) {
          // Filtra solo listini attivi che possono essere assegnati
          const assignableLists = result.priceLists.filter(
            pl => pl.status === 'active' && 
                  (pl.list_type === 'custom' || pl.list_type === 'supplier')
          )
          setPriceLists(assignableLists)
        }
      } catch (error) {
        console.error('Errore caricamento listini:', error)
        toast.error('Errore nel caricamento dei listini')
      } finally {
        setIsLoading(false)
      }
    }

    loadPriceLists()
  }, [open])

  const handleAssign = async () => {
    if (!selectedListinoId || !clientId) return

    setIsAssigning(true)
    try {
      const result = await assignPriceListAction({
        price_list_id: selectedListinoId,
        user_id: clientId,
      })

      if (result.success) {
        toast.success('Listino assegnato con successo')
        onSuccess()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Errore nell\'assegnazione del listino')
      }
    } catch (error) {
      console.error('Errore assegnazione listino:', error)
      toast.error('Errore nell\'assegnazione del listino')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-600" />
            Assegna Listino a {clientName}
          </DialogTitle>
          <DialogDescription>
            Seleziona un listino esistente da assegnare al cliente o creane uno nuovo personalizzato.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
              <span className="ml-2 text-gray-500">Caricamento listini...</span>
            </div>
          ) : priceLists.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">
                Non hai listini disponibili da assegnare.
              </p>
              <Button onClick={onCreateNew} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                Crea Listino Personalizzato
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {priceLists.map((listino) => (
                <div
                  key={listino.id}
                  onClick={() => setSelectedListinoId(listino.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedListinoId === listino.id
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                  } ${currentListinoId === listino.id ? 'bg-green-50 border-green-200' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        selectedListinoId === listino.id 
                          ? 'bg-orange-500' 
                          : 'bg-gray-100'
                      }`}>
                        {selectedListinoId === listino.id ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : (
                          <FileText className={`w-4 h-4 ${
                            currentListinoId === listino.id ? 'text-green-600' : 'text-gray-400'
                          }`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{listino.name}</p>
                        <p className="text-xs text-gray-500">
                          {listino.list_type === 'custom' ? 'Personalizzato' : 'Fornitore'}
                          {listino.default_margin_percent !== undefined && 
                            ` • +${listino.default_margin_percent}% margine`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentListinoId === listino.id && (
                        <Badge variant="success" className="text-xs">
                          Attuale
                        </Badge>
                      )}
                      <Badge 
                        variant={listino.status === 'active' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        v{listino.version}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {priceLists.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={onCreateNew}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crea Nuovo
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedListinoId || selectedListinoId === currentListinoId || isAssigning}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assegnazione...
                  </>
                ) : (
                  'Assegna Listino'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
