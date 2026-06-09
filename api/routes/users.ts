/**
 * User routes - Admin-only user management
 */
import { Router, type Request, type Response } from 'express'
import { getDb, query, scheduleSave } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { getStorageByStrategyId } from '../services/storage.js'

const router = Router()

/**
 * GET / - List all users with pagination
 */
router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string || ''
    const offset = (page - 1) * limit

    let whereClause = ''
    const params: any[] = []

    if (search) {
      whereClause = 'WHERE name LIKE ? OR email LIKE ?'
      params.push(`%${search}%`, `%${search}%`)
    }

    // Get total count
    const countResult = query(`SELECT COUNT(*) FROM users ${whereClause}`, params)
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    // Get users (exclude password)
    const sqlQuery = `SELECT id, name, email, role, capacity, used_capacity, status, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const queryParams = [...params, limit, offset]
    const result = query(sqlQuery, queryParams)

    const users = result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      role: row[3],
      capacity: row[4],
      used_capacity: row[5],
      status: row[6],
      created_at: row[7],
    })) : []

    res.json({
      status: true,
      message: '获取成功',
      data: {
        users,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err: any) {
    console.error('List users error:', err)
    res.status(500).json({ status: false, message: '获取用户列表失败' })
  }
})

/**
 * PATCH /:id - Update user (role, capacity, status)
 */
router.patch('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { id } = req.params
    const { role, capacity, status } = req.body

    const result = query('SELECT id FROM users WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }

    if (role !== undefined) {
      db.run("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", [role, id])
    }
    if (capacity !== undefined) {
      db.run("UPDATE users SET capacity = ?, updated_at = datetime('now') WHERE id = ?", [capacity, id])
    }
    if (status !== undefined) {
      db.run("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id])
    }

    scheduleSave()

    res.json({ status: true, message: '更新成功' })
  } catch (err: any) {
    console.error('Update user error:', err)
    res.status(500).json({ status: false, message: '更新用户失败' })
  }
})

/**
 * DELETE /:id - Delete user and their images
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { id } = req.params

    // Prevent deleting self
    if (id === req.user!.id) {
      res.status(400).json({ status: false, message: '不能删除自己' })
      return
    }

    const result = query('SELECT id FROM users WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }

    // Get user's images for storage cleanup
    const imagesResult = query('SELECT id, key, strategy_id FROM images WHERE user_id = ?', [id])
    if (imagesResult.length > 0) {
      for (const row of imagesResult[0].values) {
        const imgKey = row[1] as string
        const strategyId = row[2] as string
        try {
          const storage = getStorageByStrategyId(strategyId)
          await storage.delete(imgKey)
        } catch (err) {
          console.error('Delete from storage error:', err)
        }
      }
    }

    // Delete image tags
    const imageIds = imagesResult.length > 0 ? imagesResult[0].values.map(r => r[0]) : []
    for (const imgId of imageIds) {
      db.run('DELETE FROM image_tags WHERE image_id = ?', [imgId])
    }

    // Delete images
    db.run('DELETE FROM images WHERE user_id = ?', [id])

    // Delete albums
    db.run('DELETE FROM albums WHERE user_id = ?', [id])

    // Delete user
    db.run('DELETE FROM users WHERE id = ?', [id])

    scheduleSave()

    res.json({ status: true, message: '删除成功' })
  } catch (err: any) {
    console.error('Delete user error:', err)
    res.status(500).json({ status: false, message: '删除用户失败' })
  }
})

export default router
