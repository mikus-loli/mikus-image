/**
 * User routes - Admin-only user management
 */
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb, query, scheduleSave } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { getStorageByStrategyId } from '../services/storage.js'

const router = Router()

// Helper: write audit log
function auditLog(operatorId: string, operatorName: string, action: string, targetType: string, targetId: string, targetName: string, detail: string = '') {
  const db = getDb()
  const id = 'log_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  db.run(
    'INSERT INTO audit_logs (id, operator_id, operator_name, action, target_type, target_id, target_name, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, operatorId, operatorName, action, targetType, targetId, targetName, detail]
  )
  scheduleSave()
}

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
    const sqlQuery = `SELECT id, name, email, role, capacity, used_capacity, status, totp_enabled, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
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
      totp_enabled: row[7] === 1,
      created_at: row[8],
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

/**
 * POST / - Add a new user (admin only)
 */
router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { name, email, password, role } = req.body
    const operator = req.user!

    if (!name || !password) {
      res.status(400).json({ status: false, message: '用户名和密码为必填项' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ status: false, message: '密码至少需要8位字符' })
      return
    }

    // Check duplicate name
    const existing = query('SELECT id FROM users WHERE name = ?', [name])
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(409).json({ status: false, message: '用户名已存在' })
      return
    }

    const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const hashedPassword = await bcrypt.hash(password, 10)
    const userRole = role === 'admin' ? 'admin' : 'user'
    const capacity = 1024 * 1024 * 1024 // 1 GB default

    db.run(
      'INSERT INTO users (id, name, email, password, role, capacity) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email || '', hashedPassword, userRole, capacity]
    )
    scheduleSave()

    auditLog(operator.id, operator.name, 'create_user', 'user', id, name, `角色: ${userRole}`)

    res.json({ status: true, message: '用户创建成功', data: { id, name, role: userRole } })
  } catch (err: any) {
    console.error('Create user error:', err)
    res.status(500).json({ status: false, message: '创建用户失败' })
  }
})

/**
 * POST /:id/reset-password - Admin reset user password
 */
router.post('/:id/reset-password', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { id } = req.params
    const { password } = req.body
    const operator = req.user!

    if (!password || password.length < 8) {
      res.status(400).json({ status: false, message: '密码至少需要8位字符' })
      return
    }

    const result = query('SELECT id, name FROM users WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }

    const targetName = result[0].values[0][1] as string
    const hashedPassword = await bcrypt.hash(password, 10)
    db.run("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?", [hashedPassword, id])
    scheduleSave()

    auditLog(operator.id, operator.name, 'reset_password', 'user', id, targetName)

    res.json({ status: true, message: '密码重置成功' })
  } catch (err: any) {
    console.error('Reset password error:', err)
    res.status(500).json({ status: false, message: '重置密码失败' })
  }
})

/**
 * POST /:id/reset-2fa - Admin reset user's 2FA (disable it)
 */
router.post('/:id/reset-2fa', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const { id } = req.params
    const operator = req.user!

    const result = query('SELECT id, name FROM users WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }

    const targetName = result[0].values[0][1] as string
    db.run("UPDATE users SET totp_secret = '', totp_enabled = 0, updated_at = datetime('now') WHERE id = ?", [id])
    scheduleSave()

    auditLog(operator.id, operator.name, 'reset_2fa', 'user', id, targetName)

    res.json({ status: true, message: '2FA已重置' })
  } catch (err: any) {
    console.error('Reset 2FA error:', err)
    res.status(500).json({ status: false, message: '重置2FA失败' })
  }
})

/**
 * GET /audit-logs - Get audit logs (admin only)
 */
router.get('/audit-logs', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
    const offset = (page - 1) * limit

    const countResult = query('SELECT COUNT(*) FROM audit_logs')
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    const result = query(
      'SELECT id, operator_id, operator_name, action, target_type, target_id, target_name, detail, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    )

    const logs = result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      operator_id: row[1],
      operator_name: row[2],
      action: row[3],
      target_type: row[4],
      target_id: row[5],
      target_name: row[6],
      detail: row[7],
      created_at: row[8],
    })) : []

    res.json({
      status: true,
      message: '获取成功',
      data: {
        logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err: any) {
    console.error('Audit logs error:', err)
    res.status(500).json({ status: false, message: '获取日志失败' })
  }
})

export default router
