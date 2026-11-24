import { z } from "zod";

const ValueSchema = z.union([z.string().min(1), z.tuple([z.string().min(1), z.string().min(1)])]);
const SectionSchema = z.record(z.string(), ValueSchema);

export const GlossarySchema = z.strictObject({
  occupations: SectionSchema,
  epithets: SectionSchema,
  aliases: SectionSchema,
  fruit_meanings: SectionSchema,
  arcs: SectionSchema,
  sagas: SectionSchema,
  species: SectionSchema,
  regions: SectionSchema,
  periods: SectionSchema,
  genders: SectionSchema.optional(),
  canons: SectionSchema.optional(),
  character_statuses: SectionSchema.optional(),
  crew_statuses: SectionSchema.optional(),
  organization_statuses: SectionSchema.optional(),
  ship_statuses: SectionSchema.optional(),
  relation_statuses: SectionSchema.optional(),
  relation_kinds: SectionSchema.optional(),
  arc_kinds: SectionSchema.optional(),
  episode_kinds: SectionSchema.optional(),
  fruit_types: SectionSchema.optional(),
  fruit_sub_types: SectionSchema.optional(),
});

export type Glossary = z.infer<typeof GlossarySchema>;
