# DenDenAPI

An open, multilingual and spoiler-aware API for structured One Piece data.

The project has completed its initial domain handoff and now contains a minimal backend foundation. No domain feature or public endpoint has been implemented yet.

## Documentation

The domain definition lives in [`docs/domain/`](docs/domain/), architecture decisions live in [`docs/architecture/`](docs/architecture/), and implementation specifications live in [`specs/`](specs/).

## Backend

The backend uses Kotlin, Ktor, Koin, PostgreSQL, jOOQ, Flyway, and kotlinx.serialization. Four Gradle modules enforce the Clean Architecture dependency direction:

```text
api -> infrastructure -> application -> domain
 |                         ^
 +-------------------------+
```

Requirements:

- JDK 17
- Docker with Docker Compose

Common commands:

```shell
./gradlew build
./gradlew test
docker compose up --build
```

The API process listens on port `8080`. PostgreSQL is exposed locally on port `5432`.
