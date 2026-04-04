// frontend/src/utils/imageUtils.ts

/**
 * Image Compression and Resize Utility
 * - Compresses images for email-friendly sizes
 * - Maintains image clarity
 * - Converts ALL formats (including iOS HEIC/HEIF) to JPEG
 *
 * NOTE: EXIF orientation is handled automatically by modern browsers
 * (Chrome 81+, Safari, Firefox) — both naturalWidth/naturalHeight and
 * ctx.drawImage() already reflect the visually-correct orientation.
 * Manual EXIF transforms are intentionally omitted to avoid double-rotation.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  maxSizeMB?: number;
}

/**
 * Compress and resize image file.
 * Converts ALL formats (HEIC, HEIF, PNG, WebP, JPEG) → JPEG.
 * Orientation is preserved automatically by the browser's image decoder.
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

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      // naturalWidth/naturalHeight already reflect EXIF orientation on all modern browsers
      let dispW = img.naturalWidth;
      let dispH = img.naturalHeight;

      if (dispW > maxWidth || dispH > maxHeight) {
        const ratio = Math.min(maxWidth / dispW, maxHeight / dispH);
        dispW = Math.floor(dispW * ratio);
        dispH = Math.floor(dispH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = dispW;
      canvas.height = dispH;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // drawImage draws the visually-correct (EXIF-applied) image — no manual transform needed
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
