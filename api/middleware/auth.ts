/**
 * JWT authentication middleware
 */
import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getDb, query } from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'mikus-secret-key-2024'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: false, message: '未提供认证令牌' })
    return
  }

  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser

    // Verify user still exists and is active
    const db = getDb()
    const result = query("SELECT id, name, email, role, status FROM users WHERE id = ?", [decoded.id])
    if (result.length === 0 || result[0].values.length === 0) {
      res.status(401).json({ status: false, message: '用户不存在' })
      return
    }

    const row = result[0].values[0]
    const userStatus = String(row[4])
    if (userStatus !== 'active') {
      res.status(403).json({ status: false, message: '账号已被禁用' })
      return
    }

    req.user = {
      id: String(row[0]),
      name: String(row[1]),
      email: String(row[2]),
      role: String(row[3]),
    }
    next()
  } catch (err) {
    res.status(401).json({ status: false, message: '令牌无效或已过期' })
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ status: false, message: '未认证' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ status: false, message: '需要管理员权限' })
    return
  }
  next()
}
