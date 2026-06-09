/**
 * File upload middleware using multer
 */
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Upload directories at project root (d:\miku\mikus图床\uploads)
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')
const UPLOAD_TMP_DIR = path.join(UPLOADS_DIR, 'tmp')

// Ensure upload directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}
if (!fs.existsSync(UPLOAD_TMP_DIR)) {
  fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true })
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/x-icon']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_TMP_DIR)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, uniqueSuffix + ext)
  },
})

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('不支持的文件类型，仅允许: jpg, jpeg, png, gif, webp, svg, bmp, ico'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB default, will be checked against settings in route
  },
})

export { UPLOADS_DIR, UPLOAD_TMP_DIR }
