/**
 * Strategy routes - Admin-only storage strategy management
 */
import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, query, scheduleSave } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * GET / - List all strategies
 */
router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const result = db.exec('SELECT * FROM strategies ORDER BY created_at DESC')

    const strategies = result.length > 0 ? result[0].values.map(row => {
      const strategyId = row[0]
      // Count images and sum size for this strategy
      const stats = query(
        'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM images WHERE strategy_id = ?',
        [strategyId]
      )
      const fileCount = stats.length > 0 && stats[0].values.length > 0 ? (stats[0].values[0][0] as number) : 0
      const usedSpace = stats.length > 0 && stats[0].values.length > 0 ? (stats[0].values[0][1] as number) : 0

      return {
        id: row[0],
        name: row[1],
        type: row[2],
        config: typeof row[3] === 'string' ? JSON.parse(row[3]) : row[3],
        is_default: row[4],
        status: row[5],
        created_at: row[6],
        updated_at: row[7],
        file_count: fileCount,
        used_space: usedSpace,
      }
    }) : []

    res.json({ status: true, message: '获取成功', data: strategies })
  } catch (err: any) {
    console.error('List strategies error:', err)
    res.status(500).json({ status: false, message: '获取存储策略列表失败' })
  }
})

/**
 * POST / - Create strategy
 */
router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { name, type, config, is_default, status } = req.body

    if (!name || !type) {
      res.status(400).json({ status: false, message: '请填写策略名称和类型' })
      return
    }

    const id = uuidv4()
    const configStr = JSON.stringify(config || {})

    db.run(
      'INSERT INTO strategies (id, name, type, config, is_default, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, type, configStr, is_default ? 1 : 0, status || 'active']
    )

    // If this is set as default, unset other defaults
    if (is_default) {
      db.run("UPDATE strategies SET is_default = 0 WHERE id != ?", [id])
      db.run("UPDATE settings SET value = ? WHERE key = 'default_strategy'", [id])
    }

    scheduleSave()

    const strategy = { id, name, type, config: config || {}, is_default: is_default ? 1 : 0, status: status || 'active' }
    res.status(201).json({ status: true, message: '创建成功', data: strategy })
  } catch (err: any) {
    console.error('Create strategy error:', err)
    res.status(500).json({ status: false, message: '创建存储策略失败' })
  }
})

/**
 * PATCH /:id - Update strategy
 */
router.patch('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, type, config, is_default, status } = req.body

    const result = query('SELECT id FROM strategies WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '策略不存在' })
      return
    }

    if (name !== undefined) {
      db.run("UPDATE strategies SET name = ?, updated_at = datetime('now') WHERE id = ?", [name, id])
    }
    if (type !== undefined) {
      db.run("UPDATE strategies SET type = ?, updated_at = datetime('now') WHERE id = ?", [type, id])
    }
    if (config !== undefined) {
      db.run("UPDATE strategies SET config = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(config), id])
    }
    if (status !== undefined) {
      db.run("UPDATE strategies SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id])
    }
    if (is_default !== undefined) {
      if (is_default) {
        db.run("UPDATE strategies SET is_default = 0")
        db.run("UPDATE settings SET value = ? WHERE key = 'default_strategy'", [id])
      }
      db.run("UPDATE strategies SET is_default = ?, updated_at = datetime('now') WHERE id = ?", [is_default ? 1 : 0, id])
    }

    scheduleSave()

    res.json({ status: true, message: '更新成功' })
  } catch (err: any) {
    console.error('Update strategy error:', err)
    res.status(500).json({ status: false, message: '更新存储策略失败' })
  }
})

/**
 * DELETE /:id - Delete strategy
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { id } = req.params

    const result = query('SELECT id, is_default FROM strategies WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '策略不存在' })
      return
    }

    const isDefault = result[0].values[0][1] as number
    if (isDefault) {
      res.status(400).json({ status: false, message: '不能删除默认策略' })
      return
    }

    // Check if any images use this strategy
    const imageCount = query('SELECT COUNT(*) FROM images WHERE strategy_id = ?', [id])
    const count = imageCount.length > 0 ? (imageCount[0].values[0][0] as number) : 0
    if (count > 0) {
      res.status(400).json({ status: false, message: `该策略下有 ${count} 张图片，无法删除` })
      return
    }

    db.run('DELETE FROM strategies WHERE id = ?', [id])

    scheduleSave()

    res.json({ status: true, message: '删除成功' })
  } catch (err: any) {
    console.error('Delete strategy error:', err)
    res.status(500).json({ status: false, message: '删除存储策略失败' })
  }
})

export default router
