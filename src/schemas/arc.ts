import { z } from "zod";
import {
  CanonSchema,
  NameSchema,
  SlugSchema,
  SpanSchema,
  YearsSchema,
} from "./common.js";

export const ArcKindSchema = z.enum([
  "story",
  "cover_story",
  "filler",
  "special",
]);

export const ArcSchema = z.strictObject({
  slug: SlugSchema,
  order: z.number().int().positive(),
  name: NameSchema,
  kind: ArcKindSchema,
  canon: CanonSchema,
  sagas: z.array(SlugSchema),
  chapters: SpanSchema.optional(),
  volumes: SpanSchema.optional(),
  episodes: SpanSchema.optional(),
  special_episodes: z.array(z.number().int().positive()).min(1).optional(),
  years: YearsSchema.optional(),
});

export type Arc = z.infer<typeof ArcSchema>;
