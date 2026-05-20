# JobFlow AI – Project Rules

## Project Overview
AI-powered career alignment tool built for the Canberra job market.
Two routes: / (public) and /studio (private, password protected).

## Tech Stack
- Next.js 15, TypeScript, Tailwind CSS, Shadcn UI
- Gemini API (gemini-2.5-flash-lite)
- Framer Motion for animations
- docx + mammoth for document handling
- pdf-parse for PDF parsing (NOT pdfjs-dist — Vercel incompatible)

## Code Standards
- All code comments, variable names, commit messages in English
- No Chinese comments in code
- TypeScript strict mode
- Prettier for formatting

## Commit Convention
- Conventional Commits: feat:, fix:, chore:, style:, refactor:
- One commit per complete feature
- Example: feat(api): add resume parser supporting PDF and DOCX

## Color System (globals.css)
- Always use CSS variables from globals.css
- Never hardcode colors that already exist as variables
- --brand-red: #cc2936
- --highlight: #ffb6b9
- Body background: #f8fafc (light base, main overlay creates dark effect)

## API Rules
- Never log API keys even partially
- Always handle 429 errors from Gemini
- All API routes must have proper error handling
- Return consistent error format: { error: "message" }

## Visual System
- FloatingGeometry: position absolute inside main, NOT fixed
- GlassConsole: accepts style prop, do not hardcode background
- Custom cursor: red ring default, white dot on hover over buttons
- Section accents: Analysis #cc2936, Skill Gap #ffb6b9, Documents #607d8b, Employer #e07c54

## Important Architecture
- /studio route is password protected via STUDIO_PASSWORD env variable
- Resume parsing: pdf-parse for PDF, mammoth for DOCX
- All AI calls go through /api/ routes, never from frontend directly
- Gemini model: gemini-2.5-flash-lite
