import React from 'react';
import { Badge } from '../../../components/ui/Badge';

export interface DateRange {
  from?: string;
  to?: string;
  label: string;
}

export const getPresets = (): DateRange[] => {
  const today = new Date();
  
  const getISODate = (d: Date) => d.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  return [
    { label: 'Today', from: getISODate(today), to: getISODate(today) },
    { label: 'Yesterday', from: getISODate(yesterday), to: getISODate(yesterday) },
    { label: 'This Week', from: getISODate(startOfWeek), to: getISODate(today) },
    { label: 'This Month', from: getISODate(startOfMonth), to: getISODate(today) },
    { label: 'All Time', from: undefined, to: undefined }
  ];
};

interface DateRangeSelectorProps {
  presets: DateRange[];
  activePreset: DateRange;
  onChange: (preset: DateRange) => void;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ presets, activePreset, onChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
      {presets.map(p => (
        <Badge 
          key={p.label}
          variant={activePreset.label === p.label ? 'default' : 'neutral'}
          className="cursor-pointer whitespace-nowrap px-3 py-1.5"
          onClick={() => onChange(p)}
        >
          {p.label}
        </Badge>
      ))}
    </div>
  );
};
