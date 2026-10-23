# ADR-017: Serve public corpus structure separately from personal timeline data

- **Date:** 2026-10-23
- **Status:** Accepted

## Decision

Expose the fixed volume structure through public `GET /api/volumes`. Keep `GET /api/quotes/timeline` authenticated and return personal bookmarks only to the current session.

## Context

Visitors need the seven volume titles and page ranges to browse and filter corpus search. Those same structural fields are also useful to the connected user's personal timeline, which additionally contains their selected quotes, comments, and tags.

## Why not expose the personal timeline

Making the timeline endpoint public would send personal records to unauthenticated clients even if the UI hid them. Filtering those records in the frontend would not protect them.

## Why not duplicate volume structure in the frontend

Hardcoded titles and page ranges would duplicate data already stored and maintained in the corpus database, and could drift from corpus imports.

## Why this decision

The public response is backed by the existing `volumes` table and a DTO that contains only structural fields. The personal timeline continues to resolve its owner from the authenticated session and is requested only after the frontend confirms a connected user.

## Tradeoff accepted

Public corpus structure now has its own endpoint and frontend query cache. This is a small addition in exchange for an explicit boundary between public navigation metadata and user-owned data.
