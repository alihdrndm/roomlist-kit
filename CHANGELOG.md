# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-07

### Added

- Core library: parse CSV and XLSX rooming lists, map column headers, parse dates (MDY or DMY), validate with error rules (R) and warning rules (W), and build a summary with room nights.
- Five export targets: OPERA 5 XML, OPERA Cloud XLSX, Maestro CSV, canonical JSON, and canonical CSV.
- Diff of two rooming lists: added, removed and changed entries, with the change in room nights.
- Command-line tool `roomlist` with `validate`, `convert`, `diff` and `formats` commands.
- HTTP API: `validate`, `convert`, `diff` and `formats` endpoints, `application/problem+json` errors, API key authentication, rate limiting, and OpenAPI docs at `/docs`.
- Web app: validate and convert, compare two lists, and a formats page.
- Docker images and a Docker Compose file.
- SST configuration, deploy-ready (never deployed from this repository).
- GitHub Actions CI workflow.

[Unreleased]: https://github.com/alihdrndm/roomlist-kit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alihdrndm/roomlist-kit/releases/tag/v0.1.0
