import { z } from "zod";
import {
  CanonSchema,
  EntityRefSchema,
  FirstAppearanceSchema,
  NameSchema,
  SlugSchema,
} from "./common.js";

export const LocationSchema = z.strictObject({
  slug: SlugSchema,
  name: NameSchema,
  canon: CanonSchema,
  first_appearance: FirstAppearanceSchema.optional(),
  parent: SlugSchema.optional(),
  region: z.string().min(1).optional(),
  affiliations: z.array(EntityRefSchema),
});

export type Location = z.infer<typeof LocationSchema>;
