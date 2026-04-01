import { z } from 'zod';

export const EventSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().min(1),
  tenant_id: z.string().default('delta360'),
  actor_id: z.string().nullable().optional(),
  timestamp: z.string().datetime().optional(),
  version: z.number().int().min(1).default(1),
  sequence_number: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type DomainEvent = z.infer<typeof EventSchema>;

export const EmitEventSchema = EventSchema.omit({
  id: true,
  sequence_number: true,
  timestamp: true,
});

export type EmitEventInput = z.infer<typeof EmitEventSchema>;
