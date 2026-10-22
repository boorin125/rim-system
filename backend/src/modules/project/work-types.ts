// src/modules/project/work-types.ts
// Work type of a project task → the evidence the technician must provide before sending the task.
// Single source: completeTask checks it and GET /projects/work-types sends it to the UI.

export type WorkTypeKey =
  | 'GENERAL' | 'ROLLOUT' | 'WIRING' | 'INSTALL' | 'CLEAR_DATA' | 'STANDBY'
  | 'CLOSED_STORE' | 'RENOVATE' | 'REFIT' | 'EXT_PROMOTION' | 'SOFTWARE_ROLLOUT';

export type EvidenceSection =
  /** Photos of this section; `pointName` = every photo needs a point name ("POS#1") */
  | { key: string; kind: 'photos'; label: string; hint?: string; min: number; pointName?: boolean }
  /** Points, each with a BEFORE and an AFTER photo */
  | { key: string; kind: 'beforeAfter'; label: string; hint?: string; min: number }
  /** Test items: PASS / FAIL / NA (+ photo unless NA, note when FAIL); technicians may add items */
  | { key: string; kind: 'tests'; label: string; hint?: string; items: string[] }
  /** Equipment swapped (ProjectEquipment rows) */
  | { key: string; kind: 'equipment'; label: string; hint?: string; min: number };

export interface WorkTypeDef {
  key: WorkTypeKey;
  label: string;
  description: string;
  sections: EvidenceSection[];
  /** GENERAL keeps the old rule: work photo + checklist file */
  legacy?: boolean;
}

const NETWORK_TESTS = ['Ping / Internet ใช้งานได้', 'ความเร็ว Network (Speed test)'];

export const WORK_TYPES: WorkTypeDef[] = [
  {
    key: 'GENERAL',
    label: 'งานทั่วไป',
    description: 'รูปงาน + ไฟล์ Checklist',
    legacy: true,
    sections: [],
  },
  {
    key: 'ROLLOUT',
    label: 'Rollout — เปลี่ยนอุปกรณ์',
    description: 'อุปกรณ์ที่เปลี่ยน (Brand / Model / S/N เก่า-ใหม่) + รูปอุปกรณ์เก่า-ใหม่',
    sections: [
      { key: 'equipment', kind: 'equipment', label: 'อุปกรณ์ที่เปลี่ยน', hint: 'Brand / Model / S/N ของตัวเก่าและตัวใหม่', min: 1 },
      { key: 'swap', kind: 'beforeAfter', label: 'รูปอุปกรณ์ เก่า → ใหม่', hint: 'จุดละ 1 อุปกรณ์ เช่น "POS#1 Printer"', min: 1 },
    ],
  },
  {
    key: 'WIRING',
    label: 'Wiring — เดินสาย LAN',
    description: 'รูปการเดินสายทีละจุด พร้อมชื่อจุด',
    sections: [
      { key: 'wiring', kind: 'photos', label: 'รูปการเดินสาย', hint: 'ระบุชื่อจุดในแต่ละรูป เช่น "POS#1", "AP หน้าร้าน"', min: 1, pointName: true },
    ],
  },
  {
    key: 'INSTALL',
    label: 'Install Equipment — ติดตั้งอุปกรณ์ใหม่',
    description: 'รูปการติดตั้ง (Inventory รายชิ้น — เร็วๆ นี้)',
    sections: [
      { key: 'install', kind: 'photos', label: 'รูปการติดตั้ง', hint: 'ระบุอุปกรณ์ / จุดติดตั้งในแต่ละรูป', min: 1, pointName: true },
    ],
  },
  {
    key: 'CLEAR_DATA',
    label: 'Clear Data — ตรวจระบบ + เคลียร์ข้อมูลก่อนเปิดร้าน',
    description: 'ผลเทสอุปกรณ์ทุกจุด + ยอดขายเป็น 0 + วันที่เริ่มขายถูกต้อง',
    sections: [
      {
        key: 'devices',
        kind: 'tests',
        label: 'ทดสอบอุปกรณ์แต่ละจุด',
        hint: 'เพิ่มหัวข้อตามจำนวนเครื่องจริงได้ เช่น "POS#2 ขายทดสอบ"',
        items: ['POS ขายทดสอบ', 'Printer ใบเสร็จ', 'Scanner', 'Cash Drawer', 'Pole Display', 'PC Server', 'Network / Internet'],
      },
      {
        key: 'clear',
        kind: 'tests',
        label: 'เคลียร์ข้อมูล',
        items: ['ยอดขายเป็น 0 ไม่มียอดตกค้าง', 'วันที่เริ่มขายถูกต้อง'],
      },
    ],
  },
  {
    key: 'STANDBY',
    label: 'Stand by — สแตนด์บายวันงาน',
    description: 'รูปบรรยากาศงาน + ความเรียบร้อยงานติดตั้ง',
    sections: [
      { key: 'atmosphere', kind: 'photos', label: 'รูปบรรยากาศงาน', min: 1 },
      { key: 'tidy', kind: 'photos', label: 'ความเรียบร้อยงานติดตั้ง', min: 1 },
    ],
  },
  {
    key: 'CLOSED_STORE',
    label: 'Closed Store — เก็บอุปกรณ์กลับ (ปิดร้าน)',
    description: 'รูปอุปกรณ์ที่เก็บกลับ พร้อมชื่ออุปกรณ์ (เทียบ Inventory — เร็วๆ นี้)',
    sections: [
      { key: 'collected', kind: 'photos', label: 'รูปอุปกรณ์ที่เก็บกลับ', hint: 'ระบุชื่ออุปกรณ์ในแต่ละรูป', min: 1, pointName: true },
    ],
  },
  {
    key: 'RENOVATE',
    label: 'Renovate — ย้ายจุด Network',
    description: 'รูปก่อน-หลังแต่ละจุด + ผลเทส Network',
    sections: [
      { key: 'points', kind: 'beforeAfter', label: 'รูปก่อน → หลัง แต่ละจุด', min: 1 },
      { key: 'network', kind: 'tests', label: 'ผลเทส Network', items: NETWORK_TESTS },
    ],
  },
  {
    key: 'REFIT',
    label: 'Refit — ย้ายจุดอุปกรณ์',
    description: 'รูปก่อน-หลังแต่ละจุด (Cashier, Digital Sign ฯลฯ) + ผลเทส Network',
    sections: [
      { key: 'points', kind: 'beforeAfter', label: 'รูปก่อน → หลัง แต่ละจุด', hint: 'เช่น "Cashier 1", "Digital Sign หน้าร้าน"', min: 1 },
      { key: 'network', kind: 'tests', label: 'ผลเทส Network', items: NETWORK_TESTS },
    ],
  },
  {
    key: 'EXT_PROMOTION',
    label: 'External Promotion — บูทกิจกรรม',
    description: 'รูปติดตั้ง + เทสระบบขาย + เทส Promotion + รูปบรรยากาศ',
    sections: [
      { key: 'install', kind: 'photos', label: 'รูปการติดตั้ง', min: 1 },
      { key: 'sale', kind: 'tests', label: 'เทสระบบขาย', items: ['ขายทดสอบ + พิมพ์ใบเสร็จ', 'ชำระเงิน (เงินสด / บัตร / QR)'] },
      { key: 'promotion', kind: 'tests', label: 'เทส Promotion', items: ['Promotion คำนวณถูกต้อง'] },
      { key: 'atmosphere', kind: 'photos', label: 'รูปบรรยากาศงาน', min: 1 },
    ],
  },
  {
    key: 'SOFTWARE_ROLLOUT',
    label: 'Software Rollout — อัปเดต Software',
    description: 'รูปก่อน-หลังอัปเดต + ผลเทส',
    sections: [
      { key: 'version', kind: 'beforeAfter', label: 'หน้าจอเวอร์ชัน ก่อน → หลังอัปเดต', hint: 'จุดละเครื่อง เช่น "POS#1"', min: 1 },
      { key: 'test', kind: 'tests', label: 'ผลเทสหลังอัปเดต', items: ['โปรแกรมเปิดใช้งานได้', 'ฟังก์ชันหลักทำงานปกติ'] },
    ],
  },
];

export const WORK_TYPE_KEYS = WORK_TYPES.map((w) => w.key);

export function workTypeDef(key?: string | null): WorkTypeDef {
  return WORK_TYPES.find((w) => w.key === key) ?? WORK_TYPES[0];
}

interface EvidenceInput {
  photos: { category: string; section: string | null; phase: string | null; pointName: string | null; comment: string | null }[];
  testResults: { section: string; itemName: string; result: string; note: string | null; photoPath: string | null }[];
  equipment: unknown[];
  checklists: unknown[];
}

export interface SectionStatus {
  key: string;
  label: string;
  ok: boolean;
  /** what is still missing, in Thai — empty when ok */
  missing: string[];
}

/** Evidence progress of a task — every section must be ok before the task can be sent */
export function evaluateEvidence(workType: string | null | undefined, task: EvidenceInput): SectionStatus[] {
  const def = workTypeDef(workType);
  if (def.legacy) {
    const workPhotos = task.photos.filter((p) => p.category !== 'CHECK_IN').length;
    return [
      { key: 'photos', label: 'รูปภาพงาน', ok: workPhotos > 0, missing: workPhotos > 0 ? [] : ['รูปภาพงาน'] },
      { key: 'checklist', label: 'Checklist', ok: task.checklists.length > 0, missing: task.checklists.length > 0 ? [] : ['Checklist'] },
    ];
  }

  return def.sections.map((s) => {
    const missing: string[] = [];
    if (s.kind === 'photos') {
      const photos = task.photos.filter((p) => p.section === s.key);
      if (photos.length < s.min) missing.push(`${s.label} อย่างน้อย ${s.min} รูป`);
      if (s.pointName && photos.some((p) => !(p.pointName || '').trim())) missing.push(`ชื่อจุดของ${s.label}ให้ครบทุกรูป`);
    } else if (s.kind === 'beforeAfter') {
      const points = new Map<string, Set<string>>();
      for (const p of task.photos.filter((x) => x.section === s.key)) {
        const name = (p.pointName || '').trim() || '(ไม่มีชื่อจุด)';
        if (!points.has(name)) points.set(name, new Set());
        points.get(name)!.add(p.phase || '');
      }
      const complete = [...points.values()].filter((ph) => ph.has('BEFORE') && ph.has('AFTER')).length;
      if (complete < s.min) missing.push(`${s.label} (ก่อน + หลัง) อย่างน้อย ${s.min} จุด`);
      const half = [...points.entries()].filter(([, ph]) => !(ph.has('BEFORE') && ph.has('AFTER'))).map(([n]) => n);
      if (half.length) missing.push(`รูปก่อน/หลังยังไม่ครบ: ${half.join(', ')}`);
    } else if (s.kind === 'tests') {
      const rows = task.testResults.filter((t) => t.section === s.key);
      const notDone = s.items.filter((i) => !rows.some((r) => r.itemName === i));
      if (notDone.length) missing.push(`${s.label}: ${notDone.join(', ')}`);
      const noPhoto = rows.filter((r) => r.result !== 'NA' && !r.photoPath).map((r) => r.itemName);
      if (noPhoto.length) missing.push(`รูปผลเทส: ${noPhoto.join(', ')}`);
      const failNoNote = rows.filter((r) => r.result === 'FAIL' && !(r.note || '').trim()).map((r) => r.itemName);
      if (failNoNote.length) missing.push(`หมายเหตุของข้อที่ไม่ผ่าน: ${failNoNote.join(', ')}`);
    } else if (s.kind === 'equipment') {
      if (task.equipment.length < s.min) missing.push(`${s.label} อย่างน้อย ${s.min} รายการ`);
    }
    return { key: s.key, label: s.label, ok: missing.length === 0, missing };
  });
}
