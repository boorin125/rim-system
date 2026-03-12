// frontend/src/utils/watermarkUtils.ts

/**
 * เพิ่มลายน้ำให้กับรูปภาพ
 * @param file - ไฟล์รูปภาพต้นฉบับ
 * @param text - ข้อความลายน้ำ (เช่น "Before" หรือ "After")
 * @param position - ตำแหน่งของลายน้ำ (default: 'bottom-right')
 * @returns Promise<File> - ไฟล์รูปภาพที่มีลายน้ำ
 */
export async function addWatermark(
  file: File,
  text: string,
  options?: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    fontSize?: number;
    fontFamily?: string;
    textColor?: string;
    backgroundColor?: string;
    padding?: number;
    opacity?: number;
  }
): Promise<File> {
  return new Promise((resolve, reject) => {
    const {
      position = 'bottom-right',
      fontSize = 48,
      fontFamily = 'Arial, sans-serif',
      textColor = '#FFFFFF',
      backgroundColor = 'rgba(0, 0, 0, 0.6)',
      padding = 20,
      opacity = 0.9,
    } = options || {};

    // สร้าง image element
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      try {
        // สร้าง canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // ตั้งค่าขนาด canvas ตามรูปภาพ
        canvas.width = img.width;
        canvas.height = img.height;

        // วาดรูปภาพต้นฉบับ
        ctx.drawImage(img, 0, 0);

        // ตั้งค่า font
        ctx.font = `bold ${fontSize}px ${fontFamily}`;

        // วัดขนาดข้อความ
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;

        // กำหนดตำแหน่งลายน้ำ
        let x = 0;
        let y = 0;

        switch (position) {
          case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
          case 'top-right':
            x = canvas.width - textWidth - padding;
            y = padding + textHeight;
            break;
          case 'bottom-left':
            x = padding;
            y = canvas.height - padding;
            break;
          case 'bottom-right':
            x = canvas.width - textWidth - padding;
            y = canvas.height - padding;
            break;
          case 'center':
            x = (canvas.width - textWidth) / 2;
            y = (canvas.height + textHeight) / 2;
            break;
        }

        // วาดพื้นหลังของลายน้ำ (rounded rectangle)
        const bgPadding = 12;
        const borderRadius = 8;
        
        ctx.globalAlpha = opacity;
        ctx.fillStyle = backgroundColor;
        
        // สร้าง rounded rectangle
        const bgX = x - bgPadding;
        const bgY = y - textHeight - bgPadding / 2;
        const bgWidth = textWidth + bgPadding * 2;
        const bgHeight = textHeight + bgPadding;

        ctx.beginPath();
        ctx.moveTo(bgX + borderRadius, bgY);
        ctx.lineTo(bgX + bgWidth - borderRadius, bgY);
        ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + borderRadius);
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight - borderRadius);
        ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - borderRadius, bgY + bgHeight);
        ctx.lineTo(bgX + borderRadius, bgY + bgHeight);
        ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - borderRadius);
        ctx.lineTo(bgX, bgY + borderRadius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + borderRadius, bgY);
        ctx.closePath();
        ctx.fill();

        // วาดข้อความลายน้ำ
        ctx.globalAlpha = 1;
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'top';
        
        // เพิ่ม shadow เพื่อให้อ่านง่าย
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText(text, x, y - textHeight);

        // แปลง canvas เป็น blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            // สร้าง File ใหม่จาก blob
            const watermarkedFile = new File(
              [blob],
              file.name,
              {
                type: file.type || 'image/jpeg',
                lastModified: Date.now(),
              }
            );

            resolve(watermarkedFile);
          },
          file.type || 'image/jpeg',
          0.95 // quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * เพิ่มลายน้ำให้กับหลายรูปภาพพร้อมกัน
 * @param files - Array ของไฟล์รูปภาพ
 * @param text - ข้อความลายน้ำ
 * @param options - ตัวเลือกเพิ่มเติม
 * @returns Promise<File[]> - Array ของไฟล์ที่มีลายน้ำ
 */
export async function addWatermarkToMultiple(
  files: File[],
  text: string,
  options?: Parameters<typeof addWatermark>[2]
): Promise<File[]> {
  return Promise.all(
    files.map((file) => addWatermark(file, text, options))
  );
}

/**
 * เพิ่มลายน้ำพร้อม timestamp
 * @param file - ไฟล์รูปภาพ
 * @param text - ข้อความลายน้ำหลัก (เช่น "Before" หรือ "After")
 * @param includeTimestamp - แสดง timestamp หรือไม่
 * @param options - ตัวเลือกเพิ่มเติม
 * @returns Promise<File> - ไฟล์ที่มีลายน้ำ
 */
export async function addWatermarkWithTimestamp(
  file: File,
  text: string,
  includeTimestamp: boolean = true,
  options?: Parameters<typeof addWatermark>[2]
): Promise<File> {
  let watermarkText = text;

  if (includeTimestamp) {
    const now = new Date();
    const timestamp = now.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    watermarkText = `${text} - ${timestamp}`;
  }

  return addWatermark(file, watermarkText, options);
}

/**
 * Preset configurations สำหรับลายน้ำแบบต่างๆ
 */
export const WatermarkPresets = {
  // ลายน้ำสำหรับรูป "Before" (สีแดง)
  before: {
    position: 'bottom-right' as const,
    fontSize: 48,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(220, 38, 38, 0.85)', // red-600
    padding: 20,
    opacity: 0.95,
  },

  // ลายน้ำสำหรับรูป "After" (สีเขียว)
  after: {
    position: 'bottom-right' as const,
    fontSize: 48,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(22, 163, 74, 0.85)', // green-600
    padding: 20,
    opacity: 0.95,
  },

  // ลายน้ำสำหรับรูป "In Progress" (สีน้ำเงิน)
  inProgress: {
    position: 'bottom-right' as const,
    fontSize: 48,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(37, 99, 235, 0.85)', // blue-600
    padding: 20,
    opacity: 0.95,
  },

  // ลายน้ำแบบมุมบน
  topCorner: {
    position: 'top-right' as const,
    fontSize: 36,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    opacity: 0.9,
  },

  // ลายน้ำแบบตรงกลาง (สำหรับรูปสำคัญ)
  center: {
    position: 'center' as const,
    fontSize: 64,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 30,
    opacity: 0.85,
  },
};
