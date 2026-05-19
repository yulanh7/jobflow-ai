"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { AmbientGlow } from "@/components/visual/AmbientGlow";
import { FloatingGeometry } from "@/components/visual/FloatingGeometry";
import { GlassConsole } from "@/components/ui/GlassConsole";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Upload,
  FileText,
  Loader2,
  X,
  ClipboardCopy,
  Check,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";

interface SkillGap {
  skill: string;
  reason: string;
  category: "interview_ready" | "quick_win" | "long_term";
  timeEstimate: string;
  interviewTip: string;
  quickWinPlan?: string;
  longTermPartA?: string;
  longTermPartB?: string;
}

interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  skillGaps?: SkillGap[];
}

interface LearningResource {
  type: "video" | "docs" | "book" | "course" | "article";
  title: string;
  url: string;
}

interface LearningStep {
  day: string;
  task: string;
  resources: LearningResource[];
  aiPrompt: string;
}

interface SkillPlan {
  skill: string;
  totalTime: string;
  steps: LearningStep[];
  demoProject: string;
  resumeBullet: string;
}

interface LearningPlanResult {
  plans: SkillPlan[];
}

interface ValidationResult {
  passed: string[];
  warnings: string[];
}

const BANNED_WORDS = [
  "ensure",
  "crucial",
  "vital",
  "leverage",
  "seamless",
  "seamlessly",
  "comprehensive",
  "robust",
  "innovative",
  "cutting-edge",
  "dynamic",
  "synergy",
  "paradigm",
  "transform",
  "facilitate",
  "enhance",
  "drive",
  "solutions",
  "navigate",
  "journey",
  "elevate",
  "keen",
  "extensive",
  "furthermore",
  "coupled with",
  "well-suited",
  "strongly aligns",
  "excited by the prospect",
  "esteemed",
  "progressive",
  "versatility",
];

function validateResume(text: string): ValidationResult {
  const passed: string[] = [];
  const warnings: string[] = [];

  const foundBanned = BANNED_WORDS.filter((word) =>
    text.toLowerCase().includes(word.toLowerCase())
  );
  if (foundBanned.length === 0) {
    passed.push("No banned words detected");
  } else {
    warnings.push(`Banned words found: ${foundBanned.join(", ")}`);
  }

  const iStatements = text.match(/^I\s/gm);
  if (!iStatements) {
    passed.push("No first-person statements");
  } else {
    warnings.push(`${iStatements.length} first-person statement(s) found`);
  }

  const bullets = text
    .split("\n")
    .filter((line) => line.trim().startsWith("-"));
  const longBullets = bullets.filter((b) => b.trim().split(" ").length > 20);
  if (longBullets.length === 0) {
    passed.push("All bullets within 20 words");
  } else {
    warnings.push(`${longBullets.length} bullet(s) exceed 20 words`);
  }

  return { passed, warnings };
}

function validateCoverLetter(text: string): ValidationResult {
  const passed: string[] = [];
  const warnings: string[] = [];

  const foundBanned = BANNED_WORDS.filter((word) =>
    text.toLowerCase().includes(word.toLowerCase())
  );
  if (foundBanned.length === 0) {
    passed.push("No banned words detected");
  } else {
    warnings.push(`Banned words found: ${foundBanned.join(", ")}`);
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount >= 300 && wordCount <= 350) {
    passed.push(`Word count: ${wordCount} words (within 300-350)`);
  } else if (wordCount < 300) {
    warnings.push(`Word count: ${wordCount} words (too short, need 300+)`);
  } else {
    warnings.push(`Word count: ${wordCount} words (too long, max 350)`);
  }

  if (text.includes("Dear Hiring Manager")) {
    passed.push("Has proper salutation");
  } else {
    warnings.push("Missing 'Dear Hiring Manager' salutation");
  }

  if (text.includes("Yours sincerely")) {
    passed.push("Has proper closing");
  } else {
    warnings.push("Missing 'Yours sincerely' closing");
  }

  return { passed, warnings };
}

const RESOURCE_EMOJI: Record<string, string> = {
  video: "🎬",
  docs: "📄",
  book: "📚",
  course: "🎓",
  article: "📰",
};

const staggerList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.4 } },
};

const staggerListLate: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.55 } },
};

const staggerListVeryLate: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.7 } },
};

const listItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const skillGapCard: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

function isQualificationGap(text: string): boolean {
  const keywords = [
    "clearance",
    "citizenship",
    "security clearance",
    "permanent resident",
    "working rights",
    "police check",
    "nv1",
    "nv2",
    "baseline clearance",
  ];
  return keywords.some((k) => text.toLowerCase().includes(k));
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1");
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#cc2936";
  if (score >= 60) return "#e07c54";
  if (score >= 40) return "#ffb6b9";
  return "#94a3b8";
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "#cc2936";
  if (score >= 60) return "#e07c54";
  if (score >= 40) return "#ffb6b9";
  return "rgba(148,163,184,0.4)";
}

// ── Lock screen ──────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(false);
    try {
      const res = await fetch("/api/studio-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        onUnlock();
      } else {
        setError(true);
        setPassword("");
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <main
        className="relative min-h-screen flex flex-col items-center justify-center overflow-x-hidden font-[family-name:var(--font-geist-sans)] px-6"
        style={{ position: "relative", zIndex: 1, background: "transparent" }}
      >
        <AmbientGlow />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-sm"
        >
          <GlassConsole className="p-10 text-center">
            <h1 className="text-2xl font-bold mb-2">Studio // Private</h1>
            <p className="text-zinc-500 text-sm mb-8">
              This tool is for internal use only
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              {error && (
                <p className="text-red-400 text-xs">Incorrect password</p>
              )}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!password || checking}
                className="w-full py-4 rounded-xl text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "#cc2936",
                  boxShadow: "0 0 24px rgba(204, 41, 54, 0.35)",
                }}
              >
                {checking ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Checking...
                  </span>
                ) : (
                  "Enter"
                )}
              </motion.button>
            </form>
          </GlassConsole>
        </motion.div>
      </main>
    </>
  );
}

// ── Studio app ────────────────────────────────────────────────────────────────

function StudioApp({ onLock }: { onLock: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success">(
    "idle"
  );
  const [resumeText, setResumeText] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedGaps, setSelectedGaps] = useState<string[]>([]);
  const [learningPlan, setLearningPlan] = useState<LearningPlanResult | null>(
    null
  );
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [copiedBullet, setCopiedBullet] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<string[]>([]);
  const [candidateName, setCandidateName] = useState("");
  const [docxParagraphCount, setDocxParagraphCount] = useState<number | null>(null);
  const [extraContext, setExtraContext] = useState("");
  const [companyBackground, setCompanyBackground] = useState("");
  const [generateResume, setGenerateResume] = useState(true);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [documents, setDocuments] = useState<{
    resume: string | null;
    coverLetter: string | null;
  } | null>(null);
  const [copiedDoc, setCopiedDoc] = useState<"resume" | "coverLetter" | null>(
    null
  );
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [confirmedQualifications, setConfirmedQualifications] = useState<
    string[]
  >([]);
  const [feedback, setFeedback] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [validation, setValidation] = useState<{
    resume: ValidationResult | null;
    coverLetter: ValidationResult | null;
  } | null>(null);
  const [employerQuestions, setEmployerQuestions] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<
    { question: string; answer: string }[] | null
  >(null);
  const [generatingAnswers, setGeneratingAnswers] = useState(false);
  const [rewritingDocs, setRewritingDocs] = useState(false);
  const [rewrittenDocs, setRewrittenDocs] = useState<{
    resume: string | null;
    coverLetter: string | null;
  } | null>(null);
  const [rewriteValidation, setRewriteValidation] = useState<{
    resume: ValidationResult | null;
    coverLetter: ValidationResult | null;
  } | null>(null);
  const [rewriteResume, setRewriteResume] = useState(true);
  const [rewriteCoverLetter, setRewriteCoverLetter] = useState(true);
  const [copiedRewrite, setCopiedRewrite] = useState<
    "resume" | "coverLetter" | null
  >(null);
  const [downloadingRewrite, setDownloadingRewrite] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("section-analysis");
  const [navY, setNavY] = useState<number>(100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSection(id: string) {
    setCollapsedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setResumeFile(selectedFile);
    setFile(selectedFile);
    setStatus("uploading");
    setAnalysis(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        console.error("Parse error:", data.error);
        setStatus("idle");
        return;
      }

      setResumeText(data.text);
      setDocxParagraphCount(data.paragraphCount ?? null);
      setStatus("success");
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("idle");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResumeFile(null);
    setStatus("idle");
    setResumeText("");
    setJobDescription("");
    setAnalysis(null);
    setSelectedGaps([]);
    setLearningPlan(null);
    setGeneratingPlan(false);
    setExpandedPlans([]);
    setExtraContext("");
    setCompanyBackground("");
    setGenerateResume(true);
    setGenerateCoverLetter(true);
    setDocuments(null);
    setGeneratingDocs(false);
    setDownloadingResume(false);
    setConfirmedQualifications([]);
    setFeedback("");
    setIsRegenerating(false);
    setValidation(null);
    setEmployerQuestions("");
    setQuestionAnswers(null);
    setGeneratingAnswers(false);
    setRewrittenDocs(null);
    setRewriteValidation(null);
    setRewritingDocs(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!resumeText || !jobDescription) return;
    setAnalyzing(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "AI is busy, please try again in a moment.");
        return;
      }

      setAnalysis(data);
    } catch (err) {
      console.error("Analysis failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleGap = (skill: string) => {
    setSelectedGaps((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleGeneratePlan = async () => {
    if (selectedGaps.length === 0) return;
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/learning-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: selectedGaps, jobDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(
          data.error || "Failed to generate learning plan. Please try again."
        );
        return;
      }
      setLearningPlan(data);
      if (data.plans?.[0]?.skill) setExpandedPlans([data.plans[0].skill]);
    } catch (err) {
      console.error("Learning plan generation failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleDownloadPlan = () => {
    if (!learningPlan) return;

    const lines: string[] = [];
    lines.push("# Skill Gap Learning Plan");
    lines.push(
      `Generated by JobFlow AI — ${new Date().toLocaleDateString("en-AU")}`
    );
    lines.push("");

    learningPlan.plans.forEach((plan) => {
      lines.push(`## ${plan.skill}`);
      lines.push(`**Estimated time:** ${plan.totalTime}`);
      lines.push("");
      lines.push("### Study Steps");
      plan.steps.forEach((step) => {
        lines.push(`- **${step.day}:** ${step.task}`);
      });
      lines.push("");
      lines.push("### Demo Project");
      lines.push(plan.demoProject);
      lines.push("");
      lines.push("### Resume Bullet");
      lines.push(`> ${plan.resumeBullet}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learning-plan.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPrompt = async (prompt: string, key: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(key);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const handleGenerateDocs = async () => {
    if (!generateResume && !generateCoverLetter) return;
    setGeneratingDocs(true);
    try {
      const res = await fetch("/api/generate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          extraContext,
          companyBackground,
          generateResume,
          generateCoverLetter,
          confirmedQualifications,
          candidateName,
          paragraphCount: docxParagraphCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate documents. Please try again.");
        return;
      }
      setDocuments(data);
      setValidation({
        resume: data.resume ? validateResume(data.resume) : null,
        coverLetter: data.coverLetter
          ? validateCoverLetter(data.coverLetter)
          : null,
      });
    } catch (err) {
      console.error("Document generation failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setGeneratingDocs(false);
    }
  };

  const handleCopyDoc = async (text: string, key: "resume" | "coverLetter") => {
    await navigator.clipboard.writeText(text);
    setCopiedDoc(key);
    setTimeout(() => setCopiedDoc(null), 2000);
  };

  const handleDownloadResume = async () => {
    if (!documents?.resume || !resumeFile) return;
    setDownloadingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      formData.append("content", documents.resume);

      const res = await fetch("/api/generate-resume-docx", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        alert("Failed to generate formatted resume. Please try again.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume-tailored.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Resume download failed:", err);
      alert("Download failed. Please try again.");
    } finally {
      setDownloadingResume(false);
    }
  };

  const handleDownloadCoverLetter = async () => {
    if (!documents?.coverLetter) return;

    const paragraphs = documents.coverLetter.split("\n").map((line: string) => {
      const isEmpty = line.trim() === "";
      const isSignOff = /^(Yours sincerely|Kind regards)/i.test(line.trim());
      return new Paragraph({
        children: isEmpty ? [] : [new TextRun({ text: line, size: 24, font: "Calibri" })],
        spacing: { after: isEmpty ? 0 : isSignOff ? 480 : 200 },
      });
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "cover-letter.docx");
  };

  const togglePlan = (skill: string) => {
    setExpandedPlans((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleCopyBullet = async (bullet: string, skill: string) => {
    await navigator.clipboard.writeText(bullet);
    setCopiedBullet(skill);
    setTimeout(() => setCopiedBullet(null), 2000);
  };

  const handleGenerateAnswers = async () => {
    if (!employerQuestions.trim()) return;
    setGeneratingAnswers(true);
    try {
      const res = await fetch("/api/answer-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: employerQuestions,
          resumeText,
          jobDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate answers. Please try again.");
        return;
      }
      setQuestionAnswers(data.answers);
    } catch (err) {
      console.error("Answer questions failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setGeneratingAnswers(false);
    }
  };

  const handleCopyAnswers = async () => {
    if (!questionAnswers) return;
    const text = questionAnswers
      .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
  };

  const handleRewriteDocs = async () => {
    if (!analysis?.skillGaps || selectedGaps.length === 0) return;
    setRewritingDocs(true);
    try {
      const selectedGapDetails = analysis.skillGaps.filter((g) =>
        selectedGaps.includes(g.skill)
      );
      const res = await fetch("/api/rewrite-with-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          selectedGaps: selectedGapDetails,
          candidateName,
          confirmedQualifications,
          paragraphCount: docxParagraphCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to rewrite documents. Please try again.");
        return;
      }
      setRewrittenDocs(data);
      setRewriteValidation({
        resume: data.resume ? validateResume(data.resume) : null,
        coverLetter: data.coverLetter
          ? validateCoverLetter(data.coverLetter)
          : null,
      });
    } catch (err) {
      console.error("Rewrite failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setRewritingDocs(false);
    }
  };

  const handleCopyRewrite = async (
    text: string,
    key: "resume" | "coverLetter"
  ) => {
    await navigator.clipboard.writeText(text);
    setCopiedRewrite(key);
    setTimeout(() => setCopiedRewrite(null), 2000);
  };

  const handleDownloadRewrittenResume = async () => {
    if (!rewrittenDocs?.resume || !resumeFile) return;
    setDownloadingRewrite(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      formData.append("content", rewrittenDocs.resume);

      const res = await fetch("/api/generate-resume-docx", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        alert("Failed to generate formatted resume. Please try again.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume-rewritten.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Rewritten resume download failed:", err);
      alert("Download failed. Please try again.");
    } finally {
      setDownloadingRewrite(false);
    }
  };

  const handleDownloadRewrittenCoverLetter = async () => {
    if (!rewrittenDocs?.coverLetter) return;

    const paragraphs = rewrittenDocs.coverLetter.split("\n").map((line: string) => {
      const isEmpty = line.trim() === "";
      const isSignOff = /^(Yours sincerely|Kind regards)/i.test(line.trim());
      return new Paragraph({
        children: isEmpty ? [] : [new TextRun({ text: line, size: 24, font: "Calibri" })],
        spacing: { after: isEmpty ? 0 : isSignOff ? 480 : 200 },
      });
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "cover-letter-rewritten.docx");
  };

  const handleRegenerate = async () => {
    if (!feedback || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/generate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          extraContext,
          companyBackground,
          generateResume: !!documents?.resume,
          generateCoverLetter: !!documents?.coverLetter,
          confirmedQualifications,
          feedback,
          previousResume: documents?.resume,
          previousCoverLetter: documents?.coverLetter,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to regenerate. Please try again.");
        return;
      }
      setDocuments(data);
      setFeedback("");
      setValidation({
        resume: data.resume ? validateResume(data.resume) : null,
        coverLetter: data.coverLetter
          ? validateCoverLetter(data.coverLetter)
          : null,
      });
    } catch (err) {
      console.error("Regeneration failed:", err);
      alert("Check your connection and try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopySuggestions = async () => {
    if (!analysis?.suggestions) return;
    const text = analysis.suggestions
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (analysis) setCollapsedSections([]);
  }, [analysis]);

  useEffect(() => {
    if (confirmedQualifications.length > 0) {
      setGenerateResume(true);
      setGenerateCoverLetter(true);
    }
  }, [confirmedQualifications]);

  useEffect(() => {
    const sectionIds = [
      "section-analysis",
      "section-skillgap",
      "section-documents",
      "section-employer",
    ];

    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
              // Align nav to the top of the active section, clamped within safe viewport bounds
              const rect = el.getBoundingClientRect();
              const targetY = Math.max(80, Math.min(rect.top + 20, window.innerHeight - 200));
              setNavY(targetY);
            }
          });
        },
        {
          // Highlight when a section's top edge enters the middle band of the viewport
          rootMargin: "-10% 0px -90% 0px",
          threshold: 0,
        }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [analysis, collapsedSections]);

  // ── Nav items ──────────────────────────────────────────────────────────────

  const NAV_ITEMS = [
    { id: "section-analysis", label: "Analysis", color: "#cc2936" },
    { id: "section-skillgap", label: "Skill Gap", color: "#ffb6b9" },
    { id: "section-documents", label: "Documents", color: "#607d8b" },
    { id: "section-employer", label: "Employer Q&A", color: "#e07c54" },
  ];

  // ── Reusable section header ────────────────────────────────────────────────

  function SectionHeader({
    id,
    label,
    color,
  }: {
    id: string;
    label: string;
    color: string;
  }) {
    const isCollapsed = collapsedSections.includes(id);
    return (
      <div
        onClick={() => toggleSection(id)}
        className="cursor-pointer flex items-center justify-between py-4 px-6 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: color }}
          />
          <span className="text-sm font-medium text-zinc-200">{label}</span>
        </div>
        {isCollapsed ? (
          <ChevronDown size={14} className="text-zinc-600" />
        ) : (
          <ChevronUp size={14} className="text-zinc-600" />
        )}
      </div>
    );
  }

  return (
    <>
      <main
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)",
          position: "relative",
        }}
      >
        <AmbientGlow />
        <FloatingGeometry />

        {/* Studio label + lock button */}
        <div className="fixed top-4 left-4 z-50 flex items-center gap-3">
          <span className="text-xs text-zinc-600">Studio // Private</span>
          <button
            onClick={onLock}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Lock"
          >
            <Lock size={11} />
            Lock
          </button>
        </div>

        {/* Left floating nav - desktop only */}
        <nav
          className="hidden lg:flex fixed left-[max(1.5rem,calc(50%-42rem))] z-40 flex-col gap-4 bg-zinc-900/60 backdrop-blur-sm border border-white/5 rounded-xl px-3 py-4"
          style={{
            top: navY,
            transition: "top 0.4s ease",
          }}
        >
          {NAV_ITEMS.filter(
            (item) => item.id === "section-analysis" || !!analysis
          ).map((item) => (
            <button
              key={item.id}
              onClick={() =>
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="flex items-center gap-2 group"
            >
              <div
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={
                  activeSection === item.id
                    ? {
                        background: "#cc2936",
                        boxShadow: "0 0 8px rgba(204, 41, 54, 0.6)",
                      }
                    : { background: "rgba(255, 255, 255, 0.2)" }
                }
              />
              <span
                className={`text-xs transition-colors ${
                  activeSection === item.id
                    ? "text-zinc-200"
                    : "text-zinc-600 group-hover:text-zinc-400"
                }`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div
              style={{
                width: "100%",
                padding: "3rem 0 2.5rem",
                position: "relative",
              }}
            >
              <h1
                style={{
                  fontSize: "clamp(3rem, 8vw, 6rem)",
                  fontWeight: 900,
                  lineHeight: 1.05,
                  margin: "0 0 0.75rem",
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #ffb6b9 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                JobFlow AI
              </h1>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#cbd5e1",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Canberra Professional Edition // 2026
              </p>
            </div>
          </motion.div>

          {/* ── Section 1: Analysis ── */}
          <section id="section-analysis" className="mb-4">
            <GlassConsole
              style={{ borderLeft: "2px solid var(--accent-analysis)" }}
            >
              <SectionHeader
                id="section-analysis"
                label="Analysis"
                color="#cc2936"
              />
              <AnimatePresence initial={false}>
                {!collapsedSections.includes("section-analysis") && (
                  <motion.div
                    key="analysis-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/5" />
                    <div className="grid grid-cols-[35%_1px_1fr]">
                      {/* Left: INPUT */}
                      <div className="p-6 text-center">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                        />

                        <AnimatePresence mode="wait">
                          {status === "idle" && (
                            <motion.button
                              key="idle-btn"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                scale: [1, 1.03, 1],
                              }}
                              transition={{
                                opacity: { duration: 0.3 },
                                y: { duration: 0.3 },
                                scale: {
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                },
                              }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => fileInputRef.current?.click()}
                              style={{
                                background:
                                  "linear-gradient(135deg, rgba(255, 182, 185, 0.9), rgba(204, 41, 54, 0.8))",
                                color: "white",
                                padding: "20px 30px",
                                borderRadius: "15px",
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                backdropFilter: "blur(10px)",
                                boxShadow: "0 15px 35px rgba(0, 0, 0, 0.2)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              <Upload size={18} />
                              Upload Your Resume
                            </motion.button>
                          )}

                          {status === "uploading" && (
                            <motion.div
                              key="uploading-state"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col items-center gap-3"
                            >
                              <Loader2
                                className="animate-spin text-indigo-500"
                                size={32}
                              />
                              <span className="text-zinc-400 text-sm animate-pulse">
                                Reading Resume Data...
                              </span>
                            </motion.div>
                          )}

                          {status === "success" && (
                            <motion.div
                              key="success-state"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex flex-col items-center w-full"
                            >
                              <div className="flex items-center gap-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-full mb-5">
                                <FileText
                                  className="text-indigo-400 shrink-0"
                                  size={22}
                                />
                                <div className="text-left overflow-hidden flex-1">
                                  <p className="text-sm font-medium truncate">
                                    {file?.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                    Ready for Analysis
                                  </p>
                                </div>
                                <button
                                  onClick={resetUpload}
                                  className="hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                                  title="Remove file"
                                >
                                  <X size={14} className="text-zinc-500" />
                                </button>
                              </div>

                              <textarea
                                value={jobDescription}
                                onChange={(e) =>
                                  setJobDescription(e.target.value)
                                }
                                placeholder="Paste the Job Description here..."
                                className="w-full h-36 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors mb-4"
                              />

                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleAnalyze}
                                disabled={!jobDescription || analyzing}
                                className="w-full py-4 rounded-xl text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{
                                  background: "#cc2936",
                                  boxShadow: "0 0 24px rgba(204, 41, 54, 0.35)",
                                }}
                              >
                                {analyzing ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                    Analysing...
                                  </span>
                                ) : (
                                  "Start AI Alignment"
                                )}
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="mt-8 flex items-center justify-center gap-2">
                          <div
                            className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                              status === "success"
                                ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
                                : "bg-indigo-500 animate-pulse"
                            }`}
                          />
                          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">
                            {status === "success"
                              ? "Ready to Process"
                              : "System Standby"}
                          </span>
                        </div>
                      </div>

                      {/* Center divider with triangle pointer */}
                      <div
                        style={{
                          position: "relative",
                          background: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: "36px",
                            left: "0px",
                            width: 0,
                            height: 0,
                            borderTop: "8px solid transparent",
                            borderBottom: "8px solid transparent",
                            borderLeft: "10px solid rgba(255,255,255,0.15)",
                          }}
                        />
                      </div>
                      {/* Right: OUTPUT */}
                      <div className="p-6">
                        <AnimatePresence mode="wait">
                          {analysis ? (
                            <motion.div
                              key="report"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              transition={{ duration: 0.3 }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold tracking-tight text-zinc-200">
                                  Alignment Report
                                </h2>
                                <div className="flex items-baseline gap-1">
                                  <span
                                    className="text-5xl font-bold tabular-nums"
                                    style={{
                                      color: getScoreColor(analysis.score),
                                    }}
                                  >
                                    {analysis.score}
                                  </span>
                                  <span className="text-zinc-600 text-sm">
                                    /100
                                  </span>
                                </div>
                              </div>

                              <div className="w-full h-1 bg-white/5 rounded-full mb-7 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${analysis.score}%` }}
                                  transition={{
                                    duration: 1.2,
                                    ease: "easeOut",
                                    delay: 0.4,
                                  }}
                                  className="h-full rounded-full"
                                  style={{
                                    background: getScoreBarColor(
                                      analysis.score
                                    ),
                                  }}
                                />
                              </div>

                              <p className="text-zinc-400 text-sm leading-relaxed mb-8 pb-8 border-b border-white/5">
                                {analysis.summary}
                              </p>

                              <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-white/5">
                                <div>
                                  <h3
                                    className="text-[10px] uppercase tracking-[0.2em] mb-4 font-medium"
                                    style={{ color: "#cc2936" }}
                                  >
                                    Strengths
                                  </h3>
                                  <motion.ul
                                    variants={staggerList}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-3"
                                  >
                                    {analysis.strengths?.map((item, i) => (
                                      <motion.li
                                        key={i}
                                        variants={listItem}
                                        className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                                      >
                                        <span
                                          className="shrink-0 mt-0.5"
                                          style={{ color: "#cc2936" }}
                                        >
                                          +
                                        </span>
                                        {item}
                                      </motion.li>
                                    ))}
                                  </motion.ul>
                                </div>
                                <div>
                                  <h3
                                    className="text-[10px] uppercase tracking-[0.2em] mb-4 font-medium"
                                    style={{ color: "#e07c54" }}
                                  >
                                    Gaps
                                  </h3>
                                  <motion.ul
                                    variants={staggerList}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-3"
                                  >
                                    {analysis.gaps?.map((item, i) =>
                                      isQualificationGap(item) ? (
                                        <motion.li
                                          key={i}
                                          variants={listItem}
                                          className="flex items-start gap-3"
                                        >
                                          <button
                                            role="checkbox"
                                            aria-checked={confirmedQualifications.includes(
                                              item
                                            )}
                                            onClick={() =>
                                              setConfirmedQualifications(
                                                (prev) =>
                                                  prev.includes(item)
                                                    ? prev.filter(
                                                        (q) => q !== item
                                                      )
                                                    : [...prev, item]
                                              )
                                            }
                                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                              confirmedQualifications.includes(
                                                item
                                              )
                                                ? "bg-indigo-600 border-indigo-500"
                                                : "bg-transparent border-white/20 hover:border-white/40"
                                            }`}
                                          >
                                            {confirmedQualifications.includes(
                                              item
                                            ) && (
                                              <Check
                                                size={10}
                                                className="text-white"
                                                strokeWidth={3}
                                              />
                                            )}
                                          </button>
                                          <div>
                                            <span className="text-sm text-zinc-300">
                                              {item}
                                            </span>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                              Tick if you have this — it will be
                                              added to your documents
                                            </p>
                                          </div>
                                        </motion.li>
                                      ) : (
                                        <motion.li
                                          key={i}
                                          variants={listItem}
                                          className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                                        >
                                          <span
                                            className="shrink-0 mt-0.5"
                                            style={{ color: "#e07c54" }}
                                          >
                                            −
                                          </span>
                                          {item}
                                        </motion.li>
                                      )
                                    )}
                                  </motion.ul>
                                </div>
                              </div>

                              <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                  <h3
                                    className="text-[10px] uppercase tracking-[0.2em] font-medium"
                                    style={{ color: "#ffb6b9" }}
                                  >
                                    Suggestions
                                  </h3>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleCopySuggestions}
                                    className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
                                  >
                                    {copied ? (
                                      <>
                                        <Check
                                          size={11}
                                          className="text-green-400"
                                        />
                                        <span className="text-green-400">
                                          Copied
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <ClipboardCopy size={11} />
                                        Copy All
                                      </>
                                    )}
                                  </motion.button>
                                </div>
                                <motion.ul
                                  variants={staggerListLate}
                                  initial="hidden"
                                  animate="visible"
                                  className="space-y-3"
                                >
                                  {analysis.suggestions?.map((item, i) => (
                                    <motion.li
                                      key={i}
                                      variants={listItem}
                                      className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                                    >
                                      <span
                                        className="shrink-0 mt-0.5"
                                        style={{ color: "#ffb6b9" }}
                                      >
                                        →
                                      </span>
                                      {item}
                                    </motion.li>
                                  ))}
                                </motion.ul>
                              </div>

                              <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={resetUpload}
                                className="mt-2 w-full py-3 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 text-sm hover:bg-white/10 hover:text-white transition-all"
                              >
                                <RotateCcw size={13} />
                                Run New Analysis
                              </motion.button>
                            </motion.div>
                          ) : (
                            <motion.p
                              key="empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-zinc-600 text-xs text-center py-12"
                            >
                              Results will appear here
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassConsole>
          </section>

          {/* ── Section 2: Skill Gap Plan ── */}
          {analysis && (
            <section id="section-skillgap" className="mb-4">
              <GlassConsole
                style={{ borderLeft: "2px solid var(--accent-skillgap)" }}
              >
                <SectionHeader
                  id="section-skillgap"
                  label="Skill Gap Plan"
                  color="#ffb6b9"
                />
                <AnimatePresence initial={false}>
                  {!collapsedSections.includes("section-skillgap") && (
                    <motion.div
                      key="skillgap-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5" />
                      <div className="grid grid-cols-[35%_1px_1fr]">
                        {/* Left: INPUT */}
                        <div className="p-6">
                          {(analysis.skillGaps?.filter(
                            (g) => !isQualificationGap(g.skill)
                          ).length ?? 0) > 0 ? (
                            <>
                              <p className="text-xs text-zinc-500 mb-4">
                                Select the skills you want to learn — get a
                                personalised study plan
                              </p>
                              <motion.ul
                                variants={staggerListVeryLate}
                                initial="hidden"
                                animate="visible"
                                className="divide-y divide-white/5 mb-4"
                              >
                                {analysis
                                  .skillGaps!.filter(
                                    (g) => !isQualificationGap(g.skill)
                                  )
                                  .map((gap, i) => {
                                    const checked = selectedGaps.includes(
                                      gap.skill
                                    );
                                    return (
                                      <motion.li
                                        key={i}
                                        variants={skillGapCard}
                                        className="flex items-start gap-3 py-3"
                                      >
                                        <button
                                          role="checkbox"
                                          aria-checked={checked}
                                          onClick={() => toggleGap(gap.skill)}
                                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                            checked
                                              ? "bg-indigo-600 border-indigo-500"
                                              : "bg-transparent border-white/20 hover:border-white/40"
                                          }`}
                                        >
                                          {checked && (
                                            <Check
                                              size={10}
                                              className="text-white"
                                              strokeWidth={3}
                                            />
                                          )}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <span className="text-sm text-zinc-200 font-medium">
                                              {gap.skill}
                                            </span>
                                            <span className="text-xs text-amber-400/70">
                                              {gap.timeEstimate}
                                            </span>
                                            {gap.category && (
                                              <span
                                                className={`text-[10px] border rounded px-1.5 py-0.5 ${
                                                  gap.category ===
                                                  "interview_ready"
                                                    ? "text-sky-400 border-sky-400/30"
                                                    : gap.category ===
                                                        "quick_win"
                                                      ? "text-emerald-400 border-emerald-400/30"
                                                      : "text-rose-400 border-rose-400/30"
                                                }`}
                                              >
                                                {gap.category ===
                                                "interview_ready"
                                                  ? "Interview ready"
                                                  : gap.category === "quick_win"
                                                    ? "Quick win"
                                                    : "Long term"}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-zinc-600 leading-relaxed">
                                            {gap.reason}
                                          </p>
                                        </div>
                                      </motion.li>
                                    );
                                  })}
                              </motion.ul>
                              <motion.button
                                whileHover={{
                                  scale: selectedGaps.length > 0 ? 1.01 : 1,
                                }}
                                whileTap={{
                                  scale: selectedGaps.length > 0 ? 0.98 : 1,
                                }}
                                onClick={handleGeneratePlan}
                                disabled={
                                  selectedGaps.length === 0 || generatingPlan
                                }
                                className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                                style={{
                                  background: "#cc2936",
                                  color: "white",
                                  border: "none",
                                }}
                              >
                                {generatingPlan ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />
                                    Generating...
                                  </span>
                                ) : (
                                  "Generate Learning Plan"
                                )}
                              </motion.button>

                              {selectedGaps.length > 0 && (
                                <div className="border-t border-white/5 mt-4 pt-4">
                                  <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">
                                    Rewrite with Selected Skills
                                  </p>
                                  <p className="text-xs text-zinc-500 mb-3">
                                    Incorporates selected skill gaps into resume
                                    and cover letter
                                  </p>
                                  <div className="flex flex-col gap-3 mb-3">
                                    {(
                                      [
                                        {
                                          checked: rewriteResume,
                                          toggle: () =>
                                            setRewriteResume((v) => !v),
                                          label: "Rewrite resume",
                                        },
                                        {
                                          checked: rewriteCoverLetter,
                                          toggle: () =>
                                            setRewriteCoverLetter((v) => !v),
                                          label: "Rewrite cover letter",
                                        },
                                      ] as const
                                    ).map(({ checked, toggle, label }) => (
                                      <label
                                        key={label}
                                        className="flex items-center gap-3 cursor-pointer"
                                      >
                                        <button
                                          role="checkbox"
                                          aria-checked={checked}
                                          onClick={toggle}
                                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                            checked
                                              ? "bg-indigo-600 border-indigo-500"
                                              : "bg-transparent border-white/20 hover:border-white/40"
                                          }`}
                                        >
                                          {checked && (
                                            <Check
                                              size={10}
                                              className="text-white"
                                              strokeWidth={3}
                                            />
                                          )}
                                        </button>
                                        <span className="text-sm text-zinc-300">
                                          {label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  <motion.button
                                    whileHover={{
                                      scale:
                                        !rewriteResume && !rewriteCoverLetter
                                          ? 1
                                          : 1.01,
                                    }}
                                    whileTap={{
                                      scale:
                                        !rewriteResume && !rewriteCoverLetter
                                          ? 1
                                          : 0.98,
                                    }}
                                    onClick={handleRewriteDocs}
                                    disabled={
                                      (!rewriteResume && !rewriteCoverLetter) ||
                                      rewritingDocs
                                    }
                                    className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                                    style={{
                                      background: "#cc2936",
                                      color: "white",
                                      border: "none",
                                    }}
                                  >
                                    {rewritingDocs ? (
                                      <span className="flex items-center justify-center gap-2">
                                        <Loader2
                                          size={14}
                                          className="animate-spin"
                                        />
                                        Rewriting...
                                      </span>
                                    ) : (
                                      "Rewrite Documents"
                                    )}
                                  </motion.button>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-zinc-600 text-xs">
                              No skill gaps identified
                            </p>
                          )}
                        </div>

                        {/* Center divider with triangle pointer */}
                        <div
                          style={{
                            position: "relative",
                            background: "rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "36px",
                              left: "0px",
                              width: 0,
                              height: 0,
                              borderTop: "8px solid transparent",
                              borderBottom: "8px solid transparent",
                              borderLeft: "10px solid rgba(255,255,255,0.15)",
                            }}
                          />
                        </div>
                        {/* Right: OUTPUT */}
                        <div className="p-6">
                          {learningPlan ? (
                            <div className="space-y-4">
                              {learningPlan.plans.map((plan, i) => {
                                const isExpanded = expandedPlans.includes(
                                  plan.skill
                                );
                                return (
                                  <div
                                    key={plan.skill}
                                    className="border border-white/5 rounded-xl p-4"
                                  >
                                    <div
                                      onClick={() => togglePlan(plan.skill)}
                                      className="flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors rounded-lg px-2 -mx-2 py-1 -my-1"
                                    >
                                      <div className="flex items-baseline gap-3">
                                        <span className="text-sm font-bold text-amber-400">
                                          {plan.skill}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                          {plan.totalTime}
                                        </span>
                                      </div>
                                      {isExpanded ? (
                                        <ChevronUp
                                          size={14}
                                          className="text-zinc-500 shrink-0"
                                        />
                                      ) : (
                                        <ChevronDown
                                          size={14}
                                          className="text-zinc-500 shrink-0"
                                        />
                                      )}
                                    </div>
                                    <AnimatePresence initial={false}>
                                      {isExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{
                                            height: "auto",
                                            opacity: 1,
                                          }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="pt-3">
                                            <ul className="mb-3">
                                              {plan.steps.map((step, j) => (
                                                <li
                                                  key={j}
                                                  className={`text-xs py-3 ${j < plan.steps.length - 1 ? "border-b border-white/5" : ""}`}
                                                >
                                                  <div className="flex gap-2 mb-1.5">
                                                    <span className="text-zinc-300 shrink-0">
                                                      {step.day}
                                                    </span>
                                                    <span className="text-zinc-200">
                                                      {step.task}
                                                    </span>
                                                  </div>
                                                  {step.resources?.length >
                                                    0 && (
                                                    <ul className="ml-4 space-y-1 mb-1.5">
                                                      {step.resources.map(
                                                        (res, k) => (
                                                          <li
                                                            key={k}
                                                            className="flex items-center gap-1.5 text-zinc-400"
                                                          >
                                                            <span>
                                                              {RESOURCE_EMOJI[
                                                                res.type
                                                              ] ?? "🔗"}
                                                            </span>
                                                            {res.url?.startsWith(
                                                              "http"
                                                            ) ? (
                                                              <a
                                                                href={res.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:text-zinc-200 underline underline-offset-2 transition-colors"
                                                              >
                                                                {res.title}
                                                              </a>
                                                            ) : (
                                                              <span>
                                                                {res.title}
                                                                {res.url &&
                                                                  res.url !==
                                                                    res.title && (
                                                                    <span className="text-zinc-600 ml-1">
                                                                      ({res.url}
                                                                      )
                                                                    </span>
                                                                  )}
                                                              </span>
                                                            )}
                                                          </li>
                                                        )
                                                      )}
                                                    </ul>
                                                  )}
                                                  {step.aiPrompt && (
                                                    <div className="ml-4 flex items-start gap-2">
                                                      <div className="flex-1">
                                                        <p className="text-[10px] text-indigo-400 mb-0.5">
                                                          🤖 AI Learning Prompt
                                                        </p>
                                                        <p className="text-zinc-500 italic leading-relaxed">
                                                          {step.aiPrompt}
                                                        </p>
                                                      </div>
                                                      <button
                                                        onClick={() =>
                                                          handleCopyPrompt(
                                                            step.aiPrompt,
                                                            `${i}-${j}`
                                                          )
                                                        }
                                                        title="Copy AI prompt"
                                                        className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors mt-3.5"
                                                      >
                                                        {copiedPrompt ===
                                                        `${i}-${j}` ? (
                                                          <Check
                                                            size={10}
                                                            className="text-green-400"
                                                          />
                                                        ) : (
                                                          <ClipboardCopy
                                                            size={10}
                                                            className="text-zinc-600"
                                                          />
                                                        )}
                                                      </button>
                                                    </div>
                                                  )}
                                                </li>
                                              ))}
                                            </ul>
                                            <p className="text-xs text-zinc-300 mb-2">
                                              <span className="text-zinc-500">
                                                Demo:{" "}
                                              </span>
                                              {plan.demoProject}
                                            </p>
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="text-xs text-zinc-200 flex-1 leading-relaxed">
                                                <span className="text-indigo-400">
                                                  Resume bullet:{" "}
                                                </span>
                                                {plan.resumeBullet}
                                              </p>
                                              <button
                                                onClick={() =>
                                                  handleCopyBullet(
                                                    plan.resumeBullet,
                                                    plan.skill
                                                  )
                                                }
                                                title="Copy resume bullet"
                                                className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                                              >
                                                {copiedBullet === plan.skill ? (
                                                  <Check
                                                    size={12}
                                                    className="text-green-400"
                                                  />
                                                ) : (
                                                  <ClipboardCopy
                                                    size={12}
                                                    className="text-zinc-500"
                                                  />
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                              <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDownloadPlan}
                                className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 text-sm hover:bg-white/10 hover:text-white transition-all"
                              >
                                <Download size={14} />
                                Download Learning Plan
                              </motion.button>
                            </div>
                          ) : (
                            <p className="text-zinc-600 text-xs text-center py-12">
                              Results will appear here
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassConsole>
            </section>
          )}

          {/* ── Section 3: Resume & Cover Letter ── */}
          {analysis && (
            <section id="section-documents" className="mb-4">
              <GlassConsole
                style={{ borderLeft: "2px solid var(--accent-documents)" }}
              >
                <SectionHeader
                  id="section-documents"
                  label="Resume & Cover Letter"
                  color="#607d8b"
                />
                <AnimatePresence initial={false}>
                  {!collapsedSections.includes("section-documents") && (
                    <motion.div
                      key="documents-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5" />
                      <div className="grid grid-cols-[35%_1px_1fr]">
                        {/* Left: INPUT */}
                        <div className="p-6">
                          <div className="flex flex-col gap-3 mb-4">
                            {(
                              [
                                {
                                  checked: generateResume,
                                  toggle: () => setGenerateResume((v) => !v),
                                  label: "Generate tailored resume",
                                },
                                {
                                  checked: generateCoverLetter,
                                  toggle: () =>
                                    setGenerateCoverLetter((v) => !v),
                                  label: "Generate cover letter",
                                },
                              ] as const
                            ).map(({ checked, toggle, label }) => (
                              <label
                                key={label}
                                className="flex items-center gap-3 cursor-pointer"
                              >
                                <button
                                  role="checkbox"
                                  aria-checked={checked}
                                  onClick={toggle}
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    checked
                                      ? "bg-indigo-600 border-indigo-500"
                                      : "bg-transparent border-white/20 hover:border-white/40"
                                  }`}
                                >
                                  {checked && (
                                    <Check
                                      size={10}
                                      className="text-white"
                                      strokeWidth={3}
                                    />
                                  )}
                                </button>
                                <span className="text-sm text-zinc-300">
                                  {label}
                                </span>
                              </label>
                            ))}
                          </div>

                          {confirmedQualifications.length > 0 && (
                            <div className="mb-4 px-3 py-2.5 rounded-lg border border-indigo-500/25 bg-indigo-500/10">
                              <p className="text-[10px] uppercase tracking-widest text-indigo-300 mb-1.5">
                                Confirmed qualifications — will be added to documents
                              </p>
                              <ul className="space-y-0.5">
                                {confirmedQualifications.map((q, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-300">
                                    <Check size={10} className="text-indigo-400 mt-0.5 shrink-0" strokeWidth={3} />
                                    {q}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <input
                            type="text"
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            placeholder="Your full name (for cover letter sign-off)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors mb-3"
                          />

                          <textarea
                            value={extraContext}
                            onChange={(e) => setExtraContext(e.target.value)}
                            placeholder="Optional: add extra context — e.g. 'I recently learned Angular' or 'I have Baseline Clearance'"
                            className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors mb-3"
                          />

                          <textarea
                            value={companyBackground}
                            onChange={(e) => setCompanyBackground(e.target.value)}
                            placeholder="Optional: paste company background — e.g. 'Burraga Foundation is an Aboriginal non-profit building the Storylines platform for 100+ communities. They use Vercel, Supabase, and Cloudflare.'"
                            className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-white/20 transition-colors mb-4"
                          />

                          <motion.button
                            whileHover={{
                              scale:
                                !generateResume && !generateCoverLetter
                                  ? 1
                                  : 1.01,
                            }}
                            whileTap={{
                              scale:
                                !generateResume && !generateCoverLetter
                                  ? 1
                                  : 0.98,
                            }}
                            onClick={handleGenerateDocs}
                            disabled={
                              (!generateResume && !generateCoverLetter) ||
                              generatingDocs
                            }
                            className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                            style={{
                              background: "#cc2936",
                              color: "white",
                              border: "none",
                            }}
                          >
                            {generatingDocs ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Generating...
                              </span>
                            ) : (
                              "Generate Documents"
                            )}
                          </motion.button>

                          {documents && (
                            <div className="border-t border-white/5 mt-6 pt-6">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                                Not happy with the result?
                              </p>
                              <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="e.g. Make the summary shorter, add more emphasis on React experience"
                                className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-white/20 transition-colors mb-3"
                              />
                              <motion.button
                                whileHover={{
                                  scale: feedback.trim() ? 1.01 : 1,
                                }}
                                whileTap={{ scale: feedback.trim() ? 0.98 : 1 }}
                                onClick={handleRegenerate}
                                disabled={!feedback.trim() || isRegenerating}
                                className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 text-sm hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isRegenerating ? (
                                  <>
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />
                                    Regenerating...
                                  </>
                                ) : (
                                  "Regenerate with Feedback"
                                )}
                              </motion.button>
                            </div>
                          )}
                        </div>

                        {/* Center divider with triangle pointer */}
                        <div
                          style={{
                            position: "relative",
                            background: "rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "36px",
                              left: "0px",
                              width: 0,
                              height: 0,
                              borderTop: "8px solid transparent",
                              borderBottom: "8px solid transparent",
                              borderLeft: "10px solid rgba(255,255,255,0.15)",
                            }}
                          />
                        </div>
                        {/* Right: OUTPUT */}
                        <div className="p-6">
                          {rewrittenDocs || documents ? (
                            <div className="space-y-6">
                              {rewrittenDocs && (
                                <>
                                  {rewrittenDocs.resume && rewriteResume && (
                                    <div>
                                      <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">
                                        Rewritten Resume
                                      </p>
                                      <pre className="text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                        {cleanMarkdown(rewrittenDocs.resume)}
                                      </pre>
                                      {rewriteValidation?.resume && (
                                        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mt-3">
                                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                                            Quality Check
                                          </p>
                                          <ul className="space-y-1">
                                            {rewriteValidation.resume.passed.map(
                                              (item, i) => (
                                                <li
                                                  key={i}
                                                  className="text-xs text-green-400"
                                                >
                                                  ✓ {item}
                                                </li>
                                              )
                                            )}
                                            {rewriteValidation.resume.warnings.map(
                                              (item, i) => (
                                                <li
                                                  key={i}
                                                  className="text-xs text-amber-400"
                                                >
                                                  ⚠ {item}
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={() =>
                                            handleCopyRewrite(
                                              rewrittenDocs.resume!,
                                              "resume"
                                            )
                                          }
                                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                        >
                                          {copiedRewrite === "resume" ? (
                                            <Check
                                              size={11}
                                              className="text-green-400"
                                            />
                                          ) : (
                                            <ClipboardCopy size={11} />
                                          )}
                                          {copiedRewrite === "resume"
                                            ? "Copied"
                                            : "Copy"}
                                        </button>
                                        <button
                                          onClick={
                                            handleDownloadRewrittenResume
                                          }
                                          disabled={downloadingRewrite}
                                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          {downloadingRewrite ? (
                                            <>
                                              <Loader2
                                                size={11}
                                                className="animate-spin"
                                              />{" "}
                                              Generating...
                                            </>
                                          ) : (
                                            <>
                                              <Download size={11} /> Download as
                                              .docx
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {rewrittenDocs.coverLetter &&
                                    rewriteCoverLetter && (
                                      <div>
                                        <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">
                                          Rewritten Cover Letter
                                        </p>
                                        <pre className="text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                          {rewrittenDocs.coverLetter}
                                        </pre>
                                        {rewriteValidation?.coverLetter && (
                                          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mt-3">
                                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                                              Quality Check
                                            </p>
                                            <ul className="space-y-1">
                                              {rewriteValidation.coverLetter.passed.map(
                                                (item, i) => (
                                                  <li
                                                    key={i}
                                                    className="text-xs text-green-400"
                                                  >
                                                    ✓ {item}
                                                  </li>
                                                )
                                              )}
                                              {rewriteValidation.coverLetter.warnings.map(
                                                (item, i) => (
                                                  <li
                                                    key={i}
                                                    className="text-xs text-amber-400"
                                                  >
                                                    ⚠ {item}
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            onClick={() =>
                                              handleCopyRewrite(
                                                rewrittenDocs.coverLetter!,
                                                "coverLetter"
                                              )
                                            }
                                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                          >
                                            {copiedRewrite === "coverLetter" ? (
                                              <Check
                                                size={11}
                                                className="text-green-400"
                                              />
                                            ) : (
                                              <ClipboardCopy size={11} />
                                            )}
                                            {copiedRewrite === "coverLetter"
                                              ? "Copied"
                                              : "Copy"}
                                          </button>
                                          <button
                                            onClick={
                                              handleDownloadRewrittenCoverLetter
                                            }
                                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                          >
                                            <Download size={11} />
                                            Download as .docx
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                  {documents && (
                                    <div className="border-t border-white/5" />
                                  )}
                                </>
                              )}

                              {documents?.resume && (
                                <div>
                                  <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                                    Tailored Resume
                                  </p>
                                  <pre className="text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {cleanMarkdown(documents.resume)}
                                  </pre>
                                  {validation?.resume && (
                                    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mt-3">
                                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                                        Quality Check
                                      </p>
                                      <ul className="space-y-1">
                                        {validation.resume.passed.map(
                                          (item, i) => (
                                            <li
                                              key={i}
                                              className="text-xs text-green-400"
                                            >
                                              ✓ {item}
                                            </li>
                                          )
                                        )}
                                        {validation.resume.warnings.map(
                                          (item, i) => (
                                            <li
                                              key={i}
                                              className="text-xs text-amber-400"
                                            >
                                              ⚠ {item}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() =>
                                        handleCopyDoc(
                                          documents.resume!,
                                          "resume"
                                        )
                                      }
                                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                    >
                                      {copiedDoc === "resume" ? (
                                        <Check
                                          size={11}
                                          className="text-green-400"
                                        />
                                      ) : (
                                        <ClipboardCopy size={11} />
                                      )}
                                      {copiedDoc === "resume"
                                        ? "Copied"
                                        : "Copy"}
                                    </button>
                                    <button
                                      onClick={handleDownloadResume}
                                      disabled={downloadingResume}
                                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {downloadingResume ? (
                                        <>
                                          <Loader2
                                            size={11}
                                            className="animate-spin"
                                          />{" "}
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <Download size={11} /> Download as
                                          .docx
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {documents?.coverLetter && (
                                <div>
                                  <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                                    Cover Letter
                                  </p>
                                  <pre className="text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {documents.coverLetter}
                                  </pre>
                                  {validation?.coverLetter && (
                                    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mt-3">
                                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                                        Quality Check
                                      </p>
                                      <ul className="space-y-1">
                                        {validation.coverLetter.passed.map(
                                          (item, i) => (
                                            <li
                                              key={i}
                                              className="text-xs text-green-400"
                                            >
                                              ✓ {item}
                                            </li>
                                          )
                                        )}
                                        {validation.coverLetter.warnings.map(
                                          (item, i) => (
                                            <li
                                              key={i}
                                              className="text-xs text-amber-400"
                                            >
                                              ⚠ {item}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() =>
                                        handleCopyDoc(
                                          documents.coverLetter!,
                                          "coverLetter"
                                        )
                                      }
                                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                    >
                                      {copiedDoc === "coverLetter" ? (
                                        <Check
                                          size={11}
                                          className="text-green-400"
                                        />
                                      ) : (
                                        <ClipboardCopy size={11} />
                                      )}
                                      {copiedDoc === "coverLetter"
                                        ? "Copied"
                                        : "Copy"}
                                    </button>
                                    <button
                                      onClick={handleDownloadCoverLetter}
                                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                    >
                                      <Download size={11} />
                                      Download as .docx
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-zinc-600 text-xs text-center py-12">
                              Results will appear here
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassConsole>
            </section>
          )}

          {/* ── Section 4: Employer Questions ── */}
          {analysis && (
            <section id="section-employer" className="mb-4">
              <GlassConsole
                style={{ borderLeft: "2px solid var(--accent-employer)" }}
              >
                <SectionHeader
                  id="section-employer"
                  label="Employer Questions"
                  color="#e07c54"
                />
                <AnimatePresence initial={false}>
                  {!collapsedSections.includes("section-employer") && (
                    <motion.div
                      key="employer-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5" />
                      <div className="grid grid-cols-[35%_1px_1fr]">
                        {/* Left: INPUT */}
                        <div className="p-6">
                          <p className="text-xs text-zinc-500 mb-4">
                            Paste screening questions from your Seek or LinkedIn
                            application
                          </p>
                          <textarea
                            value={employerQuestions}
                            onChange={(e) =>
                              setEmployerQuestions(e.target.value)
                            }
                            placeholder={`e.g. Which of the following statements best describes your right to work in Australia?\nDo you hold Australian Security Clearance?`}
                            className="w-full h-28 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500/50 transition-colors mb-4"
                          />
                          <motion.button
                            whileHover={{
                              scale: employerQuestions.trim() ? 1.01 : 1,
                            }}
                            whileTap={{
                              scale: employerQuestions.trim() ? 0.98 : 1,
                            }}
                            onClick={handleGenerateAnswers}
                            disabled={
                              !employerQuestions.trim() || generatingAnswers
                            }
                            className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                            style={{
                              background: "#cc2936",
                              color: "white",
                              border: "none",
                            }}
                          >
                            {generatingAnswers ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Generating...
                              </span>
                            ) : (
                              "Generate Answers"
                            )}
                          </motion.button>
                        </div>

                        {/* Center divider with triangle pointer */}
                        <div
                          style={{
                            position: "relative",
                            background: "rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "36px",
                              left: "0px",
                              width: 0,
                              height: 0,
                              borderTop: "8px solid transparent",
                              borderBottom: "8px solid transparent",
                              borderLeft: "10px solid rgba(255,255,255,0.15)",
                            }}
                          />
                        </div>
                        {/* Right: OUTPUT */}
                        <div className="p-6">
                          {questionAnswers && questionAnswers.length > 0 ? (
                            <>
                              <div className="space-y-0">
                                {questionAnswers.map((qa, i) => (
                                  <div
                                    key={i}
                                    className={`py-3 ${i < questionAnswers.length - 1 ? "border-b border-white/5" : ""}`}
                                  >
                                    <p className="text-xs text-zinc-400 mb-1">
                                      {qa.question}
                                    </p>
                                    <p className="text-sm text-zinc-200 font-medium">
                                      {qa.answer}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                                <button
                                  onClick={handleCopyAnswers}
                                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                                >
                                  <ClipboardCopy size={11} />
                                  Copy All
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-zinc-600 text-xs text-center py-12">
                              Results will appear here
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassConsole>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

// ── Page root — manages auth state ───────────────────────────────────────────

export default function StudioPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <LockScreen onUnlock={() => setIsAuthenticated(true)} />;
  }

  return <StudioApp onLock={() => setIsAuthenticated(false)} />;
}
