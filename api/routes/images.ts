/**
 * Image routes - Upload, list, update, delete images
 */
import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { getDb, query, scheduleSave, getCachedSetting, getCachedBaseUrl } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { getStorageByStrategyId } from '../services/storage.js'
import { processImage, isProcessableRasterImage, isConvertibleToWebp } from '../services/image-processor.js'

const router = Router()

function generateImageKey(extension: string, username?: string): string {
  const now = new Date()
  const Y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const id = uuidv4().replace(/-/g, '').substring(0, 12)
  // Path format: username/YYYY/MM/DD/filename
  if (username) {
    return `${username}/${Y}/${m}/${d}/${id}${extension}`
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
  const watermarkOpacity = parseFloat(getCachedSetting('watermark_opacity') || '0.3')
  const enableThumbnail = getCachedSetting('enable_thumbnail') === 'true'
  const thumbnailMaxWidth = Math.max(1, parseInt(getCachedSetting('thumbnail_max_width') || '300'))

  // Determine mime type from original extension (for processing decision)
  const ext = path.extname(originalName).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  }
  const mimeType = mimeTypes[ext] || 'image/jpeg'
  // Output is always WebP for convertible raster images, original format for GIF/SVG/etc
  const outputMimeType = isConvertibleToWebp(mimeType) ? 'image/webp' : mimeType

  // Get dimensions first (using image-size which supports ICO, SVG, GIF, etc.)
  let width = 0, height = 0
  try {
    const { imageSize } = await import('image-size')
    const dimensions = imageSize(buffer)
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
      const result = await processImage(buffer, {
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
      processedBuffer = buffer
    }
  } else {
    processedBuffer = buffer
  }

  // Generate key and upload - use .webp for convertible images, original ext for GIF/SVG/etc
  const outputExt = isConvertibleToWebp(mimeType) ? '.webp' : ext
  const storedOriginalName = isConvertibleToWebp(mimeType)
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
  const id = uuidv4()

  db.run(
    `INSERT INTO images (id, key, name, original_name, size, mime_type, width, height, url, thumbnail_url, strategy_id, album_id, user_id, permission, links)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, key, path.basename(storedOriginalName, path.extname(storedOriginalName)), storedOriginalName,
      processedBuffer.length, outputMimeType,
      width, height, imagePath, thumbnailUrl, strategyId, albumId, userId, permission,
      JSON.stringify(links),
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
        res.status(413).json({ status: false, message: '存储空间不足' })
        return
      }
    }

    const buffer = fs.readFileSync(req.file.path)
    const image = await processAndSaveImage(buffer, req.file.originalname, strategyId, user.id, user.name, albumId, permission)

    // Clean up temp file
    fs.unlinkSync(req.file.path)

    res.status(201).json({ status: true, message: '上传成功', data: image })
  } catch (err: any) {
    console.error('Upload error:', err)
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
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
        res.status(413).json({ status: false, message: '存储空间不足' })
        return
      }
    }

    const image = await processAndSaveImage(buffer, originalName, strategyId, user.id, user.name, album_id || null, permission || 'private')

    res.status(201).json({ status: true, message: '上传成功', data: image })
  } catch (err: any) {
    console.error('URL upload error:', err)
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
