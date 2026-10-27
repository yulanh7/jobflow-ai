// Single source of truth for citizenship / clearance wording in generated documents

const WORK_RIGHTS_SENTENCE = "I hold full Australian working rights.";
const CHECKS_SENTENCE =
  "I am willing to undergo all necessary background and suitability checks required for this position.";

export function buildQualificationRules(confirmed: string[] | undefined): string {
  const list = confirmed && confirmed.length > 0 ? confirmed : [];
  return `# Confirmed Qualifications (CRITICAL — runtime data, overrides defaults)
CONFIRMED QUALIFICATIONS: ${list.length > 0 ? list.join(", ") : "NONE"}
1. CITIZENSHIP: If "Australian Citizen" is NOT in the confirmed list, never mention citizenship. Use: "${WORK_RIGHTS_SENTENCE}"
2. SECURITY CLEARANCE: If a clearance is NOT in the confirmed list, never claim it.
   - Citizenship confirmed → "I am an Australian citizen and am ready to undergo the [clearance level] vetting process upon sponsorship."
   - Citizenship NOT confirmed → "${CHECKS_SENTENCE}"
3. Never infer PR, citizenship, or clearance from the resume.${
    list.length > 0
      ? "\n4. Confirmed qualifications MUST appear in the Skills section and be mentioned naturally in the cover letter."
      : ""
  }`;
}
