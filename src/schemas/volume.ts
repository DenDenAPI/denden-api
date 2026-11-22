import { z } from "zod";
import { NameSchema } from "./common.js";

const positiveInt = z.number().int().positive();

function hasValidIsbn13CheckDigit(isbn: string): boolean {
  const digits = isbn.replaceAll("-", "");
  const total = [...digits].reduce(
    (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return digits.length === 13 && total % 10 === 0;
}

export const VolumeSchema = z.strictObject({
  slug: z.string().regex(/^volume-\d+$/),
  number: positiveInt,
  name: NameSchema,
  viz_title: z.string().min(1).optional(),
  chapters: z
    .strictObject({ start: positiveInt, end: positiveInt })
    .refine((range) => range.end >= range.start, {
      message: "end must not be lower than start",
    }),
  pages: positiveInt.optional(),
  release_date: z.iso.date().optional(),
  isbn: z
    .string()
    .regex(/^97[89]-\d+-\d+-\d+-\d$/)
    .refine(hasValidIsbn13CheckDigit, { message: "invalid ISBN-13 check digit" })
    .optional(),
});

export type Volume = z.infer<typeof VolumeSchema>;
