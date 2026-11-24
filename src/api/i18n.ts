import type { Glossary } from "../schemas/glossary.js";
import type { CollectionName } from "./resources.js";

type Json = Record<string, unknown>;
type NameMap = { en?: string; ja?: string; romaji?: string };

/** Undefined means the default English response. */
type Translations = Glossary | null | undefined;

/** Collections whose record names have a glossary section, keyed by collection. */
const NAME_SECTIONS = {
  arcs: "arcs",
  sagas: "sagas",
  crews: "crews",
  organizations: "organizations",
  locations: "locations",
  ships: "ships",
  "devil-fruits": "devil_fruits",
} as const satisfies Partial<Record<CollectionName, keyof Glossary>>;

const REFERENCE_URL = /^\/api\/v1\/([a-z-]+)\//;

function nameSection(collection: string): keyof Glossary | undefined {
  return Object.hasOwn(NAME_SECTIONS, collection) ? NAME_SECTIONS[collection as keyof typeof NAME_SECTIONS] : undefined;
}

function translate(glossary: Translations, section: keyof Glossary, text: string, female = false): string {
  const rows = glossary?.[section];
  if (!rows || !Object.hasOwn(rows, text)) return text;
  const value = rows[text];
  if (value === undefined) return text;
  return typeof value === "string" ? value : value[female ? 1 : 0];
}

/** Translates the name of every reference whose collection has a name glossary. */
export function localizeReferences(value: unknown, glossary: Translations): unknown {
  if (Array.isArray(value)) return value.map((item) => localizeReferences(item, glossary));
  if (!value || typeof value !== "object") return value;
  const copy = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, localizeReferences(item, glossary)]),
  ) as Json;
  const match = typeof copy.url === "string" ? REFERENCE_URL.exec(copy.url) : null;
  const section = match ? nameSection(match[1] as string) : undefined;
  if (section && typeof copy.name === "string") {
    copy.name = translate(glossary, section, copy.name);
  }
  return copy;
}

/** Region filters accept the value shown in a Spanish response. */
export function canonicalRegion(glossary: Translations, value: string): string {
  const rows = glossary?.regions ?? {};
  return Object.entries(rows).find(([, text]) => text === value)?.[0] ?? value;
}

/** English display text for every technical code, grouped as in `/api/v1/labels`. */
export const CODE_LABELS = {
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
    snakeneck: "Snakeneck",
    zombie: "Zombie",
  },
  periods: { debut: "Debut", other: "Other", post_timeskip: "Post-timeskip", pre_timeskip: "Pre-timeskip" },
  genders: { female: "Female", male: "Male" },
  canons: { anime_only: "Anime only", manga: "Manga", movie: "Movie", other: "Other" },
  character_statuses: { alive: "Alive", deceased: "Deceased", unknown: "Unknown" },
  crew_statuses: { disbanded: "Disbanded" },
  organization_statuses: { active: "Active", destroyed: "Destroyed", disbanded: "Disbanded", unknown: "Unknown" },
  ship_statuses: { destroyed: "Destroyed", unknown: "Unknown" },
  relation_statuses: { current: "Current", former: "Former" },
  relation_kinds: {
    alliance: "Alliance",
    captivity: "Captivity",
    collaboration: "Collaboration",
    family: "Family",
    guardianship: "Guardianship",
    member: "Member",
    rank: "Rank",
    service: "Service",
  },
  arc_kinds: { cover_story: "Cover story", filler: "Filler", special: "Special", story: "Story" },
  episode_kinds: { regular: "Regular", special: "Special" },
  fruit_types: { logia: "Logia", paramecia: "Paramecia", unknown: "Unknown", zoan: "Zoan" },
  fruit_sub_types: { ancient: "Ancient", artificial: "Artificial", mythical: "Mythical", special: "Special" },
  blood_types: { F: "F", S: "S", X: "X", XF: "XF" },
} as const;

export type CodeSection = keyof typeof CODE_LABELS;
type Gender = "male" | "female" | undefined;

/** Masculine and feminine forms. The masculine form is also the generic one. */
function codeForms(glossary: Translations, section: CodeSection, code: string): [string, string] {
  const english = (CODE_LABELS[section] as Record<string, string>)[code] ?? code;
  const rows = glossary?.[section as keyof Glossary];
  const value = rows && Object.hasOwn(rows, code) ? rows[code] : undefined;
  if (value === undefined) return [english, english];
  return typeof value === "string" ? [value, value] : value;
}

function code(glossary: Translations, section: CodeSection, id: unknown, gender: Gender): unknown {
  if (typeof id !== "string") return id;
  const [male, female] = codeForms(glossary, section, id);
  return { id, label: gender === "female" ? female : male };
}

/** Display text for technical codes. `generic` is for records without a known gender. */
export function labelCatalog(glossary: Translations): Json {
  const sections = Object.entries(CODE_LABELS).map(([section, codes]) => [
    section,
    Object.fromEntries(
      Object.keys(codes).map((id) => {
        const [male, female] = codeForms(glossary, section as CodeSection, id);
        return [id, { male, female, generic: male }];
      }),
    ),
  ]);
  return { language: glossary === undefined ? "en" : "es", ...Object.fromEntries(sections) };
}

const STATUS_SECTIONS: Partial<Record<CollectionName, CodeSection>> = {
  characters: "character_statuses",
  crews: "crew_statuses",
  organizations: "organization_statuses",
  ships: "ship_statuses",
};
const KIND_SECTIONS: Partial<Record<CollectionName, CodeSection>> = {
  arcs: "arc_kinds",
  episodes: "episode_kinds",
};

/** Codes inside relation items, bounties, occupations, ages and heights. */
function itemCodes(item: unknown, glossary: Translations, gender: Gender): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const copy = { ...(item as Json) };
  if ("status" in copy) copy.status = code(glossary, "relation_statuses", copy.status, gender);
  if ("canon" in copy) copy.canon = code(glossary, "canons", copy.canon, gender);
  if ("kind" in copy) copy.kind = code(glossary, "relation_kinds", copy.kind, gender);
  if ("period" in copy) copy.period = code(glossary, "periods", copy.period, gender);
  return copy;
}

/** Sub-resource items have no gender of their own, so they use the generic form. */
export function localizeItems(items: unknown[], glossary: Translations): unknown[] {
  const localized = glossary === undefined ? items : (localizeReferences(items, glossary) as unknown[]);
  return localized.map((item) => itemCodes(item, glossary, undefined));
}

/** Every technical code becomes `{ id, label }`. Filters keep using the `id`. */
function applyCodes(collection: CollectionName, body: Json, glossary: Translations): void {
  const gender = collection === "characters" ? (body.gender as Gender) : undefined;
  const top: [string, CodeSection | undefined][] = [
    ["canon", "canons"],
    ["gender", "genders"],
    ["blood_type", "blood_types"],
    ["status", STATUS_SECTIONS[collection]],
    ["kind", KIND_SECTIONS[collection]],
    ["type", collection === "devil-fruits" ? "fruit_types" : undefined],
    ["sub_type", collection === "devil-fruits" ? "fruit_sub_types" : undefined],
  ];
  for (const [field, section] of top) {
    if (section && field in body) body[field] = code(glossary, section, body[field], gender);
  }
  const identity = body.revealed_identity as Json | undefined;
  if (collection === "devil-fruits" && identity) {
    body.revealed_identity = {
      ...identity,
      ...("type" in identity ? { type: code(glossary, "fruit_types", identity.type, gender) } : {}),
      ...("sub_type" in identity ? { sub_type: code(glossary, "fruit_sub_types", identity.sub_type, gender) } : {}),
    };
  }
  if (Array.isArray(body.species)) {
    body.species = body.species.map((id) => code(glossary, "species", id, gender));
  }
  for (const [field, value] of Object.entries(body)) {
    if (field !== "species" && Array.isArray(value)) {
      body[field] = value.map((item) => itemCodes(item, glossary, gender));
    }
  }
}


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
  // Read before `gender` becomes `{ id, label }`.
  const female = copy.gender === "female";

  const section = nameSection(collection);
  const translatedName = (name: NameMap) => (name.en && section ? translate(glossary, section, name.en) : undefined);
  if (copy.name && typeof copy.name === "object") {
    const name = copy.name as NameMap;
    copy.name = labeled(name, translatedName(name));
  }
  const identity = copy.revealed_identity as { name?: NameMap } | undefined;
  if (identity?.name) copy.revealed_identity = { ...identity, name: labeled(identity.name, translatedName(identity.name)) };

  if (collection === "characters") {
    for (const field of ["epithets", "aliases"] as const) {
      if (!Array.isArray(copy[field])) continue;
      copy[field] = (copy[field] as NameMap[]).map((item) =>
        labeled(item, item.en ? translate(glossary, field, item.en, female) : undefined),
      );
    }
  }
  applyCodes(collection, copy, glossary);
  if (!spanish) return copy;

  if (collection === "devil-fruits" && typeof copy.meaning === "string") {
    copy.meaning = translate(glossary, "fruit_meanings", copy.meaning);
  }
  const revealed = copy.revealed_identity as { meaning?: string } | undefined;
  if (collection === "devil-fruits" && typeof revealed?.meaning === "string") {
    copy.revealed_identity = { ...revealed, meaning: translate(glossary, "fruit_meanings", revealed.meaning) };
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
  copy.translation = { language: "es", reviewed: false };
  return copy;
}
