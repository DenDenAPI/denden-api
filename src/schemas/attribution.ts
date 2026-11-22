import { z } from "zod";
import { SlugSchema } from "./common.js";

export const AttributionSchema = z.strictObject({
  license: z.literal("CC BY-SA 3.0"),
  license_url: z.url(),
  notice: z.string().min(1),
  articles: z.strictObject({
    sagas: z.record(SlugSchema, z.url()),
    arcs: z.record(SlugSchema, z.url()),
    chapters: z.record(SlugSchema, z.url()),
    volumes: z.record(SlugSchema, z.url()),
    episodes: z.record(SlugSchema, z.url()),
    "devil-fruits": z.record(SlugSchema, z.url()),
    crews: z.record(SlugSchema, z.url()),
    organizations: z.record(SlugSchema, z.url()),
    locations: z.record(SlugSchema, z.url()),
    ships: z.record(SlugSchema, z.url()),
    characters: z.record(SlugSchema, z.url()),
  }),
});

export type Attribution = z.infer<typeof AttributionSchema>;
