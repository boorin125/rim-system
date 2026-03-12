// backend/src/utils/image-watermark.ts

import sharp from 'sharp';

export async function addWatermark(
  imageBuffer: Buffer,
  watermarkText: 'BEFORE' | 'AFTER',
): Promise<Buffer> {
  try {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // Calculate font size based on image size
    const fontSize = Math.floor(Math.min(width, height) / 10);

    // Create SVG watermark
    const svgWatermark = `
      <svg width="${width}" height="${height}">
        <style>
          .watermark {
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            font-weight: bold;
            fill: white;
            opacity: 0.7;
            text-anchor: middle;
          }
        </style>
        <text x="${width / 2}" y="${fontSize + 20}" class="watermark">${watermarkText}</text>
      </svg>
    `;

    // Composite watermark onto image
    const watermarkedImage = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svgWatermark),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    return watermarkedImage;
  } catch (error) {
    console.error('Error adding watermark:', error);
    // Return original image if watermarking fails
    return imageBuffer;
  }
}
