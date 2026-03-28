// frontend/src/utils/fixImageOrientation.ts
// Fix EXIF orientation for iOS Safari — redraws image on canvas with correct rotation
// so both preview and uploaded data have correct orientation.

/**
 * Read EXIF orientation tag from a JPEG file.
 * Returns orientation value 1-8, or 1 (no rotation) if not found.
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
          const segLen = view.getUint16(offset, false);
          // Check "Exif\0\0" header (0x45786966 0x0000)
          if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }

          const tiffOffset = offset + 8; // start of TIFF header within APP1
          if (tiffOffset + 8 > view.byteLength) { resolve(1); return; }

          const little = view.getUint16(tiffOffset, false) === 0x4949; // II = little-endian
          const ifd0 = view.getUint32(tiffOffset + 4, little);
          const ifd0Offset = tiffOffset + ifd0;
          if (ifd0Offset + 2 > view.byteLength) { resolve(1); return; }

          const numEntries = view.getUint16(ifd0Offset, little);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifd0Offset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;
            if (view.getUint16(entryOffset, little) === 0x0112) {
              // Tag 0x0112 = Orientation
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
    // Only need first 64 KB to find EXIF
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

/**
 * Returns a new File with EXIF orientation applied to the pixel data.
 * For non-JPEG or orientation=1, returns the original file unchanged.
 */
export async function fixImageOrientation(file: File): Promise<File> {
  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  if (!isJpeg) return file;

  const orientation = await getExifOrientation(file);
  if (!orientation || orientation === 1) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      // Orientations 5-8 swap width/height
      if (orientation >= 5 && orientation <= 8) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      // Apply the inverse EXIF transform so pixels are stored upright
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0,  1, w,  0); break; // flip H
        case 3: ctx.transform(-1, 0, 0, -1, w,  h); break; // rotate 180
        case 4: ctx.transform( 1, 0, 0, -1, 0,  h); break; // flip V
        case 5: ctx.transform( 0, 1, 1,  0, 0,  0); break; // transpose
        case 6: ctx.transform( 0, 1,-1,  0, h,  0); break; // rotate 90 CW
        case 7: ctx.transform( 0,-1,-1,  0, h,  w); break; // transverse
        case 8: ctx.transform( 0,-1, 1,  0, 0,  w); break; // rotate 90 CCW
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.92,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Process an array of files — fix orientation on all of them in parallel.
 */
export async function fixImagesOrientation(files: File[]): Promise<File[]> {
  return Promise.all(files.map(fixImageOrientation));
}
