# Contributing to DenDenAPI

Thank you for helping improve DenDenAPI. Contributions are welcome through issues and pull requests.

## Before starting

Read the relevant sources of truth before proposing a change:

- Domain knowledge: [`docs/domain/`](docs/domain/)
- Architecture and decisions: [`docs/architecture/`](docs/architecture/)
- Feature requirements: [`specs/`](specs/)

Do not introduce or reinterpret domain behavior, public API contracts, architecture, data-model strategy, major dependencies, or backwards compatibility without discussing the decision first.

Feature implementation starts from an agreed specification in `specs/`. For a substantial change, open a proposal issue before investing in an implementation.

## Development environment

You need:

- JDK 21
- Docker with Docker Compose

Run the project checks with:

```shell
./gradlew build
./gradlew test
```

Start the API and PostgreSQL with:

```shell
docker compose up --build
```

The API listens on `http://localhost:8080`. See the [README](README.md) for port configuration.

## Making a change

1. Create a focused branch from the latest `main`.
2. Keep the change within the documented scope or active specification.
3. Add tests at the boundary where behavior is observable.
4. Update documentation, OpenAPI, and migrations when applicable.
5. Use English for repository content and Conventional Commits for commit messages.
6. Run every applicable check before opening a pull request.

Avoid unrelated refactors and speculative abstractions. Persistence models must not leak into the domain, application, or public API contracts.

## Pull requests

Complete the pull request template and explain both what changed and why. Link the relevant specification or explain why one is not required. List only verification that actually ran.

Pull requests are merged by a maintainer using squash merge. Review comments must be resolved before merging. A maintainer may ask for a change to be split when it mixes unrelated concerns.

## Reporting problems

Use the issue forms for reproducible bugs and change proposals. For security vulnerabilities, follow [`SECURITY.md`](SECURITY.md) and do not open a public issue.
