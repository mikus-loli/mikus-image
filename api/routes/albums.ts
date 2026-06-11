/**
 * Album routes - CRUD for albums
 */
import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, query, scheduleSave } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * GET /public - List public albums (no auth required)
 */
router.get('/public', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = query(
      `SELECT a.id, a.name, a.description, a.cover, a.created_at,
              (SELECT COUNT(*) FROM images WHERE album_id = a.id AND permission = 'public') as image_count,
              (SELECT thumbnail_url FROM images WHERE album_id = a.id AND permission = 'public' ORDER BY created_at DESC LIMIT 1) as latest_thumbnail
       FROM albums a
       WHERE a.id IN (SELECT DISTINCT album_id FROM images WHERE permission = 'public' AND album_id IS NOT NULL)
       ORDER BY a.sort_order ASC, a.created_at DESC`
    )

    const albums = result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      cover: row[3],
      created_at: row[4],
      image_count: row[5],
      latest_thumbnail: row[6],
    })) : []

    res.json({ status: true, message: '获取成功', data: albums })
  } catch (err: any) {
    console.error('Public albums error:', err)
    res.status(500).json({ status: false, message: '获取公开相册失败' })
  }
})

/**
 * GET / - List user's albums
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!

    const result = query(
      `SELECT a.*, (SELECT COUNT(*) FROM images WHERE album_id = a.id) as image_count
       FROM albums a WHERE a.user_id = ? ORDER BY a.sort_order ASC, a.created_at DESC`,
      [user.id]
    )

    const albums = result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      user_id: row[3],
      cover: row[4],
      sort_order: row[5],
      created_at: row[6],
      updated_at: row[7],
      image_count: row[8],
    })) : []

    res.json({ status: true, message: '获取成功', data: albums })
  } catch (err: any) {
    console.error('List albums error:', err)
    res.status(500).json({ status: false, message: '获取相册列表失败' })
  }
})

/**
 * POST / - Create album
 */
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { name, description, cover, sort_order } = req.body

    if (!name) {
      res.status(400).json({ status: false, message: '请填写相册名称' })
      return
    }

    const id = uuidv4()
    db.run(
      'INSERT INTO albums (id, name, description, user_id, cover, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description || '', user.id, cover || '', sort_order || 0]
    )

    scheduleSave()

    const album = { id, name, description: description || '', user_id: user.id, cover: cover || '', sort_order: sort_order || 0 }
    res.status(201).json({ status: true, message: '创建成功', data: album })
  } catch (err: any) {
    console.error('Create album error:', err)
    res.status(500).json({ status: false, message: '创建相册失败' })
  }
})

/**
 * GET /:id - Get album with images
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { id } = req.params

    const result = query('SELECT * FROM albums WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '相册不存在' })
      return
    }

    const row = result[0].values[0]
    const album = {
      id: row[0], name: row[1], description: row[2], user_id: row[3],
      cover: row[4], sort_order: row[5], created_at: row[6], updated_at: row[7],
    }

    // Non-admin users can only see their own albums
    if (user.role !== 'admin' && album.user_id !== user.id) {
      res.status(403).json({ status: false, message: '无权访问' })
      return
    }

    // Get actual image count and images in album
    const countResult = query('SELECT COUNT(*) as image_count FROM images WHERE album_id = ?', [id])
    const imageCount = countResult.length > 0 && countResult[0].values.length > 0
      ? Number(countResult[0].values[0][0] || 0)
      : 0

    const imagesResult = query(
      'SELECT id, key, name, original_name, size, mime_type, width, height, url, permission, created_at FROM images WHERE album_id = ? ORDER BY created_at DESC',
      [id]
    )

    const images = imagesResult.length > 0 ? imagesResult[0].values.map(img => ({
      id: img[0], key: img[1], name: img[2], original_name: img[3],
      size: img[4], mime_type: img[5], width: img[6], height: img[7],
      url: img[8], permission: img[9], created_at: img[10],
    })) : []

    res.json({ status: true, message: '获取成功', data: { ...album, image_count: imageCount, images } })
  } catch (err: any) {
    console.error('Get album error:', err)
    res.status(500).json({ status: false, message: '获取相册详情失败' })
  }
})

/**
 * PATCH /:id - Update album
 */
router.patch('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { id } = req.params
    const { name, description, cover, sort_order } = req.body

    const result = query('SELECT user_id FROM albums WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '相册不存在' })
      return
    }

    const ownerId = result[0].values[0][0] as string
    if (user.role !== 'admin' && ownerId !== user.id) {
      res.status(403).json({ status: false, message: '无权操作' })
      return
    }

    if (name !== undefined) {
      db.run("UPDATE albums SET name = ?, updated_at = datetime('now') WHERE id = ?", [name, id])
    }
    if (description !== undefined) {
      db.run("UPDATE albums SET description = ?, updated_at = datetime('now') WHERE id = ?", [description, id])
    }
    if (cover !== undefined) {
      db.run("UPDATE albums SET cover = ?, updated_at = datetime('now') WHERE id = ?", [cover, id])
    }
    if (sort_order !== undefined) {
      db.run("UPDATE albums SET sort_order = ?, updated_at = datetime('now') WHERE id = ?", [sort_order, id])
    }

    scheduleSave()

    res.json({ status: true, message: '更新成功' })
  } catch (err: any) {
    console.error('Update album error:', err)
    res.status(500).json({ status: false, message: '更新相册失败' })
  }
})

/**
 * DELETE /:id - Delete album
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!
    const { id } = req.params

    const result = query('SELECT user_id FROM albums WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '相册不存在' })
      return
    }

    const ownerId = result[0].values[0][0] as string
    if (user.role !== 'admin' && ownerId !== user.id) {
      res.status(403).json({ status: false, message: '无权操作' })
      return
    }

    // Set images' album_id to null
    db.run('UPDATE images SET album_id = NULL WHERE album_id = ?', [id])

    // Delete album
    db.run('DELETE FROM albums WHERE id = ?', [id])

    scheduleSave()

    res.json({ status: true, message: '删除成功' })
  } catch (err: any) {
    console.error('Delete album error:', err)
    res.status(500).json({ status: false, message: '删除相册失败' })
  }
})

export default router
