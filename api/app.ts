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
import twofaRoutes from './routes/twofa.js'

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
// CORS: restrict origins via CORS_ORIGIN env (comma-separated).
// Defaults to allowing the same origin (no CORS headers) when unset, which
// is safe for same-origin deployments. Never use wildcard '*' with credentials.
const corsOriginEnv = process.env.CORS_ORIGIN
const allowedOrigins = corsOriginEnv
  ? corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean)
  : []
app.use(cors(
  allowedOrigins.length > 0
    ? {
        origin: (origin, callback) => {
          // Allow same-origin requests (no Origin header) and whitelisted origins
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
          } else {
            callback(new Error('Not allowed by CORS'))
          }
        },
        credentials: true,
      }
    : undefined
))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files from uploads directory at project root
app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'uploads')))

// Serve frontend static files (production only)
const DIST_PATH = path.join(PROJECT_ROOT, 'dist')
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH))
}

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
app.use('/api/2fa', twofaRoutes)

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
 * SPA fallback — serve index.html for non-API routes (production only)
 */
if (fs.existsSync(DIST_PATH)) {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'))
  })
} else {
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      status: false,
      message: 'API不存在',
    })
  })
}

// Initialize database before exporting
let dbInitialized = false

export async function initializeApp(): Promise<void> {
  if (dbInitialized) return
  await initDb()
  dbInitialized = true

  // Resolve JWT_SECRET with a strict priority:
  //   1. JWT_SECRET environment variable (highest priority)
  //   2. Existing value stored in the database — BUT only if it is not the
  //      known insecure legacy default ('mikus-secret-key-2024'), which is
  //      treated as absent and replaced with a fresh random secret.
  //   3. Auto-generated random secret (persisted for subsequent restarts)
  const LEGACY_INSECURE_SECRETS = new Set(['', 'mikus-secret-key-2024'])

  if (process.env.JWT_SECRET) {
    setJwtSecret(process.env.JWT_SECRET)
  } else {
    const rows = query("SELECT value FROM settings WHERE key = 'jwt_secret'")
    let secret = rows[0]?.values?.[0]?.[0] as string | undefined
    if (!secret || LEGACY_INSECURE_SECRETS.has(secret)) {
      secret = crypto.randomBytes(48).toString('hex')
      query("INSERT INTO settings (key, value, type, description) VALUES ('jwt_secret', ?, 'string', 'JWT 密钥（自动生成）') ON CONFLICT(key) DO UPDATE SET value = ?", [secret, secret])
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
