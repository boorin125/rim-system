// frontend/src/components/AdvancedIncidentFilter.tsx

'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, ChevronDown, Calendar, Download } from 'lucide-react';

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

interface AdvancedIncidentFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  onExport: (format: 'csv' | 'excel') => void;
}

export default function AdvancedIncidentFilter({
  onFilterChange,
  onExport
}: AdvancedIncidentFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    priority: [],
    category: [],
    dateRange: {
      from: '',
      to: '',
    },
    assignee: '',
    store: '',
  });

  const statusOptions = [
    'OPEN',
    'ASSIGNED',
    'IN_PROGRESS',
    'PENDING',
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ];

  const priorityOptions = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  const categoryOptions = [
    'POS',
    'Network',
    'Hardware',
    'Software',
    'Printer',
    'Monitor',
    'Other',
  ];

  const handleMultiSelect = (
    field: 'status' | 'priority' | 'category',
    value: string
  ) => {
    const currentValues = filters[field];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];

    const newFilters = {
      ...filters,
      [field]: newValues,
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newFilters = {
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      },
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearAll = () => {
    const clearedFilters: FilterOptions = {
      status: [],
      priority: [],
      category: [],
      dateRange: { from: '', to: '' },
      assignee: '',
      store: '',
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    count += filters.status.length;
    count += filters.priority.length;
    count += filters.category.length;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.assignee) count++;
    if (filters.store) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  const modalContent = isOpen && (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 pt-20">
          <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/95">
              <h3 className="text-lg font-semibold text-white">
                Advanced Filters
              </h3>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Filter Options */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleMultiSelect('status', status)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        filters.status.includes(status)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Priority
                </label>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map((priority) => (
                    <button
                      key={priority}
                      onClick={() => handleMultiSelect('priority', priority)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        filters.priority.includes(priority)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleMultiSelect('category', category)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        filters.category.includes(category)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={filters.dateRange.from}
                      onChange={(e) => handleDateChange('from', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={filters.dateRange.to}
                      onChange={(e) => handleDateChange('to', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Export Options */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/95">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Export Results</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onExport('csv');
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => {
                      onExport('excel');
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
  );

  return (
    <>
      {/* Filter Button */}
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
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Portal Modal to body */}
      {typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
