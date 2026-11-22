import { z } from "zod";
import {
  CanonSchema,
  CharacterRefSchema,
  EntityRefSchema,
  FirstAppearanceSchema,
  NameSchema,
  SlugSchema,
} from "./common.js";

export const OrganizationSchema = z.strictObject({
  slug: SlugSchema,
  name: NameSchema,
  canon: CanonSchema,
  status: z.enum(["active", "disbanded", "destroyed", "unknown"]).optional(),
  first_appearance: FirstAppearanceSchema.optional(),
  leaders: z.array(CharacterRefSchema),
  affiliations: z.array(EntityRefSchema),
  residences: z.array(EntityRefSchema),
});

export type Organization = z.infer<typeof OrganizationSchema>;
