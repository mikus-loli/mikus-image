/**
 * Mikus Image Hosting - Express Application
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

import crypto from 'crypto'
import { initDb, scheduleSave, query } from './db.js'
import { setJwtSecret } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import imageRoutes from './routes/images.js'
import albumRoutes from './routes/albums.js'
import strategyRoutes from './routes/strategies.js'
import userRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import dashboardRoutes from './routes/dashboard.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

// Ensure required directories exist (uploads at project root)
const PROJECT_ROOT = path.join(__dirname, '..')
const dirs = [
  path.join(__dirname, 'data'),
  path.join(PROJECT_ROOT, 'uploads'),
  path.join(PROJECT_ROOT, 'uploads', 'tmp'),
]
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files from uploads directory at project root
app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'uploads')))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/images', imageRoutes)
app.use('/api/albums', albumRoutes)
app.use('/api/strategies', strategyRoutes)
app.use('/api/users', userRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/dashboard', dashboardRoutes)

/**
 * health check
 */
app.use(
  '/api/health',
  (_req: Request, res: Response, _next: NextFunction): void => {
    res.status(200).json({
      status: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', error)

  // Handle multer errors
  if (error.message && error.message.includes('不支持的文件类型')) {
    res.status(400).json({
      status: false,
      message: error.message,
    })
    return
  }

  if (error.message && error.message.includes('File too large')) {
    res.status(413).json({
      status: false,
      message: '文件大小超出限制',
    })
    return
  }

  res.status(500).json({
    status: false,
    message: '服务器内部错误',
  })
})

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: false,
    message: 'API不存在',
  })
})

// Initialize database before exporting
let dbInitialized = false

export async function initializeApp(): Promise<void> {
  if (dbInitialized) return
  await initDb()
  dbInitialized = true

  // Auto-generate JWT_SECRET if not set via env
  if (!process.env.JWT_SECRET) {
    const rows = query("SELECT value FROM settings WHERE key = 'jwt_secret'")
    let secret = rows[0]?.value as string | undefined
    if (!secret) {
      secret = crypto.randomBytes(48).toString('hex')
      query("INSERT INTO settings (key, value, type, description) VALUES ('jwt_secret', ?, 'string', 'JWT 密钥（自动生成）')", [secret])
      scheduleSave()
      console.log('JWT secret auto-generated and saved to database')
    }
    setJwtSecret(secret)
  }

  console.log('App initialized')

  // Save DB on process exit
  const cleanup = () => {
    scheduleSave()
    process.exit(0)
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
}

export default app
