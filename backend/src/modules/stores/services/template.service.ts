// src/modules/stores/services/template.service.ts

import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class TemplateService {
  /**
   * Generate Excel template for store import
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // ========================================
    // Sheet 1: Instructions
    // ========================================
    const instructionsSheet = workbook.addWorksheet('Instructions');
    
    // Title
    instructionsSheet.getCell('A1').value = '📋 Store Import Template - Instructions';
    instructionsSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF0066CC' } };
    instructionsSheet.mergeCells('A1:F1');
    
    // Instructions
    let row = 3;
    const instructions = [
      { label: 'How to use this template:', value: '', bold: true },
      { label: '', value: '1. Go to "Store Data" sheet' },
      { label: '', value: '2. Fill in store information (one store per row)' },
      { label: '', value: '3. Required fields are marked with * (red header)' },
      { label: '', value: '4. See "Field Guide" sheet for field descriptions' },
      { label: '', value: '5. Save and upload via RIM > Stores > Import Excel' },
      { label: '', value: '' },
      { label: 'Important Notes:', value: '', bold: true },
      { label: '', value: '• Do not delete header row' },
      { label: '', value: '• Do not change column order' },
      { label: '', value: '• Maximum 1000 stores per file' },
      { label: '', value: '• IP addresses must be valid format (e.g., 192.168.1.1)' },
      { label: '', value: '• Dates must be YYYY-MM-DD format' },
      { label: '', value: '• Times must be HH:MM format (24-hour)' },
      { label: '', value: '• Store codes can be reused for pop-up stores (after closing previous)' },
    ];
    
    instructions.forEach(item => {
      const cell = instructionsSheet.getCell(`A${row}`);
      cell.value = item.label || item.value;
      if (item.bold) {
        cell.font = { bold: true, size: 12 };
      }
      row++;
    });
    
    instructionsSheet.getColumn('A').width = 80;
    
    // ========================================
    // Sheet 2: Store Data (Template)
    // ========================================
    const dataSheet = workbook.addWorksheet('Store Data');
    
    // Define all columns with headers
    const columns = [
      // Basic Info (1-5)
      { header: 'Company *', key: 'company', width: 15 },
      { header: 'Store Code *', key: 'code', width: 15 },
      { header: 'Store Name *', key: 'name', width: 30 },
      { header: 'Province *', key: 'province', width: 15 },
      { header: 'Store Type', key: 'storeType', width: 12 },

      // Address (6-10)
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Postal Code', key: 'postalCode', width: 12 },
      { header: 'SLA Region', key: 'slaRegion', width: 15 },
      { header: 'Area', key: 'area', width: 20 },
      { header: 'Service Center', key: 'serviceCenter', width: 25 },
      
      // Contact
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Google Map Link', key: 'googleMapLink', width: 30 },
      
      // Network
      { header: 'Circuit ID', key: 'circuitId', width: 15 },
      { header: 'Router IP', key: 'routerIp', width: 15 },
      { header: 'Switch IP', key: 'switchIp', width: 15 },
      { header: 'Access Point IP', key: 'accessPointIp', width: 15 },
      
      // Servers & Computers
      { header: 'PC Server IP', key: 'pcServerIp', width: 15 },
      { header: 'PC Printer IP', key: 'pcPrinterIp', width: 15 },
      { header: 'PMC Computer IP', key: 'pmcComputerIp', width: 15 },
      { header: 'SBS Computer IP', key: 'sbsComputerIp', width: 15 },
      { header: 'VAT Computer IP', key: 'vatComputerIp', width: 15 },
      
      // POS & Payment
      { header: 'POS IP', key: 'posIp', width: 15 },
      { header: 'EDC IP', key: 'edcIp', width: 15 },
      { header: 'SCO IP', key: 'scoIp', width: 15 },
      
      // Other Devices
      { header: 'People Counter IP', key: 'peopleCounterIp', width: 15 },
      { header: 'Digital TV IP', key: 'digitalTvIp', width: 15 },
      { header: 'Time Attendance IP', key: 'timeAttendanceIp', width: 15 },
      { header: 'CCTV IP', key: 'cctvIp', width: 15 },
      
      // Working Hours
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
      
      // Store Lifecycle
      { header: 'Open Date', key: 'openDate', width: 12 },
      { header: 'Close Date', key: 'closeDate', width: 12 },
      { header: 'Store Status', key: 'storeStatus', width: 12 },
      
      // Metadata
      { header: 'Notes', key: 'notes', width: 40 },
    ];
    
    dataSheet.columns = columns;
    
    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.height = 20;
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Mark required fields in red (A=Company, B=Store Code, C=Store Name, D=Province)
    ['A1', 'B1', 'C1', 'D1'].forEach(cellAddress => {
      const cell = dataSheet.getCell(cellAddress);
      cell.font = { bold: true, size: 11, color: { argb: 'FFFF0000' } };
    });

    // Add data validation for dropdowns
    // Store Type dropdown (Column E = storeType)
    for (let i = 2; i <= 1001; i++) {
      const storeTypeCell = dataSheet.getCell(`E${i}`);
      storeTypeCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"permanent,pop_up,seasonal"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Store Type',
        error: 'Please select: permanent, pop_up, or seasonal'
      };
    }

    // SLA Region dropdown (Column H = slaRegion)
    for (let i = 2; i <= 1001; i++) {
      const slaRegionCell = dataSheet.getCell(`H${i}`);
      slaRegionCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"BANGKOK_METRO,PROVINCIAL"'],
        showErrorMessage: true,
        errorTitle: 'Invalid SLA Region',
        error: 'Please select: BANGKOK_METRO or PROVINCIAL'
      };
    }

    // Store Status dropdown (Column AW = 49th column = storeStatus)
    for (let i = 2; i <= 1001; i++) {
      const statusCell = dataSheet.getCell(`AW${i}`);
      statusCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"active,inactive"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Status',
        error: 'Please select: active or inactive'
      };
    }
    
    // Add sample data row
    dataSheet.addRow({
      code: 'WAT-BKK-001',
      name: 'Watsons Siam Paragon',
      company: 'Watsons',
      storeType: 'permanent',
      address: '991 Rama 1 Road, Pathumwan',
      province: 'Bangkok',
      slaRegion: 'BANGKOK_METRO',
      postalCode: '10330',
      area: 'Bangkok Central',
      serviceCenter: 'Bangkok Service Center',
      phone: '02-123-4567',
      email: 'siam@watsons.co.th',
      googleMapLink: 'https://maps.google.com/?q=13.7456,100.5344',
      circuitId: 'CIR-BKK-001',
      routerIp: '192.168.1.1',
      switchIp: '192.168.1.2',
      accessPointIp: '192.168.1.3',
      pcServerIp: '192.168.10.1',
      pcPrinterIp: '192.168.10.2',
      pmcComputerIp: '192.168.10.3',
      sbsComputerIp: '192.168.10.4',
      vatComputerIp: '192.168.10.5',
      posIp: '192.168.20.1',
      edcIp: '192.168.20.2',
      scoIp: '192.168.20.3',
      peopleCounterIp: '192.168.30.1',
      digitalTvIp: '192.168.30.2',
      timeAttendanceIp: '192.168.30.3',
      cctvIp: '192.168.30.4',
      mondayOpen: '10:00',
      mondayClose: '22:00',
      tuesdayOpen: '10:00',
      tuesdayClose: '22:00',
      wednesdayOpen: '10:00',
      wednesdayClose: '22:00',
      thursdayOpen: '10:00',
      thursdayClose: '22:00',
      fridayOpen: '10:00',
      fridayClose: '22:00',
      saturdayOpen: '10:00',
      saturdayClose: '22:00',
      sundayOpen: '10:00',
      sundayClose: '22:00',
      holidayOpen: '11:00',
      holidayClose: '20:00',
      openDate: '2020-01-15',
      closeDate: '',
      storeStatus: 'active',
      notes: 'Sample store data - you can delete this row'
    });
    
    // Style sample row (light yellow)
    const sampleRow = dataSheet.getRow(2);
    sampleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFE0' }
    };
    
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
    // Sheet 3: Field Guide
    // ========================================
    const guideSheet = workbook.addWorksheet('Field Guide');
    
    guideSheet.columns = [
      { header: 'Field Name', key: 'field', width: 20 },
      { header: 'Required', key: 'required', width: 10 },
      { header: 'Format', key: 'format', width: 15 },
      { header: 'Example', key: 'example', width: 25 },
      { header: 'Description', key: 'description', width: 50 }
    ];
    
    // Style header
    const guideHeaderRow = guideSheet.getRow(1);
    guideHeaderRow.font = { bold: true, size: 11 };
    guideHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    guideHeaderRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    
    // Add field descriptions (ordered same as template columns)
    const fieldGuide = [
      { field: 'company', required: 'Yes', format: 'Text', example: 'Watsons', description: 'Company name (e.g., Watsons, KFC, NTT)' },
      { field: 'code', required: 'Yes', format: 'Text', example: 'WAT-BKK-001', description: 'Unique store code. Can be reused for pop-up stores after closing.' },
      { field: 'name', required: 'Yes', format: 'Text', example: 'Watsons Siam Paragon', description: 'Full store name' },
      { field: 'province', required: 'Yes', format: 'Text', example: 'Bangkok', description: 'Province name' },
      { field: 'storeType', required: 'No', format: 'List', example: 'permanent', description: 'Type: permanent, pop_up, or seasonal' },
      { field: 'address', required: 'No', format: 'Text', example: '991 Rama 1 Road', description: 'Street address' },
      { field: 'postalCode', required: 'No', format: 'Text', example: '10330', description: 'Postal/ZIP code' },
      { field: 'slaRegion', required: 'No', format: 'List', example: 'BANGKOK_METRO', description: 'SLA Region: BANGKOK_METRO (กรุงเทพและปริมณฑล) or PROVINCIAL (ต่างจังหวัด)' },
      { field: 'area', required: 'No', format: 'Text', example: 'Bangkok Central', description: 'Area/Region for grouping stores' },
      { field: 'serviceCenter', required: 'No', format: 'Text', example: 'Bangkok Service Center', description: 'Responsible service center' },
      { field: 'phone', required: 'No', format: 'Text', example: '02-123-4567', description: 'Store phone number' },
      { field: 'email', required: 'No', format: 'Email', example: 'store@company.com', description: 'Store email address' },
      { field: 'googleMapLink', required: 'No', format: 'URL', example: 'https://maps.google.com/?q=...', description: 'Google Maps link' },
      { field: 'circuitId', required: 'No', format: 'Text', example: 'CIR-BKK-001', description: 'Network circuit ID' },
      { field: 'routerIp', required: 'No', format: 'IP', example: '192.168.1.1', description: 'Router IP address' },
      { field: 'switchIp', required: 'No', format: 'IP', example: '192.168.1.2', description: 'Network switch IP address' },
      { field: 'accessPointIp', required: 'No', format: 'IP', example: '192.168.1.3', description: 'WiFi access point IP address' },
      { field: 'pcServerIp', required: 'No', format: 'IP', example: '192.168.10.1', description: 'PC server IP address' },
      { field: 'mondayOpen', required: 'No', format: 'Time', example: '10:00', description: 'Monday opening time (HH:MM, 24-hour format)' },
      { field: 'mondayClose', required: 'No', format: 'Time', example: '22:00', description: 'Monday closing time (HH:MM, 24-hour format)' },
      { field: 'openDate', required: 'No', format: 'Date', example: '2020-01-15', description: 'Store opening date (YYYY-MM-DD)' },
      { field: 'closeDate', required: 'No', format: 'Date', example: '2025-04-01', description: 'Store closing date (leave blank if still open)' },
      { field: 'storeStatus', required: 'No', format: 'List', example: 'active', description: 'Status: active or inactive' },
      { field: 'notes', required: 'No', format: 'Text', example: 'Relocated from...', description: 'Additional notes or comments' },
    ];
    
    fieldGuide.forEach(item => {
      guideSheet.addRow(item);
    });
    
    // ✅ Fixed: Convert ArrayBuffer to Buffer properly
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}