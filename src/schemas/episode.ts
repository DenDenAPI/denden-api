import { z } from "zod";
import { CanonSchema, NameSchema } from "./common.js";

export const EpisodeSchema = z
  .strictObject({
    slug: z.string().regex(/^episode-(?:special-)?\d+$/),
    number: z.number().int().positive(),
    kind: z.enum(["regular", "special"]),
    name: NameSchema,
    canon: CanonSchema,
    air_date: z.iso.date().optional(),
  })
  .refine(
    (episode) =>
      episode.slug ===
      (episode.kind === "special"
        ? `episode-special-${episode.number}`
        : `episode-${episode.number}`),
    { message: "slug must match kind and number" },
  );

export type Episode = z.infer<typeof EpisodeSchema>;
