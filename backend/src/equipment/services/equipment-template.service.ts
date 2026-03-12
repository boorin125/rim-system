import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class EquipmentTemplateService {
  /**
   * Generate Excel template for equipment import
   */
  async generateTemplate(): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Instructions
    const instructionsSheet = workbook.addWorksheet('คำแนะนำ', {
      properties: { defaultRowHeight: 20 },
    });

    instructionsSheet.columns = [
      { width: 50 },
      { width: 50 },
    ];

    // Header
    instructionsSheet.getCell('A1').value = 'คำแนะนำการใช้งาน Template นำเข้าอุปกรณ์';
    instructionsSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '002060' } };
    instructionsSheet.mergeCells('A1:B1');

    // Instructions
    const instructions = [
      '',
      '1. กรุณากรอกข้อมูลในแผ่นงาน "ข้อมูลอุปกรณ์" เท่านั้น',
      '2. อย่าแก้ไขชื่อคอลัมน์ในแถวที่ 1',
      '3. ฟิลด์ที่มีเครื่องหมาย * เป็นฟิลด์บังคับ (ต้องกรอก)',
      '4. สามารถนำเข้าได้สูงสุด 1,000 รายการต่อครั้ง',
      '',
      'รายละเอียดฟิลด์:',
      '- Serial Number*: หมายเลขเครื่อง (ต้องไม่ซ้ำ)',
      '- Name*: ชื่ออุปกรณ์',
      '- Category*: ประเภทอุปกรณ์ (NETWORK, COMPUTER, POS, PRINTER, ROUTER, SWITCH, CCTV, OTHER)',
      '- Brand: ยี่ห้อ',
      '- Model: รุ่น',
      '- Purchase Date: วันที่ซื้อ (รูปแบบ: YYYY-MM-DD)',
      '- Warranty Expiry: วันที่รับประกันหมดอายุ (รูปแบบ: YYYY-MM-DD)',
      '- Status: สถานะ (ACTIVE, INACTIVE, MAINTENANCE, RETIRED)',
      '- Store Code*: รหัสสาขา (ต้องมีในระบบ)',
      '',
      'หมายเหตุ:',
      '- ใช้รูปแบบวันที่แบบ ISO: YYYY-MM-DD (เช่น 2024-12-20)',
      '- หากไม่ระบุ Status จะใช้ค่าเริ่มต้นเป็น ACTIVE',
      '- ตรวจสอบให้แน่ใจว่า Store Code มีอยู่ในระบบก่อนนำเข้า',
    ];

    instructions.forEach((text, index) => {
      const row = index + 3;
      instructionsSheet.getCell(`A${row}`).value = text;
      instructionsSheet.getCell(`A${row}`).alignment = {
        vertical: 'top',
        wrapText: true,
      };
      instructionsSheet.mergeCells(`A${row}:B${row}`);
    });

    // Sheet 2: Data Entry
    const dataSheet = workbook.addWorksheet('ข้อมูลอุปกรณ์');

    // Define columns
    dataSheet.columns = [
      { header: 'Serial Number *', key: 'serialNumber', width: 20 },
      { header: 'Name *', key: 'name', width: 30 },
      { header: 'Category *', key: 'category', width: 15 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Store Code *', key: 'storeCode', width: 15 },
    ];

    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Add example data
    const exampleData = [
      {
        serialNumber: 'SN-ROUTER-001',
        name: 'Cisco Router 2901',
        category: 'ROUTER',
        brand: 'Cisco',
        model: '2901',
        purchaseDate: '2024-01-15',
        warrantyExpiry: '2027-01-15',
        status: 'ACTIVE',
        storeCode: 'WAT-BKK-001',
      },
      {
        serialNumber: 'SN-PC-001',
        name: 'Dell OptiPlex 7010',
        category: 'COMPUTER',
        brand: 'Dell',
        model: 'OptiPlex 7010',
        purchaseDate: '2024-02-20',
        warrantyExpiry: '2027-02-20',
        status: 'ACTIVE',
        storeCode: 'WAT-BKK-001',
      },
      {
        serialNumber: 'SN-POS-001',
        name: 'NCR RealPOS 82XRT',
        category: 'POS',
        brand: 'NCR',
        model: '82XRT',
        purchaseDate: '2023-06-15',
        warrantyExpiry: '2024-06-15',
        status: 'ACTIVE',
        storeCode: 'WAT-BKK-002',
      },
    ];

    exampleData.forEach((data) => {
      dataSheet.addRow(data);
    });

    // Apply borders to all cells
    dataSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Sheet 3: Field Guide
    const guideSheet = workbook.addWorksheet('คู่มือฟิลด์');

    guideSheet.columns = [
      { width: 20 },
      { width: 50 },
      { width: 30 },
    ];

    // Header
    guideSheet.getCell('A1').value = 'Field Name';
    guideSheet.getCell('B1').value = 'Description';
    guideSheet.getCell('C1').value = 'Valid Values / Format';
    
    const guideHeaderRow = guideSheet.getRow(1);
    guideHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    guideHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '70AD47' },
    };
    guideHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    guideHeaderRow.height = 25;

    // Field guide data
    const fieldGuides = [
      {
        field: 'Serial Number *',
        description: 'หมายเลขเครื่อง (ต้องไม่ซ้ำในระบบ)',
        values: '3-100 characters',
      },
      {
        field: 'Name *',
        description: 'ชื่ออุปกรณ์',
        values: 'Max 200 characters',
      },
      {
        field: 'Category *',
        description: 'ประเภทอุปกรณ์',
        values: 'NETWORK, COMPUTER, POS, PRINTER, ROUTER, SWITCH, CCTV, OTHER',
      },
      {
        field: 'Brand',
        description: 'ยี่ห้อ',
        values: 'Max 100 characters (Optional)',
      },
      {
        field: 'Model',
        description: 'รุ่น',
        values: 'Max 100 characters (Optional)',
      },
      {
        field: 'Purchase Date',
        description: 'วันที่ซื้อ',
        values: 'YYYY-MM-DD (e.g., 2024-12-20) (Optional)',
      },
      {
        field: 'Warranty Expiry',
        description: 'วันที่รับประกันหมดอายุ',
        values: 'YYYY-MM-DD (e.g., 2027-12-20) (Optional)',
      },
      {
        field: 'Status',
        description: 'สถานะอุปกรณ์',
        values: 'ACTIVE, INACTIVE, MAINTENANCE, RETIRED (Default: ACTIVE)',
      },
      {
        field: 'Store Code *',
        description: 'รหัสสาขา (ต้องมีในระบบ)',
        values: 'Existing store code (e.g., WAT-BKK-001)',
      },
    ];

    fieldGuides.forEach((guide) => {
      const row = guideSheet.addRow([guide.field, guide.description, guide.values]);
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    return await workbook.xlsx.writeBuffer();
  }
}
