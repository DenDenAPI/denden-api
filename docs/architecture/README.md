# Architecture

DenDenAPI uses Clean Architecture with explicit `domain`, `application`, `infrastructure`, and `api` Gradle modules. Dependencies point inward, while composition happens in the API boundary.

Significant approved technical decisions are recorded in [`decisions/`](decisions/). Documentation may describe an approved decision, but it must not silently create one.

The current unapproved persistence options are collected in the [persistence design proposal](persistence-design-proposal.md). It is a review aid, not an architecture decision or implementation authorization.
