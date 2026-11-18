import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import { filePurposeSchema, type FilePurpose } from '@azura/contracts'

type Bindings = {
  APP_ENV: 'development' | 'production'
  ALLOWED_ORIGIN: string
  REQUIRE_AUTH?: string
  PUBLIC_BASE_URL?: string
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_SECRET_KEY?: string
  PUBLIC_BUCKET: R2Bucket
  PRIVATE_BUCKET: R2Bucket
}

type Variables = {
  userId?: string
  userEmail?: string
}

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

async function verifyBearerToken(c: AppContext, token: string): Promise<Response | null> {
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_PUBLISHABLE_KEY) {
    return c.json({ ok: false, error: { code: 'SERVER_CONFIG', message: 'Konfigurasi autentikasi belum tersedia.' } }, 500)
  }

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
  return null
}

function parseFileRouteParams(c: AppContext): { visibility: 'public' | 'private'; key: string } | null {
  const visibility = c.req.param('visibility')
  if (visibility !== 'public' && visibility !== 'private') return null
  const prefix = `/api/files/${visibility}/`
  try {
    const key = decodeURIComponent(c.req.path.slice(prefix.length))
    if (!key || key.startsWith('/') || key.includes('..')) return null
    return { visibility, key }
  } catch {
    return null
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())
app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }))
app.use('*', async (c, next) => {
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGIN)
  const middleware = cors({
    origin: allowedOrigins,
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

const requireAuth = (mode: 'strict' | 'upload') =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const authorization = c.req.header('Authorization')
    if (authorization?.startsWith('Bearer ')) {
      const errorResponse = await verifyBearerToken(c, authorization.slice(7))
      if (errorResponse) return errorResponse
      await next()
      return
    }

    if (c.env.APP_ENV === 'development') {
      c.set('userEmail', 'demo@azuramakeup.local')
      await next()
      return
    }

    const authRequired = mode === 'strict' || c.env.REQUIRE_AUTH === 'true'
    if (authRequired) {
      return c.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sesi login diperlukan.' } }, 401)
    }

    // Reject browser uploads from unexpected third-party origins when auth is disabled.
    const origin = c.req.header('Origin')?.trim().replace(/\/+$/, '')
    const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGIN)
    if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return c.json({ ok: false, error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin tidak diizinkan.' } }, 403)
    }

    await next()
  })

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

app.post('/api/files', requireAuth('upload'), async (c) => {
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
      uploadedBy: c.get('userId') ?? 'anonymous',
      originalName: file.name.slice(0, 160),
      purpose: parsedPurpose.data,
    },
  })

  if (c.env.APP_ENV === 'production' && c.env.SUPABASE_URL && c.env.SUPABASE_SECRET_KEY) {
    try {
      const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { error: insertError } = await supabase.from('pengaturan_file').insert({
        id,
        bucket: visibility,
        object_key: key,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        etag: stored.etag,
        purpose: parsedPurpose.data,
        created_by: c.get('userId') ?? null,
      })
      if (insertError) {
        console.warn('pengaturan_file insert warning:', insertError.message)
      }
    } catch (error) {
      console.warn('pengaturan_file sync failed:', error)
    }
  }

  const baseUrl = (c.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const relativePath = `/api/files/${visibility}/${key}`

  return c.json({
    ok: true,
    data: {
      id,
      key,
      visibility,
      mimeType: file.type,
      size: file.size,
      url: baseUrl ? `${baseUrl}${relativePath}` : relativePath,
    },
  }, 201)
})

app.get('/api/files/:visibility/*', async (c, next) => {
  if (c.env.APP_ENV === 'production' && c.req.param('visibility') !== 'public') {
    return requireAuth('strict')(c, next)
  }
  await next()
}, async (c) => {
  const params = parseFileRouteParams(c)
  if (!params) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_PATH', message: 'Lokasi file tidak valid.' } }, 400)
  }

  const bucket = params.visibility === 'public' ? c.env.PUBLIC_BUCKET : c.env.PRIVATE_BUCKET
  const object = await bucket.get(params.key)
  if (!object) {
    return c.json({ ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan.' } }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('X-Content-Type-Options', 'nosniff')
  if (params.visibility === 'private') headers.set('Cache-Control', 'private, no-store')
  return new Response(object.body, { headers })
})

app.delete('/api/files/:visibility/*', requireAuth('strict'), async (c) => {
  const params = parseFileRouteParams(c)
  if (!params) {
    return c.json({ ok: false, error: { code: 'INVALID_FILE_PATH', message: 'Lokasi file tidak valid.' } }, 400)
  }
  const bucket = params.visibility === 'public' ? c.env.PUBLIC_BUCKET : c.env.PRIVATE_BUCKET
  await bucket.delete(params.key)
  return c.json({ ok: true, data: { deleted: params.key } })
})

app.notFound((c) => c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, 404))
app.onError((error, c) => {
  console.error(error)
  return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } }, 500)
})

export default app
