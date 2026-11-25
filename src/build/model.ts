import { nameSection, translatedForms } from "../api/i18n.js";
import type { Cover, Covers } from "../api/ports.js";
import { COLLECTIONS, type CollectionName } from "../api/resources.js";
import type { Dataset } from "../data/validate.js";
import { createOpenApiDocument } from "../openapi/spec.js";
import type { Attribution } from "../schemas/attribution.js";
import type { Glossary } from "../schemas/glossary.js";

// Records are validated before reaching this module and are handled generically here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

export interface RecordRow {
  collection: CollectionName;
  id: string;
  slug: string;
  name: string;
  sort_name: string;
  /** Sort key of the Spanish name, or of the English one when there is no translation. */
  sort_name_es: string;
  number: number | null;
  first_chapter: number | null;
  bounty: number | null;
}

/** A name shown by spoiler-filtered responses up to `until` (see the character alias schema). */
export interface CoverRow {
  collection: CollectionName;
  id: string;
  until: number;
  name: string;
  sort_name: string;
  sort_name_es: string;
}

function coversOf(record: Loose): Cover[] {
  return ((record.aliases ?? []) as Loose[])
    .filter((item) => item.cover_until !== undefined)
    .map(({ revealed_chapter: _revealed, cover_until: until, ...name }) => ({ name: name as Cover["name"], until }))
    .sort((a, b) => a.until - b.until);
}

export interface FacetRow {
  collection: CollectionName;
  id: string;
  facet: string;
  value: string;
}

export interface SearchRow {
  collection: CollectionName;
  id: string;
  name: string;
  extra: string;
}

export interface BuildOutput {
  documents: Map<string, unknown>;
  records: RecordRow[];
  covers: CoverRow[];
  facets: FacetRow[];
  search: SearchRow[];
}

interface Listed {
  first_chapter: number | null;
  item: Loose;
}

const REF_COLLECTION = { crew: "crews", organization: "organizations", location: "locations" } as const;

function publicId(collection: CollectionName, record: Loose): string {
  if (collection === "chapters" || collection === "volumes") return String(record.number);
  if (collection === "episodes") {
    return record.kind === "special" ? `special-${record.number}` : String(record.number);
  }
  return record.slug as string;
}

function firstChapter(collection: CollectionName, record: Loose): number | null {
  if (collection === "chapters") return record.number as number;
  if (collection === "volumes") return record.chapters.start as number;
  if (collection === "sagas" || collection === "arcs") return record.chapters?.ranges[0]?.start ?? null;
  if (collection === "episodes") return null;
  return record.first_appearance?.chapter ?? null;
}

function expand(ranges: { start: number; end: number | null }[], last: number): number[] {
  return ranges.flatMap(({ start, end }) => {
    const stop = end ?? last;
    return Array.from({ length: Math.max(stop - start + 1, 0) }, (_, index) => start + index);
  });
}

function nameText(name: Loose): string {
  return [name.en, name.ja, name.romaji].filter(Boolean).join(" ");
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** SQLite compares bytes, so accents are removed to keep "Árbol" next to "arco" instead of after "z". */
function spanishSortKey(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

/**
 * `glossary` adds the Spanish names to the search index, so a search finds a record in either language,
 * and gives each record a Spanish sort key.
 */
export function buildOutput(dataset: Dataset, attribution: Attribution, glossary?: Glossary): BuildOutput {
  const spanishName = (collection: CollectionName, name: string): string | undefined => {
    const section = nameSection(collection);
    return section ? translatedForms(glossary, section, name)[0] : undefined;
  };
  const entries = new Map<CollectionName, Map<string, { id: string; name: string; first: number | null }>>();
  for (const collection of COLLECTIONS) {
    const entry = new Map<string, { id: string; name: string; first: number | null }>();
    for (const record of dataset[collection] as Loose[]) {
      entry.set(record.slug, {
        id: publicId(collection, record),
        name: record.name.en,
        first: firstChapter(collection, record),
      });
    }
    entries.set(collection, entry);
  }

  const lookup = (collection: CollectionName, slug: string) => {
    const entry = entries.get(collection)?.get(slug);
    if (!entry) throw new Error(`Unknown reference ${collection}/${slug}`);
    return entry;
  };
  const urlOf = (collection: CollectionName, slug: string) =>
    `/api/v1/${collection}/${lookup(collection, slug).id}`;
  const ref = (collection: CollectionName, slug: string) => ({
    name: lookup(collection, slug).name,
    url: urlOf(collection, slug),
  });
  const listed = (collection: CollectionName, slug: string, extra: Loose = {}): Listed => ({
    first_chapter: lookup(collection, slug).first,
    item: { ...ref(collection, slug), ...extra },
  });
  const relation = (value: Loose) => ({
    status: value.status,
    ...(value.canon ? { canon: value.canon } : {}),
    ...(value.revealed_chapter !== undefined ? { revealed_chapter: value.revealed_chapter } : {}),
    ...(value.kind ? { kind: value.kind } : {}),
    ...(value.temporary ? { temporary: true } : {}),
  });
  const entityRef = (value: Loose) => ({
    type: value.type,
    ...ref(REF_COLLECTION[value.type as keyof typeof REF_COLLECTION], value.slug),
    ...relation(value),
  });
  const characterRef = (value: Loose) => ({ ...ref("characters", value.character), ...relation(value) });

  const lastChapter = Math.max(0, ...dataset.chapters.map((chapter) => chapter.number));
  const regularEpisodes = dataset.episodes.filter((episode) => episode.kind === "regular");
  const lastEpisode = Math.max(0, ...regularEpisodes.map((episode) => episode.number));

  const sub = new Map<string, Listed[]>();
  const addSub = (collection: CollectionName, slug: string, name: string, value: Listed) =>
    push(sub, `${collection}/${slug}/${name}`, value);

  const facets: FacetRow[] = [];
  const facet = (collection: CollectionName, slug: string, name: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      facets.push({ collection, id: lookup(collection, slug).id, facet: name, value: String(value) });
    }
  };

  const chapterVolume = new Map<number, string>();
  const chapterArcs = new Map<string, string[]>();
  const episodeArcs = new Map<string, string[]>();
  for (const volume of dataset.volumes) {
    for (let number = volume.chapters.start; number <= volume.chapters.end; number += 1) {
      chapterVolume.set(number, volume.slug);
      if (lookupExists(entries, "chapters", `chapter-${number}`)) {
        addSub("volumes", volume.slug, "chapters", listed("chapters", `chapter-${number}`));
      }
    }
  }
  for (const arc of [...dataset.arcs].sort((a, b) => a.order - b.order)) {
    for (const saga of arc.sagas) addSub("sagas", saga, "arcs", listed("arcs", arc.slug));
    // Cover story ranges are envelopes, so they do not identify individual chapters.
    if (arc.kind !== "cover_story") {
      for (const number of expand(arc.chapters?.ranges ?? [], lastChapter)) {
        const slug = `chapter-${number}`;
        if (!lookupExists(entries, "chapters", slug)) continue;
        addSub("arcs", arc.slug, "chapters", listed("chapters", slug));
        push(chapterArcs, slug, arc.slug);
      }
    }
    for (const number of expand(arc.episodes?.ranges ?? [], lastEpisode)) {
      const slug = `episode-${number}`;
      if (!lookupExists(entries, "episodes", slug)) continue;
      addSub("arcs", arc.slug, "episodes", listed("episodes", slug));
      push(episodeArcs, slug, arc.slug);
    }
    for (const number of arc.special_episodes ?? []) {
      const slug = `episode-special-${number}`;
      if (!lookupExists(entries, "episodes", slug)) continue;
      addSub("arcs", arc.slug, "episodes", listed("episodes", slug));
      push(episodeArcs, slug, arc.slug);
    }
  }

  const characterFruits = new Map<string, Loose[]>();
  for (const fruit of dataset["devil-fruits"]) {
    for (const user of fruit.users) {
      addSub("devil-fruits", fruit.slug, "users", listed("characters", user.character, relation(user)));
      push(characterFruits, user.character, { ...ref("devil-fruits", fruit.slug), ...relation(user) });
    }
  }
  for (const ship of dataset.ships) {
    for (const value of ship.affiliations) {
      if (value.type === "crew" || value.type === "organization") {
        addSub(REF_COLLECTION[value.type], value.slug, "ships", listed("ships", ship.slug, relation(value)));
      }
      if (value.type === "crew" && value.status === "current") facet("ships", ship.slug, "crew", value.slug);
    }
  }
  for (const location of dataset.locations) {
    if (location.parent) addSub("locations", location.parent, "children", listed("locations", location.slug));
  }
  for (const character of dataset.characters) {
    for (const value of character.affiliations ?? []) {
      if (value.type === "crew" || value.type === "organization") {
        addSub(REF_COLLECTION[value.type], value.slug, "members", listed("characters", character.slug, relation(value)));
        if (value.status === "current") facet("characters", character.slug, value.type, value.slug);
      }
    }
    for (const value of character.residences ?? []) {
      addSub("locations", value.slug, "residents", listed("characters", character.slug, relation(value)));
    }
  }

  const documents = new Map<string, unknown>();
  const records: RecordRow[] = [];
  const search: SearchRow[] = [];
  const covers: Covers = {};
  const coverRows: CoverRow[] = [];

  const linksFor = (collection: CollectionName, record: Loose, names: string[]) => {
    const url = urlOf(collection, record.slug);
    const links: Record<string, string> = {};
    for (const name of names) {
      if (sub.has(`${collection}/${record.slug}/${name}`)) links[name] = `${url}/${name}`;
    }
    return Object.keys(links).length > 0 ? { links } : {};
  };

  const bodyFor = (collection: CollectionName, record: Loose): Loose => {
    const base = { url: urlOf(collection, record.slug), ...record };
    switch (collection) {
      case "sagas":
        return { ...base, ...linksFor(collection, record, ["arcs"]) };
      case "arcs":
        return {
          ...base,
          sagas: record.sagas.map((slug: string) => ref("sagas", slug)),
          ...linksFor(collection, record, ["chapters", "episodes"]),
        };
      case "chapters": {
        const volume = chapterVolume.get(record.number);
        return {
          ...base,
          ...(volume ? { volume: ref("volumes", volume) } : {}),
          arcs: (chapterArcs.get(record.slug) ?? []).map((slug) => ref("arcs", slug)),
        };
      }
      case "volumes":
        return { ...base, ...linksFor(collection, record, ["chapters"]) };
      case "episodes":
        return { ...base, arcs: (episodeArcs.get(record.slug) ?? []).map((slug) => ref("arcs", slug)) };
      case "devil-fruits":
        return {
          ...base,
          users: record.users.map(characterRef),
          ...linksFor(collection, record, ["users"]),
        };
      case "crews":
        return {
          ...base,
          captains: record.captains.map(characterRef),
          ...linksFor(collection, record, ["members", "ships"]),
        };
      case "organizations":
        return {
          ...base,
          leaders: record.leaders.map(characterRef),
          affiliations: record.affiliations.map(entityRef),
          residences: record.residences.map(entityRef),
          ...linksFor(collection, record, ["members", "ships"]),
        };
      case "locations":
        return {
          ...base,
          ...(record.parent ? { parent: ref("locations", record.parent) } : {}),
          affiliations: record.affiliations.map(entityRef),
          ...linksFor(collection, record, ["residents", "children"]),
        };
      case "ships":
        return { ...base, affiliations: record.affiliations.map(entityRef) };
      case "characters": {
        const fruits = characterFruits.get(record.slug) ?? [];
        return {
          ...base,
          ...(record.affiliations ? { affiliations: record.affiliations.map(entityRef) } : {}),
          ...(record.residences ? { residences: record.residences.map(entityRef) } : {}),
          ...(record.origin
            ? {
                origin: {
                  ...(record.origin.location ? { location: ref("locations", record.origin.location) } : {}),
                  ...(record.origin.region ? { region: record.origin.region } : {}),
                  ...(record.origin.revealed_chapter !== undefined
                    ? { revealed_chapter: record.origin.revealed_chapter }
                    : {}),
                  ...(record.origin.region_revealed_chapter !== undefined
                    ? { region_revealed_chapter: record.origin.region_revealed_chapter }
                    : {}),
                },
              }
            : {}),
          ...(fruits.length > 0 ? { devil_fruits: fruits } : {}),
          links: {
            ...(record.affiliations ? { affiliations: `${base.url}/affiliations` } : {}),
            ...(record.bounties ? { bounties: `${base.url}/bounties` } : {}),
            ...(fruits.length > 0 ? { "devil-fruits": `${base.url}/devil-fruits` } : {}),
          },
        };
      }
    }
  };

  for (const collection of COLLECTIONS) {
    for (const record of dataset[collection] as Loose[]) {
      const { id, name, first } = lookup(collection, record.slug);
      const body = bodyFor(collection, record);
      documents.set(`v1/${collection}/${id}`, { first_chapter: first, body });

      if (collection === "characters") {
        if (body.affiliations) {
          addSub(collection, record.slug, "affiliations", {
            first_chapter: first,
            item: { items: body.affiliations },
          });
        }
        if (record.bounties) {
          addSub(collection, record.slug, "bounties", {
            first_chapter: first,
            item: { items: record.bounties },
          });
        }
        if (body.devil_fruits) {
          addSub(collection, record.slug, "devil-fruits", {
            first_chapter: first,
            item: { items: body.devil_fruits },
          });
        }
      }

      const bounties: Loose[] = record.bounties ?? [];
      // Deceased characters keep their last bounty, which the source marks as former.
      const latestBounty = bounties.filter((item) => !item.canon).at(-1);
      const characterCovers = collection === "characters" ? coversOf(record) : [];
      if (characterCovers.length > 0) covers[id] = characterCovers;
      for (const { name: coverName, until } of characterCovers) {
        coverRows.push({
          collection,
          id,
          until,
          name: coverName.en,
          sort_name: coverName.en.toLocaleLowerCase("en"),
          sort_name_es: spanishSortKey(coverName.en),
        });
      }
      records.push({
        collection,
        id,
        slug: record.slug,
        name,
        sort_name: name.toLocaleLowerCase("en"),
        sort_name_es: spanishSortKey(spanishName(collection, name) ?? name),
        number: record.number ?? record.order ?? null,
        first_chapter: first,
        bounty: latestBounty?.amount ?? null,
      });

      const section = nameSection(collection);
      const spanish = (name: Loose | undefined, nameSectionKey = section): string[] =>
        name?.en && nameSectionKey ? translatedForms(glossary, nameSectionKey, name.en) : [];
      const named = (field: "epithets" | "aliases") =>
        ((record[field] ?? []) as Loose[]).flatMap((item) => [nameText(item), ...spanish(item, field)]);
      const extras = [
        ...named("epithets"),
        ...named("aliases"),
        record.revealed_identity ? nameText(record.revealed_identity.name) : "",
        ...spanish(record.revealed_identity?.name),
      ];
      const names = [nameText(record.name), ...spanish(record.name)];
      // A covered character's real name is a spoiler, so spoiler-safe search only sees the cover name.
      const covered = characterCovers.length > 0;
      const searchName = covered ? characterCovers.map((cover) => nameText(cover.name)) : names;
      const searchExtra = covered ? [...names, ...extras] : extras;
      search.push({ collection, id, name: searchName.join(" "), extra: searchExtra.filter(Boolean).join(" ") });

      for (const field of ["canon", "kind", "status", "gender", "blood_type", "type", "sub_type", "region"]) {
        facet(collection, record.slug, field, record[field]);
      }
      for (const value of record.species ?? []) facet(collection, record.slug, "species", value);
      if (collection === "locations") facet(collection, record.slug, "parent", record.parent);
      if (collection === "arcs") {
        for (const saga of record.sagas) facet(collection, record.slug, "saga", saga);
      }
      if (collection === "chapters") {
        const volume = chapterVolume.get(record.number);
        if (volume) facet(collection, record.slug, "volume", lookup("volumes", volume).id);
        for (const arc of chapterArcs.get(record.slug) ?? []) facet(collection, record.slug, "arc", arc);
      }
      if (collection === "episodes") {
        for (const arc of episodeArcs.get(record.slug) ?? []) facet(collection, record.slug, "arc", arc);
      }
    }
  }

  for (const [key, values] of sub) {
    const [collection, slug, name] = key.split("/") as [CollectionName, string, string];
    const id = lookup(collection, slug).id;
    const wrapped = values.length === 1 && Array.isArray(values[0]?.item.items);
    const items: Listed[] = wrapped
      ? (values[0]?.item.items as Loose[]).map((item) => ({ first_chapter: values[0]?.first_chapter ?? null, item }))
      : values;
    documents.set(`v1/${collection}/${id}/${name}`, { items });
  }

  documents.set("v1/covers", covers);
  documents.set("v1/index", {
    name: "DenDen API",
    description: "Unofficial REST API for One Piece data.",
    version: "v1",
    data: { last_chapter: lastChapter, last_episode: lastEpisode },
    resources: Object.fromEntries(COLLECTIONS.map((name) => [name, `/api/v1/${name}`])),
    search: "/api/v1/search",
    labels: "/api/v1/labels",
    attribution: "/api/v1/attribution",
    openapi: "/api/v1/openapi.json",
  });
  documents.set(
    "v1/openapi",
    createOpenApiDocument({
      counts: Object.fromEntries(COLLECTIONS.map((name) => [name, dataset[name].length])) as Record<
        CollectionName,
        number
      >,
      last_chapter: lastChapter,
      last_episode: lastEpisode,
    }),
  );
  documents.set("v1/attribution", {
    license: attribution.license,
    license_url: attribution.license_url,
    notice: attribution.notice,
    articles: Object.fromEntries(COLLECTIONS.map((name) => [name, `/api/v1/attribution/${name}`])),
  });
  for (const collection of COLLECTIONS) {
    const items = Object.entries(attribution.articles[collection]).map(([slug, source_url]) => ({
      first_chapter: null,
      item: { ...ref(collection, slug), source_url },
    }));
    documents.set(`v1/attribution/${collection}`, { items });
  }

  return { documents, records, covers: coverRows, facets, search };
}

function lookupExists(
  entries: Map<CollectionName, Map<string, unknown>>,
  collection: CollectionName,
  slug: string,
): boolean {
  return entries.get(collection)?.has(slug) ?? false;
}
