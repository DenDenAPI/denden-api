# DenDenAPI

An open, multilingual and spoiler-aware API for structured One Piece data.

The project has completed its initial domain handoff and now contains a minimal backend foundation. No domain feature or public endpoint has been implemented yet.

## Documentation

The domain definition lives in [`docs/domain/`](docs/domain/), architecture decisions live in [`docs/architecture/`](docs/architecture/), and implementation specifications live in [`specs/`](specs/).

## Backend

The backend uses Kotlin, Ktor, Metro, PostgreSQL, jOOQ, Flyway, and kotlinx.serialization. Four Gradle modules enforce the Clean Architecture dependency direction:

```text
api -> infrastructure -> application -> domain
 |                         ^
 +-------------------------+
```

Requirements:

- JDK 21
- Docker with Docker Compose

Common commands:

```shell
./gradlew build
./gradlew test
docker compose up --build
```

The API process listens on port `8080`. PostgreSQL is exposed locally on port `5432`. If port `8080` is already in use, select another host port without changing the container configuration:

```shell
API_PORT=8081 docker compose up --build
```

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Project governance is documented in [`GOVERNANCE.md`](GOVERNANCE.md), and community participation follows the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Report suspected vulnerabilities privately by following [`SECURITY.md`](SECURITY.md).

## License

Original DenDenAPI software and documentation are licensed under the [Apache License, Version 2.0](LICENSE). See [`NOTICE`](NOTICE) for attribution and the third-party intellectual property disclaimer.
