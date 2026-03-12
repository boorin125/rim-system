// frontend/src/utils/photoUtils.ts

/**
 * Get proper photo URL
 * - If photo is base64 (data:image/...) - return as-is
 * - If photo is relative path - prefix with API URL + /uploads/
 * - If photo is full URL (http/https) - return as-is
 */
export const getPhotoUrl = (photo: string): string => {
  if (!photo) return ''

  // Already a data URL (base64)
  if (photo.startsWith('data:')) {
    return photo
  }

  // Already a full URL
  if (photo.startsWith('http://') || photo.startsWith('https://')) {
    return photo
  }

  // Relative path - add API URL prefix
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
  // Remove /api suffix if present, as uploads are served from root
  const baseUrl = apiUrl.replace(/\/api$/, '')
  return `${baseUrl}/uploads/${photo}`
}
