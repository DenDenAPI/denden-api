import type { Glossary } from "../schemas/glossary.js";
import type { CollectionName } from "./resources.js";

type Json = Record<string, unknown>;
type NameMap = { en?: string; ja?: string; romaji?: string };

/** Undefined means the default English response. */
type Translations = Glossary | null | undefined;

const REFERENCE_URL = /^\/api\/v1\/(arcs|sagas)\//;

function translate(glossary: Translations, section: keyof Glossary, text: string, female = false): string {
  const rows = glossary?.[section];
  if (!rows || !Object.hasOwn(rows, text)) return text;
  const value = rows[text];
  if (value === undefined) return text;
  return typeof value === "string" ? value : value[female ? 1 : 0];
}

/** Arc and saga references are the only reference names with a translation. */
export function localizeReferences(value: unknown, glossary: Translations): unknown {
  if (Array.isArray(value)) return value.map((item) => localizeReferences(item, glossary));
  if (!value || typeof value !== "object") return value;
  const copy = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, localizeReferences(item, glossary)]),
  ) as Json;
  const match = typeof copy.url === "string" ? REFERENCE_URL.exec(copy.url) : null;
  if (match && typeof copy.name === "string") {
    copy.name = translate(glossary, match[1] as "arcs" | "sagas", copy.name);
  }
  return copy;
}

/** Region filters accept the value shown in a Spanish response. */
export function canonicalRegion(glossary: Translations, value: string): string {
  const rows = glossary?.regions ?? {};
  return Object.entries(rows).find(([, text]) => text === value)?.[0] ?? value;
}

const ENGLISH_LABELS = {
  species: {
    animal: "Animal",
    birkan: "Birkan",
    cyborg: "Cyborg",
    dwarf: "Dwarf",
    fish_man: "Fish-Man",
    giant: "Giant",
    homie: "Homie",
    human: "Human",
    hybrid: "Hybrid",
    longarm: "Longarm",
    longleg: "Longleg",
    lunarian: "Lunarian",
    merfolk: "Merfolk",
    mink: "Mink",
    robot: "Robot",
    sea_king: "Sea King",
    shandia: "Shandia",
    skypiean: "Skypiean",
    zombie: "Zombie",
  },
  periods: {
    debut: "Debut",
    other: "Other",
    post_timeskip: "Post-timeskip",
    pre_timeskip: "Pre-timeskip",
  },
} as const;

/** Display text for technical codes. `female` is the form to use for female characters. */
export function labelCatalog(glossary: Translations): Json {
  const section = (name: "species" | "periods") =>
    Object.fromEntries(
      Object.entries(ENGLISH_LABELS[name]).map(([code, english]) => {
        const value = glossary?.[name]?.[code] ?? english;
        const [base, female] = typeof value === "string" ? [value, value] : value;
        return [code, { default: base, female }];
      }),
    );
  return {
    language: glossary === undefined ? "en" : "es",
    species: section("species"),
    periods: section("periods"),
  };
}

const withLanguage = (url: string) => `${url}${url.includes("?") ? "&" : "?"}lang=es`;

function labeled<T extends NameMap>(name: T, label?: string): T & { label: string } {
  return { ...name, label: label ?? name.en ?? name.romaji ?? name.ja ?? "" };
}

/**
 * Every response has the same keys in every language. `label` is the text to display.
 * Runs after spoiler redaction, so it only ever translates values that are already visible.
 */
export function localizeBody(collection: CollectionName, body: Json, glossary: Translations): Json {
  const spanish = glossary !== undefined;
  const copy = (spanish ? localizeReferences(body, glossary) : { ...body }) as Json;
  const female = copy.gender === "female";

  if (copy.name && typeof copy.name === "object") {
    const name = copy.name as NameMap;
    const translated =
      name.en && (collection === "arcs" || collection === "sagas")
        ? translate(glossary, collection, name.en)
        : undefined;
    copy.name = labeled(name, translated);
  }
  const identity = copy.revealed_identity as { name?: NameMap } | undefined;
  if (identity?.name) copy.revealed_identity = { ...identity, name: labeled(identity.name) };

  if (collection === "characters") {
    for (const field of ["epithets", "aliases"] as const) {
      if (!Array.isArray(copy[field])) continue;
      copy[field] = (copy[field] as NameMap[]).map((item) =>
        labeled(item, item.en ? translate(glossary, field, item.en, female) : undefined),
      );
    }
  }
  if (!spanish) return copy;

  if (collection === "devil-fruits" && typeof copy.meaning === "string") {
    copy.meaning = translate(glossary, "fruit_meanings", copy.meaning);
  }
  if (collection === "locations" && typeof copy.region === "string") {
    copy.region = translate(glossary, "regions", copy.region);
  }
  if (collection === "characters") {
    if (Array.isArray(copy.occupations)) {
      copy.occupations = (copy.occupations as { name: string }[]).map((item) => ({
        ...item,
        name: translate(glossary, "occupations", item.name, female),
      }));
    }
    const origin = copy.origin as { region?: string } | undefined;
    if (origin?.region) copy.origin = { ...origin, region: translate(glossary, "regions", origin.region) };
  }
  if (copy.links && typeof copy.links === "object") {
    copy.links = Object.fromEntries(
      Object.entries(copy.links).map(([name, url]) => [name, withLanguage(url as string)]),
    );
  }
  copy.translation = { language: "es", reviewed: false };
  return copy;
}
