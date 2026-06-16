/**
 * 2FA routes - Setup, verify, disable TOTP authentication
 */
import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb, query, scheduleSave, getCachedSetting } from '../db.js'
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js'
import { generateTotpSecret, buildOtpAuthUri, generateQrCodeDataUrl, verifyTotpToken } from '../services/totp.js'

const router = Router()

/**
 * GET /status - Get current user's 2FA status
 */
router.get('/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = query('SELECT totp_enabled, totp_secret FROM users WHERE id = ?', [req.user!.id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }
    const row = result[0].values[0]
    const force2fa = getCachedSetting('force_2fa') === 'true'

    res.json({
      status: true,
      message: '获取成功',
      data: {
        enabled: row[0] === 1,
        force_2fa: force2fa,
      },
    })
  } catch (err: any) {
    console.error('2FA status error:', err)
    res.status(500).json({ status: false, message: '获取2FA状态失败' })
  }
})

/**
 * POST /setup - Generate TOTP secret and QR code (requires current password)
 * Returns secret + QR code for the user to scan, but does NOT enable 2FA yet
 */
router.post('/setup', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body
    if (!password) {
      res.status(400).json({ status: false, message: '请输入当前密码' })
      return
    }

    // Verify current password
    const pwResult = query('SELECT password FROM users WHERE id = ?', [req.user!.id])
    if (pwResult.length === 0 || pwResult[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }
    const currentHash = String(pwResult[0].values[0][0])
    const isMatch = await bcrypt.compare(password, currentHash)
    if (!isMatch) {
      res.status(401).json({ status: false, message: '当前密码错误' })
      return
    }

    // Check if 2FA already enabled
    const existing = query('SELECT totp_enabled FROM users WHERE id = ?', [req.user!.id])
    if (existing.length > 0 && existing[0].values[0][0] === 1) {
      res.status(400).json({ status: false, message: '2FA已启用，请先禁用' })
      return
    }

    // Generate new secret (store temporarily, only persist on verify)
    const secret = generateTotpSecret()
    const otpauthUri = buildOtpAuthUri(req.user!.name, secret)
    const qrCode = await generateQrCodeDataUrl(otpauthUri)

    // Issue a short-lived setup token containing the secret
    const setupToken = jwt.sign(
      { id: req.user!.id, totp_setup_secret: secret },
      JWT_SECRET,
      { expiresIn: '5m' }
    )

    res.json({
      status: true,
      message: '请扫描二维码并输入验证码',
      data: {
        secret,
        qr_code: qrCode,
        otpauth_uri: otpauthUri,
        setup_token: setupToken,
      },
    })
  } catch (err: any) {
    console.error('2FA setup error:', err)
    res.status(500).json({ status: false, message: '2FA设置失败' })
  }
})

/**
 * POST /verify - Verify TOTP code and enable 2FA
 */
router.post('/verify', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, setup_token } = req.body
    if (!code || !setup_token) {
      res.status(400).json({ status: false, message: '请提供验证码和设置令牌' })
      return
    }

    // Verify setup token
    let decoded: any
    try {
      decoded = jwt.verify(setup_token, JWT_SECRET)
    } catch {
      res.status(401).json({ status: false, message: '设置令牌已过期，请重新设置' })
      return
    }

    if (decoded.id !== req.user!.id || !decoded.totp_setup_secret) {
      res.status(400).json({ status: false, message: '无效的设置令牌' })
      return
    }

    const secret = decoded.totp_setup_secret
    if (!await verifyTotpToken(code, secret)) {
      res.status(401).json({ status: false, message: '验证码错误' })
      return
    }

    // Enable 2FA: persist secret and set totp_enabled=1
    const db = getDb()
    db.run(
      "UPDATE users SET totp_secret = ?, totp_enabled = 1, updated_at = datetime('now') WHERE id = ?",
      [secret, req.user!.id]
    )
    scheduleSave()

    res.json({ status: true, message: '双因素认证已启用' })
  } catch (err: any) {
    console.error('2FA verify error:', err)
    res.status(500).json({ status: false, message: '2FA验证失败' })
  }
})

/**
 * POST /disable - Disable 2FA (requires current password)
 */
router.post('/disable', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body
    if (!password) {
      res.status(400).json({ status: false, message: '请输入当前密码' })
      return
    }

    // Verify current password
    const pwResult = query('SELECT password FROM users WHERE id = ?', [req.user!.id])
    if (pwResult.length === 0 || pwResult[0].values.length === 0) {
      res.status(404).json({ status: false, message: '用户不存在' })
      return
    }
    const currentHash = String(pwResult[0].values[0][0])
    const isMatch = await bcrypt.compare(password, currentHash)
    if (!isMatch) {
      res.status(401).json({ status: false, message: '当前密码错误' })
      return
    }

    // Check if global force_2fa is on (admins can still disable, regular users cannot)
    const force2fa = getCachedSetting('force_2fa') === 'true'
    if (force2fa && req.user!.role !== 'admin') {
      res.status(403).json({ status: false, message: '管理员已全局强制启用2FA，无法禁用' })
      return
    }

    const db = getDb()
    db.run(
      "UPDATE users SET totp_secret = '', totp_enabled = 0, updated_at = datetime('now') WHERE id = ?",
      [req.user!.id]
    )
    scheduleSave()

    res.json({ status: true, message: '双因素认证已禁用' })
  } catch (err: any) {
    console.error('2FA disable error:', err)
    res.status(500).json({ status: false, message: '禁用2FA失败' })
  }
})

export default router
