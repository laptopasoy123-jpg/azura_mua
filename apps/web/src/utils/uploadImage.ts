const fileToCompressedDataUrl = (
  file: File,
  options?: { maxDimension?: number; preserveTransparency?: boolean },
): Promise<string> =>
  new Promise((resolve, reject) => {
    const maxDimension = options?.maxDimension ?? 1000
    const preserveTransparency = options?.preserveTransparency ?? false
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Gagal memproses gambar.'))
          return
        }
        if (preserveTransparency) {
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/png'))
        } else {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('File gambar tidak dapat dibaca.'))
    }
    img.src = objectUrl
  })

export const uploadImageWithFallback = async (
  file: File,
  purpose: 'wedding-attire' | 'catalog' | 'payment-proof' | 'expense-proof' | 'inventory' | 'business-logo',
): Promise<{ url: string; mode: 'r2' | 'local' }> => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 5 MB.')
  }

  const body = new FormData()
  body.append('file', file)
  body.append('purpose', purpose)
  body.append('visibility', 'public')

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/files`, { method: 'POST', body })
    if (response.ok) {
      const payload = await response.json() as { ok: boolean; data?: { url: string } }
      if (payload.ok && payload.data?.url) {
        return { url: payload.data.url, mode: 'r2' }
      }
    }
  } catch {
    // Fallback to local compressed Data URL when API worker is not running
  }

  const isLogo = purpose === 'business-logo'
  const dataUrl = await fileToCompressedDataUrl(file, {
    maxDimension: isLogo ? 280 : 1000,
    preserveTransparency: isLogo && (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml'),
  })
  return { url: dataUrl, mode: 'local' }
}
