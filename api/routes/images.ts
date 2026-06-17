/**
 * Image routes - Upload, list, update, delete images
 */
import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { getDb, query, scheduleSave, getCachedSetting, getCachedBaseUrl } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { getStorageByStrategyId } from '../services/storage.js'
import { processImage, isProcessableRasterImage, isConvertibleToWebp, isSharpProcessable, processWithSharp } from '../services/image-processor.js'
import {
  evaluateImage,
  type NsfwResult,
} from '../services/nsfw.js'

const router = Router()

/** Thrown when an upload is rejected by the NSFW policy. */
class NsfwRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NsfwRejectedError'
  }
}

/** Thrown when the NSFW service is unavailable and degrade mode is "block". */
class NsfwServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NsfwServiceUnavailableError'
  }
}

interface NsfwPolicy {
  enabled: boolean
  threshold: number
  action: 'reject' | 'flag' | 'blur'
  classes: string[]
  degradeMode: 'allow' | 'block'
  blurRadius: number
}

function getNsfwPolicy(): NsfwPolicy {
  const threshold = parseFloat(getCachedSetting('nsfw_threshold') || '0.5')
  const action = (getCachedSetting('nsfw_action') || 'reject') as NsfwPolicy['action']
  const classes = (getCachedSetting('nsfw_classes') || 'Hentai,Porn,Sexy')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const degradeMode = (getCachedSetting('nsfw_degrade_mode') || 'allow') as NsfwPolicy['degradeMode']
  const blurRadius = Math.max(1, parseInt(getCachedSetting('nsfw_blur_radius') || '20'))
  return {
    enabled: getCachedSetting('nsfw_enabled') === 'true',
    threshold: Number.isFinite(threshold) ? threshold : 0.5,
    action,
    classes,
    degradeMode,
    blurRadius,
  }
}

/** Insert a row into nsfw_logs. */
function logNsfwDetection(params: {
  imageId: string | null
  originalName: string
  userId: string
  userName: string
  result: NsfwResult | null
  action: string
  detail?: string
}): void {
  const db = getDb()
  const id = uuidv4()
  const { result } = params
  const scores = result
    ? JSON.stringify(Object.fromEntries(result.predictions.map((p) => [p.className, p.probability])))
    : '{}'
  // Use JS ISO timestamp (with timezone 'Z') instead of SQLite datetime('now')
  // which returns UTC without timezone marker and is misparsed by the frontend.
  const createdAt = new Date().toISOString()
  db.run(
    `INSERT INTO nsfw_logs (id, image_id, original_name, user_id, user_name, top_class, max_score, scores, is_nsfw, action, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.imageId,
      params.originalName,
      params.userId,
      params.userName,
      result ? result.topClass : 'Unknown',
      result ? result.maxNsfwScore : 0,
      scores,
      result ? (result.isNsfw ? 1 : 0) : 0,
      params.action,
      params.detail || '',
      createdAt,
    ]
  )
  scheduleSave()
}

function logUploadFailure(params: {
  originalName: string
  userId: string
  userName: string
  detail: string
}): void {
  logNsfwDetection({
    imageId: null,
    originalName: params.originalName,
    userId: params.userId,
    userName: params.userName,
    result: null,
    action: 'upload_failed',
    detail: params.detail,
  })
}

function generateImageKey(extension: string, username?: string): string {
  const now = new Date()
  const Y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const id = uuidv4().replace(/-/g, '').substring(0, 12)
  // Sanitize username: only allow alphanumerics, underscore, hyphen, dot.
  // Prevents path traversal (e.g. "..", "/", "\", null bytes) in the storage key.
  const safeUsername = username
    ? username.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '')
    : ''
  // Path format: username/YYYY/MM/DD/filename
  if (safeUsername) {
    return `${safeUsername}/${Y}/${m}/${d}/${id}${extension}`
  }
  // Default path format: YYYY/MM/DD/filename (for admin or when isolation is disabled)
  return `${Y}/${m}/${d}/${id}${extension}`
}

function generateLinks(baseUrl: string, imagePath: string, name: string): Record<string, string> {
  const url = `${baseUrl}${imagePath}`
  return {
    url,
    markdown: `![${name}](${url})`,
    html: `<img src="${url}" alt="${name}" />`,
    bbcode: `[img]${url}[/img]`,
  }
}

async function processAndSaveImage(
  buffer: Buffer,
  originalName: string,
  strategyId: string,
  userId: string,
  username: string,
  albumId: string | null,
  permission: string
): Promise<Record<string, any>> {
  const db = getDb()

  // Get settings from cache
  const enableCompress = getCachedSetting('enable_compress') === 'true'
  const compressQuality = parseInt(getCachedSetting('compress_quality') || '80')
  const enableWatermark = getCachedSetting('enable_watermark') === 'true'
  const watermarkText = getCachedSetting('watermark_text') || 'Mikus图床'
  const watermarkPosition = getCachedSetting('watermark_position') || 'bottom-right'
  // Parse opacity: accept both 0-1 (decimal) and 0-100 (percentage) formats
  const rawOpacity = parseFloat(getCachedSetting('watermark_opacity') || '30')
  const watermarkOpacity = rawOpacity > 1 ? rawOpacity / 100 : rawOpacity
  const enableThumbnail = getCachedSetting('enable_thumbnail') === 'true'
  const thumbnailMaxWidth = Math.max(1, parseInt(getCachedSetting('thumbnail_max_width') || '300'))

  // Generate the image id up front so NSFW logs can reference it even on rejection.
  const id = uuidv4()

  // ── NSFW content moderation ──────────────────────────────────────────
  // Runs on the original buffer before any processing/storage. On service
  // failure, falls back according to the configured degrade mode.
  const nsfwPolicy = getNsfwPolicy()
  let workingBuffer = buffer
  let nsfwFlagged = 0
  if (nsfwPolicy.enabled) {
    try {
      const result = await evaluateImage(buffer, nsfwPolicy.classes, nsfwPolicy.threshold)
      if (result.isNsfw) {
        if (nsfwPolicy.action === 'reject') {
          logNsfwDetection({
            imageId: null,
            originalName,
            userId,
            userName: username,
            result,
            action: 'reject',
            detail: `命中类别 ${result.topClass}，分数 ${result.maxNsfwScore.toFixed(3)} ≥ 阈值 ${nsfwPolicy.threshold}`,
          })
          throw new NsfwRejectedError('图片内容不合规，已拒绝上传')
        }
        if (nsfwPolicy.action === 'blur') {
          workingBuffer = await sharp(buffer).blur(nsfwPolicy.blurRadius).toBuffer()
          nsfwFlagged = 1
          logNsfwDetection({
            imageId: id,
            originalName,
            userId,
            userName: username,
            result,
            action: 'blur',
            detail: `已模糊处理，半径 ${nsfwPolicy.blurRadius}px`,
          })
        } else {
          // flag
          nsfwFlagged = 1
          logNsfwDetection({
            imageId: id,
            originalName,
            userId,
            userName: username,
            result,
            action: 'flag',
            detail: `图片已标记待审核`,
          })
        }
      } else {
        logNsfwDetection({
          imageId: id,
          originalName,
          userId,
          userName: username,
          result,
          action: 'allow',
        })
      }
    } catch (err) {
      // Service unavailable — apply degrade mode.
      if (err instanceof NsfwRejectedError) throw err
      if (err instanceof NsfwServiceUnavailableError) throw err
      console.error('[NSFW] detection failed, applying degrade mode:', err)
      logNsfwDetection({
        imageId: id,
        originalName,
        userId,
        userName: username,
        result: null,
        action: 'degrade',
        detail: err instanceof Error ? err.message : String(err),
      })
      if (nsfwPolicy.degradeMode === 'block') {
        throw new NsfwServiceUnavailableError('内容检测服务不可用，已暂停上传')
      }
      // degradeMode === 'allow': continue with the original buffer
    }
  }

  // Determine mime type from original extension (for processing decision)
  const ext = path.extname(originalName).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  }
  const mimeType = mimeTypes[ext] || 'image/jpeg'
  // Output is always WebP for convertible images (JPG/PNG/ICO/SVG/WebP)
  const outputMimeType = (isConvertibleToWebp(mimeType) || isSharpProcessable(mimeType)) ? 'image/webp' : mimeType

  // Get dimensions first (using image-size which supports ICO, SVG, GIF, etc.)
  let width = 0, height = 0
  try {
    const { imageSize } = await import('image-size')
    const dimensions = imageSize(workingBuffer)
    width = dimensions.width || 0
    height = dimensions.height || 0
  } catch {
    // Can't determine dimensions
  }

  // Process image
  let processedBuffer: Buffer
  let thumbnailBuffer: Buffer | undefined

  if (isProcessableRasterImage(mimeType)) {
    try {
      const result = await processImage(workingBuffer, {
        compress: enableCompress,
        compressQuality,
        watermark: enableWatermark,
        watermarkText,
        watermarkPosition,
        watermarkOpacity,
        thumbnail: enableThumbnail,
        thumbnailMaxWidth,
        mimeType,
      })
      processedBuffer = result.processedBuffer
      thumbnailBuffer = result.thumbnailBuffer
    } catch (err) {
      console.error('Image processing error, saving original:', err)
      processedBuffer = workingBuffer
    }
  } else if (isSharpProcessable(mimeType)) {
    // Use sharp for WebP/ICO/SVG - convert to WebP and generate thumbnail
    try {
      const result = await processWithSharp(workingBuffer, {
        thumbnail: enableThumbnail,
        thumbnailMaxWidth,
        watermark: enableWatermark,
        watermarkText,
        watermarkPosition,
        watermarkOpacity,
      })
      processedBuffer = result.processedBuffer
      thumbnailBuffer = result.thumbnailBuffer
      // Update dimensions from sharp
      width = result.width
      height = result.height
    } catch (err) {
      console.error('Sharp processing error, saving original:', err)
      processedBuffer = workingBuffer
    }
  } else {
    processedBuffer = workingBuffer
  }

  // Generate key and upload - use .webp for convertible images, original ext for GIF/etc
  const outputExt = (isConvertibleToWebp(mimeType) || isSharpProcessable(mimeType)) ? '.webp' : ext
  const storedOriginalName = (isConvertibleToWebp(mimeType) || isSharpProcessable(mimeType))
    ? path.basename(originalName, path.extname(originalName)) + '.webp'
    : originalName
  const key = generateImageKey(outputExt, username)
  const storage = getStorageByStrategyId(strategyId)
  const imagePath = await storage.upload(key, processedBuffer)

  // Upload thumbnail if generated
  let thumbnailUrl = ''
  if (thumbnailBuffer) {
    try {
      const parsedKey = path.parse(key)
      const thumbnailKey = path.join(parsedKey.dir, `${parsedKey.name}_thumb.webp`).replace(/\\/g, '/')
      thumbnailUrl = await storage.upload(thumbnailKey, thumbnailBuffer)
    } catch (err) {
      console.error('Thumbnail upload error:', err)
    }
  }

  const baseUrl = getCachedBaseUrl()
  const links = generateLinks(baseUrl, imagePath, originalName)

  // Save to database
  db.run(
    `INSERT INTO images (id, key, name, original_name, size, mime_type, width, height, url, thumbnail_url, strategy_id, album_id, user_id, permission, links, nsfw_flagged)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, key, path.basename(storedOriginalName, path.extname(storedOriginalName)), storedOriginalName,
      processedBuffer.length, outputMimeType,
      width, height, imagePath, thumbnailUrl, strategyId, albumId, userId, permission,
      JSON.stringify(links), nsfwFlagged,
    ]
  )

  // Update user used capacity
  db.run('UPDATE users SET used_capacity = used_capacity + ? WHERE id = ?', [processedBuffer.length, userId])

  scheduleSave()

  return {
    id,
    key,
    name: path.basename(storedOriginalName, path.extname(storedOriginalName)),
    original_name: storedOriginalName,
    size: processedBuffer.length,
    mime_type: outputMimeType,
    width,
    height,
    url: imagePath,
    thumbnail_url: thumbnailUrl,
    links,
    strategy_id: strategyId,
    album_id: albumId,
    permission,
    nsfw_flagged: nsfwFlagged,
    created_at: new Date().toISOString(),
  }
}

/**
 * POST / - Upload image (multipart form)
 */
router.post('/', authMiddleware, upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ status: false, message: '请选择要上传的图片' })
      return
    }

    const db = getDb()
    const user = req.user!
    const albumId = req.body.album_id || null
    const permission = req.body.permission || 'private'
    const strategyId = req.body.strategy_id || (getCachedSetting('default_strategy') || 'default-local')

    // Check user capacity
    const userResult = query('SELECT capacity, used_capacity FROM users WHERE id = ?', [user.id])
    if (userResult.length > 0 && userResult[0].values.length > 0) {
      const capacity = userResult[0].values[0][0] as number
      const usedCapacity = userResult[0].values[0][1] as number
      if (usedCapacity + req.file.size > capacity) {
        // Clean up temp file
        fs.unlinkSync(req.file.path)
        logUploadFailure({
          originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf-8'),
          userId: user.id,
          userName: user.name,
          detail: `存储空间不足：已用 ${usedCapacity}，容量 ${capacity}，本次上传 ${req.file.size}`,
        })
        res.status(413).json({ status: false, message: '存储空间不足' })
        return
      }
    }

    const buffer = fs.readFileSync(req.file.path)
    // Fix multer Latin-1 encoding issue for non-ASCII filenames (e.g. Chinese)
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8')
    const image = await processAndSaveImage(buffer, originalName, strategyId, user.id, user.name, albumId, permission)

    // Clean up temp file
    fs.unlinkSync(req.file.path)

    res.status(201).json({ status: true, message: '上传成功', data: image })
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    if (err instanceof NsfwRejectedError) {
      console.info('[NSFW] upload rejected:', err.message)
      res.status(403).json({ status: false, message: err.message })
      return
    }
    if (err instanceof NsfwServiceUnavailableError) {
      console.warn('[NSFW] service unavailable:', err.message)
      res.status(503).json({ status: false, message: err.message })
      return
    }
    console.error('Upload error:', err)
    logUploadFailure({
      originalName: req.file?.originalname ? Buffer.from(req.file.originalname, 'latin1').toString('utf-8') : 'unknown',
      userId: req.user?.id || 'unknown',
      userName: req.user?.name || 'unknown',
      detail: err instanceof Error ? err.message : '未知上传错误',
    })
    res.status(500).json({ status: false, message: '上传失败' })
  }
})

/**
 * POST /url - Upload from URL
 */
router.post('/url', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, album_id, permission, strategy_id } = req.body

    if (!url) {
      res.status(400).json({ status: false, message: '请提供图片URL' })
      return
    }

    const db = getDb()
    const user = req.user!
    const strategyId = strategy_id || (getCachedSetting('default_strategy') || 'default-local')

    // Download image from URL
    const response = await axios.get(url, { responseType: 'arraybuffer', maxContentLength: 10 * 1024 * 1024 })
    const buffer = Buffer.from(response.data)

    // Extract filename from URL
    const urlPath = new URL(url).pathname
    const originalName = path.basename(urlPath) || 'downloaded.png'

    // Check user capacity
    const userResult = query('SELECT capacity, used_capacity FROM users WHERE id = ?', [user.id])
    if (userResult.length > 0 && userResult[0].values.length > 0) {
      const capacity = userResult[0].values[0][0] as number
      const usedCapacity = userResult[0].values[0][1] as number
      if (usedCapacity + buffer.length > capacity) {
        logUploadFailure({
          originalName,
          userId: user.id,
          userName: user.name,
          detail: `URL 上传存储空间不足：已用 ${usedCapacity}，容量 ${capacity}，本次上传 ${buffer.length}`,
        })
        res.status(413).json({ status: false, message: '存储空间不足' })
        return
      }
    }

    const image = await processAndSaveImage(buffer, originalName, strategyId, user.id, user.name, album_id || null, permission || 'private')

    res.status(201).json({ status: true, message: '上传成功', data: image })
  } catch (err: any) {
    if (err instanceof NsfwRejectedError) {
      console.info('[NSFW] URL upload rejected:', err.message)
      res.status(403).json({ status: false, message: err.message })
      return
    }
    if (err instanceof NsfwServiceUnavailableError) {
      console.warn('[NSFW] service unavailable during URL upload:', err.message)
      res.status(503).json({ status: false, message: err.message })
      return
    }
    console.error('URL upload error:', err)
    logUploadFailure({
      originalName: req.body?.url || 'unknown-url',
      userId: req.user?.id || 'unknown',
      userName: req.user?.name || 'unknown',
      detail: err instanceof Error ? err.message : '未知 URL 上传错误',
    })
    res.status(500).json({ status: false, message: '从URL上传失败' })
  }
})

/**
 * GET /public - List public images (no auth required)
 * Query params: page, limit, album_id (filter by album), unassigned (1=only unassigned), sort, search
 */
router.get('/public', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 24, 50)
    const offset = (page - 1) * limit
    const albumId = req.query.album_id as string || ''
    const unassigned = req.query.unassigned === '1'
    const search = req.query.search as string || ''
    const sort = req.query.sort as string || 'newest'

    let whereClause = "WHERE i.permission = 'public'"
    const params: any[] = []

    if (albumId) {
      whereClause += ' AND i.album_id = ?'
      params.push(albumId)
    } else if (unassigned) {
      whereClause += ' AND i.album_id IS NULL'
    }

    if (search) {
      whereClause += ' AND (i.name LIKE ? OR i.original_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    const orderBy = sort === 'oldest' ? 'i.created_at ASC' : 'i.created_at DESC'

    const countResult = query(`SELECT COUNT(*) FROM images i ${whereClause}`, params)
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    const result = query(
      `SELECT i.id, i.key, i.name, i.original_name, i.size, i.mime_type, i.width, i.height, i.url, i.thumbnail_url, i.album_id, i.permission, i.created_at, u.name as user_name
       FROM images i LEFT JOIN users u ON i.user_id = u.id
       ${whereClause}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const images = result.length > 0 ? result[0].values.map(row => {
      const obj = Object.fromEntries(result[0].columns.map((col, idx) => [col, row[idx]])) as Record<string, any>
      return obj
    }) : []

    res.json({
      status: true,
      message: '获取成功',
      data: {
        images,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err: any) {
    console.error('Public images error:', err)
    res.status(500).json({ status: false, message: '获取公开图片失败' })
  }
})

/**
 * GET / - List images with pagination and filters
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string || ''
    const albumId = req.query.album_id as string || ''
    const permissionFilter = req.query.permission as string || ''
    const offset = (page - 1) * limit

    // Check user isolation setting
    const userIsolation = getCachedSetting('user_isolation') === 'true'

    let whereClause = ''
    const params: any[] = []

    // Apply user isolation for non-admin users
    if (user.role !== 'admin' && userIsolation) {
      whereClause += 'WHERE i.user_id = ?'
      params.push(user.id)
    }

    if (search) {
      whereClause += whereClause ? ' AND' : ' WHERE'
      whereClause += ' (i.name LIKE ? OR i.original_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    if (albumId) {
      whereClause += whereClause ? ' AND' : ' WHERE'
      whereClause += ' i.album_id = ?'
      params.push(albumId)
    }

    if (permissionFilter) {
      whereClause += whereClause ? ' AND' : ' WHERE'
      whereClause += ' i.permission = ?'
      params.push(permissionFilter)
    }

    // Get total count
    const countResult = query(`SELECT COUNT(*) FROM images i ${whereClause}`, params)
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    // Get images
    const sqlQuery = `SELECT i.*, u.name as user_name FROM images i LEFT JOIN users u ON i.user_id = u.id ${whereClause} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`
    const queryParams = [...params, limit, offset]
    const result = query(sqlQuery, queryParams)

    const images = result.length > 0 ? result[0].values.map(row => {
      const image = Object.fromEntries(result[0].columns.map((column, index) => [column, row[index]])) as Record<string, any>
      return {
        ...image,
        links: typeof image.links === 'string' ? JSON.parse(image.links) : image.links,
      }
    }) : []

    res.json({
      status: true,
      message: '获取成功',
      data: {
        images,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (err: any) {
    console.error('List images error:', err)
    res.status(500).json({ status: false, message: '获取图片列表失败' })
  }
})

/**
 * GET /nsfw-logs - List NSFW detection logs (admin only)
 * Query params: page, limit, action, is_nsfw (0|1), search
 *
 * NOTE: Must be defined before /:id, otherwise "nsfw-logs" is captured as an
 * image id parameter and returns 404.
 */
router.get('/nsfw-logs', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const offset = (page - 1) * limit
    const action = req.query.action as string || ''
    const isNsfw = req.query.is_nsfw as string || ''
    const search = req.query.search as string || ''

    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (action) {
      whereClause += ' AND action = ?'
      params.push(action)
    }
    if (isNsfw === '0' || isNsfw === '1') {
      whereClause += ' AND is_nsfw = ?'
      params.push(parseInt(isNsfw))
    }
    if (search) {
      whereClause += ' AND (original_name LIKE ? OR user_name LIKE ? OR top_class LIKE ? OR detail LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    const countResult = query(`SELECT COUNT(*) FROM nsfw_logs ${whereClause}`, params)
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    const result = query(
      `SELECT id, image_id, original_name, user_id, user_name, top_class, max_score, scores, is_nsfw, action, detail, created_at
       FROM nsfw_logs ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const logs = result.length > 0 ? result[0].values.map((row) => {
      const obj = Object.fromEntries(result[0].columns.map((col, idx) => [col, row[idx]])) as Record<string, any>
      obj.scores = typeof obj.scores === 'string' ? JSON.parse(obj.scores) : obj.scores
      obj.is_nsfw = Number(obj.is_nsfw) === 1
      return obj
    }) : []

    res.json({
      status: true,
      message: '获取成功',
      data: {
        logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err: any) {
    console.error('NSFW logs error:', err)
    res.status(500).json({ status: false, message: '获取 NSFW 日志失败' })
  }
})

/**
 * GET /nsfw-stats - Aggregate NSFW detection statistics (admin only)
 */
router.get('/nsfw-stats', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const totalResult = query('SELECT COUNT(*) FROM nsfw_logs')
    const total = totalResult.length > 0 ? (totalResult[0].values[0][0] as number) : 0

    const byAction = query(
      `SELECT action, COUNT(*) as cnt FROM nsfw_logs GROUP BY action`
    )
    const actionCounts: Record<string, number> = {}
    if (byAction.length > 0) {
      for (const row of byAction[0].values) {
        actionCounts[row[0] as string] = row[1] as number
      }
    }

    const nsfwResult = query('SELECT COUNT(*) FROM nsfw_logs WHERE is_nsfw = 1')
    const nsfwCount = nsfwResult.length > 0 ? (nsfwResult[0].values[0][0] as number) : 0

    // "Today" in the server's local timezone: compare against the local date
    // boundaries expressed as ISO strings. created_at is stored as ISO (with Z).
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
    const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString()
    const todayResult = query(
      `SELECT COUNT(*) FROM nsfw_logs WHERE created_at >= ? AND created_at < ?`,
      [startOfDay, startOfNextDay]
    )
    const todayCount = todayResult.length > 0 ? (todayResult[0].values[0][0] as number) : 0

    res.json({
      status: true,
      message: '获取成功',
      data: {
        total,
        nsfwCount,
        todayCount,
        allowed: actionCounts['allow'] || 0,
        rejected: actionCounts['reject'] || 0,
        flagged: actionCounts['flag'] || 0,
        blurred: actionCounts['blur'] || 0,
        degraded: actionCounts['degrade'] || 0,
        uploadFailed: actionCounts['upload_failed'] || 0,
      },
    })
  } catch (err: any) {
    console.error('NSFW stats error:', err)
    res.status(500).json({ status: false, message: '获取 NSFW 统计失败' })
  }
})

/**
 * GET /nsfw-status - Get NSFW service status (admin only)
 */
router.get('/nsfw-status', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { isNsfwReady, getNsfwLoadError } = await import('../services/nsfw.js')
    res.json({
      status: true,
      message: '获取成功',
      data: {
        enabled: getCachedSetting('nsfw_enabled') === 'true',
        ready: isNsfwReady(),
        error: getNsfwLoadError()?.message || null,
      },
    })
  } catch (err: any) {
    console.error('NSFW status error:', err)
    res.status(500).json({ status: false, message: '获取 NSFW 状态失败' })
  }
})

/**
 * POST /nsfw-reload - Manually (re)load the NSFW model (admin only)
 * Clears any previous error and attempts to load the model. Returns the
 * resulting status so the frontend can update immediately.
 */
router.post('/nsfw-reload', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { loadNsfwModel, resetNsfwState, isNsfwReady, getNsfwLoadError } = await import('../services/nsfw.js')
    resetNsfwState()
    try {
      await loadNsfwModel()
    } catch {
      // error captured in loadError; reported below
    }
    res.json({
      status: true,
      message: isNsfwReady() ? '模型加载成功' : '模型加载失败',
      data: {
        enabled: getCachedSetting('nsfw_enabled') === 'true',
        ready: isNsfwReady(),
        error: getNsfwLoadError()?.message || null,
      },
    })
  } catch (err: any) {
    console.error('NSFW reload error:', err)
    res.status(500).json({ status: false, message: '重新加载 NSFW 模型失败' })
  }
})

/**
 * GET /:id - Get image detail
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { id } = req.params

    const result = query(
      `SELECT i.*, u.name as user_name FROM images i LEFT JOIN users u ON i.user_id = u.id WHERE i.id = ?`,
      [id]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '图片不存在' })
      return
    }

    const row = result[0].values[0]
    const image = Object.fromEntries(result[0].columns.map((column, index) => [column, row[index]])) as Record<string, any>
    image.links = typeof image.links === 'string' ? JSON.parse(image.links) : image.links

    // Non-admin users can only see their own images
    if (user.role !== 'admin' && image.user_id !== user.id) {
      res.status(403).json({ status: false, message: '无权访问' })
      return
    }

    // Get tags
    const tagsResult = query(
      `SELECT t.id, t.name FROM tags t INNER JOIN image_tags it ON t.id = it.tag_id WHERE it.image_id = ?`,
      [id]
    )
    const tags = tagsResult.length > 0 ? tagsResult[0].values.map(row => ({
      id: row[0],
      name: row[1],
    })) : []

    res.json({ status: true, message: '获取成功', data: { ...image, tags } })
  } catch (err: any) {
    console.error('Get image error:', err)
    res.status(500).json({ status: false, message: '获取图片详情失败' })
  }
})

/**
 * PATCH /:id - Update image
 */
router.patch('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { id } = req.params
    const { album_id, permission, tags } = req.body

    // Check image exists and user has permission
    const imageResult = query('SELECT user_id FROM images WHERE id = ?', [id])
    if (imageResult.length === 0 || imageResult[0].values.length === 0) {
      res.status(404).json({ status: false, message: '图片不存在' })
      return
    }

    const ownerId = imageResult[0].values[0][0] as string
    if (user.role !== 'admin' && ownerId !== user.id) {
      res.status(403).json({ status: false, message: '无权操作' })
      return
    }

    // Update image fields
    if (album_id !== undefined) {
      db.run('UPDATE images SET album_id = ?, updated_at = datetime(\'now\') WHERE id = ?', [album_id, id])
    }
    if (permission !== undefined) {
      db.run('UPDATE images SET permission = ?, updated_at = datetime(\'now\') WHERE id = ?', [permission, id])
    }

    // Update tags
    if (tags && Array.isArray(tags)) {
      // Remove existing tags
      db.run('DELETE FROM image_tags WHERE image_id = ?', [id])

      for (const tagName of tags) {
        // Find or create tag
        let tagResult = query('SELECT id FROM tags WHERE name = ?', [tagName])
        let tagId: string

        if (tagResult.length > 0 && tagResult[0].values.length > 0) {
          tagId = tagResult[0].values[0][0] as string
        } else {
          tagId = uuidv4()
          db.run('INSERT INTO tags (id, name) VALUES (?, ?)', [tagId, tagName])
        }

        db.run('INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)', [id, tagId])
      }
    }

    scheduleSave()

    res.json({ status: true, message: '更新成功' })
  } catch (err: any) {
    console.error('Update image error:', err)
    res.status(500).json({ status: false, message: '更新图片失败' })
  }
})

/**
 * DELETE /:id - Delete image
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { id } = req.params

    const result = query('SELECT key, thumbnail_url, size, user_id, strategy_id FROM images WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '图片不存在' })
      return
    }

    const row = result[0].values[0]
    const key = row[0] as string
    const thumbnailUrl = row[1] as string
    const size = row[2] as number
    const ownerId = row[3] as string
    const strategyId = row[4] as string

    if (user.role !== 'admin' && ownerId !== user.id) {
      res.status(403).json({ status: false, message: '无权操作' })
      return
    }

    // Delete from storage
    try {
      const storage = getStorageByStrategyId(strategyId)
      await storage.delete(key)
      if (thumbnailUrl) {
        const thumbnailKey = thumbnailUrl.replace(/^\/uploads\//, '')
        await storage.delete(thumbnailKey)
      }
    } catch (err) {
      console.error('Delete from storage error:', err)
    }

    // Delete from database
    db.run('DELETE FROM image_tags WHERE image_id = ?', [id])
    db.run('DELETE FROM images WHERE id = ?', [id])

    // Update user used capacity
    db.run('UPDATE users SET used_capacity = MAX(0, used_capacity - ?) WHERE id = ?', [size, ownerId])

    scheduleSave()

    res.json({ status: true, message: '删除成功' })
  } catch (err: any) {
    console.error('Delete image error:', err)
    res.status(500).json({ status: false, message: '删除图片失败' })
  }
})

/**
 * POST /batch - Batch operations
 */
router.post('/batch', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { ids, action, album_id, permission } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ status: false, message: '请选择要操作的图片' })
      return
    }

    if (!action) {
      res.status(400).json({ status: false, message: '请指定操作类型' })
      return
    }

    const placeholders = ids.map(() => '?').join(',')

    // Verify ownership for non-admin
    if (user.role !== 'admin') {
      const ownerResult = query(
        `SELECT COUNT(*) FROM images WHERE id IN (${placeholders}) AND user_id = ?`,
        [...ids, user.id]
      )
      const count = ownerResult.length > 0 ? (ownerResult[0].values[0][0] as number) : 0
      if (count !== ids.length) {
        res.status(403).json({ status: false, message: '无权操作部分图片' })
        return
      }
    }

    switch (action) {
      case 'delete': {
        // Get images info for storage deletion and capacity update
        const imagesResult = query(
          `SELECT id, key, thumbnail_url, size, user_id, strategy_id FROM images WHERE id IN (${placeholders})`,
          ids
        )
        if (imagesResult.length > 0) {
          for (const row of imagesResult[0].values) {
            const key = row[1] as string
            const thumbnailUrl = row[2] as string
            const size = row[3] as number
            const ownerId = row[4] as string
            const strategyId = row[5] as string

            try {
              const storage = getStorageByStrategyId(strategyId)
              await storage.delete(key)
              if (thumbnailUrl) {
                const thumbnailKey = thumbnailUrl.replace(/^\/uploads\//, '')
                await storage.delete(thumbnailKey)
              }
            } catch (err) {
              console.error('Delete from storage error:', err)
            }

            db.run('UPDATE users SET used_capacity = MAX(0, used_capacity - ?) WHERE id = ?', [size, ownerId])
          }
        }

        // Delete tags and images
        for (const imgId of ids) {
          db.run('DELETE FROM image_tags WHERE image_id = ?', [imgId])
        }
        db.run(`DELETE FROM images WHERE id IN (${placeholders})`, ids)
        break
      }
      case 'move': {
        if (!album_id) {
          res.status(400).json({ status: false, message: '请指定目标相册' })
          return
        }
        db.run(
          `UPDATE images SET album_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`,
          [album_id, ...ids]
        )
        break
      }
      case 'permission': {
        if (!permission) {
          res.status(400).json({ status: false, message: '请指定权限' })
          return
        }
        db.run(
          `UPDATE images SET permission = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`,
          [permission, ...ids]
        )
        break
      }
      default:
        res.status(400).json({ status: false, message: '不支持的操作类型' })
        return
    }

    scheduleSave()

    res.json({ status: true, message: '批量操作成功' })
  } catch (err: any) {
    console.error('Batch operation error:', err)
    res.status(500).json({ status: false, message: '批量操作失败' })
  }
})

/**
 * GET /:id/qrcode - Generate QR code for image URL
 */
router.get('/:id/qrcode', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const QRCode = (await import('qrcode')).default
    const db = getDb()
    const user = req.user!
    const { id } = req.params

    const result = query('SELECT url, user_id FROM images WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '图片不存在' })
      return
    }

    const row = result[0].values[0]
    const imageUrl = row[0] as string
    const ownerId = row[1] as string

    if (user.role !== 'admin' && ownerId !== user.id) {
      res.status(403).json({ status: false, message: '无权操作' })
      return
    }

    const baseUrl = getCachedBaseUrl()
    const fullUrl = `${baseUrl}${imageUrl}`

    const qrDataUrl = await QRCode.toDataURL(fullUrl)

    res.json({ status: true, message: '生成成功', data: { qrcode: qrDataUrl, url: fullUrl } })
  } catch (err: any) {
    console.error('QR code error:', err)
    res.status(500).json({ status: false, message: '生成二维码失败' })
  }
})

export default router
