// src/modules/stores/services/excel.service.ts

import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ParsedStoreRow {
  rowNumber: number;
  code: string;
  name: string;
  company: string;
  storeType?: string;
  address?: string;
  province?: string;
  slaRegion?: string;
  postalCode?: string;
  area?: string;
  serviceCenter?: string;
  phone?: string;
  email?: string;
  googleMapLink?: string;
  circuitId?: string;
  routerIp?: string;
  switchIp?: string;
  accessPointIp?: string;
  pcServerIp?: string;
  pcPrinterIp?: string;
  pmcComputerIp?: string;
  sbsComputerIp?: string;
  vatComputerIp?: string;
  posIp?: string;
  edcIp?: string;
  scoIp?: string;
  peopleCounterIp?: string;
  digitalTvIp?: string;
  timeAttendanceIp?: string;
  cctvIp?: string;
  mondayOpen?: string;
  mondayClose?: string;
  tuesdayOpen?: string;
  tuesdayClose?: string;
  wednesdayOpen?: string;
  wednesdayClose?: string;
  thursdayOpen?: string;
  thursdayClose?: string;
  fridayOpen?: string;
  fridayClose?: string;
  saturdayOpen?: string;
  saturdayClose?: string;
  sundayOpen?: string;
  sundayClose?: string;
  holidayOpen?: string;
  holidayClose?: string;
  openDate?: string;
  closeDate?: string;
  storeStatus?: string;
  notes?: string;
}

@Injectable()
export class ExcelService {
  /**
   * Parse Excel file and return store rows
   */
  async parseExcelFile(file: Express.Multer.File): Promise<ParsedStoreRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    
    // Get first worksheet (Store Data)
    const worksheet = workbook.getWorksheet('Store Data') || workbook.getWorksheet(1);
    
    if (!worksheet) {
      throw new Error('ไม่พบ worksheet ในไฟล์ Excel');
    }
    
    const rows: ParsedStoreRow[] = [];
    
    // Parse each row (skip header row 1)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      // ✅ Handle different cell value types properly
      const getValue = (cellNum: number): string => {
        const cell = row.getCell(cellNum);
        const value = cell.value;

        if (value === null || value === undefined) return '';

        // Handle Date objects from Excel
        if (value instanceof Date) {
          // Check if it's a valid date
          if (!isNaN(value.getTime())) {
            // Return as YYYY-MM-DD format
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          return '';
        }

        // Handle different cell value types
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return String(value);
        if (typeof value === 'boolean') return String(value);

        // Handle hyperlink cells: { text: 'display text', hyperlink: 'url' }
        if (typeof value === 'object' && 'text' in value) {
          return String((value as any).text).trim();
        }

        // Handle rich text
        if (typeof value === 'object' && 'richText' in value) {
          return (value as any).richText.map((t: any) => t.text).join('').trim();
        }

        // Handle formula results
        if (typeof value === 'object' && 'result' in value) {
          return String((value as any).result).trim();
        }

        return String(value).trim();
      };

      // Helper to convert Excel time serial numbers to HH:MM format
      const getTimeValue = (cellNum: number): string => {
        const cell = row.getCell(cellNum);
        const value = cell.value;

        if (value === null || value === undefined) return '';

        // Excel stores time as a decimal fraction of a day (e.g. 0.4167 = 10:00, 0.9167 = 22:00)
        if (typeof value === 'number' && value >= 0 && value < 1) {
          const totalMinutes = Math.round(value * 24 * 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // Handle Date objects (Excel may parse time cells as Date with epoch date)
        if (value instanceof Date && !isNaN(value.getTime())) {
          const year = value.getFullYear();
          // ExcelJS returns time-only cells as Date with epoch 1899-12-30 or 1970-01-01
          if (year <= 1900 || year === 1970) {
            // Use UTC to avoid timezone offset issues
            const hours = value.getUTCHours();
            const minutes = value.getUTCMinutes();
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
        }

        // Already a string like "10:00"
        const str = String(value).trim();
        // Validate HH:MM pattern
        if (/^\d{1,2}:\d{2}$/.test(str)) {
          const [h, m] = str.split(':');
          return `${h.padStart(2, '0')}:${m}`;
        }

        // Number > 1 could be minutes or misformatted — try to interpret
        if (typeof value === 'number' && value >= 1) {
          // Could be a number like 1000 meaning 10:00, or a serial > 1 day
          const fraction = value % 1;
          if (fraction > 0) {
            const totalMinutes = Math.round(fraction * 24 * 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
        }

        return str;
      };

      // Skip empty rows (check Company at column 1 or Store Code at column 2)
      const company = getValue(1);
      const code = getValue(2);
      if (!company && !code) return;
      
      rows.push({
        rowNumber,
        // Basic Info (1-5) - New order: Company, Store Code, Store Name, Province, Store Type
        company: getValue(1),
        code: getValue(2),
        name: getValue(3),
        province: getValue(4)?.toString().toUpperCase().trim() || undefined,
        storeType: getValue(5),
        // Address (6-10) - Address, Postal Code, SLA Region, Area, Service Center
        address: getValue(6),
        postalCode: getValue(7),
        slaRegion: getValue(8),
        area: getValue(9),
        serviceCenter: getValue(10),
        // Contact (11-13)
        phone: getValue(11),
        email: getValue(12),
        googleMapLink: getValue(13),
        // Network (14-29)
        circuitId: getValue(14),
        routerIp: getValue(15),
        switchIp: getValue(16),
        accessPointIp: getValue(17),
        pcServerIp: getValue(18),
        pcPrinterIp: getValue(19),
        pmcComputerIp: getValue(20),
        sbsComputerIp: getValue(21),
        vatComputerIp: getValue(22),
        posIp: getValue(23),
        edcIp: getValue(24),
        scoIp: getValue(25),
        peopleCounterIp: getValue(26),
        digitalTvIp: getValue(27),
        timeAttendanceIp: getValue(28),
        cctvIp: getValue(29),
        // Working Hours (30-45) - Use getTimeValue to handle Excel time serial numbers
        mondayOpen: getTimeValue(30),
        mondayClose: getTimeValue(31),
        tuesdayOpen: getTimeValue(32),
        tuesdayClose: getTimeValue(33),
        wednesdayOpen: getTimeValue(34),
        wednesdayClose: getTimeValue(35),
        thursdayOpen: getTimeValue(36),
        thursdayClose: getTimeValue(37),
        fridayOpen: getTimeValue(38),
        fridayClose: getTimeValue(39),
        saturdayOpen: getTimeValue(40),
        saturdayClose: getTimeValue(41),
        sundayOpen: getTimeValue(42),
        sundayClose: getTimeValue(43),
        holidayOpen: getTimeValue(44),
        holidayClose: getTimeValue(45),
        // Lifecycle (46-48)
        openDate: getValue(46),
        closeDate: getValue(47),
        storeStatus: getValue(48),
        // Notes (49)
        notes: getValue(49),
      });
    });
    
    return rows;
  }
  
  /**
   * Generate Excel file from stores
   */
  async generateExcel(stores: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // ========================================
    // Sheet 1: Store Data
    // ========================================
    const dataSheet = workbook.addWorksheet('Stores');
    
    // Define columns (same order as import template)
    dataSheet.columns = [
      { header: 'Company', key: 'company', width: 15 },
      { header: 'Store Code', key: 'storeCode', width: 15 },
      { header: 'Store Name', key: 'name', width: 30 },
      { header: 'Province', key: 'province', width: 15 },
      { header: 'Store Type', key: 'storeType', width: 12 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Postal Code', key: 'postalCode', width: 12 },
      { header: 'SLA Region', key: 'slaRegion', width: 15 },
      { header: 'Area', key: 'area', width: 20 },
      { header: 'Service Center', key: 'serviceCenter', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Google Map Link', key: 'googleMapLink', width: 30 },
      { header: 'Circuit ID', key: 'circuitId', width: 15 },
      { header: 'Router IP', key: 'routerIp', width: 15 },
      { header: 'Switch IP', key: 'switchIp', width: 15 },
      { header: 'Access Point IP', key: 'accessPointIp', width: 15 },
      { header: 'PC Server IP', key: 'pcServerIp', width: 15 },
      { header: 'PC Printer IP', key: 'pcPrinterIp', width: 15 },
      { header: 'PMC Computer IP', key: 'pmcComputerIp', width: 15 },
      { header: 'SBS Computer IP', key: 'sbsComputerIp', width: 15 },
      { header: 'VAT Computer IP', key: 'vatComputerIp', width: 15 },
      { header: 'POS IP', key: 'posIp', width: 15 },
      { header: 'EDC IP', key: 'edcIp', width: 15 },
      { header: 'SCO IP', key: 'scoIp', width: 15 },
      { header: 'People Counter IP', key: 'peopleCounterIp', width: 15 },
      { header: 'Digital TV IP', key: 'digitalTvIp', width: 15 },
      { header: 'Time Attendance IP', key: 'timeAttendanceIp', width: 15 },
      { header: 'CCTV IP', key: 'cctvIp', width: 15 },
      { header: 'Monday Open', key: 'mondayOpen', width: 12 },
      { header: 'Monday Close', key: 'mondayClose', width: 12 },
      { header: 'Tuesday Open', key: 'tuesdayOpen', width: 12 },
      { header: 'Tuesday Close', key: 'tuesdayClose', width: 12 },
      { header: 'Wednesday Open', key: 'wednesdayOpen', width: 12 },
      { header: 'Wednesday Close', key: 'wednesdayClose', width: 12 },
      { header: 'Thursday Open', key: 'thursdayOpen', width: 12 },
      { header: 'Thursday Close', key: 'thursdayClose', width: 12 },
      { header: 'Friday Open', key: 'fridayOpen', width: 12 },
      { header: 'Friday Close', key: 'fridayClose', width: 12 },
      { header: 'Saturday Open', key: 'saturdayOpen', width: 12 },
      { header: 'Saturday Close', key: 'saturdayClose', width: 12 },
      { header: 'Sunday Open', key: 'sundayOpen', width: 12 },
      { header: 'Sunday Close', key: 'sundayClose', width: 12 },
      { header: 'Holiday Open', key: 'holidayOpen', width: 12 },
      { header: 'Holiday Close', key: 'holidayClose', width: 12 },
      { header: 'Open Date', key: 'openDate', width: 12 },
      { header: 'Close Date', key: 'closeDate', width: 12 },
      { header: 'Store Status', key: 'storeStatus', width: 12 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];
    
    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.height = 20;
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Add data rows
    stores.forEach(store => {
      dataSheet.addRow({
        storeCode: store.storeCode,  // ✅ Fixed: ใช้ storeCode ไม่ใช่ code
        name: store.name,
        company: store.company,
        storeType: store.storeType,
        address: store.address,
        province: store.province,
        slaRegion: store.slaRegion,
        postalCode: store.postalCode,
        area: store.area,
        serviceCenter: store.serviceCenter,
        phone: store.phone,
        email: store.email,
        googleMapLink: store.googleMapLink,
        circuitId: store.circuitId,
        routerIp: store.routerIp,
        switchIp: store.switchIp,
        accessPointIp: store.accessPointIp,
        pcServerIp: store.pcServerIp,
        pcPrinterIp: store.pcPrinterIp,
        pmcComputerIp: store.pmcComputerIp,
        sbsComputerIp: store.sbsComputerIp,
        vatComputerIp: store.vatComputerIp,
        posIp: store.posIp,
        edcIp: store.edcIp,
        scoIp: store.scoIp,
        peopleCounterIp: store.peopleCounterIp,
        digitalTvIp: store.digitalTvIp,
        timeAttendanceIp: store.timeAttendanceIp,
        cctvIp: store.cctvIp,
        mondayOpen: store.mondayOpen,
        mondayClose: store.mondayClose,
        tuesdayOpen: store.tuesdayOpen,
        tuesdayClose: store.tuesdayClose,
        wednesdayOpen: store.wednesdayOpen,
        wednesdayClose: store.wednesdayClose,
        thursdayOpen: store.thursdayOpen,
        thursdayClose: store.thursdayClose,
        fridayOpen: store.fridayOpen,
        fridayClose: store.fridayClose,
        saturdayOpen: store.saturdayOpen,
        saturdayClose: store.saturdayClose,
        sundayOpen: store.sundayOpen,
        sundayClose: store.sundayClose,
        holidayOpen: store.holidayOpen,
        holidayClose: store.holidayClose,
        openDate: store.openDate ? this.formatDate(store.openDate) : '',
        closeDate: store.closeDate ? this.formatDate(store.closeDate) : '',
        storeStatus: store.storeStatus,
        notes: store.notes,
        createdAt: store.createdAt ? this.formatDateTime(store.createdAt) : '',
        updatedAt: store.updatedAt ? this.formatDateTime(store.updatedAt) : '',
      });
    });
    
    // Add auto-filter
    dataSheet.autoFilter = {
      from: 'A1',
      to: `AZ1`
    };
    
    // Freeze header row
    dataSheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
    
    // ========================================
    // Sheet 2: Summary
    // ========================================
    const summarySheet = workbook.addWorksheet('Summary');
    
    summarySheet.getCell('A1').value = '📊 Export Summary';
    summarySheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF0066CC' } };
    summarySheet.mergeCells('A1:B1');
    
    // Calculate statistics
    const totalStores = stores.length;
    const activeStores = stores.filter(s => s.storeStatus === 'ACTIVE').length;
    const inactiveStores = stores.filter(s => s.storeStatus === 'INACTIVE').length;
    
    const byProvince: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    stores.forEach(store => {
      const province = store.province || 'Unknown';
      byProvince[province] = (byProvince[province] || 0) + 1;
      
      const company = store.company || 'Unknown';
      byCompany[company] = (byCompany[company] || 0) + 1;
      
      const type = store.storeType || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    // Add summary data
    let row = 3;
    summarySheet.getCell(`A${row}`).value = 'Total Stores:';
    summarySheet.getCell(`B${row}`).value = totalStores;
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    
    summarySheet.getCell(`A${row}`).value = 'Active Stores:';
    summarySheet.getCell(`B${row}`).value = activeStores;
    row++;
    
    summarySheet.getCell(`A${row}`).value = 'Inactive Stores:';
    summarySheet.getCell(`B${row}`).value = inactiveStores;
    row += 2;
    
    summarySheet.getCell(`A${row}`).value = 'By Province:';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    Object.entries(byProvince).forEach(([province, count]) => {
      summarySheet.getCell(`A${row}`).value = province;
      summarySheet.getCell(`B${row}`).value = count;
      row++;
    });
    row++;
    
    summarySheet.getCell(`A${row}`).value = 'By Company:';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    Object.entries(byCompany).forEach(([company, count]) => {
      summarySheet.getCell(`A${row}`).value = company;
      summarySheet.getCell(`B${row}`).value = count;
      row++;
    });
    row++;
    
    summarySheet.getCell(`A${row}`).value = 'By Store Type:';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    Object.entries(byType).forEach(([type, count]) => {
      summarySheet.getCell(`A${row}`).value = type;
      summarySheet.getCell(`B${row}`).value = count;
      row++;
    });
    
    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 15;
    
    // ✅ Fixed: Convert ArrayBuffer to Buffer properly
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Format datetime as YYYY-MM-DD HH:MM:SS
   */
  private formatDateTime(date: Date | string): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}