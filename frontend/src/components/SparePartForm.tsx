// frontend/src/components/SparePartForm.tsx - UPDATED WITH DARK THEME + AUTOCOMPLETE

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Package, Camera, AlertCircle, Search, Cpu, ArrowRightLeft } from 'lucide-react';
import axios from 'axios';
import BarcodeScannerModal from './BarcodeScannerModal';

export interface SparePart {
  id: string;
  // Repair Type - ประเภทการซ่อม
  repairType: 'EQUIPMENT_REPLACEMENT' | 'COMPONENT_REPLACEMENT';

  // === EQUIPMENT_REPLACEMENT Fields ===
  // Device selector (เลือกจาก Equipment ของ Store)
  selectedDeviceId?: number;
  // Old Device
  oldDeviceName: string;
  oldSerialNo: string;
  oldEquipmentId?: number;  // ✅ เชื่อมโยงกับ Equipment ที่ถูกถอดออก
  // New Device
  newDeviceName: string;    // composed from newBrand + newModel for backend
  newSerialNo: string;
  newBrand?: string;        // ยี่ห้อของอุปกรณ์ใหม่
  newModel?: string;        // รุ่นของอุปกรณ์ใหม่
  newEquipmentId?: number;  // ✅ เชื่อมโยงกับ Equipment ที่ใส่เข้าไป
  // Replacement Type
  replacementType: 'PERMANENT' | 'TEMPORARY';

  // === COMPONENT_REPLACEMENT Fields ===
  // เปลี่ยนเฉพาะชิ้นส่วนภายใน (เช่น แบตเตอรี่ใน UPS)
  componentName?: string;       // ชื่อชิ้นส่วน เช่น "Battery", "Power Supply"
  oldComponentSerial?: string;  // Serial เดิมของชิ้นส่วน
  newComponentSerial?: string;  // Serial ใหม่ของชิ้นส่วน
  parentEquipmentId?: number;   // อุปกรณ์หลักที่ชิ้นส่วนอยู่ใน
  parentEquipmentName?: string; // ชื่ออุปกรณ์หลัก (for display)

  // Optional
  notes?: string;
}

interface SparePartFormProps {
  spareParts: SparePart[];
  onChange: (spareParts: SparePart[]) => void;
  disabled?: boolean;
  storeId?: number;  // Store ID สำหรับดึง Equipment ของสาขานั้น
  incidentEquipmentIds?: number[]; // กรอง Old Device ให้แสดงเฉพาะอุปกรณ์ที่เลือกไว้ใน Incident (MA)
}

// Device suggestion interface - เชื่อมกับ Equipment จริงในระบบ
interface DeviceSuggestion {
  id: number;              // Equipment ID (int)
  name: string;
  position?: string;       // ตำแหน่งอุปกรณ์ เช่น "POS#1", "Kitchen Printer#1"
  serialNumber: string;    // Serial Number ของ Equipment
  model?: string;
  brand?: string;
  category?: string;
  status?: string;
  storeName?: string;      // ชื่อสาขา
}

export default function SparePartForm({
  spareParts,
  onChange,
  disabled = false,
  storeId,
  incidentEquipmentIds,
}: SparePartFormProps) {
  const [scanningFor, setScanningFor] = useState<{ partId: string; field: 'oldSerialNo' | 'newSerialNo' | 'oldComponentSerial' | 'newComponentSerial' } | null>(null);

  // Store equipment list for Device dropdown
  const [storeEquipment, setStoreEquipment] = useState<DeviceSuggestion[]>([]);
  const [filteredStoreEquipment, setFilteredStoreEquipment] = useState<DeviceSuggestion[]>([]);
  const [loadingStoreEquipment, setLoadingStoreEquipment] = useState(false);

  // Autocomplete states
  const [oldDeviceSuggestions, setOldDeviceSuggestions] = useState<{ [key: string]: DeviceSuggestion[] }>({});
  const [newDeviceSuggestions, setNewDeviceSuggestions] = useState<{ [key: string]: DeviceSuggestion[] }>({});
  const [showOldDropdown, setShowOldDropdown] = useState<string | null>(null);
  const [showNewDropdown, setShowNewDropdown] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Brand / Model autocomplete states
  const [brandSuggestions, setBrandSuggestions] = useState<{ [key: string]: string[] }>({});
  const [modelSuggestions, setModelSuggestions] = useState<{ [key: string]: string[] }>({});
  const [showBrandDropdown, setShowBrandDropdown] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState<string | null>(null);
  const brandDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const modelDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Refs for click outside detection
  const oldDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const newDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Fetch store equipment for Device dropdown
  useEffect(() => {
    if (!storeId) return;
    const fetchStoreEquipment = async () => {
      setLoadingStoreEquipment(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/equipment`,
          {
            params: { storeId, status: 'ACTIVE', limit: 200 },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const list = response.data?.data || [];
        const mapped: DeviceSuggestion[] = list.map((device: any) => ({
          id: device.id,
          name: device.name,
          position: device.position,
          serialNumber: device.serialNumber,
          model: device.model,
          brand: device.brand,
          category: device.category,
          status: device.status,
          storeName: device.store?.name || device.store?.storeCode,
        }));
        setStoreEquipment(mapped);
        // Filter to incident equipment if provided (for MA incidents)
        const filtered = incidentEquipmentIds?.length
          ? mapped.filter(d => incidentEquipmentIds.includes(d.id))
          : mapped;
        setFilteredStoreEquipment(filtered);

      } catch (error) {
        console.error('Failed to fetch store equipment:', error);
      } finally {
        setLoadingStoreEquipment(false);
      }
    };
    fetchStoreEquipment();
  }, [storeId]);

  // Auto-select the single device whenever a new EQUIPMENT_REPLACEMENT part is added
  // (runs after storeEquipment loads AND whenever spareParts.length changes)
  useEffect(() => {
    if (filteredStoreEquipment.length !== 1) return;
    const d = filteredStoreEquipment[0];
    const needsUpdate = spareParts.some(
      p => p.repairType === 'EQUIPMENT_REPLACEMENT' && !p.selectedDeviceId
    );
    if (!needsUpdate) return;
    const displayName = [d.position, d.brand, d.model].filter(Boolean).join(' ') || d.name;
    onChange(
      spareParts.map(p =>
        p.repairType === 'EQUIPMENT_REPLACEMENT' && !p.selectedDeviceId
          ? { ...p, selectedDeviceId: d.id, oldDeviceName: displayName, oldSerialNo: d.serialNumber || '', oldEquipmentId: d.id, newDeviceName: p.newDeviceName || d.name }
          : p
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStoreEquipment, spareParts.length]);

  // Auto-fill parentEquipment for COMPONENT_REPLACEMENT when incident has exactly 1 device
  useEffect(() => {
    if (filteredStoreEquipment.length !== 1) return;
    const d = filteredStoreEquipment[0];
    const needsUpdate = spareParts.some(
      p => p.repairType === 'COMPONENT_REPLACEMENT' && !p.parentEquipmentId
    );
    if (!needsUpdate) return;
    const displayName = [d.position, d.brand, d.model].filter(Boolean).join(' ') || d.name;
    onChange(
      spareParts.map(p =>
        p.repairType === 'COMPONENT_REPLACEMENT' && !p.parentEquipmentId
          ? { ...p, parentEquipmentName: displayName, parentEquipmentId: d.id }
          : p
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStoreEquipment, spareParts.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showOldDropdown) {
        const ref = oldDropdownRefs.current[showOldDropdown];
        if (ref && !ref.contains(event.target as Node)) setShowOldDropdown(null);
      }
      if (showNewDropdown) {
        const ref = newDropdownRefs.current[showNewDropdown];
        if (ref && !ref.contains(event.target as Node)) setShowNewDropdown(null);
      }
      if (showBrandDropdown) {
        const ref = brandDropdownRefs.current[showBrandDropdown];
        if (ref && !ref.contains(event.target as Node)) setShowBrandDropdown(null);
      }
      if (showModelDropdown) {
        const ref = modelDropdownRefs.current[showModelDropdown];
        if (ref && !ref.contains(event.target as Node)) setShowModelDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOldDropdown, showNewDropdown, showBrandDropdown, showModelDropdown]);

  // ✅ Fetch device suggestions from Equipment API
  const searchDevices = async (query: string, storeId?: number): Promise<DeviceSuggestion[]> => {
    if (!query || query.length < 2) return [];

    try {
      setIsSearching(true);
      const token = localStorage.getItem('token');

      // ใช้ /equipment endpoint พร้อม search parameter
      const params: any = { search: query, limit: 15 };
      if (storeId) params.storeId = storeId;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Map response to DeviceSuggestion format
      const equipmentList = response.data?.data || [];
      return equipmentList.map((device: any) => ({
        id: device.id,
        name: device.name,
        position: device.position, // ตำแหน่งอุปกรณ์
        serialNumber: device.serialNumber,
        model: device.model,
        brand: device.brand,
        category: device.category,
        status: device.status,
        storeName: device.store?.name || device.store?.storeCode,
      }));
    } catch (error) {
      console.error('Failed to search devices:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  // Get category of the selected old device (for brand/model filtering)
  const getOldDeviceCategory = (partId: string): string | undefined => {
    const part = spareParts.find(p => p.id === partId);
    if (!part?.selectedDeviceId) return undefined;
    return storeEquipment.find(d => d.id === part.selectedDeviceId)?.category;
  };

  // Fetch distinct brand suggestions for a category (fetch all, filter client-side)
  const fetchBrandSuggestions = async (partId: string, query: string) => {
    const category = getOldDeviceCategory(partId);
    try {
      const token = localStorage.getItem('token');
      const params: any = { limit: 500 };
      if (category) params.category = category;
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data?.data || [];
      const allBrands = [...new Set<string>(list.map((e: any) => e.brand).filter(Boolean))].sort();
      const filtered = query ? allBrands.filter(b => b.toLowerCase().includes(query.toLowerCase())) : allBrands;
      setBrandSuggestions(prev => ({ ...prev, [partId]: filtered }));
      setShowBrandDropdown(filtered.length > 0 ? partId : null);
    } catch { setShowBrandDropdown(null); }
  };

  // Fetch distinct model suggestions for a category + brand (query is optional — show all under brand if empty)
  const fetchModelSuggestions = async (partId: string, query: string, brand: string) => {
    const category = getOldDeviceCategory(partId);
    // Require at least a brand or a query to avoid fetching the entire DB
    if (!brand && !query) { setShowModelDropdown(null); return; }
    try {
      const token = localStorage.getItem('token');
      const params: any = { limit: 300 };
      if (category) params.category = category;
      if (brand) params.brand = brand;
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data?.data || [];
      const allModels = [...new Set<string>(list.map((e: any) => e.model).filter(Boolean))].sort();
      // Filter client-side by query text if user has typed something
      const filtered = query ? allModels.filter(m => m.toLowerCase().includes(query.toLowerCase())) : allModels;
      setModelSuggestions(prev => ({ ...prev, [partId]: filtered }));
      setShowModelDropdown(filtered.length > 0 ? partId : null);
    } catch { setShowModelDropdown(null); }
  };

  // Handle device name change with search
  const handleDeviceNameChange = async (
    partId: string, 
    field: 'oldDeviceName' | 'newDeviceName', 
    value: string
  ) => {
    updateSparePart(partId, field, value);

    // Search for suggestions
    if (value.length >= 2) {
      let suggestions = await searchDevices(value, field === 'newDeviceName' ? storeId : undefined);

      if (field === 'oldDeviceName') {
        // For Old Device: filter to incident equipment only if specified
        if (incidentEquipmentIds?.length) {
          suggestions = suggestions.filter(d => incidentEquipmentIds.includes(d.id));
        }
        setOldDeviceSuggestions(prev => ({ ...prev, [partId]: suggestions }));
        setShowOldDropdown(partId);
      } else {
        setNewDeviceSuggestions(prev => ({ ...prev, [partId]: suggestions }));
        setShowNewDropdown(partId);
      }
    } else {
      if (field === 'oldDeviceName') {
        setShowOldDropdown(null);
      } else {
        setShowNewDropdown(null);
      }
    }
  };

  // Select device from suggestions - เก็บทั้งชื่อ, Serial Number และ Equipment ID
  const selectDevice = (
    partId: string,
    field: 'oldDeviceName' | 'newDeviceName',
    device: DeviceSuggestion
  ) => {
    // สร้างชื่อแสดงผล โดยรวม position ถ้ามี
    let deviceName = device.position ? `[${device.position}] ` : '';
    deviceName += device.brand && device.model
      ? `${device.name} (${device.brand} ${device.model})`
      : device.model
        ? `${device.name} ${device.model}`
        : device.name;

    // อัพเดตหลาย field พร้อมกัน
    const updatedParts = spareParts.map((part) => {
      if (part.id !== partId) return part;

      if (field === 'oldDeviceName') {
        return {
          ...part,
          oldDeviceName: deviceName,
          oldSerialNo: device.serialNumber,
          oldEquipmentId: device.id,
        };
      } else {
        return {
          ...part,
          newDeviceName: deviceName,
          newSerialNo: device.serialNumber,
          newEquipmentId: device.id,
          newBrand: device.brand || '',
          newModel: device.model || '',
        };
      }
    });

    onChange(updatedParts);

    if (field === 'oldDeviceName') {
      setShowOldDropdown(null);
    } else {
      setShowNewDropdown(null);
    }
  };

  // Handle Device dropdown selection — auto-fill old device info
  const handleDeviceSelect = (partId: string, deviceId: number | '') => {
    const updatedParts = spareParts.map((part) => {
      if (part.id !== partId) return part;

      if (deviceId === '' || !deviceId) {
        // Clear selection
        return {
          ...part,
          selectedDeviceId: undefined,
          oldDeviceName: '',
          oldSerialNo: '',
          oldEquipmentId: undefined,
        };
      }

      const device = storeEquipment.find((d) => d.id === deviceId);
      if (!device) return part;

      // Build display name: [Position] Brand Model
      const parts: string[] = [];
      if (device.position) parts.push(device.position);
      if (device.brand) parts.push(device.brand);
      if (device.model) parts.push(device.model);
      if (parts.length === 0) parts.push(device.name);
      const displayName = parts.join(' ');

      return {
        ...part,
        selectedDeviceId: device.id,
        oldDeviceName: displayName,
        oldSerialNo: device.serialNumber || '',
        oldEquipmentId: device.id,
        // Auto-fill new device name with the same device type (new equipment inherits old device's name)
        newDeviceName: part.newDeviceName || device.name,
      };
    });

    onChange(updatedParts);
  };

  const addSparePart = () => {
    const newPart: SparePart = {
      id: `spare-${Date.now()}`,
      repairType: 'EQUIPMENT_REPLACEMENT', // Default to equipment replacement
      // Equipment Replacement fields
      selectedDeviceId: undefined,
      oldDeviceName: '',
      oldSerialNo: '',
      newDeviceName: '',
      newSerialNo: '',
      newBrand: '',
      newModel: '',
      replacementType: '' as any,
      // Component Replacement fields
      componentName: '',
      oldComponentSerial: '',
      newComponentSerial: '',
      parentEquipmentName: '',
      notes: '',
    };
    onChange([...spareParts, newPart]);
  };

  const removeSparePart = (id: string) => {
    onChange(spareParts.filter((part) => part.id !== id));
  };

  const updateSparePart = (id: string, field: keyof SparePart, value: string) => {
    onChange(
      spareParts.map((part) =>
        part.id === id ? { ...part, [field]: value } : part
      )
    );
  };

  const handleScanBarcode = (partId: string, field: 'oldSerialNo' | 'newSerialNo' | 'oldComponentSerial' | 'newComponentSerial') => {
    setScanningFor({ partId, field });
  };

  const handleBarcodeDetected = (value: string) => {
    if (!scanningFor) return;
    updateSparePart(scanningFor.partId, scanningFor.field, value);
    setScanningFor(null);
  };

  return (
    <div className="space-y-4">
      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={!!scanningFor}
        label="สแกน Serial Number"
        onDetect={handleBarcodeDetected}
        onClose={() => setScanningFor(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" />
          <h3 className="font-medium text-white">Spare Parts Used</h3>
          <span className="text-sm text-gray-400">({spareParts.length} items)</span>
        </div>
        <button
          type="button"
          onClick={addSparePart}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Part
        </button>
      </div>

      {/* Spare Parts List */}
      {spareParts.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-600/50 rounded-lg bg-slate-800/30">
          <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-300 mb-2">No spare parts added yet</p>
          <p className="text-xs text-gray-400">Click "Add Part" to add spare parts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {spareParts.map((part, index) => (
            <div
              key={part.id}
              className="border border-slate-700/50 rounded-lg p-4 space-y-4 bg-slate-800/30 shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  Spare Part #{index + 1}
                </h4>
                <button
                  type="button"
                  onClick={() => removeSparePart(part.id)}
                  disabled={disabled}
                  className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Remove part"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* REPAIR TYPE SELECTOR */}
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  ประเภทการซ่อม <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Equipment Replacement */}
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    part.repairType === 'EQUIPMENT_REPLACEMENT'
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-slate-600/50 hover:bg-slate-700/30'
                  }`}>
                    <input
                      type="radio"
                      name={`repair-type-${part.id}`}
                      value="EQUIPMENT_REPLACEMENT"
                      checked={part.repairType === 'EQUIPMENT_REPLACEMENT'}
                      onChange={(e) => updateSparePart(part.id, 'repairType', e.target.value)}
                      disabled={disabled}
                      className="sr-only"
                    />
                    <ArrowRightLeft className={`w-5 h-5 ${
                      part.repairType === 'EQUIPMENT_REPLACEMENT' ? 'text-blue-400' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white">เปลี่ยนอุปกรณ์</p>
                      <p className="text-xs text-gray-400">เปลี่ยนอุปกรณ์ทั้งตัว</p>
                    </div>
                  </label>

                  {/* Component Replacement */}
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    part.repairType === 'COMPONENT_REPLACEMENT'
                      ? 'border-purple-500 bg-purple-900/30'
                      : 'border-slate-600/50 hover:bg-slate-700/30'
                  }`}>
                    <input
                      type="radio"
                      name={`repair-type-${part.id}`}
                      value="COMPONENT_REPLACEMENT"
                      checked={part.repairType === 'COMPONENT_REPLACEMENT'}
                      onChange={(e) => updateSparePart(part.id, 'repairType', e.target.value)}
                      disabled={disabled}
                      className="sr-only"
                    />
                    <Cpu className={`w-5 h-5 ${
                      part.repairType === 'COMPONENT_REPLACEMENT' ? 'text-purple-400' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white">เปลี่ยนชิ้นส่วน</p>
                      <p className="text-xs text-gray-400">เปลี่ยนชิ้นส่วนภายใน</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* COMPONENT REPLACEMENT FIELDS */}
              {part.repairType === 'COMPONENT_REPLACEMENT' && (
                <>
                  {/* Parent Equipment */}
                  <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
                    <h5 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      อุปกรณ์หลัก (Parent Equipment)
                    </h5>
                    {/* Single device: show read-only chip */}
                    {filteredStoreEquipment.length === 1 ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 border border-purple-600/40 rounded-lg">
                        <Package className="w-4 h-4 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">
                            {part.parentEquipmentName || [filteredStoreEquipment[0].position, filteredStoreEquipment[0].brand, filteredStoreEquipment[0].model].filter(Boolean).join(' ') || filteredStoreEquipment[0].name}
                          </p>
                          <p className="text-xs text-purple-400 font-mono">S/N: {filteredStoreEquipment[0].serialNumber}</p>
                        </div>
                        <span className="text-xs text-purple-400 shrink-0">Auto</span>
                      </div>
                    ) : (
                      /* Multiple devices: live-search filtered to incident equipment only */
                      <div className="relative" ref={el => { oldDropdownRefs.current[`parent-${part.id}`] = el }}>
                        <label className="block text-xs font-medium text-gray-200 mb-1">
                          ชื่ออุปกรณ์ <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={part.parentEquipmentName || ''}
                            onChange={(e) => {
                              const updatedParts = spareParts.map(p =>
                                p.id === part.id
                                  ? { ...p, parentEquipmentName: e.target.value, parentEquipmentId: undefined }
                                  : p
                              );
                              onChange(updatedParts);
                              setShowOldDropdown(`parent-${part.id}`);
                            }}
                            onFocus={() => setShowOldDropdown(`parent-${part.id}`)}
                            disabled={disabled}
                            placeholder="พิมพ์เพื่อค้นหาอุปกรณ์..."
                            className="w-full px-3 py-2 pr-8 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                            required
                          />
                          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        {/* Dropdown: filtered from incident equipment only */}
                        {showOldDropdown === `parent-${part.id}` && (() => {
                          const q = (part.parentEquipmentName || '').toLowerCase();
                          const filtered = filteredStoreEquipment.filter(d =>
                            !q ||
                            d.name.toLowerCase().includes(q) ||
                            (d.brand || '').toLowerCase().includes(q) ||
                            (d.model || '').toLowerCase().includes(q) ||
                            (d.position || '').toLowerCase().includes(q)
                          );
                          return filtered.length > 0 ? (
                            <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                              {filtered.map((device) => (
                                <button
                                  key={device.id}
                                  type="button"
                                  onClick={() => {
                                    const deviceName = [device.position, device.brand, device.model].filter(Boolean).join(' ') || device.name;
                                    onChange(spareParts.map(p =>
                                      p.id === part.id
                                        ? { ...p, parentEquipmentName: deviceName, parentEquipmentId: device.id }
                                        : p
                                    ));
                                    setShowOldDropdown(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-left hover:bg-slate-600 transition-colors border-b border-slate-600/50 last:border-0"
                                >
                                  <div className="flex items-start gap-2">
                                    {device.position && (
                                      <span className="text-xs px-1.5 py-0.5 bg-yellow-900/40 text-yellow-300 rounded font-medium shrink-0">
                                        {device.position}
                                      </span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white font-medium truncate">{device.name}</p>
                                      {(device.brand || device.model) && (
                                        <p className="text-xs text-gray-400">{[device.brand, device.model].filter(Boolean).join(' ')}</p>
                                      )}
                                      <p className="text-xs text-purple-400 font-mono">S/N: {device.serialNumber}</p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Component Details */}
                  <div className="bg-cyan-900/20 border border-cyan-700/50 rounded-lg p-3">
                    <h5 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      ชิ้นส่วนที่เปลี่ยน (Component)
                    </h5>
                    <div className="grid grid-cols-1 gap-3">
                      {/* Component Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-200 mb-1">
                          ชื่อชิ้นส่วน <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={part.componentName || ''}
                          onChange={(e) => updateSparePart(part.id, 'componentName', e.target.value)}
                          disabled={disabled}
                          placeholder="e.g., Battery, Power Supply, Hard Drive"
                          className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                          required
                        />
                      </div>

                      {/* Old/New Component Serials */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-200 mb-1">
                            Serial เดิม <span className="text-red-400">*</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={part.oldComponentSerial || ''}
                              onChange={(e) => updateSparePart(part.id, 'oldComponentSerial', e.target.value)}
                              disabled={disabled}
                              placeholder="Serial ชิ้นส่วนเดิม"
                              className="flex-1 px-3 py-2 text-sm bg-red-900/20 border border-red-700/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => handleScanBarcode(part.id, 'oldComponentSerial')}
                              disabled={disabled || scanningFor !== null}
                              className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:bg-slate-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                              title="Scan barcode"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-200 mb-1">
                            Serial ใหม่ <span className="text-red-400">*</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={part.newComponentSerial || ''}
                              onChange={(e) => updateSparePart(part.id, 'newComponentSerial', e.target.value)}
                              disabled={disabled}
                              placeholder="Serial ชิ้นส่วนใหม่"
                              className="flex-1 px-3 py-2 text-sm bg-green-900/20 border border-green-700/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => handleScanBarcode(part.id, 'newComponentSerial')}
                              disabled={disabled || scanningFor !== null}
                              className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:bg-slate-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                              title="Scan barcode"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* EQUIPMENT REPLACEMENT FIELDS */}
              {part.repairType === 'EQUIPMENT_REPLACEMENT' && (
                <>
              {/* DEVICE SELECTOR - เลือก Device จาก Equipment ของ Store */}
              {storeId && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                  <h5 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    เลือก Device ที่ต้องการเปลี่ยน
                  </h5>
                  {loadingStoreEquipment ? (
                    <p className="text-xs text-yellow-300">กำลังโหลดข้อมูล Equipment...</p>
                  ) : filteredStoreEquipment.length === 0 ? (
                    <p className="text-xs text-gray-400">ไม่พบ Equipment ในสาขานี้ — สามารถกรอกข้อมูลเองได้</p>
                  ) : filteredStoreEquipment.length === 1 ? (
                    // Single device — show as static badge
                    <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-600/40 rounded-lg">
                      <Package className="w-4 h-4 text-yellow-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {filteredStoreEquipment[0].name}
                          {filteredStoreEquipment[0].brand || filteredStoreEquipment[0].model
                            ? ` — ${[filteredStoreEquipment[0].brand, filteredStoreEquipment[0].model].filter(Boolean).join(' ')}`
                            : ''}
                        </p>
                        {filteredStoreEquipment[0].serialNumber && (
                          <p className="text-xs text-yellow-300 font-mono">S/N: {filteredStoreEquipment[0].serialNumber}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Multiple devices — dropdown
                    <select
                      value={part.selectedDeviceId || ''}
                      onChange={(e) => handleDeviceSelect(part.id, e.target.value ? Number(e.target.value) : '')}
                      disabled={disabled}
                      className="w-full px-3 py-2.5 text-sm bg-slate-700/50 border border-slate-600/50 text-white rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">-- เลือก Device --</option>
                      {filteredStoreEquipment.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                          {device.brand || device.model
                            ? ` — ${[device.brand, device.model].filter(Boolean).join(' ')}`
                            : ''}
                          {device.serialNumber ? ` (S/N: ${device.serialNumber})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* OLD DEVICE SECTION */}
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Old Device (Removed)
                </h5>

                {(() => {
                  // Resolve the "old" device from DB — prefer explicit selection,
                  // fall back to the single-device case (badge shown above)
                  const dev = part.oldEquipmentId
                    ? storeEquipment.find(d => d.id === part.oldEquipmentId)
                    : filteredStoreEquipment.length === 1 ? filteredStoreEquipment[0] : null;

                  if (dev) {
                    const brand = dev.brand || '-';
                    const model = dev.model || '-';
                    // Use part.oldSerialNo if tech has overridden it, otherwise fall back to DB value
                    const displaySerial = part.oldSerialNo || dev.serialNumber || '';
                    const isMockSerial = dev.serialNumber && part.oldSerialNo &&
                      part.oldSerialNo.trim().toLowerCase() !== dev.serialNumber.trim().toLowerCase();
                    return (
                      /* ── Device from DB: name/brand/model read-only, serial editable ── */
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-200 mb-1">ชื่ออุปกรณ์</label>
                          <div className="px-3 py-2 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm text-gray-300">
                            {dev.name}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-200 mb-1">Brand</label>
                            <div className="px-3 py-2.5 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm text-white select-all">
                              {brand}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-200 mb-1">Model</label>
                            <div className="px-3 py-2.5 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm text-white select-all">
                              {model}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-200 mb-1">
                              Serial No. จริง
                              <span className="text-gray-400 font-normal ml-1">(แก้ได้ถ้า DB ไม่ตรง)</span>
                            </label>
                            <input
                              type="text"
                              value={displaySerial}
                              onChange={(e) => updateSparePart(part.id, 'oldSerialNo', e.target.value)}
                              disabled={disabled}
                              placeholder={dev.serialNumber || 'Serial No.'}
                              className="w-full px-3 py-2.5 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm font-mono text-red-200 focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:cursor-not-allowed"
                            />
                            {isMockSerial && (
                              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                ⚠️ Serial ใน DB: <span className="font-mono">{dev.serialNumber}</span> → จะถูกแก้เป็น <span className="font-mono">{part.oldSerialNo}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                  /* ── Manual input: no device selected ── */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Old Device Brand/Model with Autocomplete */}
                    <div className="relative" ref={el => { oldDropdownRefs.current[part.id] = el }}>
                      <label className="block text-xs font-medium text-gray-200 mb-1">
                        Brand / Model <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={part.oldDeviceName}
                          onChange={(e) =>
                            handleDeviceNameChange(part.id, 'oldDeviceName', e.target.value)
                          }
                          onFocus={() => {
                            if (part.oldDeviceName.length >= 2) {
                              setShowOldDropdown(part.id);
                            }
                          }}
                          disabled={disabled}
                          placeholder="e.g., HP RP2 / Epson TM-T82"
                          className="w-full px-3 py-2 pr-8 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                          required
                        />
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>

                      {/* Autocomplete Dropdown */}
                      {showOldDropdown === part.id && oldDeviceSuggestions[part.id]?.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                          {isSearching && (
                            <div className="p-3 text-center text-sm text-gray-400">
                              กำลังค้นหาอุปกรณ์...
                            </div>
                          )}
                          {oldDeviceSuggestions[part.id].map((device) => (
                            <button
                              key={device.id}
                              type="button"
                              onClick={() => selectDevice(part.id, 'oldDeviceName', device)}
                              className="w-full px-3 py-2.5 text-left hover:bg-slate-600 transition-colors border-b border-slate-600/50 last:border-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {device.position && (
                                      <span className="text-xs px-1.5 py-0.5 bg-yellow-900/40 text-yellow-300 rounded font-medium">
                                        {device.position}
                                      </span>
                                    )}
                                    <p className="text-sm text-white font-medium truncate">{device.name}</p>
                                  </div>
                                  <p className="text-xs text-blue-400 font-mono">S/N: {device.serialNumber}</p>
                                  {device.brand && device.model && (
                                    <p className="text-xs text-gray-400">{device.brand} {device.model}</p>
                                  )}
                                  {device.storeName && (
                                    <p className="text-xs text-gray-500">📍 {device.storeName}</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {device.category && (
                                    <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded">
                                      {device.category}
                                    </span>
                                  )}
                                  {device.status && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      device.status === 'ACTIVE' ? 'bg-green-900/30 text-green-300' :
                                      device.status === 'MAINTENANCE' ? 'bg-yellow-900/30 text-yellow-300' :
                                      'bg-gray-900/30 text-gray-300'
                                    }`}>
                                      {device.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Old Serial No with Barcode Scanner */}
                    <div>
                      <label className="block text-xs font-medium text-gray-200 mb-1">
                        Serial No. <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={part.oldSerialNo}
                          onChange={(e) =>
                            updateSparePart(part.id, 'oldSerialNo', e.target.value)
                          }
                          disabled={disabled}
                          placeholder="Scan or enter serial number"
                          className="flex-1 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleScanBarcode(part.id, 'oldSerialNo')}
                          disabled={disabled || scanningFor !== null}
                          className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:bg-slate-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                          title="Scan barcode"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </div>

              {/* NEW DEVICE SECTION */}
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  New Device (Installed)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Brand */}
                  <div
                    className="relative"
                    ref={el => { brandDropdownRefs.current[part.id] = el; }}
                  >
                    <label className="block text-xs font-medium text-gray-200 mb-1">
                      Brand / ยี่ห้อ <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={part.newBrand || ''}
                      onChange={(e) => {
                        updateSparePart(part.id, 'newBrand', e.target.value);
                        fetchBrandSuggestions(part.id, e.target.value);
                      }}
                      onFocus={() => {
                        fetchBrandSuggestions(part.id, part.newBrand || '');
                      }}
                      disabled={disabled}
                      placeholder="e.g., HP, Dell, Epson"
                      className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                      required
                      autoComplete="off"
                    />
                    {showBrandDropdown === part.id && (brandSuggestions[part.id]?.length ?? 0) > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                        {brandSuggestions[part.id].map(brand => (
                          <li
                            key={brand}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              updateSparePart(part.id, 'newBrand', brand);
                              setShowBrandDropdown(null);
                              // Auto-load models for the chosen brand immediately
                              fetchModelSuggestions(part.id, part.newModel || '', brand);
                            }}
                            className="px-3 py-2 text-sm text-white hover:bg-slate-700 cursor-pointer"
                          >
                            {brand}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Model */}
                  <div
                    className="relative"
                    ref={el => { modelDropdownRefs.current[part.id] = el; }}
                  >
                    <label className="block text-xs font-medium text-gray-200 mb-1">
                      Model / รุ่น <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={part.newModel || ''}
                      onChange={(e) => {
                        updateSparePart(part.id, 'newModel', e.target.value);
                        fetchModelSuggestions(part.id, e.target.value, part.newBrand || '');
                      }}
                      onFocus={() => {
                        fetchModelSuggestions(part.id, part.newModel || '', part.newBrand || '');
                      }}
                      disabled={disabled}
                      placeholder="e.g., EloPOS X10, ProBook 450"
                      className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                      required
                      autoComplete="off"
                    />
                    {showModelDropdown === part.id && (modelSuggestions[part.id]?.length ?? 0) > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                        {modelSuggestions[part.id].map(model => (
                          <li
                            key={model}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              updateSparePart(part.id, 'newModel', model);
                              setShowModelDropdown(null);
                            }}
                            className="px-3 py-2 text-sm text-white hover:bg-slate-700 cursor-pointer"
                          >
                            {model}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Serial No with Barcode Scanner */}
                  <div>
                    <label className="block text-xs font-medium text-gray-200 mb-1">
                      Serial No. <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={part.newSerialNo}
                        onChange={(e) => updateSparePart(part.id, 'newSerialNo', e.target.value)}
                        disabled={disabled}
                        placeholder="Scan or enter serial number"
                        className="flex-1 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleScanBarcode(part.id, 'newSerialNo')}
                        disabled={disabled || scanningFor !== null}
                        className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:bg-slate-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                        title="Scan barcode"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* REPLACEMENT TYPE */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <label className="block text-sm font-semibold text-blue-300 mb-3">
                  Replacement Type <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {/* Permanent */}
                  <label className="flex items-start gap-3 p-3 border-2 border-slate-600/50 rounded-lg cursor-pointer hover:bg-blue-900/30 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/40">
                    <input
                      type="radio"
                      name={`replacement-type-${part.id}`}
                      value="PERMANENT"
                      checked={part.replacementType === 'PERMANENT'}
                      onChange={(e) =>
                        updateSparePart(part.id, 'replacementType', e.target.value)
                      }
                      disabled={disabled}
                      className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        Permanent Replacement - เปลี่ยนถาวร
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Device is permanently replaced. Old device removed from inventory.
                      </p>
                    </div>
                  </label>

                  {/* Temporary */}
                  <label className="flex items-start gap-3 p-3 border-2 border-slate-600/50 rounded-lg cursor-pointer hover:bg-orange-900/30 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-900/40">
                    <input
                      type="radio"
                      name={`replacement-type-${part.id}`}
                      value="TEMPORARY"
                      checked={part.replacementType === 'TEMPORARY'}
                      onChange={(e) =>
                        updateSparePart(part.id, 'replacementType', e.target.value)
                      }
                      disabled={disabled}
                      className="mt-0.5 w-4 h-4 text-orange-600 focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        Temporary Spare - วางสแปร์ชั่วคราว
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Spare device installed temporarily. Must be returned later.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Warning for Temporary */}
                {part.replacementType === 'TEMPORARY' && (
                  <div className="flex items-start gap-2 mt-3 p-2 bg-orange-900/30 border border-orange-700/50 rounded text-xs text-orange-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Note:</strong> A "Return Spare Part" task will need to be created later to track the return of this device.
                    </p>
                  </div>
                )}
              </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={part.notes || ''}
                  onChange={(e) =>
                    updateSparePart(part.id, 'notes', e.target.value)
                  }
                  disabled={disabled}
                  placeholder="Any additional information about this replacement..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-800/30 disabled:cursor-not-allowed resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scanning Indicator */}
      {scanningFor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="glass-card border border-slate-700/50 rounded-lg p-6 max-w-sm text-center">
            <Camera className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Scanning Barcode...
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Point your camera at the barcode
            </p>
            <button
              onClick={() => setScanningFor(null)}
              className="px-4 py-2 bg-slate-700 text-gray-200 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg text-sm text-blue-200">
        <Package className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Spare Parts Tracking:</p>
          <ul className="text-xs space-y-0.5 list-disc list-inside">
            <li>Type device name to search from inventory (2+ characters)</li>
            <li>Use barcode scanner for accurate serial numbers</li>
            <li>Select replacement type for proper inventory tracking</li>
            <li>Temporary spares require follow-up return task</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
