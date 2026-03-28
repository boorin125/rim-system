// frontend/src/utils/imageUtils.ts

/**
 * Image Compression and Resize Utility
 * - Compresses images for email-friendly sizes
 * - Maintains image clarity
 * - Converts ALL formats (including iOS HEIC/HEIF) to JPEG
 * - Applies EXIF orientation so photos are always upright
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  maxSizeMB?: number;
}

/**
 * Read EXIF orientation tag from a JPEG/HEIC binary.
 * Returns 1–8, or 1 (no transform) if not found.
 */
async function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) { resolve(1); return; }
      const view = new DataView(buffer);

      // Must start with JPEG SOI marker 0xFFD8
      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
        resolve(1); return;
      }

      let offset = 2;
      while (offset + 4 <= view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;

        if (marker === 0xFFE1) {
          // APP1 segment — may contain Exif
          if (offset + 6 > view.byteLength) { resolve(1); return; }
          // Check "Exif\0\0" header (0x45786966 0x0000)
          if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }

          const tiffOffset = offset + 8;
          if (tiffOffset + 8 > view.byteLength) { resolve(1); return; }

          const little = view.getUint16(tiffOffset, false) === 0x4949;
          const ifd0 = view.getUint32(tiffOffset + 4, little);
          const ifd0Offset = tiffOffset + ifd0;
          if (ifd0Offset + 2 > view.byteLength) { resolve(1); return; }

          const numEntries = view.getUint16(ifd0Offset, little);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifd0Offset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;
            if (view.getUint16(entryOffset, little) === 0x0112) {
              resolve(view.getUint16(entryOffset + 8, little));
              return;
            }
          }
          resolve(1); return;
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          if (offset + 2 > view.byteLength) break;
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    // Only need the first 64 KB to find EXIF data
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

/**
 * Compress and resize image file.
 * Converts ALL formats (HEIC, HEIF, PNG, WebP, JPEG) → JPEG.
 * Applies EXIF orientation correction so the image is always upright.
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed JPEG File
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeMB = 2,
  } = options;

  // Read EXIF orientation for JPEG files (HEIC decoded by iOS Safari has no EXIF issue)
  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  const orientation = isJpeg ? await getExifOrientation(file) : 1;

  // Swap dimensions for 90°/270° rotations (orientations 5–8)
  const swapDims = orientation >= 5 && orientation <= 8;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: nw, naturalHeight: nh } = img;

      // Calculate display dimensions (before rotation swap)
      let dispW = nw;
      let dispH = nh;
      const effectiveMaxW = swapDims ? maxHeight : maxWidth;
      const effectiveMaxH = swapDims ? maxWidth : maxHeight;
      if (dispW > effectiveMaxW || dispH > effectiveMaxH) {
        const ratio = Math.min(effectiveMaxW / dispW, effectiveMaxH / dispH);
        dispW = Math.floor(dispW * ratio);
        dispH = Math.floor(dispH * ratio);
      }

      // Canvas dimensions after rotation
      const canvas = document.createElement('canvas');
      canvas.width  = swapDims ? dispH : dispW;
      canvas.height = swapDims ? dispW : dispH;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Apply inverse EXIF transform so pixels are stored upright
      switch (orientation) {
        case 2: ctx.transform(-1, 0,  0,  1, dispW,      0); break;
        case 3: ctx.transform(-1, 0,  0, -1, dispW,  dispH); break;
        case 4: ctx.transform( 1, 0,  0, -1,     0,  dispH); break;
        case 5: ctx.transform( 0, 1,  1,  0,     0,      0); break;
        case 6: ctx.transform( 0, 1, -1,  0, dispH,      0); break;
        case 7: ctx.transform( 0,-1, -1,  0, dispH,  dispW); break;
        case 8: ctx.transform( 0,-1,  1,  0,     0,  dispW); break;
      }

      ctx.drawImage(img, 0, 0, dispW, dispH);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Failed to create blob')); return; }

          const sizeMB = blob.size / 1024 / 1024;
          if (sizeMB > maxSizeMB && quality > 0.5) {
            const newQuality = quality * (maxSizeMB / sizeMB) * 0.9;
            compressImage(file, { ...options, quality: newQuality })
              .then(resolve)
              .catch(reject);
            return;
          }

          // Always use .jpg extension regardless of original format
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Compress multiple images
 * @param files - Array of image files
 * @param options - Compression options
 * @returns Array of compressed images
 */
export async function compressImages(
  files: File[],
  options?: CompressImageOptions
): Promise<File[]> {
  const compressed = await Promise.all(
    files.map((file) => compressImage(file, options))
  );
  return compressed;
}

/**
 * Convert File to base64 string
 * @param file - File to convert
 * @returns Base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert multiple files to base64
 * @param files - Files to convert
 * @returns Array of base64 strings
 */
export async function filesToBase64(files: File[]): Promise<string[]> {
  return Promise.all(files.map(fileToBase64));
}

/**
 * Get image dimensions
 * @param file - Image file
 * @returns Width and height
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Validate image file
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns Validation result
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
    };
  }

  // Check file size
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
