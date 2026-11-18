import { describe, expect, it } from 'vitest'
import app from '../src/index'

function createMemoryBucket(): R2Bucket {
  const store = new Map<string, { body: Uint8Array; httpMetadata?: R2HTTPMetadata; etag: string }>()
  return {
    async put(key, value, options) {
      const bytes = value instanceof Uint8Array
        ? value
        : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new TextEncoder().encode(String(value))
      const etag = `"${key.length}-${bytes.byteLength}"`
      store.set(key, {
        body: bytes,
        httpMetadata: options?.httpMetadata as R2HTTPMetadata | undefined,
        etag,
      })
      return { key, etag, httpEtag: etag, size: bytes.byteLength } as R2Object
    },
    async get(key) {
      const entry = store.get(key)
      if (!entry) return null
      return {
        key,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(entry.body)
            controller.close()
          },
        }),
        httpEtag: entry.etag,
        writeHttpMetadata(headers: Headers) {
          if (entry.httpMetadata?.contentType) headers.set('Content-Type', entry.httpMetadata.contentType)
          if (entry.httpMetadata?.cacheControl) headers.set('Cache-Control', entry.httpMetadata.cacheControl)
        },
      } as unknown as R2ObjectBody
    },
    async delete(key) {
      if (Array.isArray(key)) key.forEach((k) => store.delete(k))
      else store.delete(key)
    },
  } as unknown as R2Bucket
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    APP_ENV: 'production' as const,
    ALLOWED_ORIGIN: 'https://azura.daysheet.id',
    REQUIRE_AUTH: 'false',
    PUBLIC_BUCKET: createMemoryBucket(),
    PRIVATE_BUCKET: createMemoryBucket(),
    ...overrides,
  }
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])

describe('azura-mua-api worker', () => {
  it('returns health status and CORS header for azura.daysheet.id', async () => {
    const res = await app.request(
      '/health',
      { headers: { Origin: 'https://azura.daysheet.id' } },
      makeEnv(),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://azura.daysheet.id')
    const json = await res.json() as { ok: boolean; environment: string; storage: string }
    expect(json.ok).toBe(true)
    expect(json.environment).toBe('production')
    expect(json.storage).toBe('cloudflare-r2')
  })

  it('uploads and publicly serves public files when REQUIRE_AUTH is false', async () => {
    const env = makeEnv()
    const form = new FormData()
    form.append('file', new File([PNG_BYTES], 'sample.png', { type: 'image/png' }))
    form.append('purpose', 'catalog')
    form.append('visibility', 'public')

    const uploadRes = await app.request(
      '/api/files',
      { method: 'POST', body: form, headers: { Origin: 'https://azura.daysheet.id' } },
      env,
    )
    expect(uploadRes.status).toBe(201)
    const uploadJson = await uploadRes.json() as { ok: boolean; data: { url: string; key: string } }
    expect(uploadJson.ok).toBe(true)
    expect(uploadJson.data.url).toBe(`/api/files/public/${uploadJson.data.key}`)

    const getRes = await app.request(uploadJson.data.url, {}, env)
    expect(getRes.status).toBe(200)
    expect(getRes.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
    expect(getRes.headers.get('Content-Type')).toBe('image/png')
  })

  it('rejects uploads from disallowed browser origins', async () => {
    const form = new FormData()
    form.append('file', new File([PNG_BYTES], 'sample.png', { type: 'image/png' }))
    form.append('purpose', 'catalog')
    form.append('visibility', 'public')

    const res = await app.request(
      '/api/files',
      { method: 'POST', body: form, headers: { Origin: 'https://evil.example' } },
      makeEnv(),
    )
    expect(res.status).toBe(403)
  })

  it('requires auth for upload when REQUIRE_AUTH is true', async () => {
    const form = new FormData()
    form.append('file', new File([PNG_BYTES], 'sample.png', { type: 'image/png' }))
    form.append('purpose', 'catalog')
    form.append('visibility', 'public')

    const res = await app.request(
      '/api/files',
      { method: 'POST', body: form, headers: { Origin: 'https://azura.daysheet.id' } },
      makeEnv({ REQUIRE_AUTH: 'true' }),
    )
    expect(res.status).toBe(401)
  })

  it('keeps private GET and DELETE protected in production', async () => {
    const env = makeEnv()
    const privateRes = await app.request('/api/files/private/payments/2026/test.pdf', {}, env)
    expect(privateRes.status).toBe(401)

    const deleteRes = await app.request(
      '/api/files/public/catalog/2026/test.png',
      { method: 'DELETE' },
      env,
    )
    expect(deleteRes.status).toBe(401)
  })

  it('rejects path traversal on GET /api/files', async () => {
    const res = await app.request('/api/files/public/..%2Fsecret.png', {}, makeEnv())
    expect(res.status).toBe(400)
  })
})
