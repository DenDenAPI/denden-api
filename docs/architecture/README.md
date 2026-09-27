# Architecture

DenDenAPI uses Clean Architecture with explicit `domain`, `application`, `infrastructure`, and `api` Gradle modules. Dependencies point inward, while composition happens in the API boundary.

Significant approved technical decisions are recorded in [`decisions/`](decisions/). Documentation may describe an approved decision, but it must not silently create one.
