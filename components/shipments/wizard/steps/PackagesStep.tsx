'use client';

import { useState } from 'react';
import { Package, Plus, Trash2, Scale, Ruler, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useShipmentWizard } from '../ShipmentWizardContext';
import { cn } from '@/lib/utils';
import { calcVolume, calcPesoVolumetrico, calcPesoTassabile } from '@/lib/package-metrics';

// Preset comuni per colli
const PACKAGE_PRESETS = [
  { name: 'Busta', lunghezza: 35, larghezza: 25, altezza: 3, peso: 0.5 },
  { name: 'Scatola Piccola', lunghezza: 20, larghezza: 15, altezza: 10, peso: 1 },
  { name: 'Scatola Media', lunghezza: 40, larghezza: 30, altezza: 20, peso: 5 },
  { name: 'Scatola Grande', lunghezza: 60, larghezza: 40, altezza: 40, peso: 10 },
  { name: 'Pallet Piccolo', lunghezza: 80, larghezza: 60, altezza: 50, peso: 30 },
];

export function PackagesStep() {
  const { data, addPackage, removePackage, updatePackage, validateStep } = useShipmentWizard();
  const validation = validateStep('packages');

  const [showPresets, setShowPresets] = useState<string | null>(null);

  const applyPreset = (packageId: string, preset: (typeof PACKAGE_PRESETS)[0]) => {
    updatePackage(packageId, {
      lunghezza: preset.lunghezza,
      larghezza: preset.larghezza,
      altezza: preset.altezza,
      peso: preset.peso,
    });
    setShowPresets(null);
  };

  const totalWeight = data.packages.reduce((sum, pkg) => sum + pkg.peso, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Dettagli Colli</h2>
            <p className="text-sm text-gray-500">
              {data.packages.length} collo{data.packages.length !== 1 ? 'i' : ''} -{' '}
              {totalWeight.toFixed(1)} kg totali
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addPackage}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Collo
        </Button>
      </div>

      {/* Packages List */}
      <div className="space-y-6">
        {data.packages.map((pkg, index) => (
          <div key={pkg.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Collo {index + 1}</h3>
              <div className="flex items-center gap-2">
                {/* Preset button */}
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPresets(showPresets === pkg.id ? null : pkg.id)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Preset
                  </Button>

                  {/* Preset dropdown */}
                  {showPresets === pkg.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {PACKAGE_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyPreset(pkg.id, preset)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <span className="font-medium">{preset.name}</span>
                          <span className="text-gray-500 ml-2">
                            {preset.lunghezza}x{preset.larghezza}x{preset.altezza}cm
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {data.packages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePackage(pkg.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Peso */}
              <div className="space-y-2">
                <Label htmlFor={`pkg-${pkg.id}-peso`} className="flex items-center gap-2 text-sm">
                  <Scale className="w-4 h-4 text-gray-500" />
                  Peso (kg) *
                </Label>
                <Input
                  id={`pkg-${pkg.id}-peso`}
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={pkg.peso}
                  onChange={(e) => updatePackage(pkg.id, { peso: parseFloat(e.target.value) || 0 })}
                  className={cn(pkg.peso <= 0 && 'border-red-500')}
                />
              </div>

              {/* Lunghezza */}
              <div className="space-y-2">
                <Label
                  htmlFor={`pkg-${pkg.id}-lunghezza`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Ruler className="w-4 h-4 text-gray-500" />
                  Lunghezza (cm)
                </Label>
                <Input
                  id={`pkg-${pkg.id}-lunghezza`}
                  type="number"
                  min="1"
                  value={pkg.lunghezza || ''}
                  onChange={(e) =>
                    updatePackage(pkg.id, { lunghezza: parseInt(e.target.value) || 0 })
                  }
                  placeholder="es. 30"
                />
              </div>

              {/* Larghezza */}
              <div className="space-y-2">
                <Label htmlFor={`pkg-${pkg.id}-larghezza`} className="text-sm">
                  Larghezza (cm)
                </Label>
                <Input
                  id={`pkg-${pkg.id}-larghezza`}
                  type="number"
                  min="1"
                  value={pkg.larghezza || ''}
                  onChange={(e) =>
                    updatePackage(pkg.id, { larghezza: parseInt(e.target.value) || 0 })
                  }
                  placeholder="es. 20"
                />
              </div>

              {/* Altezza */}
              <div className="space-y-2">
                <Label htmlFor={`pkg-${pkg.id}-altezza`} className="text-sm">
                  Altezza (cm)
                </Label>
                <Input
                  id={`pkg-${pkg.id}-altezza`}
                  type="number"
                  min="1"
                  value={pkg.altezza || ''}
                  onChange={(e) =>
                    updatePackage(pkg.id, { altezza: parseInt(e.target.value) || 0 })
                  }
                  placeholder="es. 15"
                />
              </div>
            </div>

            {/* Contenuto (opzionale) */}
            <div className="mt-4 space-y-2">
              <Label
                htmlFor={`pkg-${pkg.id}-contenuto`}
                className="flex items-center gap-2 text-sm"
              >
                <FileText className="w-4 h-4 text-gray-500" />
                Contenuto (opzionale)
              </Label>
              <Input
                id={`pkg-${pkg.id}-contenuto`}
                value={pkg.contenuto || ''}
                onChange={(e) => updatePackage(pkg.id, { contenuto: e.target.value })}
                placeholder="es. Abbigliamento, Elettronica, Documenti..."
              />
            </div>

            {/* Volume, peso volumetrico e peso tassabile */}
            {(() => {
              const volume = calcVolume(pkg.lunghezza, pkg.larghezza, pkg.altezza);
              const pesoVolumetrico = calcPesoVolumetrico(
                pkg.lunghezza,
                pkg.larghezza,
                pkg.altezza
              );
              const { pesoTassabile, usaVolumetrico } = calcPesoTassabile(
                pkg.peso,
                pkg.lunghezza,
                pkg.larghezza,
                pkg.altezza
              );
              return (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Volume:</span>
                    <span className="font-medium">{volume.toFixed(3)} m³</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Peso volumetrico (L×W×H/5000):</span>
                    <span className="font-medium">{pesoVolumetrico.toFixed(2)} kg</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200">
                    <span className="text-gray-700 font-semibold">Peso tassabile:</span>
                    <span
                      className={`font-bold ${usaVolumetrico ? 'text-orange-600' : 'text-gray-900'}`}
                    >
                      {pesoTassabile.toFixed(2)} kg
                      {usaVolumetrico && (
                        <span className="ml-1 text-xs font-normal text-orange-500">
                          (volumetrico)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Validation errors */}
      {!validation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-sm text-orange-800">
          <strong>Suggerimento:</strong> Il peso volumetrico viene calcolato automaticamente. Il
          corriere potrebbe applicare il peso maggiore tra quello reale e quello volumetrico.
        </p>
      </div>
    </div>
  );
}
