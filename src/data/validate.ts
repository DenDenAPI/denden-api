import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";
import type { z } from "zod";
import { ArcSchema, type Arc } from "../schemas/arc.js";
import { AttributionSchema } from "../schemas/attribution.js";
import { ChapterSchema, type Chapter } from "../schemas/chapter.js";
import { CharacterSchema, type Character } from "../schemas/character.js";
import type { CharacterRef, EntityRef, FirstAppearance, Span } from "../schemas/common.js";
import { CrewSchema, type Crew } from "../schemas/crew.js";
import { DevilFruitSchema, type DevilFruit } from "../schemas/devil-fruit.js";
import { EpisodeSchema, type Episode } from "../schemas/episode.js";
import { LocationSchema, type Location } from "../schemas/location.js";
import { OrganizationSchema, type Organization } from "../schemas/organization.js";
import { SagaSchema, type Saga } from "../schemas/saga.js";
import { ShipSchema, type Ship } from "../schemas/ship.js";
import { VolumeSchema, type Volume } from "../schemas/volume.js";

export interface Dataset {
  sagas: Saga[];
  arcs: Arc[];
  chapters: Chapter[];
  volumes: Volume[];
  episodes: Episode[];
  "devil-fruits": DevilFruit[];
  crews: Crew[];
  organizations: Organization[];
  locations: Location[];
  ships: Ship[];
  characters: Character[];
}

export interface ValidationResult extends Dataset {
  issues: string[];
}

function loadCollection<S extends z.ZodType>(
  root: string,
  directory: string,
  schema: S,
  issues: string[],
): z.infer<S>[] {
  const path = join(root, directory);
  if (!existsSync(path)) {
    issues.push(`${directory}: directory is missing`);
    return [];
  }

  const records: z.infer<S>[] = [];
  for (const file of readdirSync(path).filter((name) => name.endsWith(".yaml")).sort()) {
    const label = `${directory}/${file}`;
    let content: unknown;
    try {
      content = parse(readFileSync(join(path, file), "utf8"));
    } catch (error) {
      issues.push(`${label}: invalid YAML (${String(error)})`);
      continue;
    }

    const result = schema.safeParse(content);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push(`${label}: ${issue.path.join(".") || "record"} ${issue.message}`);
      }
      continue;
    }

    const slug = (result.data as { slug: string }).slug;
    if (slug !== basename(file, ".yaml")) {
      issues.push(`${label}: slug "${slug}" does not match the file name`);
    }
    records.push(result.data);
  }
  return records;
}

function checkUniqueOrder(
  label: string,
  records: { slug: string; order: number }[],
  issues: string[],
): void {
  const seen = new Map<number, string>();
  for (const { slug, order } of records) {
    const other = seen.get(order);
    if (other) issues.push(`${label}: order ${order} is used by ${other} and ${slug}`);
    seen.set(order, slug);
  }
}

function checkNumbering(
  label: string,
  records: { slug: string; number: number }[],
  first: number,
  issues: string[],
): void {
  const numbers = new Set<number>();
  for (const { slug, number } of records) {
    if (numbers.has(number)) issues.push(`${label}: duplicate number ${number}`);
    numbers.add(number);
    if (!slug.endsWith(`-${number}`)) issues.push(`${label}/${slug}: slug does not match number ${number}`);
  }
  if (numbers.size === 0) return;
  for (let number = first; number <= Math.max(...numbers); number += 1) {
    if (!numbers.has(number)) issues.push(`${label}: number ${number} is missing`);
  }
}

function checkSpan(
  label: string,
  span: Span | undefined,
  exact: boolean,
  known: Set<number>,
  issues: string[],
): void {
  if (!span) return;

  const sorted = [...span.ranges].sort((a, b) => a.start - b.start);
  sorted.forEach((range, index) => {
    const next = sorted[index + 1];
    if (next && (range.end === null || range.end >= next.start)) {
      issues.push(`${label}: ranges overlap`);
    }
    if (known.size > 0) {
      if (!known.has(range.start)) issues.push(`${label}: unknown start ${range.start}`);
      if (range.end !== null && !known.has(range.end)) issues.push(`${label}: unknown end ${range.end}`);
    }
  });

  if (!exact || span.count === null || span.ranges.some((range) => range.end === null)) return;
  const total = span.ranges.reduce((sum, range) => sum + (range.end as number) - range.start + 1, 0);
  if (total !== span.count) {
    issues.push(`${label}: count ${span.count} does not match ranges total ${total}`);
  }
}

function checkVolumes(volumes: Volume[], chapterNumbers: Set<number>, issues: string[]): void {
  const sorted = [...volumes].sort((a, b) => a.number - b.number);
  sorted.forEach((volume, index) => {
    const { start, end } = volume.chapters;
    if (!chapterNumbers.has(start) || !chapterNumbers.has(end)) {
      issues.push(`volumes/${volume.slug}: chapters ${start}-${end} are not all known`);
    }
    const next = sorted[index + 1];
    if (next && next.chapters.start !== end + 1) {
      issues.push(`volumes/${volume.slug}: next volume starts at ${next.chapters.start}, expected ${end + 1}`);
    }
  });
}

function checkChronology(
  label: string,
  records: { slug: string; number: number; date: string | undefined }[],
  issues: string[],
): void {
  let latest: string | undefined;
  for (const { slug, date } of [...records].sort((a, b) => a.number - b.number)) {
    if (!date) continue;
    if (latest && date < latest) issues.push(`${label}/${slug}: date ${date} is before ${latest}`);
    if (!latest || date > latest) latest = date;
  }
}

function episodesIn(arc: Arc, maxEpisode: number): number[] {
  return (arc.episodes?.ranges ?? []).flatMap(({ start, end }) => {
    const last = end ?? maxEpisode;
    return Array.from({ length: Math.max(last - start + 1, 0) }, (_, index) => start + index);
  });
}

function checkEpisodeCanon(arcs: Arc[], episodes: Episode[], issues: string[]): void {
  const regular = episodes.filter((episode) => episode.kind === "regular");
  const byNumber = new Map(regular.map((episode) => [episode.number, episode]));
  const maxEpisode = Math.max(0, ...byNumber.keys());
  const mangaEpisodes = new Set(
    arcs
      .filter((arc) => arc.kind === "story" || arc.kind === "cover_story")
      .flatMap((arc) => episodesIn(arc, maxEpisode)),
  );

  for (const arc of arcs.filter((item) => item.kind === "filler" || item.kind === "special")) {
    for (const number of episodesIn(arc, maxEpisode)) {
      const episode = byNumber.get(number);
      if (episode && !mangaEpisodes.has(number) && episode.canon !== "anime_only") {
        issues.push(`episodes/${episode.slug}: belongs to ${arc.slug} but canon is ${episode.canon}`);
      }
    }
  }
}

function checkFirstAppearance(
  label: string,
  first: FirstAppearance | undefined,
  chapters: Set<number>,
  episodes: Set<number>,
  issues: string[],
): void {
  if (first?.chapter !== undefined && !chapters.has(first.chapter)) {
    issues.push(`${label}: unknown first chapter ${first.chapter}`);
  }
  if (first?.episode !== undefined && !episodes.has(first.episode)) {
    issues.push(`${label}: unknown first episode ${first.episode}`);
  }
}

function checkEntityRefs(
  label: string,
  refs: EntityRef[],
  known: Record<EntityRef["type"], Set<string>>,
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = `${ref.type}:${ref.slug}:${ref.status}`;
    if (seen.has(key)) issues.push(`${label}: duplicate reference ${key}`);
    seen.add(key);
    if (!known[ref.type].has(ref.slug)) issues.push(`${label}: unknown ${ref.type} "${ref.slug}"`);
  }
}

function checkCharacterRefs(
  label: string,
  refs: CharacterRef[],
  characters: Set<string>,
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = `${ref.character}:${ref.status}`;
    if (seen.has(key)) issues.push(`${label}: duplicate reference ${key}`);
    seen.add(key);
    if (!characters.has(ref.character)) issues.push(`${label}: unknown character "${ref.character}"`);
  }
}

function checkCharacters(
  dataset: Dataset,
  known: Record<EntityRef["type"], Set<string>>,
  chapters: Set<number>,
  issues: string[],
): void {
  for (const character of dataset.characters) {
    const label = `characters/${character.slug}`;
    checkEntityRefs(`${label} affiliations`, character.affiliations ?? [], known, issues);
    checkEntityRefs(`${label} residences`, character.residences ?? [], known, issues);
    if (character.origin?.location && !known.location.has(character.origin.location)) {
      issues.push(`${label}: unknown origin "${character.origin.location}"`);
    }
    for (const bounty of character.bounties ?? []) {
      if (bounty.revealed_chapter !== undefined && !chapters.has(bounty.revealed_chapter)) {
        issues.push(`${label}: unknown bounty chapter ${bounty.revealed_chapter}`);
      }
    }
    const origin = character.origin;
    if (origin?.region_revealed_chapter !== undefined) {
      if (!origin.region || !origin.location) {
        issues.push(`${label}: origin region chapter needs both a region and a place`);
      }
      if (origin.revealed_chapter !== undefined && origin.revealed_chapter <= origin.region_revealed_chapter) {
        issues.push(`${label}: origin region chapter must come before the origin chapter`);
      }
    }
    if (character.blood_type_revealed_chapter !== undefined && character.blood_type === undefined) {
      issues.push(`${label}: blood type chapter without a blood type`);
    }
    const revealed = [
      character.status_revealed_chapter,
      character.blood_type_revealed_chapter,
      character.birthday?.revealed_chapter,
      origin?.revealed_chapter,
      origin?.region_revealed_chapter,
      ...[
        ...(character.epithets ?? []),
        ...(character.aliases ?? []),
        ...(character.occupations ?? []),
        ...(character.social_ranks ?? []),
        ...(character.affiliations ?? []),
        ...(character.residences ?? []),
        ...(character.ages ?? []),
        ...(character.heights ?? []),
      ].map((item) => item.revealed_chapter),
    ].filter((chapter) => chapter !== undefined);
    const debut = character.first_appearance?.chapter;
    const endOf = (alias: { cover_until?: number | undefined; cover_always?: true | undefined }) =>
      alias.cover_always ? Infinity : (alias.cover_until as number);
    const covers = (character.aliases ?? [])
      .filter((alias) => alias.cover_until !== undefined || alias.cover_always)
      .sort((a, b) => endOf(a) - endOf(b));
    // Cover names follow one another: each starts after the previous one ends.
    covers.forEach((cover, index) => {
      const previous = covers[index - 1];
      if (previous && cover.revealed_chapter !== undefined && cover.revealed_chapter <= endOf(previous)) {
        issues.push(`${label}: cover alias "${cover.en}" starts before "${previous.en}" ends`);
      }
    });
    for (const cover of covers) {
      if (cover.cover_always && cover.cover_until !== undefined) {
        issues.push(`${label}: cover alias "${cover.en}" cannot both end and last forever`);
      }
      if (cover.cover_until === undefined) {
        if (cover.revealed_chapter === undefined) issues.push(`${label}: cover alias "${cover.en}" needs a revealed chapter`);
        continue;
      }
      const until = cover.cover_until;
      if (cover.revealed_chapter === undefined) {
        issues.push(`${label}: cover alias "${cover.en}" needs a revealed chapter`);
      } else if (until < cover.revealed_chapter) {
        issues.push(`${label}: cover alias "${cover.en}" ends before it is revealed`);
      }
      if (!chapters.has(until)) issues.push(`${label}: unknown cover chapter ${until}`);
      if (debut === undefined || until < debut) {
        issues.push(`${label}: cover alias "${cover.en}" ends before the first appearance`);
      }
    }
    for (const chapter of revealed) {
      if (!chapters.has(chapter)) issues.push(`${label}: unknown revealed chapter ${chapter}`);
      if (debut === undefined || chapter < debut) {
        issues.push(`${label}: revealed chapter ${chapter} is before the first appearance`);
      }
    }
  }
}

function checkLocationParents(locations: Location[], issues: string[]): void {
  const parents = new Map(locations.map((location) => [location.slug, location.parent]));
  for (const location of locations) {
    if (location.parent && !parents.has(location.parent)) {
      issues.push(`locations/${location.slug}: unknown parent "${location.parent}"`);
    }
    const visited = new Set([location.slug]);
    let current = location.parent;
    while (current) {
      if (visited.has(current)) {
        issues.push(`locations/${location.slug}: parent cycle through "${current}"`);
        break;
      }
      visited.add(current);
      current = parents.get(current);
    }
  }
}

function checkEntities(
  dataset: Dataset,
  chapters: Set<number>,
  episodes: Set<number>,
  issues: string[],
): void {
  const known = {
    crew: new Set(dataset.crews.map((crew) => crew.slug)),
    organization: new Set(dataset.organizations.map((organization) => organization.slug)),
    location: new Set(dataset.locations.map((location) => location.slug)),
  };

  const characters = new Set(dataset.characters.map((character) => character.slug));
  for (const name of ["devil-fruits", "crews", "organizations", "locations", "ships", "characters"] as const) {
    for (const record of dataset[name]) {
      checkFirstAppearance(`${name}/${record.slug}`, record.first_appearance, chapters, episodes, issues);
    }
  }
  for (const crew of dataset.crews) {
    checkCharacterRefs(`crews/${crew.slug} captains`, crew.captains, characters, issues);
  }
  for (const organization of dataset.organizations) {
    checkCharacterRefs(`organizations/${organization.slug} leaders`, organization.leaders, characters, issues);
  }
  for (const fruit of dataset["devil-fruits"]) {
    checkCharacterRefs(`devil-fruits/${fruit.slug} users`, fruit.users, characters, issues);
    const revealed = fruit.revealed_identity;
    if (revealed && !chapters.has(revealed.chapter)) {
      issues.push(`devil-fruits/${fruit.slug}: unknown reveal chapter ${revealed.chapter}`);
    }
  }
  for (const organization of dataset.organizations) {
    const label = `organizations/${organization.slug}`;
    checkEntityRefs(`${label} affiliations`, organization.affiliations, known, issues);
    checkEntityRefs(`${label} residences`, organization.residences, known, issues);
  }
  for (const location of dataset.locations) {
    checkEntityRefs(`locations/${location.slug} affiliations`, location.affiliations, known, issues);
  }
  for (const ship of dataset.ships) {
    checkEntityRefs(`ships/${ship.slug} affiliations`, ship.affiliations, known, issues);
  }
  checkLocationParents(dataset.locations, issues);
  checkCharacters(dataset, known, chapters, issues);
}

function checkAttribution(root: string, dataset: Dataset, issues: string[]): void {
  const path = join(root, "ATTRIBUTION.yaml");
  if (!existsSync(path)) {
    issues.push("ATTRIBUTION.yaml: file is missing");
    return;
  }

  const result = AttributionSchema.safeParse(parse(readFileSync(path, "utf8")));
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`ATTRIBUTION.yaml: ${issue.path.join(".")} ${issue.message}`);
    }
    return;
  }

  const collections = [
    "sagas",
    "arcs",
    "chapters",
    "volumes",
    "episodes",
    "devil-fruits",
    "crews",
    "organizations",
    "locations",
    "ships",
    "characters",
  ] as const;
  for (const name of collections) {
    const articles = result.data.articles[name];
    const slugs = new Set(dataset[name].map((record) => record.slug));
    for (const slug of slugs) {
      if (!articles[slug]) issues.push(`ATTRIBUTION.yaml: ${name}/${slug} has no article`);
    }
    for (const slug of Object.keys(articles)) {
      if (!slugs.has(slug)) issues.push(`ATTRIBUTION.yaml: ${name}/${slug} has no record`);
    }
  }
}

export function validateDataset(root: string): ValidationResult {
  const issues: string[] = [];
  const dataset: Dataset = {
    sagas: loadCollection(root, "sagas", SagaSchema, issues),
    arcs: loadCollection(root, "arcs", ArcSchema, issues),
    chapters: loadCollection(root, "chapters", ChapterSchema, issues),
    volumes: loadCollection(root, "volumes", VolumeSchema, issues),
    episodes: loadCollection(root, "episodes", EpisodeSchema, issues),
    "devil-fruits": loadCollection(root, "devil-fruits", DevilFruitSchema, issues),
    crews: loadCollection(root, "crews", CrewSchema, issues),
    organizations: loadCollection(root, "organizations", OrganizationSchema, issues),
    locations: loadCollection(root, "locations", LocationSchema, issues),
    ships: loadCollection(root, "ships", ShipSchema, issues),
    characters: loadCollection(root, "characters", CharacterSchema, issues),
  };
  const { sagas, arcs, chapters, volumes, episodes } = dataset;

  checkUniqueOrder("sagas", sagas, issues);
  checkUniqueOrder("arcs", arcs, issues);
  checkNumbering("chapters", chapters, chapters.some((chapter) => chapter.number === 0) ? 0 : 1, issues);
  checkNumbering("volumes", volumes, 1, issues);
  const regularEpisodes = episodes.filter((episode) => episode.kind === "regular");
  const specialEpisodes = episodes.filter((episode) => episode.kind === "special");
  checkNumbering("episodes", regularEpisodes, 1, issues);
  checkNumbering("episodes", specialEpisodes, 1, issues);

  const chapterNumbers = new Set(chapters.map((chapter) => chapter.number));
  const volumeNumbers = new Set(volumes.map((volume) => volume.number));
  const episodeNumbers = new Set(regularEpisodes.map((episode) => episode.number));
  const specialNumbers = new Set(specialEpisodes.map((episode) => episode.number));
  checkVolumes(volumes, chapterNumbers, issues);
  // Chapter 0 was published years after the start of the series.
  checkChronology(
    "chapters",
    chapters
      .filter((chapter) => chapter.number > 0)
      .map(({ slug, number, release_date }) => ({ slug, number, date: release_date })),
    issues,
  );
  checkChronology(
    "volumes",
    volumes.map(({ slug, number, release_date }) => ({ slug, number, date: release_date })),
    issues,
  );
  checkChronology(
    "episodes",
    regularEpisodes.map(({ slug, number, air_date }) => ({ slug, number, date: air_date })),
    issues,
  );

  const sagaSlugs = new Set(sagas.map((saga) => saga.slug));
  for (const saga of sagas) {
    checkSpan(`sagas/${saga.slug} chapters`, saga.chapters, true, chapterNumbers, issues);
    checkSpan(`sagas/${saga.slug} volumes`, saga.volumes, true, volumeNumbers, issues);
    checkSpan(`sagas/${saga.slug} episodes`, saga.episodes, true, episodeNumbers, issues);
  }

  for (const arc of arcs) {
    for (const saga of arc.sagas) {
      if (!sagaSlugs.has(saga)) issues.push(`arcs/${arc.slug}: unknown saga "${saga}"`);
    }
    if (arc.kind === "filler" && arc.canon === "manga") {
      issues.push(`arcs/${arc.slug}: filler cannot have manga canon`);
    }
    for (const number of arc.special_episodes ?? []) {
      if (!specialNumbers.has(number)) issues.push(`arcs/${arc.slug}: unknown special episode ${number}`);
    }
    // Cover stories run on non-consecutive chapters, so their range is only an envelope.
    const exact = arc.kind !== "cover_story";
    checkSpan(`arcs/${arc.slug} chapters`, arc.chapters, exact, chapterNumbers, issues);
    checkSpan(`arcs/${arc.slug} volumes`, arc.volumes, exact, volumeNumbers, issues);
    checkSpan(`arcs/${arc.slug} episodes`, arc.episodes, exact, episodeNumbers, issues);
  }

  checkEpisodeCanon(arcs, episodes, issues);
  checkEntities(dataset, chapterNumbers, episodeNumbers, issues);
  checkAttribution(root, dataset, issues);
  return { ...dataset, issues };
}
