import { z } from "zod";
import { NameSchema } from "./common.js";

export const ChapterSchema = z.strictObject({
  slug: z.string().regex(/^chapter-\d+$/),
  number: z.number().int().nonnegative(),
  name: NameSchema,
  viz_title: z.string().min(1).optional(),
  pages: z.number().int().positive().optional(),
  release_date: z.iso.date().optional(),
  jump_issue: z
    .strictObject({
      year: z.number().int().positive(),
      issue: z.string().regex(/^\d+(?:-\d+)?$/),
    })
    .optional(),
});

export type Chapter = z.infer<typeof ChapterSchema>;
