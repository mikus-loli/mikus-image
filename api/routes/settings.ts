/**
 * Settings routes - Get and update system settings
 */
import { Router, type Request, type Response } from 'express'
import { getDb, query, scheduleSave, invalidateSettingsCache } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * GET /public - Get public settings (no auth required)
 */
router.get('/public', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = query('SELECT key, value, type FROM settings WHERE is_public = 1')

    const settings: Record<string, any> = {}
    if (result.length > 0) {
      for (const row of result[0].values) {
        const key = row[0] as string
        let value: any = row[1]
        const type = row[2] as string

        if (type === 'number') {
          value = parseFloat(value as string)
        } else if (type === 'boolean') {
          value = value === 'true'
        }

        settings[key] = value
      }
    }

    res.json({ status: true, message: '获取成功', data: settings })
  } catch (err: any) {
    console.error('Get public settings error:', err)
    res.status(500).json({ status: false, message: '获取设置失败' })
  }
})

/**
 * GET / - Get all settings
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const user = req.user!

    let sqlQuery = 'SELECT key, value, type, description, is_public FROM settings'
    const params: any[] = []

    // Non-admin users can only see public settings
    if (user.role !== 'admin') {
      sqlQuery += ' WHERE is_public = 1'
    }

    const result = query(sqlQuery, params)

    const settings: Record<string, any> = {}
    if (result.length > 0) {
      for (const row of result[0].values) {
        const key = row[0] as string
        let value: any = row[1]
        const type = row[2] as string

        // Convert value based on type
        if (type === 'number') {
          value = parseFloat(value as string)
        } else if (type === 'boolean') {
          value = value === 'true'
        }

        settings[key] = value
      }
    }

    res.json({ status: true, message: '获取成功', data: settings })
  } catch (err: any) {
    console.error('Get settings error:', err)
    res.status(500).json({ status: false, message: '获取设置失败' })
  }
})

/**
 * PATCH / - Update settings (admin only)
 */
router.patch('/', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const updates = req.body

    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ status: false, message: '请提供要更新的设置' })
      return
    }

    for (const [key, value] of Object.entries(updates)) {
      const stringValue = String(value)
      db.run(
        "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?",
        [stringValue, key]
      )
    }

    scheduleSave()
    invalidateSettingsCache()

    res.json({ status: true, message: '更新成功' })
  } catch (err: any) {
    console.error('Update settings error:', err)
    res.status(500).json({ status: false, message: '更新设置失败' })
  }
})

/**
 * GET /stats - Get public site statistics (no auth required)
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const userCount = query('SELECT COUNT(*) FROM users WHERE status = ?', ['active'])
    const imageCount = query('SELECT COUNT(*) FROM images')
    const createdAt = query("SELECT value FROM settings WHERE key = 'site_created_at'")

    const users = userCount.length > 0 ? (userCount[0].values[0]?.[0] as number) || 0 : 0
    const images = imageCount.length > 0 ? (imageCount[0].values[0]?.[0] as number) || 0 : 0

    let days = 1
    if (createdAt.length > 0 && createdAt[0].values.length > 0) {
      const created = createdAt[0].values[0][0] as string
      if (created) {
        const diff = Date.now() - new Date(created).getTime()
        days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }
    }

    res.json({
      status: true,
      message: '获取成功',
      data: { users, images, days },
    })
  } catch (err: any) {
    console.error('Get public stats error:', err)
    res.json({
      status: true,
      message: '获取成功',
      data: { users: 0, images: 0, days: 1 },
    })
  }
})

export default router
