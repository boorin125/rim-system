// thailand-regions.ts - Province to Region mapping + region colors

export const regionColors: Record<string, { fill: string; label: string; labelTh: string }> = {
  north:     { fill: '#bfdbfe', label: 'North',     labelTh: 'ภาคเหนือ' },
  northeast: { fill: '#fde68a', label: 'Northeast', labelTh: 'ภาคตะวันออกเฉียงเหนือ' },
  central:   { fill: '#fbcfe8', label: 'Central',   labelTh: 'ภาคกลาง' },
  east:      { fill: '#a7f3d0', label: 'East',      labelTh: 'ภาคตะวันออก' },
  west:      { fill: '#ddd6fe', label: 'West',      labelTh: 'ภาคตะวันตก' },
  south:     { fill: '#fed7aa', label: 'South',     labelTh: 'ภาคใต้' },
}

// Map province name (Thai) → region key
export const provinceToRegion: Record<string, string> = {
  // ภาคเหนือ (North) - 9 จังหวัด
  'เชียงใหม่': 'north', 'เชียงราย': 'north', 'ลำปาง': 'north', 'ลำพูน': 'north',
  'แม่ฮ่องสอน': 'north', 'น่าน': 'north', 'พะเยา': 'north', 'แพร่': 'north', 'อุตรดิตถ์': 'north',

  // ภาคตะวันออกเฉียงเหนือ (Northeast/Isan) - 20 จังหวัด
  'กาฬสินธุ์': 'northeast', 'ขอนแก่น': 'northeast', 'ชัยภูมิ': 'northeast',
  'นครพนม': 'northeast', 'นครราชสีมา': 'northeast', 'บึงกาฬ': 'northeast',
  'บุรีรัมย์': 'northeast', 'มหาสารคาม': 'northeast', 'มุกดาหาร': 'northeast',
  'ยโสธร': 'northeast', 'ร้อยเอ็ด': 'northeast', 'เลย': 'northeast',
  'ศรีสะเกษ': 'northeast', 'สกลนคร': 'northeast', 'สุรินทร์': 'northeast',
  'หนองคาย': 'northeast', 'หนองบัวลำภู': 'northeast', 'อำนาจเจริญ': 'northeast',
  'อุดรธานี': 'northeast', 'อุบลราชธานี': 'northeast',

  // ภาคกลาง (Central) - 22 จังหวัด
  'กรุงเทพมหานคร': 'central', 'กำแพงเพชร': 'central', 'ชัยนาท': 'central',
  'นครนายก': 'central', 'นครปฐม': 'central', 'นครสวรรค์': 'central',
  'นนทบุรี': 'central', 'ปทุมธานี': 'central', 'พระนครศรีอยุธยา': 'central',
  'พิจิตร': 'central', 'พิษณุโลก': 'central', 'เพชรบูรณ์': 'central',
  'ลพบุรี': 'central', 'สมุทรปราการ': 'central', 'สมุทรสงคราม': 'central',
  'สมุทรสาคร': 'central', 'สระบุรี': 'central', 'สิงห์บุรี': 'central',
  'สุโขทัย': 'central', 'สุพรรณบุรี': 'central', 'อ่างทอง': 'central', 'อุทัยธานี': 'central',

  // ภาคตะวันออก (East) - 7 จังหวัด
  'จันทบุรี': 'east', 'ฉะเชิงเทรา': 'east', 'ชลบุรี': 'east', 'ตราด': 'east',
  'ปราจีนบุรี': 'east', 'ระยอง': 'east', 'สระแก้ว': 'east',

  // ภาคตะวันตก (West) - 5 จังหวัด
  'กาญจนบุรี': 'west', 'ตาก': 'west', 'ประจวบคีรีขันธ์': 'west',
  'เพชรบุรี': 'west', 'ราชบุรี': 'west',

  // ภาคใต้ (South) - 14 จังหวัด
  'กระบี่': 'south', 'ชุมพร': 'south', 'ตรัง': 'south',
  'นครศรีธรรมราช': 'south', 'นราธิวาส': 'south', 'ปัตตานี': 'south',
  'พังงา': 'south', 'พัทลุง': 'south', 'ภูเก็ต': 'south',
  'ยะลา': 'south', 'ระนอง': 'south', 'สงขลา': 'south',
  'สตูล': 'south', 'สุราษฎร์ธานี': 'south',
}

// English name fallback mapping
export const provinceToRegionEN: Record<string, string> = {
  // North
  'Chiang Mai': 'north', 'Chiang Rai': 'north', 'Lampang': 'north', 'Lamphun': 'north',
  'Mae Hong Son': 'north', 'Nan': 'north', 'Phayao': 'north', 'Phrae': 'north', 'Uttaradit': 'north',
  // Northeast
  'Kalasin': 'northeast', 'Khon Kaen': 'northeast', 'Chaiyaphum': 'northeast',
  'Nakhon Phanom': 'northeast', 'Nakhon Ratchasima': 'northeast', 'Bueng Kan': 'northeast',
  'Buri Ram': 'northeast', 'Buriram': 'northeast', 'Maha Sarakham': 'northeast',
  'Mukdahan': 'northeast', 'Yasothon': 'northeast', 'Roi Et': 'northeast',
  'Loei': 'northeast', 'Si Sa Ket': 'northeast', 'Sisaket': 'northeast',
  'Sakon Nakhon': 'northeast', 'Surin': 'northeast', 'Nong Khai': 'northeast',
  'Nong Bua Lam Phu': 'northeast', 'Nong Bua Lamphu': 'northeast',
  'Amnat Charoen': 'northeast', 'Udon Thani': 'northeast', 'Ubon Ratchathani': 'northeast',
  // Central
  'Bangkok': 'central', 'Krung Thep Maha Nakhon': 'central',
  'Kamphaeng Phet': 'central', 'Chai Nat': 'central', 'Chainat': 'central',
  'Nakhon Nayok': 'central', 'Nakhon Pathom': 'central', 'Nakhon Sawan': 'central',
  'Nonthaburi': 'central', 'Pathum Thani': 'central', 'Phra Nakhon Si Ayutthaya': 'central',
  'Ayutthaya': 'central', 'Phichit': 'central', 'Phitsanulok': 'central',
  'Phetchabun': 'central', 'Lop Buri': 'central', 'Lopburi': 'central',
  'Samut Prakan': 'central', 'Samut Songkhram': 'central', 'Samut Sakhon': 'central',
  'Saraburi': 'central', 'Sing Buri': 'central', 'Singburi': 'central',
  'Sukhothai': 'central', 'Suphan Buri': 'central', 'Suphanburi': 'central',
  'Ang Thong': 'central', 'Uthai Thani': 'central',
  // East
  'Chanthaburi': 'east', 'Chachoengsao': 'east', 'Chon Buri': 'east', 'Chonburi': 'east',
  'Trat': 'east', 'Prachin Buri': 'east', 'Prachinburi': 'east',
  'Rayong': 'east', 'Sa Kaeo': 'east',
  // West
  'Kanchanaburi': 'west', 'Tak': 'west', 'Prachuap Khiri Khan': 'west',
  'Phetchaburi': 'west', 'Ratchaburi': 'west',
  // South
  'Krabi': 'south', 'Chumphon': 'south', 'Trang': 'south',
  'Nakhon Si Thammarat': 'south', 'Narathiwat': 'south', 'Pattani': 'south',
  'Phang Nga': 'south', 'Phangnga': 'south', 'Phatthalung': 'south',
  'Phuket': 'south', 'Yala': 'south', 'Ranong': 'south',
  'Songkhla': 'south', 'Satun': 'south', 'Surat Thani': 'south',
}

/**
 * Get region key from province name (supports Thai + English)
 */
export function getRegion(provinceName: string): string {
  return provinceToRegion[provinceName]
    || provinceToRegionEN[provinceName]
    || 'central' // fallback
}
