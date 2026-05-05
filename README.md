JobFlow AI (Canberra Professional Edition)
An AI-driven career portal designed for tech professionals and government contractors in Canberra. This project showcases high-end UI/UX, AI agent integration, and modern web engineering standards.

🌟 Key Features
AI Career Concierge: An interactive AI assistant for tech stack deep-dives.

Alignment Analytics: Private dashboard for real-time Job Description (JD) matching.

Premium Visuals: Apple/Linear-inspired aesthetics with Glassmorphism and Framer Motion.

🛠 Tech Stack
Framework: Next.js 15 (App Router)

Styling: Tailwind CSS, Shadcn UI

Animation: Framer Motion

Deployment: Vercel (Edge Network)

🤖 AI-Powered Workflow
To maintain high-velocity development and context accuracy, this project uses a custom context-merging script.

1. Synchronize Context
Generate a full-code snapshot for AI assistants:

Bash
node merge-code.js
This command bundles the /src directory into all_code.txt to bypass AI context window limitations.

2. Strategic Collaboration
We use Gemini as the Strategic Architect and Claude Code for CLI execution.

Prompting Standard: Always provide the latest all_code.txt to the AI to ensure consistent implementation.

🚀 Getting Started
First, install dependencies:

Bash
npm install
Then, run the development server:

Bash
npm run dev
Open http://localhost:3000 to view the local build.

📜 Professional Standards
Conventional Commits: Strictly following feat:, style:, refactor:, etc.

Bilingual Logic: Strategic communication in Chinese; professional English for codebase and UI.