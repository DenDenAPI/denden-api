import { z } from "zod";

const positiveInt = z.number().int().positive();

export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase kebab-case slug");

export const NameSchema = z.strictObject({
  en: z.string().min(1),
  ja: z.string().min(1).optional(),
  romaji: z.string().min(1).optional(),
});

/** Inclusive range. A null end means the range is still ongoing. */
export const RangeSchema = z
  .strictObject({ start: positiveInt, end: positiveInt.nullable() })
  .refine((range) => range.end === null || range.end >= range.start, {
    message: "end must not be lower than start",
  });

export const SpanSchema = z.strictObject({
  count: positiveInt.nullable(),
  ranges: z.array(RangeSchema).min(1),
});

const YearSpanSchema = z
  .strictObject({ start: positiveInt, end: positiveInt.nullable() })
  .refine((years) => years.end === null || years.end >= years.start, {
    message: "end year must not be lower than start year",
  });

export const YearsSchema = z.strictObject({
  manga: YearSpanSchema.optional(),
  anime: YearSpanSchema.optional(),
});

export const CanonSchema = z.enum(["manga", "anime_only", "movie", "other"]);

export const FirstAppearanceSchema = z.strictObject({
  chapter: z.number().int().nonnegative().optional(),
  episode: positiveInt.optional(),
});

/** Chapter by which a reader can know this value. Without it, spoiler filters hide the value. */
export const RevealedChapterSchema = z.number().int().nonnegative();

export const RevealedNameSchema = NameSchema.extend({
  revealed_chapter: RevealedChapterSchema.optional(),
});

const relationFields = {
  status: z.enum(["current", "former"]),
  canon: CanonSchema.optional(),
  revealed_chapter: RevealedChapterSchema.optional(),
};

export const CharacterRefSchema = z.strictObject({
  character: SlugSchema,
  ...relationFields,
});

/** How a character is linked to a group. Without it, the link is plain membership. */
export const RelationKindSchema = z.enum([
  "member",
  "rank",
  "captivity",
  "alliance",
  "collaboration",
  "family",
  "guardianship",
  "service",
  // A place used as a base (Buggy in Orange Town, Vegapunk on Punk Hazard). Mostly on residences.
  "base",
  // Travels with a crew without being a member (Toki with the Roger Pirates).
  "passenger",
]).describe("How the character is linked: base and captivity are used on residences, passenger on crews.");

export const EntityRefSchema = z.strictObject({
  type: z.enum(["crew", "organization", "location"]),
  slug: SlugSchema,
  ...relationFields,
  kind: RelationKindSchema.optional(),
  temporary: z.literal(true).optional(),
});

export type Span = z.infer<typeof SpanSchema>;
export type FirstAppearance = z.infer<typeof FirstAppearanceSchema>;
export type EntityRef = z.infer<typeof EntityRefSchema>;
export type CharacterRef = z.infer<typeof CharacterRefSchema>;
