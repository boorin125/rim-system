# Plan: Add Device Selector to Spare Part Form

## Changes:
1. **SparePartForm.tsx** - Add `storeId` prop, fetch store equipment, add Device dropdown at top of EQUIPMENT_REPLACEMENT section, auto-fill old device info on selection
2. **ResolveIncidentModal.tsx** - Add `storeId` prop, pass to SparePartForm
3. **incidents/[id]/page.tsx** - Pass `incident.store.id` to ResolveIncidentModal
4. **Backend syncEquipmentFromSparePart** - Also update brand/model when syncing equipment on resolve
