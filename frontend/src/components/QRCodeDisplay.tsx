'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodeDisplayProps {
  url: string
  size?: number
}

export default function QRCodeDisplay({ url, size = 150 }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(url, { width: size, margin: 1 })
      .then(setQrDataUrl)
      .catch(console.error)
  }, [url, size])

  if (!qrDataUrl) return null

  return <img src={qrDataUrl} alt="QR Code" width={size} height={size} />
}
