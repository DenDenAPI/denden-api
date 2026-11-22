import { z } from "zod";
import {
  CanonSchema,
  EntityRefSchema,
  FirstAppearanceSchema,
  NameSchema,
  SlugSchema,
} from "./common.js";

export const ShipSchema = z.strictObject({
  slug: SlugSchema,
  name: NameSchema,
  canon: CanonSchema,
  status: z.enum(["destroyed", "unknown"]).optional(),
  first_appearance: FirstAppearanceSchema.optional(),
  affiliations: z.array(EntityRefSchema),
});

export type Ship = z.infer<typeof ShipSchema>;
