# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ The line above is not optional. Next.js here is **16.2.6** with React **19** and Tailwind **v4** — APIs and conventions differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build (also the best full type/route check)
npm run start    # serve the production build
npm run lint     # eslint (flat config, next/core-web-vitals + next/typescript)
```

There is no test runner configured. Type errors surface via `npm run build` (tsconfig has `noEmit`); there is no standalone `typecheck` script.

## Conventions

- **Git commits: never include `Co-Authored-By` (or any co-author) trailers.** Keep commit messages free of attribution lines.

## Architecture

This is **Tribe Index** — a Next.js App Router app presenting 12 biblical-tribe personality archetypes, and (per `ASSESSMENT_DESIGN.md`) the planned foundation for a word-selection assessment that maps people to a primary/secondary tribe.

**The data model is the heart of the app.** `src/lib/tribes.ts` is the single source of truth: the `Tribe` interface and the `tribes` array (12 entries, `number` 1–12, each with `hebrew` / `essence` / strengths / shadow / oil / fall line / notable people / "the note"). Everything else renders from it.

- `src/app/page.tsx` — home: hero + the twelve tribes as stacked rows, each linking to `/tribes/[slug]`.
- `src/app/tribes/[slug]/page.tsx` — tribe detail. Uses `generateStaticParams()` over `tribes` (fully static), and prev/next nav indexes the array by `tribe.number` (`tribes[number-2]` / `tribes[number]`), so **`number` must stay 1-based and contiguous and the array must stay sorted by `number`**. `params` is a `Promise` (await it) — a Next 16 convention.

**Design system.** The look is a light "sanctuary" theme. Palette tokens live in `globals.css` as CSS variables, exposed to Tailwind v4 via `@theme` (`bg-bone`, `text-gold`, `text-ink`, etc.). Fonts are loaded in `layout.tsx` with `next/font` and exposed as CSS variables: Inter (body, `--font-inter`), Cormorant Garamond (serif headings), Cinzel (the carved display word in the hero), Frank Ruhl Libre (Hebrew — needs the `hebrew` subset). The hero "sun" bloom and the animated per-tribe accent bar on tribe rows are the `.sun` / `.tribe-row` classes in `globals.css`.

**Per-tribe accent color** comes from the `color` field (a Tailwind color name like `"amber"`), mapped to a hex by an `accentHex` lookup duplicated in `page.tsx` and the detail page, then passed in as the `--accent` CSS variable via inline `style`. **When adding a tribe or color, add the matching key to both `accentHex` maps** — a missing key falls back to brass with no error.

**Tribe `status`** (`active` / `disqualified` / `warning` / `disqualified-arc`): the home page does **not** surface it. The detail page renders non-`active` statuses as an in-depth section using `statusLabels` (`tribes.ts`) + `statusNote` (detail page).

`src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge) for class merging.

## Reference docs (content, not code)

- `TRIBE_PROFILES.md` — full prose profiles; the source the `tribes` array is distilled from.
- `ASSESSMENT_DESIGN.md` — spec for the not-yet-built assessment: a flat 73-word adjective list, each word mapped to one or two tribes (shared words score 0.5 each), plus a self vs. 360-observer comparison flow. Consult this before building assessment/scoring features.
