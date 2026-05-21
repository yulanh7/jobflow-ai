# JobFlow AI

## Project Overview

AI-powered career alignment tool for the Canberra job market.

## Tech Stack

- Next.js (latest), TypeScript strict mode, Tailwind CSS, Shadcn UI
- Gemini API — all AI calls go through `/api/` routes
- Framer Motion, `docx` + `mammoth`, `pdf-parse`
- **Never use `pdfjs-dist`** — Vercel incompatible

## Commands

```bash
npm run dev
npm run build
npm run lint
node merge-code.js  # bundles /src into all_code.txt
```

## Code Standards

- English only — no Chinese in comments, variable names, or commits
- No `any` types
- Named exports for components
- All AI calls go through `/api/` routes, never directly from frontend
- `className` for static styles (Tailwind), `style` only for dynamic values

## Color System

Use CSS variables from `globals.css` only, never hardcode color values.
Tailwind `zinc-*` is remapped in `globals.css` — don't assume standard values.

## API Rules

- Never log API keys
- Always handle Gemini 429 errors
- Consistent error format: `{ error: "message" }`

## Cover Letter Constraints

300–350 words, opens "Dear Hiring Manager", closes "Yours sincerely".
`BANNED_WORDS` enforced on resume and cover letter output.

## Commit Convention

`feat:` `fix:` `chore:` `style:` `refactor:` — one commit per feature.
Example: `feat(api): add resume parser supporting PDF and DOCX`
