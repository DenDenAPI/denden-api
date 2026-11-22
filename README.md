# DenDen API

An unofficial, free and read-only REST API for One Piece data.

Characters, devil fruits, crews, organizations, locations, ships, sagas, arcs, chapters, volumes and episodes, all linked together.

## Features

- Plain REST and JSON, with no keys or sign-up.
- Relations as sub-resources, such as `/api/v1/crews/straw-hat-pirates/members`.
- Filters, sorting, pagination and global search.
- Optional spoiler filter with `?until_chapter=`.
- OpenAPI 3.1 at `/api/v1/openapi.json`.
- Open CORS, ETag caching and RFC 9457 errors.

## Examples

```text
GET /api/v1/characters/monkey-d-luffy
GET /api/v1/characters?sort=-bounty&limit=10
GET /api/v1/devil-fruits/gomu-gomu-no-mi/users
GET /api/v1/sagas/east-blue-saga/arcs
GET /api/v1/search?q=zoro
GET /api/v1/characters/monkey-d-luffy?until_chapter=100
```

## Run locally

You need Node.js 24 and pnpm. Clone this repository next to [`denden-data`](https://github.com/DenDenAPI/denden-data):

```shell
pnpm install
pnpm build
pnpm start
```

The API listens on `http://127.0.0.1:8787/api/v1`.

## Checks

```shell
pnpm typecheck
pnpm test
pnpm validate:data
pnpm check:openapi
pnpm check:worker
```

## Architecture

```text
denden-data (YAML) → build → static JSON + read-only SQLite → Hono API
```

Records and relations are served from static JSON. Filters, sorting and search use SQLite. The API runs on Cloudflare Workers with D1, and also on Node.js through small adapters in `src/adapters`.

## Related repositories

- [`denden-data`](https://github.com/DenDenAPI/denden-data): the dataset.

## License

The code is licensed under [BSD 3-Clause](LICENSE). The dataset is licensed separately under CC BY-SA 3.0 and is based on content from [One Piece Wiki](https://onepiece.fandom.com/wiki/One_Piece_Wiki) at Fandom.

One Piece is owned by Eiichiro Oda, Shueisha and Toei Animation. This is an unofficial fan project. See [NOTICE](NOTICE).
