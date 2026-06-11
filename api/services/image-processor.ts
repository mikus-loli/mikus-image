/**
 * Image processing service using jimp (v1.x API) + sharp for WebP/ICO
 */
import { Jimp, loadFont, measureText, measureTextHeight } from 'jimp'
import { SANS_32_WHITE } from 'jimp/fonts'
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

export function isProcessableRasterImage(mimeType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp'].includes(mimeType)
}

export function isConvertibleToWebp(mimeType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType)
}

/** Formats that sharp can handle for thumbnail generation */
export function isSharpProcessable(mimeType: string): boolean {
  return ['image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/ico'].includes(mimeType)
}

/**
 * Generate thumbnail for WebP/ICO images using sharp.
 * Returns { thumbnailBuffer, width, height }
 */
export async function generateThumbnailWithSharp(
  buffer: Buffer,
  maxWidth: number = 300
): Promise<{ thumbnailBuffer: Buffer; width: number; height: number }> {
  const metadata = await sharp(buffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  let pipeline = sharp(buffer)
  if (width > maxWidth) {
    pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true })
  }
  const thumbnailBuffer = await pipeline.webp({ quality: 70 }).toBuffer()

  return { thumbnailBuffer, width, height }
}

/**
 * Process image in a single Jimp.read() pass:
 * 1. Compress (JPEG quality)
 * 2. Add watermark
 * 3. Get dimensions
 * 4. Generate thumbnail
 *
 * Returns { processedBuffer, width, height, thumbnailBuffer? }
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
    mimeType = 'image/jpeg',
    maxFileSize = 50 * 1024 * 1024,
  } = options

  // Read image once
  const image = await Jimp.read(buffer)
  const width = image.width || 0
  const height = image.height || 0

  // Add watermark (before compression so it gets compressed too)
  if (enableWatermark) {
    const font = await loadFont(SANS_32_WHITE)
    const textWidth = measureText(font, watermarkText)
    const textHeight = measureTextHeight(font, watermarkText, textWidth)
    const padding = 10
    let x: number, y: number

    switch (watermarkPosition) {
      case 'top-left': x = padding; y = padding; break
      case 'top-right': x = image.width - textWidth - padding; y = padding; break
      case 'bottom-left': x = padding; y = image.height - textHeight - padding; break
      case 'center': x = (image.width - textWidth) / 2; y = (image.height - textHeight) / 2; break
      case 'bottom-right':
      default: x = image.width - textWidth - padding; y = image.height - textHeight - padding; break
    }

    image.print({ font, x, y, text: watermarkText })
    image.opacity(watermarkOpacity)
  }

  // Get processed buffer - always output WebP for raster images
  const outputMime = 'image/webp'
  const qualityOpts = { quality: compress ? compressQuality : 80 }
  const processedBuffer = await (image.getBuffer as any)(outputMime, qualityOpts)

  // Generate thumbnail from the same Jimp instance (clone to avoid mutation)
  let thumbnailBuffer: Buffer | undefined
  if (enableThumbnail && isProcessableRasterImage(mimeType)) {
    if (buffer.length <= maxFileSize && width > 0 && height > 0 && width * height <= 80_000_000) {
      try {
        const thumb = image.clone()
        const ratio = thumbnailMaxWidth / thumb.width
        if (ratio < 1) {
          thumb.resize({ w: thumbnailMaxWidth, h: Math.max(1, Math.round(thumb.height * ratio)) })
        }
        thumbnailBuffer = await (thumb.getBuffer as any)('image/webp', { quality: 70 })
      } catch (err) {
        console.error('Thumbnail generation failed:', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.warn('Thumbnail skipped: file too large or dimensions too large')
    }
  }

  return { processedBuffer, width, height, thumbnailBuffer }
}

// Keep individual functions for backward compatibility
export async function compressImage(buffer: Buffer, quality: number = 80): Promise<Buffer> {
  const image = await Jimp.read(buffer)
  return await (image.getBuffer as any)('image/webp', { quality })
}

export async function addWatermark(
  buffer: Buffer,
  text: string,
  position: string = 'bottom-right',
  opacity: number = 0.3
): Promise<Buffer> {
  const image = await Jimp.read(buffer)
  const font = await loadFont(SANS_32_WHITE)

  const textWidth = measureText(font, text)
  const textHeight = measureTextHeight(font, text, textWidth)

  let x: number, y: number
  const padding = 10

  switch (position) {
    case 'top-left':
      x = padding
      y = padding
      break
    case 'top-right':
      x = image.width - textWidth - padding
      y = padding
      break
    case 'bottom-left':
      x = padding
      y = image.height - textHeight - padding
      break
    case 'center':
      x = (image.width - textWidth) / 2
      y = (image.height - textHeight) / 2
      break
    case 'bottom-right':
    default:
      x = image.width - textWidth - padding
      y = image.height - textHeight - padding
      break
  }

  image.print({ font, x, y, text })
  image.opacity(opacity)

  const mime = 'image/webp'
  return await (image.getBuffer as any)(mime)
}

export async function getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
  const image = await Jimp.read(buffer)
  return {
    width: image.width,
    height: image.height,
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
    const image = await Jimp.read(buffer)
    if (!image.width || !image.height) {
      throw new ImageProcessingError('无法读取图片尺寸')
    }

    const ratio = maxWidth / image.width
    if (ratio < 1) {
      image.resize({ w: maxWidth, h: Math.max(1, Math.round(image.height * ratio)) })
    }

    return await (image.getBuffer as any)('image/webp', { quality: 70 })
  } catch (err) {
    if (err instanceof ImageProcessingError) throw err
    throw new ImageProcessingError('图像处理库生成缩略图失败', err)
  }
}
