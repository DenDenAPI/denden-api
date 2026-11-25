import { z } from "zod";
import {
  CanonSchema,
  EntityRefSchema,
  FirstAppearanceSchema,
  NameSchema,
  RevealedChapterSchema,
  RevealedNameSchema,
  SlugSchema,
} from "./common.js";

const PeriodSchema = z.enum(["debut", "pre_timeskip", "post_timeskip", "other"]);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SpeciesSchema = z.enum([
  "human",
  "giant",
  "fish_man",
  "merfolk",
  "mink",
  "dwarf",
  "skypiean",
  "birkan",
  "shandia",
  "lunarian",
  "longarm",
  "longleg",
  "snakeneck",
  "hybrid",
  "animal",
  "sea_king",
  "homie",
  "zombie",
  "cyborg",
  "robot",
]);

/**
 * `cover_until` marks a false or provisional name (Klahadore, Kyoshiro): until that chapter the reader
 * knows the character only by this alias, so spoiler-filtered responses show it as the name.
 */
const AliasSchema = RevealedNameSchema.extend({
  cover_until: RevealedChapterSchema.optional(),
});

export const CharacterSchema = z.strictObject({
  slug: SlugSchema,
  name: NameSchema,
  canon: CanonSchema,
  gender: z.enum(["male", "female"]).optional(),
  species: z.array(SpeciesSchema).min(1).optional(),
  status: z.enum(["alive", "deceased", "unknown"]),
  status_revealed_chapter: RevealedChapterSchema.optional(),
  first_appearance: FirstAppearanceSchema.optional(),
  epithets: z.array(RevealedNameSchema).min(1).optional(),
  aliases: z.array(AliasSchema).min(1).optional(),
  occupations: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        status: z.enum(["current", "former"]),
        revealed_chapter: RevealedChapterSchema.optional(),
      }),
    )
    .min(1)
    .optional(),
  affiliations: z.array(EntityRefSchema).min(1).optional(),
  origin: z
    .strictObject({
      location: SlugSchema.optional(),
      region: z.string().min(1).optional(),
      revealed_chapter: RevealedChapterSchema.optional(),
      // The region can be known before the place: it is shown alone from this chapter.
      region_revealed_chapter: RevealedChapterSchema.optional(),
    })
    .optional(),
  residences: z.array(EntityRefSchema).min(1).optional(),
  birthday: z
    .strictObject({
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
    })
    .refine(({ month, day }) => day <= (DAYS_IN_MONTH[month - 1] ?? 0), {
      message: "invalid day for month",
    })
    .optional(),
  blood_type: z.enum(["F", "S", "X", "XF"]).optional(),
  ages: z
    .array(
      z.strictObject({
        years: z.number().int().nonnegative(),
        period: PeriodSchema,
        minimum: z.literal(true).optional(),
        revealed_chapter: RevealedChapterSchema.optional(),
      }),
    )
    .min(1)
    .optional(),
  heights: z
    .array(z.strictObject({ cm: z.number().int().positive(), period: PeriodSchema }))
    .min(1)
    .optional(),
  /** Ordered from oldest to newest. */
  bounties: z
    .array(
      z.strictObject({
        amount: z.number().int().nonnegative(),
        status: z.enum(["current", "former"]),
        minimum: z.literal(true).optional(),
        revealed_chapter: z.number().int().nonnegative().optional(),
        canon: CanonSchema.optional(),
      }),
    )
    .min(1)
    .optional(),
  /** Marine star rating. It is a threat level, not a bounty. */
  marine_rating: z
    .strictObject({
      stars: z.number().int().positive(),
      equivalent: z.number().int().nonnegative().optional(),
      minimum: z.literal(true).optional(),
    })
    .optional(),
});

export type Character = z.infer<typeof CharacterSchema>;
