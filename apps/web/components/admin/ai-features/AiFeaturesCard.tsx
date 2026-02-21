'use client';

import { updateUserAiFeatures } from '@/actions/super-admin';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface AiFeaturesCardProps {
  userId: string;
  initialCanManagePriceLists: boolean;
  userName: string;
  onToggleComplete?: () => void;
}

export function AiFeaturesCard({
  userId,
  initialCanManagePriceLists,
  userName,
  onToggleComplete,
}: AiFeaturesCardProps) {
  const [canManagePriceLists, setCanManagePriceLists] = useState(initialCanManagePriceLists);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('AiFeaturesCard v2 loaded - Check for this log');
  }, []);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    // Optimistic update
    setCanManagePriceLists(checked);

    try {
      const result = await updateUserAiFeatures(userId, {
        canManagePriceLists: checked,
      });

      if (!result.success) {
        throw new Error(result.error || "Errore durante l'aggiornamento");
      }

      toast.success(
        checked ? `Feature attivata per ${userName}` : `Feature disattivata per ${userName}`
      );

      if (onToggleComplete) {
        onToggleComplete();
      }
    } catch (error: any) {
      console.error('Error toggling AI feature:', error);
      toast.error(error.message || 'Errore sconosciuto');
      // Rollback
      setCanManagePriceLists(!checked);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-600" />
          Capacità AI (Anne)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Configura cosa può fare l&apos;assistente AI per questo utente.
        </p>
      </div>

      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label htmlFor="price-list-mgmt" className="text-base font-medium">
            Gestione Listini
          </Label>
          <p className="text-sm text-gray-500">
            Permetti ad Anne di clonare, assegnare e cercare listini master.
          </p>
        </div>
        <Switch
          id="price-list-mgmt"
          checked={canManagePriceLists}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
