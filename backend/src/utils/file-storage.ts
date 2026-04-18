import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Save a base64 data URL or raw base64 string to disk.
 * Returns the relative path from the uploads/ root (e.g. "incidents/abc/1234_0.jpg")
 */
export async function saveBase64File(
  base64: string,
  subDir: string,
  filename: string,
): Promise<string> {
  let mimeType: string;
  let data: string;

  if (base64.startsWith('data:')) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) throw new Error('Invalid base64 data URL');
    mimeType = match[1];
    data = match[2];
  } else {
    mimeType = 'image/png';
    data = base64;
  }

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType] ?? 'jpg';

  const dir = path.join(process.cwd(), 'uploads', subDir);
  await fs.mkdir(dir, { recursive: true });

  const relativePath = `${subDir}/${filename}.${ext}`;
  const fullPath = path.join(process.cwd(), 'uploads', relativePath);
  await fs.writeFile(fullPath, Buffer.from(data, 'base64'));

  return relativePath;
}

/**
 * Save multiple base64 photos to disk.
 * Returns array of relative paths.
 */
export async function saveBase64Files(
  photos: string[],
  subDir: string,
): Promise<string[]> {
  const timestamp = Date.now();
  return Promise.all(
    photos.map((photo, i) => saveBase64File(photo, subDir, `${timestamp}_${i}`)),
  );
}

/**
 * Delete a file by relative path (from uploads/ root). Silently ignores missing files.
 */
export async function deleteUploadFile(relativePath: string): Promise<void> {
  try {
    const fullPath = path.join(process.cwd(), 'uploads', relativePath);
    await fs.unlink(fullPath);
  } catch {
    // ignore
  }
}
