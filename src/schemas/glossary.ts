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
});

export type Glossary = z.infer<typeof GlossarySchema>;
