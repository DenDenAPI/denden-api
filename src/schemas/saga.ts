import { z } from "zod";
import { NameSchema, SlugSchema, SpanSchema, YearsSchema } from "./common.js";

export const SagaSchema = z.strictObject({
  slug: SlugSchema,
  order: z.number().int().positive(),
  name: NameSchema,
  chapters: SpanSchema.optional(),
  volumes: SpanSchema.optional(),
  episodes: SpanSchema.optional(),
  years: YearsSchema.optional(),
});

export type Saga = z.infer<typeof SagaSchema>;
