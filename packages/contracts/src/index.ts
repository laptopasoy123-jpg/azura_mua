import { z } from 'zod'

export const bookingStatusSchema = z.enum([
  'draft',
  'confirmed',
  'completed',
  'cancelled',
])

export const paymentMethodSchema = z.enum(['cash', 'transfer', 'qris', 'other'])

export const stylingTypeSchema = z.enum(['Hijabdo', 'Hairdo'])

export const createBookingSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  eventLocation: z.string().trim().min(2).max(240),
  eventDate: z.iso.date(),
  eventTime: z.string().optional(),
  stylingType: stylingTypeSchema.optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export const recordPaymentSchema = z.object({
  bookingId: z.uuid(),
  paidAt: z.iso.datetime(),
  method: paymentMethodSchema,
  amount: z.number().int().positive(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.uuid(),
})

export const filePurposeSchema = z.enum([
  'catalog',
  'payment-proof',
  'expense-proof',
  'inventory',
  'avatar',
  'business-asset',
  'wedding-attire',
  'business-logo',
])

export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>
export type FilePurpose = z.infer<typeof filePurposeSchema>
export type StylingType = z.infer<typeof stylingTypeSchema>

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } }
