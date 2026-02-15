import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getFileUrl = (path?: string | null) => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '')
  return `${base}${path}`
}

export const getDisplayNameFromEmail = (value?: string | null) => {
  const raw = String(value || '').trim()
  if (!raw) return 'Пользователь'

  const localPart = raw.includes('@') ? raw.split('@')[0] : raw
  const normalized = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return 'Пользователь'

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => {
      if (/^\d+$/.test(token)) return token
      return token.charAt(0).toUpperCase() + token.slice(1)
    })
    .join(' ')
}
