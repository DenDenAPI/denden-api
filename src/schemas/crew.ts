import { z } from "zod";
import {
  CanonSchema,
  CharacterRefSchema,
  FirstAppearanceSchema,
  NameSchema,
  SlugSchema,
} from "./common.js";

export const CrewSchema = z.strictObject({
  slug: SlugSchema,
  name: NameSchema,
  canon: CanonSchema,
  status: z.enum(["disbanded"]).optional(),
  first_appearance: FirstAppearanceSchema.optional(),
  captains: z.array(CharacterRefSchema),
});

export type Crew = z.infer<typeof CrewSchema>;
