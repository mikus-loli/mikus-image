/**
 * Auth routes - User registration, login, and profile
 */
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getDb, query, saveDbToFile, getCachedSetting } from '../db.js'
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js'
import { verifyTotpToken } from '../services/totp.js'

const router = Router()

const JWT_EXPIRES_IN = '7d'

function generateToken(user: { id: string; name: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

/**
 * POST /register - Register a new user
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      res.status(400).json({ status: false, message: '请填写所有必填字段' })
      return
    }

    // Validate username format: only alphanumerics, underscore, hyphen, dot,
    // and CJK characters. Reject path traversal characters and control chars.
    if (typeof name !== 'string' || name.length < 2 || name.length > 32 ||
        /[\/\\]|\.\.|[\x00-\x1f]/.test(name)) {
      res.status(400).json({ status: false, message: '用户名格式无效' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ status: false, message: '密码至少6个字符' })
      return
    }

    const db = getDb()

    // Check if registration is enabled
    const regSetting = db.exec("SELECT value FROM settings WHERE key = 'register_enabled'")
    if (regSetting.length > 0 && regSetting[0].values.length > 0) {
      if (regSetting[0].values[0][0] === 'false') {
        res.status(403).json({ status: false, message: '注册已关闭' })
        return
      }
    }

    // Check if email already exists
    const existing = query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(409).json({ status: false, message: '该邮箱已被注册' })
      return
    }

    const id = uuidv4()
    const hashedPassword = await bcrypt.hash(password, 10)

    // First user becomes admin
    const userCount = db.exec('SELECT COUNT(*) FROM users')
    const count = userCount.length > 0 ? (userCount[0].values[0][0] as number) : 0
    const role = count === 0 ? 'admin' : 'member'

    // Get default capacity
    const capSetting = db.exec("SELECT value FROM settings WHERE key = 'default_capacity'")
    const capacity = capSetting.length > 0 && capSetting[0].values.length > 0
      ? parseInt(capSetting[0].values[0][0] as string)
      : 104857600

    db.run(
      'INSERT INTO users (id, name, email, password, role, capacity) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, role, capacity]
    )

    const user = { id, name, email, role }
    const token = generateToken(user)

    res.status(201).json({
      status: true,
      message: role === 'admin' ? '注册成功，您已成为管理员' : '注册成功',
      data: { token, user },
    })
  } catch (err: any) {
    console.error('Register error:', err)
    res.status(500).json({ status: false, message: '注册失败' })
  }
})

/**
 * POST /login - User login (by username)
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, password } = req.body

    if (!name || !password) {
      res.status(400).json({ status: false, message: '请填写用户名和密码' })
      return
    }

    const db = getDb()
    const result = query(
      'SELECT id, name, email, password, role, status, totp_enabled, totp_secret FROM users WHERE name = ?',
      [name]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(401).json({ status: false, message: '用户名或密码错误' })
      return
    }

    const row = result[0].values[0]
    const user = {
      id: String(row[0]),
      name: String(row[1]),
      email: String(row[2]),
      hashedPassword: String(row[3]),
      role: String(row[4]),
      status: String(row[5]),
      totpEnabled: row[6] === 1,
      totpSecret: String(row[7] || ''),
    }

    if (user.status !== 'active') {
      res.status(403).json({ status: false, message: '账号已被禁用' })
      return
    }

    const isMatch = await bcrypt.compare(password, user.hashedPassword)
    if (!isMatch) {
      res.status(401).json({ status: false, message: '用户名或密码错误' })
      return
    }

    // 2FA check: if user has 2FA enabled, require TOTP code
    if (user.totpEnabled && user.totpSecret) {
      // Issue a short-lived temp token for 2FA verification
      const tempToken = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, twofa_pending: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      )
      res.json({
        status: true,
        message: '请输入双因素认证验证码',
        data: { requires_2fa: true, temp_token: tempToken },
      })
      return
    }

    // Global force_2fa check: if admin forces 2FA and user hasn't set it up
    const force2fa = getCachedSetting('force_2fa') === 'true'
    if (force2fa) {
      const tempToken = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, twofa_setup_pending: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      )
      res.json({
        status: true,
        message: '管理员要求启用双因素认证，请先完成设置',
        data: { requires_2fa_setup: true, temp_token: tempToken },
      })
      return
    }

    const tokenUser = { id: user.id, name: user.name, email: user.email, role: user.role }
    const token = generateToken(tokenUser)

    res.json({
      status: true,
      message: '登录成功',
      data: { token, user: tokenUser },
    })
  } catch (err: any) {
    console.error('Login error:', err)
    res.status(500).json({ status: false, message: '登录失败' })
  }
})

/**
 * POST /login/verify-2fa - Verify TOTP code and complete login
 */
router.post('/login/verify-2fa', async (req: Request, res: Response): Promise<void> => {
  try {
    const { temp_token, code } = req.body
    if (!temp_token || !code) {
      res.status(400).json({ status: false, message: '请提供临时令牌和验证码' })
      return
    }

    // Verify temp token
    let decoded: any
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET)
    } catch {
      res.status(401).json({ status: false, message: '临时令牌已过期，请重新登录' })
      return
    }

    if (!decoded.twofa_pending) {
      res.status(400).json({ status: false, message: '无效的临时令牌' })
      return
    }

    // Get user's TOTP secret
    const result = query('SELECT totp_secret, totp_enabled, status FROM users WHERE id = ?', [decoded.id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }

    const row = result[0].values[0]
    const secret = String(row[0] || '')
    const totpEnabled = row[1] === 1
    const userStatus = String(row[2])

    if (userStatus !== 'active') {
      res.status(403).json({ status: false, message: '账号已被禁用' })
      return
    }

    if (!totpEnabled || !secret) {
      res.status(400).json({ status: false, message: '该用户未启用2FA' })
      return
    }

    // Verify TOTP code
    if (!await verifyTotpToken(code, secret)) {
      res.status(401).json({ status: false, message: '验证码错误' })
      return
    }

    // Issue real JWT
    const tokenUser = { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role }
    const token = generateToken(tokenUser)

    res.json({
      status: true,
      message: '登录成功',
      data: { token, user: tokenUser },
    })
  } catch (err: any) {
    console.error('2FA login verify error:', err)
    res.status(500).json({ status: false, message: '2FA验证失败' })
  }
})

/**
 * GET /me - Get current user info
 */
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb()
    const result = query(
      'SELECT id, name, email, role, capacity, used_capacity, status, created_at FROM users WHERE id = ?',
      [req.user!.id]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }

    const row = result[0].values[0]
    const user = {
      id: row[0],
      name: row[1],
      email: row[2],
      role: row[3],
      capacity: row[4],
      used_capacity: row[5],
      status: row[6],
      created_at: row[7],
    }

    res.json({ status: true, message: '获取成功', data: user })
  } catch (err: any) {
    console.error('Get me error:', err)
    res.status(500).json({ status: false, message: '获取用户信息失败' })
  }
})

/**
 * PATCH /profile - Update current user's profile (name, password)
 */
router.patch('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, oldPassword, newPassword } = req.body
    const db = getDb()
    const userId = req.user!.id

    // If changing password, verify old password
    if (newPassword) {
      if (!oldPassword) {
        res.status(400).json({ status: false, message: '请输入当前密码' })
        return
      }
      if (newPassword.length < 6) {
        res.status(400).json({ status: false, message: '新密码至少6个字符' })
        return
      }
      const pwResult = query('SELECT password FROM users WHERE id = ?', [userId])
      if (pwResult.length === 0 || pwResult[0].values.length === 0) {
        res.status(404).json({ status: false, message: '用户不存在' })
        return
      }
      const currentHash = String(pwResult[0].values[0][0])
      const isMatch = await bcrypt.compare(oldPassword, currentHash)
      if (!isMatch) {
        res.status(401).json({ status: false, message: '当前密码错误' })
        return
      }
      const newHash = await bcrypt.hash(newPassword, 10)
      db.run("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?", [newHash, userId])
    }

    // If changing name
    if (name) {
      // Check if name is taken by another user
      const nameResult = query('SELECT id FROM users WHERE name = ? AND id != ?', [name, userId])
      if (nameResult.length > 0 && nameResult[0].values.length > 0) {
        res.status(409).json({ status: false, message: '该用户名已被占用' })
        return
      }
      db.run("UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?", [name, userId])
    }

    // Return updated user info
    const result = query(
      'SELECT id, name, email, role, capacity, used_capacity, status, created_at FROM users WHERE id = ?',
      [userId]
    )
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }
    const row = result[0].values[0]
    const updatedUser = {
      id: row[0],
      name: row[1],
      email: row[2],
      role: row[3],
      capacity: row[4],
      used_capacity: row[5],
      status: row[6],
      created_at: row[7],
    }

    // Generate new token with updated name
    const newToken = generateToken({ id: String(updatedUser.id), name: String(updatedUser.name), email: String(updatedUser.email), role: String(updatedUser.role) })

    res.json({
      status: true,
      message: '修改成功',
      data: { user: updatedUser, token: newToken },
    })
  } catch (err: any) {
    console.error('Update profile error:', err)
    res.status(500).json({ status: false, message: '修改失败' })
  }
})

export default router
