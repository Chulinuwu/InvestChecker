# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Twenty Toys Investment Tracker — a SvelteKit 2 + Svelte 5 full-stack PWA for managing toy business investments, pre-orders, LINE members, and a backoffice admin panel. Deployed to Vercel. UI is primarily in Thai.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type-check (svelte-kit sync + svelte-check)
npm run check:watch  # Type-check in watch mode
npm run lint         # Prettier check + ESLint
npm run format       # Auto-format with Prettier
```

No test framework is configured.

## Architecture

### Routing (SvelteKit file-based)
- `/` — Main investment tracker (login + dashboard for the regular user)
- `/backoffice/` — Admin backoffice layout with nav bar + mobile bottom nav
- `/backoffice/sets/` — Product sets management
- `/backoffice/members/` — LINE user/member management
- `/backoffice/gifts/` — Redeemable gifts (points system)
- `/backoffice/settings/` — App config + broadcast messaging

The backoffice page (`/backoffice/+page.svelte`) uses URL search params (`?tab=preorders`) for tab-based sub-navigation between Products and Pre-orders.

### Data Layer
All database access uses the Supabase JS client directly from the browser — there are no SvelteKit server routes or load functions. Service helpers live in `src/lib/supabase.ts` (`investmentService`, `transactionService`, `settingsService`, `investmentLogService`, `lineUserService`). Backoffice pages sometimes call `supabase` directly for complex queries rather than going through service helpers.

A separate backend at `VITE_BACKEND_URL` handles LINE notifications (verification status changes, broadcast messages).

### Auth
Client-side only. Credentials are compared against Vite env vars (`VITE_LOGIN_USERNAME`, `VITE_LOGIN_PASSWORD`, `VITE_LOGIN_USERNAME_2`, `VITE_LOGIN_PASSWORD_2`). Session state stored in `localStorage` (`isAuthenticated` for regular user, `isAdminAuthenticated` for backoffice).

### Database (Supabase/PostgreSQL)
Key tables: `investments`, `transactions`, `settings`, `investment_logs`, `line_users`, `products`, `product_sets`, `set_items`, `preorder_logs`, `gifts`, `config`. Schema SQL is in `database/` and `README.md`.

## Code Conventions

- **Svelte 5 runes**: Backoffice pages use `$state()`, `$props()`, `$derived()`. The main `+page.svelte` uses older-style `let` variables.
- **TypeScript interfaces** are defined locally within each `.svelte` file's `<script>` block — no shared types file.
- **Tailwind CSS only** — no CSS modules or SCSS.
- **Prettier**: tabs, single quotes, no trailing commas, 100-char print width. Plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`.
- **Single-file components**: All logic, template, and styles are co-located in `.svelte` files.
- **Image uploads**: Some pages upload to Supabase Storage (products, sets, gifts).
