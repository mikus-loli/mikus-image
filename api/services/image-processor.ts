/**
 * Image processing service using sharp only
 */
import sharp from 'sharp'

export interface ImageDimensions {
  width: number
  height: number
}

export class ImageProcessingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

/** JPG/PNG/BMP - raster images that support watermark */
export function isProcessableRasterImage(mimeType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp'].includes(mimeType)
}

/** All formats that should be converted to WebP */
export function isConvertibleToWebp(mimeType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/ico'].includes(mimeType)
}

/** Formats that only sharp can handle (WebP/ICO/SVG) */
export function isSharpProcessable(mimeType: string): boolean {
  return ['image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/ico', 'image/svg+xml'].includes(mimeType)
}

/** Create an SVG watermark overlay buffer */
function createWatermarkSvg(
  text: string,
  width: number,
  height: number,
  position: string = 'bottom-right',
  opacity: number = 0.3
): Buffer {
  const fontSize = Math.max(16, Math.min(48, Math.floor(width / 20)))
  const padding = 10
  let x: number, y: number
  let anchor: 'start' | 'middle' | 'end'

  switch (position) {
    case 'top-left':
      x = padding; y = padding + fontSize; anchor = 'start'; break
    case 'top-right':
      x = width - padding; y = padding + fontSize; anchor = 'end'; break
    case 'bottom-left':
      x = padding; y = height - padding; anchor = 'start'; break
    case 'center':
      x = width / 2; y = height / 2 + fontSize / 3; anchor = 'middle'; break
    case 'bottom-right':
    default:
      x = width - padding; y = height - padding; anchor = 'end'; break
  }

  // Use rgba fill (more reliable than fill-opacity in librsvg) + dark shadow for contrast
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(0,0,0,${opacity})" text-anchor="${anchor}" dx="1" dy="1">${escapeXml(text)}</text>
    <text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,${opacity})" text-anchor="${anchor}">${escapeXml(text)}</text>
  </svg>`
  return Buffer.from(svg)
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Process image using sharp:
 * 1. Add watermark (raster images only)
 * 2. Convert to WebP
 * 3. Generate thumbnail
 */
export async function processImage(buffer: Buffer, options: {
  compress?: boolean
  compressQuality?: number
  watermark?: boolean
  watermarkText?: string
  watermarkPosition?: string
  watermarkOpacity?: number
  thumbnail?: boolean
  thumbnailMaxWidth?: number
  mimeType?: string
  maxFileSize?: number
}): Promise<{
  processedBuffer: Buffer
  width: number
  height: number
  thumbnailBuffer?: Buffer
}> {
  const {
    compress = false,
    compressQuality = 80,
    watermark: enableWatermark = false,
    watermarkText = 'Mikus图床',
    watermarkPosition = 'bottom-right',
    watermarkOpacity = 0.3,
    thumbnail: enableThumbnail = false,
    thumbnailMaxWidth = 300,
  } = options

  const metadata = await sharp(buffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  let pipeline = sharp(buffer)

  // Add watermark for raster images
  if (enableWatermark && width > 0 && height > 0) {
    const watermarkSvg = createWatermarkSvg(watermarkText, width, height, watermarkPosition, watermarkOpacity)
    pipeline = pipeline.composite([{
      input: watermarkSvg,
      blend: 'over',
      tile: false,
    }])
    console.log('[Watermark] Applied:', { width, height, position: watermarkPosition, opacity: watermarkOpacity, text: watermarkText })
  }

  const quality = compress ? compressQuality : 80
  const processedBuffer = await pipeline.webp({ quality }).toBuffer()

  // Generate thumbnail
  let thumbnailBuffer: Buffer | undefined
  if (enableThumbnail && width > 0) {
    try {
      const maxWidth = thumbnailMaxWidth
      thumbnailBuffer = await sharp(buffer)
        .resize(maxWidth, null, { withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer()
    } catch (err) {
      console.error('Thumbnail generation failed:', err instanceof Error ? err.message : String(err))
    }
  }

  return { processedBuffer, width, height, thumbnailBuffer }
}

/**
 * Process WebP/ICO/SVG using sharp - convert to WebP + thumbnail + watermark
 */
export async function processWithSharp(
  buffer: Buffer,
  options: {
    thumbnail?: boolean
    thumbnailMaxWidth?: number
    watermark?: boolean
    watermarkText?: string
    watermarkPosition?: string
    watermarkOpacity?: number
  } = {}
): Promise<{ processedBuffer: Buffer; width: number; height: number; thumbnailBuffer?: Buffer }> {
  const {
    thumbnail: enableThumbnail = false,
    thumbnailMaxWidth = 300,
    watermark: enableWatermark = false,
    watermarkText = 'Mikus图床',
    watermarkPosition = 'bottom-right',
    watermarkOpacity = 0.3,
  } = options

  const metadata = await sharp(buffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  let pipeline = sharp(buffer)

  if (enableWatermark && width > 0 && height > 0) {
    const watermarkSvg = createWatermarkSvg(watermarkText, width, height, watermarkPosition, watermarkOpacity)
    pipeline = pipeline.composite([{
      input: watermarkSvg,
      blend: 'over',
      tile: false,
    }])
    console.log('[Watermark] Applied (sharp):', { width, height, position: watermarkPosition, opacity: watermarkOpacity, text: watermarkText })
  }

  const processedBuffer = await pipeline.webp({ quality: 80 }).toBuffer()

  let thumbnailBuffer: Buffer | undefined
  if (enableThumbnail) {
    const maxWidth = options.thumbnailMaxWidth || 300
    let thumbPipeline = sharp(buffer)
    if (width > maxWidth) {
      thumbPipeline = thumbPipeline.resize(maxWidth, null, { withoutEnlargement: true })
    }
    thumbnailBuffer = await thumbPipeline.webp({ quality: 70 }).toBuffer()
  }

  return { processedBuffer, width, height, thumbnailBuffer }
}

export async function compressImage(buffer: Buffer, quality: number = 80): Promise<Buffer> {
  return await sharp(buffer).webp({ quality }).toBuffer()
}

export async function addWatermark(
  buffer: Buffer,
  text: string,
  position: string = 'bottom-right',
  opacity: number = 0.3
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  if (width === 0 || height === 0) {
    return await sharp(buffer).webp().toBuffer()
  }

  const watermarkSvg = createWatermarkSvg(text, width, height, position, opacity)
  return await sharp(buffer)
    .composite([{ input: watermarkSvg, blend: 'over' }])
    .webp()
    .toBuffer()
}

export async function getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  }
}

export async function generateThumbnail(buffer: Buffer, maxWidth: number = 300): Promise<Buffer> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ImageProcessingError('源文件为空，无法生成缩略图')
  }

  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    throw new ImageProcessingError(`缩略图宽度配置无效: ${maxWidth}`)
  }

  try {
    return await sharp(buffer)
      .resize(maxWidth, null, { withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
  } catch (err) {
    if (err instanceof ImageProcessingError) throw err
    throw new ImageProcessingError('图像处理库生成缩略图失败', err)
  }
}
