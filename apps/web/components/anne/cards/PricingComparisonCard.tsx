'use client';

import { useState } from 'react';
import { TrendingDown, Clock, Shield, ChevronDown, ChevronUp, Package } from 'lucide-react';
import type { PricingResult } from '@/lib/ai/pricing-engine';

interface PricingComparisonCardProps {
  options: PricingResult[];
  onSelect?: (option: PricingResult) => void;
}

const RECOMMENDATION_CONFIG: Record<
  PricingResult['recommendation'],
  { label: string; icon: typeof TrendingDown; color: string }
> = {
  best_price: { label: 'Miglior prezzo', icon: TrendingDown, color: 'text-green-600 bg-green-50' },
  best_speed: { label: 'Piu veloce', icon: Clock, color: 'text-blue-600 bg-blue-50' },
  best_reliability: {
    label: 'Piu affidabile',
    icon: Shield,
    color: 'text-purple-600 bg-purple-50',
  },
};

export function PricingComparisonCard({ options, onSelect }: PricingComparisonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!options || options.length === 0) return null;

  const best = options[0];
  const others = options.slice(1, 4);
  const hasMore = options.length > 1;

  const handleSelect = (option: PricingResult, idx: number) => {
    setSelectedIdx(idx);
    onSelect?.(option);
  };

  return (
    <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden max-w-[320px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-semibold text-purple-900">Preventivo Spedizione</span>
      </div>

      {/* Best option */}
      <OptionRow
        option={best}
        index={0}
        isBest
        isSelected={selectedIdx === 0}
        onSelect={() => handleSelect(best, 0)}
      />

      {/* Other options (collapsible) */}
      {hasMore && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-purple-600 hover:bg-purple-50 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Nascondi alternative
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                {others.length} alternativ{others.length === 1 ? 'a' : 'e'}
              </>
            )}
          </button>

          {expanded &&
            others.map((opt, idx) => (
              <OptionRow
                key={idx}
                option={opt}
                index={idx + 1}
                isSelected={selectedIdx === idx + 1}
                onSelect={() => handleSelect(opt, idx + 1)}
              />
            ))}
        </>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">Prezzi con margine applicato. Dati indicativi.</p>
      </div>
    </div>
  );
}

function OptionRow({
  option,
  index,
  isBest = false,
  isSelected,
  onSelect,
}: {
  option: PricingResult;
  index: number;
  isBest?: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const rec = RECOMMENDATION_CONFIG[option.recommendation];
  const RecIcon = rec.icon;

  return (
    <button
      onClick={onSelect}
      className={`w-full px-4 py-3 text-left transition-colors ${
        isSelected
          ? 'bg-purple-50 border-l-2 border-purple-500'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
      } ${!isBest ? 'border-t border-gray-100' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{option.courier}</span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${rec.color}`}
            >
              <RecIcon className="w-2.5 h-2.5" />
              {rec.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{option.serviceType}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {option.estimatedDeliveryDays.min}-{option.estimatedDeliveryDays.max} giorni
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-gray-900">
            {option.finalPrice.toFixed(2).replace('.', ',')}
          </span>
          <span className="text-xs text-gray-500 ml-0.5">EUR</span>
        </div>
      </div>
    </button>
  );
}
