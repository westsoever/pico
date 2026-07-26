# Pico — Web MVP Plan

## Goal

Self-contained web MVP under `02-Projects/Pico/` with one core loop:

**Scan → Rate (taste profile) → Repertoire → Similar**

Mobile-first, testable on iPhone via Safari.

## Status

- [x] Project scaffold (Vite + React + TypeScript + Tailwind)
- [x] Seed catalog (~30 coffees)
- [x] Scan flow (search + camera capture)
- [x] Rating + taste profile
- [x] Repertoire + similar recommendations
- [x] Mobile-first UI

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS
- localStorage persistence
- Static JSON seed catalog

## Success criteria

Complete this flow on iPhone or desktop:

1. Find a coffee via search (or snap label + search)
2. Rate with stars and flavor tags
3. See it in Repertoire
4. See similar coffees in recommendations

See [BUILD-LATER.md](./BUILD-LATER.md) for everything out of scope.
