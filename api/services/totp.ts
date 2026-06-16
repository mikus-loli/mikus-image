/**
 * TOTP service using otplib v13 functional API
 */
import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'
import { getCachedSetting } from '../db.js'

/** Generate a new random TOTP secret (base32) */
export function generateTotpSecret(): string {
  return generateSecret()
}

/** Build the otpauth:// URI for QR code scanning */
export function buildOtpAuthUri(username: string, secret: string): string {
  const siteName = getCachedSetting('site_name') || 'Mikus图床'
  return generateURI({
    issuer: siteName,
    label: username,
    secret,
    period: 30,
    digits: 6,
  })
}

/** Generate a QR code data URL from the otpauth URI */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return await QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

/** Verify a TOTP token against the user's secret (allows 30s clock drift) */
export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({
      secret,
      token: token.replace(/\s/g, ''),
      epochTolerance: 30, // allow 1 step before/after
    })
    return result.valid
  } catch {
    return false
  }
}
