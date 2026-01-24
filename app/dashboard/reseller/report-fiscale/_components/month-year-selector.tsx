'use client';

/**
 * Month Year Selector
 *
 * Selettore mese/anno per filtro report fiscale.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

interface MonthYearSelectorProps {
  month: number; // 1-12
  year: number;
  onChange: (month: number, year: number) => void;
  disabled?: boolean;
}

export function MonthYearSelector({ month, year, onChange, disabled }: MonthYearSelectorProps) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Non permettere di andare oltre il mese corrente
  const isAtCurrentMonth = month === currentMonth && year === currentYear;

  const handlePrevMonth = () => {
    if (disabled) return;
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const handleNextMonth = () => {
    if (disabled || isAtCurrentMonth) return;
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    // Se siamo nell'anno corrente, non permettere mesi futuri
    if (year === currentYear && newMonth > currentMonth) {
      return;
    }
    onChange(newMonth, year);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    // Se il nuovo anno è l'anno corrente e il mese selezionato è futuro, resetta al mese corrente
    if (newYear === currentYear && month > currentMonth) {
      onChange(currentMonth, newYear);
    } else {
      onChange(month, newYear);
    }
  };

  // Genera lista anni (ultimi 3 anni + anno corrente)
  const years = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    years.push(y);
  }

  // Genera lista mesi (tutti, ma disabilitati se futuri)
  const months = MONTH_NAMES.map((name, index) => ({
    value: index + 1,
    label: name,
    disabled: year === currentYear && index + 1 > currentMonth,
  }));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrevMonth}
        disabled={disabled}
        className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        title="Mese precedente"
      >
        <ChevronLeft className="h-5 w-5 text-gray-600" />
      </button>

      <div className="flex items-center gap-2">
        <select
          value={month}
          onChange={handleMonthChange}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value} disabled={m.disabled}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={handleYearChange}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleNextMonth}
        disabled={disabled || isAtCurrentMonth}
        className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        title="Mese successivo"
      >
        <ChevronRight className="h-5 w-5 text-gray-600" />
      </button>
    </div>
  );
}
