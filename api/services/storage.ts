/**
 * Storage strategy service
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Uploads directory at project root (d:\miku\mikus图床\uploads)
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

export interface IStorage {
  upload(key: string, buffer: Buffer): Promise<string>
  delete(key: string): Promise<void>
  getUrl(key: string): string
}

export class LocalStorage implements IStorage {
  async upload(key: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(UPLOADS_DIR, key)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, buffer)
    return this.getUrl(key)
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(UPLOADS_DIR, key)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`
  }
}

export class S3Storage implements IStorage {
  private config: Record<string, string>

  constructor(config: Record<string, string> = {}) {
    this.config = config
  }

  async upload(key: string, buffer: Buffer): Promise<string> {
    // Placeholder: save locally for now
    console.log('S3Storage: saving locally as placeholder, key:', key)
    const local = new LocalStorage()
    return local.upload(key, buffer)
  }

  async delete(key: string): Promise<void> {
    console.log('S3Storage: deleting locally as placeholder, key:', key)
    const local = new LocalStorage()
    return local.delete(key)
  }

  getUrl(key: string): string {
    if (this.config.endpoint && this.config.bucket) {
      return `${this.config.endpoint}/${this.config.bucket}/${key}`
    }
    return `/uploads/${key}`
  }
}

export function getStorageByType(type: string, config: Record<string, string> = {}): IStorage {
  switch (type) {
    case 's3':
      return new S3Storage(config)
    case 'local':
    default:
      return new LocalStorage()
  }
}

export function getStorageByStrategyId(strategyId: string): IStorage {
  const result = query('SELECT type, config FROM strategies WHERE id = ?', [strategyId])
  if (result.length === 0 || result[0].values.length === 0) {
    return new LocalStorage()
  }
  const type = result[0].values[0][0] as string
  const configStr = result[0].values[0][1] as string
  let config: Record<string, string> = {}
  try {
    config = JSON.parse(configStr)
  } catch {
    config = {}
  }
  return getStorageByType(type, config)
}
