// src/utils/thai-provinces.ts
// Canonical list of Thailand's 77 provinces. The stored value everywhere (stores.province,
// users.province, users.responsible_provinces) is `en` — official English name in UPPERCASE.
// ⚠️ Keep in sync with frontend/src/data/thai-provinces.ts
import { BadRequestException } from '@nestjs/common';

export interface ThaiProvince {
  en: string;
  th: string;
  aliases?: string[]; // other spellings seen in the wild (matching ignores spaces/case anyway)
}

export const THAI_PROVINCES: ThaiProvince[] = [
  { en: 'BANGKOK', th: 'กรุงเทพมหานคร', aliases: ['KRUNG THEP', 'KRUNG THEP MAHA NAKHON', 'BKK', 'กรุงเทพ', 'กทม'] },
  { en: 'AMNAT CHAROEN', th: 'อำนาจเจริญ', aliases: ['AMNAJ CHAROEN'] },
  { en: 'ANG THONG', th: 'อ่างทอง' },
  { en: 'BUENG KAN', th: 'บึงกาฬ', aliases: ['BUNG KAN', 'BUENGKARN'] },
  { en: 'BURIRAM', th: 'บุรีรัมย์', aliases: ['BURI RAM', 'BURIRUM'] },
  { en: 'CHACHOENGSAO', th: 'ฉะเชิงเทรา', aliases: ['CHACHERNGSAO', 'CHACHENGSAO'] },
  { en: 'CHAI NAT', th: 'ชัยนาท', aliases: ['CHAINART'] },
  { en: 'CHAIYAPHUM', th: 'ชัยภูมิ', aliases: ['CHAIYAPHOOM'] },
  { en: 'CHANTHABURI', th: 'จันทบุรี', aliases: ['CHANTABURI', 'CHANTHABURY'] },
  { en: 'CHIANG MAI', th: 'เชียงใหม่', aliases: ['CHIENG MAI', 'CHIANGMAI'] },
  { en: 'CHIANG RAI', th: 'เชียงราย', aliases: ['CHIENG RAI'] },
  { en: 'CHONBURI', th: 'ชลบุรี', aliases: ['CHON BURI', 'CHOLBURI'] },
  { en: 'CHUMPHON', th: 'ชุมพร', aliases: ['CHUMPORN', 'CHUMPON'] },
  { en: 'KALASIN', th: 'กาฬสินธุ์' },
  { en: 'KAMPHAENG PHET', th: 'กำแพงเพชร', aliases: ['KAMPAENG PHET', 'KAMPHAENGPETCH'] },
  { en: 'KANCHANABURI', th: 'กาญจนบุรี', aliases: ['KANCHANABURY'] },
  { en: 'KHON KAEN', th: 'ขอนแก่น', aliases: ['KHONKEAN', 'KONKAEN'] },
  { en: 'KRABI', th: 'กระบี่' },
  { en: 'LAMPANG', th: 'ลำปาง' },
  { en: 'LAMPHUN', th: 'ลำพูน', aliases: ['LAMPOON', 'LAMPUN'] },
  { en: 'LOEI', th: 'เลย', aliases: ['LOEY'] },
  { en: 'LOPBURI', th: 'ลพบุรี', aliases: ['LOP BURI', 'LOPBURY'] },
  { en: 'MAE HONG SON', th: 'แม่ฮ่องสอน' },
  { en: 'MAHA SARAKHAM', th: 'มหาสารคาม', aliases: ['MAHASARAKAM'] },
  { en: 'MUKDAHAN', th: 'มุกดาหาร' },
  { en: 'NAKHON NAYOK', th: 'นครนายก' },
  { en: 'NAKHON PATHOM', th: 'นครปฐม', aliases: ['NAKORN PATHOM'] },
  { en: 'NAKHON PHANOM', th: 'นครพนม', aliases: ['NAKORN PHANOM'] },
  { en: 'NAKHON RATCHASIMA', th: 'นครราชสีมา', aliases: ['KORAT', 'KHORAT', 'NAKORN RATCHASIMA', 'โคราช'] },
  { en: 'NAKHON SAWAN', th: 'นครสวรรค์', aliases: ['NAKORN SAWAN'] },
  { en: 'NAKHON SI THAMMARAT', th: 'นครศรีธรรมราช', aliases: ['NAKHON SRI THAMMARAT', 'NAKORN SRI THAMMARAT'] },
  { en: 'NAN', th: 'น่าน' },
  { en: 'NARATHIWAT', th: 'นราธิวาส' },
  { en: 'NONG BUA LAMPHU', th: 'หนองบัวลำภู', aliases: ['NONG BUA LAM PHU'] },
  { en: 'NONG KHAI', th: 'หนองคาย' },
  { en: 'NONTHABURI', th: 'นนทบุรี', aliases: ['NONTABURI', 'NONTHABURY'] },
  { en: 'PATHUM THANI', th: 'ปทุมธานี', aliases: ['PATUM THANI', 'PATHUMTANI'] },
  { en: 'PATTANI', th: 'ปัตตานี', aliases: ['PATANI'] },
  { en: 'PHANG NGA', th: 'พังงา', aliases: ['PANGNGA'] },
  { en: 'PHATTHALUNG', th: 'พัทลุง', aliases: ['PHATTALUNG', 'PATTALUNG'] },
  { en: 'PHAYAO', th: 'พะเยา' },
  { en: 'PHETCHABUN', th: 'เพชรบูรณ์', aliases: ['PETCHABUN'] },
  { en: 'PHETCHABURI', th: 'เพชรบุรี', aliases: ['PHETBURI', 'PETCHABURI', 'PETCHBURI'] },
  { en: 'PHICHIT', th: 'พิจิตร', aliases: ['PICHIT'] },
  { en: 'PHITSANULOK', th: 'พิษณุโลก', aliases: ['PITSANULOK'] },
  { en: 'PHRA NAKHON SI AYUTTHAYA', th: 'พระนครศรีอยุธยา', aliases: ['AYUTTHAYA', 'AYUTHAYA', 'AYUDHYA', 'อยุธยา'] },
  { en: 'PHRAE', th: 'แพร่', aliases: ['PRAE'] },
  { en: 'PHUKET', th: 'ภูเก็ต', aliases: ['PUKET'] },
  { en: 'PRACHINBURI', th: 'ปราจีนบุรี', aliases: ['PRACHIN BURI'] },
  { en: 'PRACHUAP KHIRI KHAN', th: 'ประจวบคีรีขันธ์', aliases: ['PRACHUAB KHIRI KHAN', 'PRACHUAP KIRI KHAN'] },
  { en: 'RANONG', th: 'ระนอง' },
  { en: 'RATCHABURI', th: 'ราชบุรี', aliases: ['RATBURI', 'RAJABURI'] },
  { en: 'RAYONG', th: 'ระยอง' },
  { en: 'ROI ET', th: 'ร้อยเอ็ด' },
  { en: 'SA KAEO', th: 'สระแก้ว', aliases: ['SA KAEW', 'SRAKAEO'] },
  { en: 'SAKON NAKHON', th: 'สกลนคร', aliases: ['SAKON NAKORN'] },
  { en: 'SAMUT PRAKAN', th: 'สมุทรปราการ', aliases: ['SAMUT PRAKARN', 'SAMUTPRAKAN'] },
  { en: 'SAMUT SAKHON', th: 'สมุทรสาคร', aliases: ['SAMUT SAKORN'] },
  { en: 'SAMUT SONGKHRAM', th: 'สมุทรสงคราม', aliases: ['SAMUT SONGKRAM'] },
  { en: 'SARABURI', th: 'สระบุรี' },
  { en: 'SATUN', th: 'สตูล', aliases: ['SATOON'] },
  { en: 'SING BURI', th: 'สิงห์บุรี' },
  { en: 'SISAKET', th: 'ศรีสะเกษ', aliases: ['SI SA KET', 'SRISAKET', 'SRI SAKET', 'SRISAKES'] },
  { en: 'SONGKHLA', th: 'สงขลา', aliases: ['SONGKLA', 'HAT YAI'] },
  { en: 'SUKHOTHAI', th: 'สุโขทัย', aliases: ['SUKOTHAI'] },
  { en: 'SUPHAN BURI', th: 'สุพรรณบุรี', aliases: ['SUPHANBURY', 'SUPANBURI'] },
  { en: 'SURAT THANI', th: 'สุราษฎร์ธานี', aliases: ['SURAT TANI', 'SURATHANI'] },
  { en: 'SURIN', th: 'สุรินทร์' },
  { en: 'TAK', th: 'ตาก' },
  { en: 'TRANG', th: 'ตรัง' },
  { en: 'TRAT', th: 'ตราด', aliases: ['TRAD'] },
  { en: 'UBON RATCHATHANI', th: 'อุบลราชธานี', aliases: ['UBON', 'UBON RAJATHANI'] },
  { en: 'UDON THANI', th: 'อุดรธานี', aliases: ['UDON', 'UDORN THANI'] },
  { en: 'UTHAI THANI', th: 'อุทัยธานี' },
  { en: 'UTTARADIT', th: 'อุตรดิตถ์', aliases: ['UTARADIT'] },
  { en: 'YALA', th: 'ยะลา' },
  { en: 'YASOTHON', th: 'ยโสธร' },
];

/** Comparison key: case-, space- and punctuation-insensitive; drops "จังหวัด"/"จ."/"CHANGWAT"/"PROVINCE" */
export function provinceKey(raw: string): string {
  return raw
    .normalize('NFC')
    .toUpperCase()
    .trim()
    .replace(/^(จังหวัด|จ\.|CHANGWAT)\s*/u, '')
    .replace(/\s*PROVINCE$/, '')
    .replace(/[\s.\-_'’,()]/g, '');
}

const LOOKUP = new Map<string, string>();
for (const p of THAI_PROVINCES) {
  for (const name of [p.en, p.th, ...(p.aliases ?? [])]) LOOKUP.set(provinceKey(name), p.en);
}

/** Canonical province (UPPERCASE English) for any spelling / Thai name, or null when unknown. */
export function matchProvince(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  return LOOKUP.get(provinceKey(raw)) ?? null;
}

export function isCanonicalProvince(value: string): boolean {
  return THAI_PROVINCES.some((p) => p.en === value);
}

/** For write paths: '' / null → null, known spelling → canonical, anything else → 400 */
export function requireProvince(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null || !String(raw).trim()) return null;
  const canonical = matchProvince(String(raw));
  if (!canonical) {
    throw new BadRequestException(`ไม่รู้จักจังหวัด "${raw}" — กรุณาเลือกจากรายการ 77 จังหวัด`);
  }
  return canonical;
}
