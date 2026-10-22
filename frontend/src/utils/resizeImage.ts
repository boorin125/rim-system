// Shrink a photo before upload (longest side ≤ maxDimension, JPEG) — smaller uploads from phones
export async function resizeImage(file: File, maxDimension = 1920, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { naturalWidth: w, naturalHeight: h } = img
      if (w <= maxDimension && h <= maxDimension) { resolve(file); return }
      const ratio = Math.min(maxDimension / w, maxDimension / h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => resolve(file)
    img.src = objectUrl
  })
}
