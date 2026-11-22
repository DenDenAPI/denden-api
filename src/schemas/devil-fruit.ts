import { z } from "zod";
import {
  CanonSchema,
  CharacterRefSchema,
  FirstAppearanceSchema,
  NameSchema,
  SlugSchema,
} from "./common.js";

const FruitTypeSchema = z.enum(["paramecia", "zoan", "logia", "unknown"]);
const FruitSubTypeSchema = z.enum(["ancient", "mythical", "artificial", "special"]);

export const DevilFruitSchema = z.strictObject({
  slug: SlugSchema,
  name: NameSchema,
  type: FruitTypeSchema,
  sub_type: FruitSubTypeSchema.optional(),
  meaning: z.string().min(1).optional(),
  /** Identity revealed later in the story. Hide it before `chapter` to avoid spoilers. */
  revealed_identity: z
    .strictObject({
      chapter: z.number().int().positive(),
      name: NameSchema,
      type: FruitTypeSchema,
      sub_type: FruitSubTypeSchema.optional(),
      meaning: z.string().min(1).optional(),
    })
    .optional(),
  canon: CanonSchema,
  first_appearance: FirstAppearanceSchema.optional(),
  users: z.array(CharacterRefSchema),
});

export type DevilFruit = z.infer<typeof DevilFruitSchema>;
