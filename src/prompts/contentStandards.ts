// Generic writing rules shared by every resume / cover letter prompt.
// Mirrors .claude/skills/content-standards/SKILL.md, bundled with the app so it ships to production.

export const CONTENT_STANDARDS = `# Universal Technical Recruitment Rules (Australia)

## 1. WRITING PRINCIPLES & TONE

- **Direct & Human:** Professional, understated tone. No corporate-speak.
- **Active Voice:** Start every bullet with simple action verbs (built, created, developed, wrote, designed, deployed, integrated, reduced, shipped).
- **Zero Fluff:** Every sentence must contain a fact, a technology, or a number.
- **Banned Words:**
  - _Generic:_ ensure, crucial, vital, leverage, seamless, seamlessly, comprehensive, robust, innovative, cutting-edge, dynamic, synergy, paradigm, transform, facilitate, enhance, drive, deliver, solutions, navigate, journey, elevate, optimize, keen, extensive, versatility, progressive, esteemed, effectively, impactful, intricate, spearheaded, adept
  - _Phrases:_ proficient in, solid foundation, strong foundation, specializing, strongly aligns, well-suited, coupled with, furthermore, excited by the prospect, proven ability
  - _Fillers:_ passionate, deeply, resonates, particularly appealing, I believe, I am confident, confident in my ability, contribute positively, collaborate effectively, moreover
  - _Clichés:_ I am writing to express my interest, I am pleased to apply, look no further, dive into, delve, tapestry, embark, unleash, unlock, game changer, available for an interview at your earliest convenience, I would be a great fit, I believe I am, I possess the technical foundation, eager to apply my skills, eager to bring, this role is particularly appealing, I am eager to, prospect of supporting, it is with great, very compelling, particularly appeals, eager to apply

## 2. RESUME RULES

- **Length:** Strictly ONE page
- **Summary:** 2-3 sentences. [Title] + [X years exp] + [Key Tech] + [Work Rights]
- **Bullets:** 10-15 words ideal, 20 max. Implicit first person ("Built X" not "I built X")
- **Numbers:** Only use defendable metrics. Never invent data.
- **Data Integrity:** NEVER add skills, technologies, or experience from the JD that are not in the candidate's actual work history. Skills section must only list tools the candidate has genuinely used. Do not infer or extrapolate.
- **Skills Format:** Use \`·\` to separate items within each category (e.g. \`React · Next.js · TypeScript\`)
- **Structure variety:** Mix sentence types, do not repeat the same pattern across bullets
- **Keywords:** Include naturally in summary and skills for ATS

## 3. COVER LETTER RULES

- **Length:** 300-350 words. Never exceed 400.
- **Opening:** "Dear [Name]," if the JD names the hiring manager, otherwise "Dear Hiring Manager,"
- **Closing:** Use the candidate's specified sign-off
- **Structure:**
  - **Para 1:** Role title + years of experience + work rights statement
  - **Para 2 (The Bridge):** ONE technical challenge from the JD. Show evidence of solving a similar problem using 2+ numbers from the resume.
  - **Para 3 (The Context):** Specific reason for choosing this company. Use the \`companyBackground\` field if provided. If not provided, extract specific details from the JD itself (mission, product, team, values). Do not invent or generalise — every sentence must be grounded in provided information.
  - **Para 4 (The Close):** If there is an employment gap in the candidate's work history, explain it in 1–2 sentences with specific project details — not vague phrases like "career break" or "personal development". Only use details stated in the Candidate Profile or Extra Context; if none are provided, do not mention the gap. Then close with an active statement naming what you bring to this specific role, followed by a direct invitation. Do not use: "I look forward to the opportunity", "I am confident in my ability", "I am available for an interview at your earliest convenience".
- **No bullet points** in cover letter — prose paragraphs only
- **Do not repeat the resume** — add context, motivation, evidence

## 4. SKILL GAP STRATEGY

- **Strong match:** Use production experience directly
- **Sibling skill** (same category, different tool): Bridge with "My experience with [Y] transfers directly to [X]"
- **Adjacent skill** (overlapping concepts): Build a 24-hour demo and present it as a personal project — never as professional experience
- **Too far:** Flag as critical gap, recommend skipping application if core skill >60% of role

## 5. WORK RIGHTS & CLEARANCE

- Always state work rights explicitly in resume summary and cover letter Para 1
- **CRITICAL:** Never imply immediate security clearance grant. Use: "I hold full working rights and am willing to undergo the necessary background checks for the role."`;
