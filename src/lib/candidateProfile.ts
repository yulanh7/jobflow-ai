// Loads the studio owner's personal profile. Kept out of the public repo:
// production reads CANDIDATE_PROFILE, local dev falls back to the skill file.

import fs from "fs";
import path from "path";

let cached: string | null = null;

export function getCandidateProfile(): string {
  if (cached !== null) return cached;

  if (process.env.CANDIDATE_PROFILE) {
    cached = process.env.CANDIDATE_PROFILE;
    return cached;
  }

  try {
    cached = fs.readFileSync(
      path.join(process.cwd(), ".claude/skills/my-profile/SKILL.md"),
      "utf-8"
    );
  } catch {
    console.warn("Candidate profile not found: set CANDIDATE_PROFILE for studio requests");
    cached = "";
  }
  return cached;
}
