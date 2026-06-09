/**
 * Dashboard routes - Admin-only dashboard statistics
 */
import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * GET /stats - Get dashboard statistics
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Total images
    const imgResult = query('SELECT COUNT(*), COALESCE(SUM(size), 0) FROM images')
    const totalImages = imgResult.length > 0 ? (imgResult[0].values[0][0] as number) : 0
    const totalStorage = imgResult.length > 0 ? (imgResult[0].values[0][1] as number) : 0

    // Today uploads
    const todayResult = query("SELECT COUNT(*) FROM images WHERE date(created_at) = date('now')")
    const todayUploads = todayResult.length > 0 ? (todayResult[0].values[0][0] as number) : 0

    // Active users
    const userResult = query("SELECT COUNT(*) FROM users WHERE status = 'active'")
    const activeUsers = userResult.length > 0 ? (userResult[0].values[0][0] as number) : 0

    // Total users
    const totalUsersResult = query('SELECT COUNT(*) FROM users')
    const totalUsers = totalUsersResult.length > 0 ? (totalUsersResult[0].values[0][0] as number) : 0

    // Total albums
    const albumResult = query('SELECT COUNT(*) FROM albums')
    const totalAlbums = albumResult.length > 0 ? (albumResult[0].values[0][0] as number) : 0

    res.json({
      status: true,
      message: '获取成功',
      data: {
        totalImages,
        totalStorage,
        todayUploads,
        activeUsers,
        totalUsers,
        totalAlbums,
      },
    })
  } catch (err: any) {
    console.error('Dashboard stats error:', err)
    res.status(500).json({ status: false, message: '获取统计数据失败' })
  }
})

/**
 * GET /trend - Get upload trend for last 30 days
 */
router.get('/trend', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = query(`
      SELECT date(created_at) as date, COUNT(*) as count, COALESCE(SUM(size), 0) as size
      FROM images
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `)

    const trend = result.length > 0 ? result[0].values.map(row => ({
      date: row[0],
      count: row[1],
      size: row[2],
    })) : []

    res.json({ status: true, message: '获取成功', data: trend })
  } catch (err: any) {
    console.error('Dashboard trend error:', err)
    res.status(500).json({ status: false, message: '获取趋势数据失败' })
  }
})

export default router
