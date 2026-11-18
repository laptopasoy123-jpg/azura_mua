import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import { filePurposeSchema, type FilePurpose } from '@azura/contracts'

type Bindings = {
  APP_ENV: 'development' | 'production'
  ALLOWED_ORIGIN: string
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_SECRET_KEY?: string
  PUBLIC_BUCKET: R2Bucket
  PRIVATE_BUCKET: R2Bucket
}

type Variables = {
  userId: string
  userEmail?: string
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', async (c, next) => {
  const middleware = cors({
    origin: c.env.ALLOWED_ORIGIN,
    allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'ETag'],
    maxAge: 86400,
    credentials: true,
  })
  return middleware(c, next)
})

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'azura-mua-api',
    environment: c.env.APP_ENV,
    storage: c.env.APP_ENV === 'development' ? 'local-r2' : 'cloudflare-r2',
    timestamp: new Date().toISOString(),
  }),
)

const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  if (c.env.APP_ENV === 'development') {
    c.set('userId', '00000000-0000-4000-8000-000000000001')
    c.set('userEmail', 'demo@azuramakeup.local')
    await next()
    return
  }

  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sesi login diperlukan.' } }, 401)
  }

  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_PUBLISHABLE_KEY) {
    return c.json({ ok: false, error: { code: 'SERVER_CONFIG', message: 'Konfigurasi autentikasi belum tersedia.' } }, 500)
  }

  const token = authorization.slice(7)
  const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: c.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    return c.json({ ok: false, error: { code: 'INVALID_SESSION', message: 'Sesi tidak valid atau sudah berakhir.' } }, 401)
  }

  const user = (await response.json()) as { id: string; email?: string }
  c.set('userId', user.id)
  c.set('userEmail', user.email)
  await next()
})

app.use('/api/*', requireAuth)

function purposePrefix(purpose: FilePurpose) {
  return {
    catalog: 'catalog',
    'payment-proof': 'payments',
    'expense-proof': 'expenses',
    inventory: 'inventory',
    avatar: 'avatars',
    'business-asset': 'business',
    'wedding-attire': 'wedding-attire',
    'business-logo': 'business-logo',
  }[purpose]
}

function extensionForMime(mime: string) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }[mime] ?? 'bin'
}

async function hasValidSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === 'image/webp') {
    return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  }
  if (mime === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  return false
}

app.post('/api/files', async (c) => {
  const body = await c.req.parseBody()
  const file = body.file
  const parsedPurpose = filePurposeSchema.safeParse(body.purpose)
  const visibility = body.visibility === 'public' ? 'public' : 'private'

  if (!(file instanceof File)) {
    return c.json({ ok: false, error: { code: 'FILE_REQUIRED', message: 'Pilih file yang akan diunggah.' } }, 400)
  }
  if (!parsedPurpose.success) {
    return c.json({ ok: false, error: { code: 'INVALID_PURPOSE', message: 'Tujuan file tidak valid.' } }, 400)
  }
  if (!allowedMimeTypes.has(file.type)) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_TYPE', message: 'Format yang diperbolehkan: JPG, PNG, WebP, atau PDF.' } }, 415)
  }
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_SIZE', message: 'Ukuran file harus di antara 1 byte dan 5 MB.' } }, 413)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!(await hasValidSignature(bytes, file.type))) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_CONTENT', message: 'Isi file tidak sesuai dengan formatnya.' } }, 415)
  }

  const id = crypto.randomUUID()
  const key = `${purposePrefix(parsedPurpose.data)}/${new Date().getUTCFullYear()}/${id}.${extensionForMime(file.type)}`
  const bucket = visibility === 'public' ? c.env.PUBLIC_BUCKET : c.env.PRIVATE_BUCKET
  const stored = await bucket.put(key, bytes, {
    httpMetadata: { contentType: file.type, cacheControl: visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store' },
    customMetadata: {
      uploadedBy: c.get('userId'),
      originalName: file.name.slice(0, 160),
      purpose: parsedPurpose.data,
    },
  })

  if (c.env.APP_ENV === 'production' && c.env.SUPABASE_URL && c.env.SUPABASE_SECRET_KEY) {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await supabase.from('pengaturan_file').insert({
      id,
      bucket: visibility,
      object_key: key,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      etag: stored.etag,
      purpose: parsedPurpose.data,
      created_by: c.get('userId'),
    })
  }

  return c.json({
    ok: true,
    data: {
      id,
      key,
      visibility,
      mimeType: file.type,
      size: file.size,
      url: `/api/files/${visibility}/${key}`,
    },
  }, 201)
})

app.get('/api/files/:visibility/*', async (c) => {
  const visibility = c.req.param('visibility')
  const prefix = `/api/files/${visibility}/`
  const key = decodeURIComponent(c.req.path.slice(prefix.length))
  if (!key || (visibility !== 'public' && visibility !== 'private')) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_PATH', message: 'Lokasi file tidak valid.' } }, 400)
  }

  const bucket = visibility === 'public' ? c.env.PUBLIC_BUCKET : c.env.PRIVATE_BUCKET
  const object = await bucket.get(key)
  if (!object) {
    return c.json({ ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan.' } }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('X-Content-Type-Options', 'nosniff')
  if (visibility === 'private') headers.set('Cache-Control', 'private, no-store')
  return new Response(object.body, { headers })
})

app.delete('/api/files/:visibility/*', async (c) => {
  const visibility = c.req.param('visibility')
  const prefix = `/api/files/${visibility}/`
  const key = decodeURIComponent(c.req.path.slice(prefix.length))
  if (!key || (visibility !== 'public' && visibility !== 'private')) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_PATH', message: 'Lokasi file tidak valid.' } }, 400)
  }
  const bucket = visibility === 'public' ? c.env.PUBLIC_BUCKET : c.env.PRIVATE_BUCKET
  await bucket.delete(key)
  return c.json({ ok: true, data: { deleted: key } })
})

app.notFound((c) => c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, 404))
app.onError((error, c) => {
  console.error(error)
  return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } }, 500)
})

export default app
