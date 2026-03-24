// frontend/src/components/AdvancedIncidentFilter.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, ChevronDown, Download, Check } from 'lucide-react';

interface FilterOptions {
  status: string[];
  priority: string[];
  category: string[];
  dateRange: {
    from: string;
    to: string;
  };
  assignee: string;
  store: string;
}

interface SlaConfig {
  priority: string;
  name: string;
}

interface AdvancedIncidentFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  onExport: (format: 'csv' | 'excel') => void;
  slaConfigs?: SlaConfig[];
  categories?: string[];
}

const DEFAULT_PRIORITY_OPTIONS: SlaConfig[] = [
  { priority: 'CRITICAL', name: 'CRITICAL' },
  { priority: 'HIGH', name: 'HIGH' },
  { priority: 'MEDIUM', name: 'MEDIUM' },
  { priority: 'LOW', name: 'LOW' },
];

const DEFAULT_CATEGORIES = ['POS', 'Network', 'Hardware', 'Software', 'Printer', 'Monitor', 'Other'];

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-300 border-red-500/40',
  HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  LOW: 'bg-green-500/20 text-green-300 border-green-500/40',
};

const PRIORITY_ACTIVE_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500 text-white border-red-500',
  HIGH: 'bg-orange-500 text-white border-orange-500',
  MEDIUM: 'bg-yellow-500 text-white border-yellow-500',
  LOW: 'bg-green-500 text-white border-green-500',
};

// ─── Checkbox Dropdown Component ─────────────────────────────────────────────
function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
    onChange(next);
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  const displayText = selected.length === 0
    ? 'ทั้งหมด'
    : selected.length === options.length
    ? 'ทั้งหมด'
    : selected.length <= 2
    ? selected.join(', ')
    : `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
          selected.length > 0
            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
            : 'bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-700'
        }`}
      >
        <span className="truncate">{displayText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded-full font-medium">
              {selected.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[10000] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
          {/* Select All / Clear */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/80">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              เลือกทั้งหมด
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              ล้าง
            </button>
          </div>
          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-700/60 transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selected.includes(opt) ? 'bg-blue-500 border-blue-500' : 'border-slate-500 bg-slate-700'
                }`}>
                  {selected.includes(opt) && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={selected.includes(opt) ? 'text-white' : 'text-gray-300'}>
                  {opt}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdvancedIncidentFilter({
  onFilterChange,
  onExport,
  slaConfigs,
  categories,
}: AdvancedIncidentFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    priority: [],
    category: [],
    dateRange: { from: '', to: '' },
    assignee: '',
    store: '',
  });

  const statusOptions = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED', 'CANCELLED'];
  const statusLabels: Record<string, string> = {
    OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress',
    PENDING: 'Pending', RESOLVED: 'Resolved', CLOSED: 'Closed', CANCELLED: 'Cancelled',
  };

  // Use SLA names from settings, fallback to defaults
  const priorityOptions: SlaConfig[] = (slaConfigs && slaConfigs.length > 0)
    ? slaConfigs.filter(s => s.priority && s.name)
    : DEFAULT_PRIORITY_OPTIONS;

  // Use categories from settings, fallback to defaults
  const categoryOptions: string[] = (categories && categories.length > 0)
    ? categories
    : DEFAULT_CATEGORIES;

  const handleMultiSelect = (field: 'status' | 'priority', value: string) => {
    const currentValues = filters[field];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    const newFilters = { ...filters, [field]: newValues };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleCategoryChange = (values: string[]) => {
    const newFilters = { ...filters, category: values };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newFilters = { ...filters, dateRange: { ...filters.dateRange, [field]: value } };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearAll = () => {
    const cleared: FilterOptions = {
      status: [], priority: [], category: [],
      dateRange: { from: '', to: '' }, assignee: '', store: '',
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const activeCount =
    filters.status.length + filters.priority.length + filters.category.length +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    (filters.assignee ? 1 : 0) + (filters.store ? 1 : 0);

  const modalContent = isOpen && (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 pt-20 px-4">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/95">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Advanced Filters</h3>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full font-medium">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button onClick={handleClearAll} className="text-sm text-gray-400 hover:text-white transition-colors">
                ล้างทั้งหมด
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-700 rounded transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Filter Options */}
        <div className="p-4 space-y-5 max-h-[65vh] overflow-y-auto">

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(status => (
                <button
                  key={status}
                  onClick={() => handleMultiSelect('status', status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    filters.status.includes(status)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-slate-700/50 text-gray-300 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  {statusLabels[status] || status}
                </button>
              ))}
            </div>
          </div>

          {/* Priority — SLA names from settings */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map(({ priority, name }) => (
                <button
                  key={priority}
                  onClick={() => handleMultiSelect('priority', priority)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    filters.priority.includes(priority)
                      ? (PRIORITY_ACTIVE_COLORS[priority] || 'bg-blue-500 text-white border-blue-500')
                      : (PRIORITY_COLORS[priority]
                          ? `${PRIORITY_COLORS[priority]} hover:opacity-80`
                          : 'bg-slate-700/50 text-gray-300 border-slate-600 hover:bg-slate-700')
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Category — Checkbox Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category
              {filters.category.length > 0 && (
                <span className="ml-2 text-xs text-blue-400">({filters.category.length} เลือกแล้ว)</span>
              )}
            </label>
            <CheckboxDropdown
              label="Category"
              options={categoryOptions}
              selected={filters.category}
              onChange={handleCategoryChange}
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateRange.from}
                  onChange={e => handleDateChange('from', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateRange.to}
                  onChange={e => handleDateChange('to', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer — Export */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/95">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Export Results</span>
            <div className="flex gap-2">
              <button
                onClick={() => { onExport('csv'); setIsOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />CSV
              </button>
              <button
                onClick={() => { onExport('excel'); setIsOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
      >
        <Filter className="w-4 h-4" />
        <span>Advanced Filters</span>
        {activeCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
