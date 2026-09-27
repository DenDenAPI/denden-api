# Governance

DenDenAPI is currently maintained by a single project owner. External contributions are welcome, but maintainer access is not required to participate.

## Responsibilities

The maintainer is responsible for:

- setting project scope and priorities;
- approving domain, API, architecture, data-model, dependency, and compatibility decisions;
- reviewing and merging pull requests;
- managing releases, security reports, and repository settings;
- applying the Code of Conduct.

Contributors are responsible for keeping proposals and changes focused, following the documented domain and architecture, responding to review feedback, and reporting security concerns privately.

## Decision process

Small implementation details may be decided in a pull request when they do not alter established semantics or contracts. Significant decisions must be discussed before implementation and recorded in the appropriate specification or architecture decision record.

The maintainer makes the final decision when consensus cannot be reached. Decisions should be explained in the relevant issue, pull request, specification, or ADR.

## Merging

Changes to `main` go through pull requests and use squash merge. Required approvals remain at zero while the project has a single maintainer, because GitHub does not allow authors to approve their own pull requests. Automated checks and resolved review conversations are still required.

If additional maintainers join, the review policy will be revisited before granting merge access.
