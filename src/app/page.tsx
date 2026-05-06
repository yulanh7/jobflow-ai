"use client";

import { useState, useRef } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { AmbientGlow } from "@/components/visual/AmbientGlow";
import { CustomCursor } from "@/components/visual/CustomCursor";
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

// Shape of the AI analysis response
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
  "ensure", "crucial", "vital", "leverage", "seamless", "seamlessly",
  "comprehensive", "robust", "innovative", "cutting-edge", "dynamic",
  "synergy", "paradigm", "transform", "facilitate", "enhance", "drive",
  "solutions", "navigate", "journey", "elevate", "keen", "extensive",
  "furthermore", "coupled with", "well-suited", "strongly aligns",
  "excited by the prospect", "esteemed", "progressive", "versatility",
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

  const bullets = text.split("\n").filter((line) => line.trim().startsWith("-"));
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

// Stagger container — siblings animate one after another
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
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
};

// Returns a colour class based on the alignment score
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-indigo-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

// Returns a progress bar colour class based on the alignment score
function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-indigo-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export default function Home() {
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
  const [learningPlan, setLearningPlan] = useState<LearningPlanResult | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [copiedBullet, setCopiedBullet] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState("");
  const [generateResume, setGenerateResume] = useState(true);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [documents, setDocuments] = useState<{
    resume: string | null;
    coverLetter: string | null;
  } | null>(null);
  const [copiedDoc, setCopiedDoc] = useState<"resume" | "coverLetter" | null>(null);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [validation, setValidation] = useState<{
    resume: ValidationResult | null;
    coverLetter: ValidationResult | null;
  } | null>(null);
  const [employerQuestions, setEmployerQuestions] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<{ question: string; answer: string }[] | null>(null);
  const [generatingAnswers, setGeneratingAnswers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection and trigger resume parsing API
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
      setStatus("success");
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("idle");
    }
  };

  // Reset all state to allow a fresh analysis
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
    setGenerateResume(true);
    setGenerateCoverLetter(true);
    setDocuments(null);
    setGeneratingDocs(false);
    setDownloadingResume(false);
    setValidation(null);
    setEmployerQuestions("");
    setQuestionAnswers(null);
    setGeneratingAnswers(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send resume text and JD to the AI analysis API
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
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }, 150);
    } catch (err) {
      console.error("Analysis failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Toggle a skill gap in/out of the selected learning plan
  const toggleGap = (skill: string) => {
    setSelectedGaps((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  // Call the learning plan API with selected skill gaps
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
        alert(data.error || "Failed to generate learning plan. Please try again.");
        return;
      }
      setLearningPlan(data);
      if (data.plans?.[0]?.skill) setExpandedPlans([data.plans[0].skill]);
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }, 150);
    } catch (err) {
      console.error("Learning plan generation failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Build and trigger a markdown file download of the learning plan
  const handleDownloadPlan = () => {
    if (!learningPlan) return;

    const lines: string[] = [];
    lines.push("# Skill Gap Learning Plan");
    lines.push(`Generated by JobFlow AI — ${new Date().toLocaleDateString("en-AU")}`);
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

  // Copy an AI learning prompt to clipboard; key is "planIndex-stepIndex"
  const handleCopyPrompt = async (prompt: string, key: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(key);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  // Call the document generation API with selected options
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
          generateResume,
          generateCoverLetter,
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
        coverLetter: data.coverLetter ? validateCoverLetter(data.coverLetter) : null,
      });
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }, 150);
    } catch (err) {
      console.error("Document generation failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setGeneratingDocs(false);
    }
  };

  // Copy a generated document to clipboard
  const handleCopyDoc = async (text: string, key: "resume" | "coverLetter") => {
    await navigator.clipboard.writeText(text);
    setCopiedDoc(key);
    setTimeout(() => setCopiedDoc(null), 2000);
  };

  // Download resume as formatted .docx using the original file's structure
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

  // Download the cover letter as a .docx file
  const handleDownloadCoverLetter = async () => {
    if (!documents?.coverLetter) return;

    const paragraphs = documents.coverLetter.split("\n").map((line: string) => {
      if (line.trim() === "") return new Paragraph({ text: "" });
      return new Paragraph({
        children: [new TextRun({ text: line, size: 24, font: "Calibri" })],
        spacing: { after: 200 },
      });
    });

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "cover-letter.docx");
  };

  // Toggle a plan card's expanded/collapsed state
  const togglePlan = (skill: string) => {
    setExpandedPlans((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  // Copy a single resume bullet to clipboard
  const handleCopyBullet = async (bullet: string, skill: string) => {
    await navigator.clipboard.writeText(bullet);
    setCopiedBullet(skill);
    setTimeout(() => setCopiedBullet(null), 2000);
  };

  // Send employer screening questions to AI and store structured answers
  const handleGenerateAnswers = async () => {
    if (!employerQuestions.trim()) return;
    setGeneratingAnswers(true);
    try {
      const res = await fetch("/api/answer-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: employerQuestions, resumeText, jobDescription }),
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

  // Copy all Q&A pairs to clipboard
  const handleCopyAnswers = async () => {
    if (!questionAnswers) return;
    const text = questionAnswers
      .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
  };

  // Copy all suggestions to clipboard
  const handleCopySuggestions = async () => {
    if (!analysis?.suggestions) return;
    const text = analysis.suggestions
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
    <CustomCursor />
    <main className="relative min-h-screen flex flex-col items-center justify-start bg-black text-white overflow-x-hidden font-[family-name:var(--font-geist-sans)] py-16 px-6">
      <AmbientGlow />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center mb-10"
      >
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-3">
          JobFlow <span className="text-indigo-500">AI</span>
        </h1>
        <p className="text-zinc-500 text-sm font-light tracking-widest uppercase">
          Canberra Professional Edition
          <span className="mx-2 text-zinc-700">//</span>
          2026
        </p>
      </motion.div>

      {/* Upload Console */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10 w-full max-w-xl"
      >
        <GlassConsole className="p-8 md:p-10 text-center">
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
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="group flex items-center gap-3 px-8 py-4 mx-auto bg-white/5 border border-white/10 rounded-2xl text-white font-medium tracking-wide backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
              >
                <Upload
                  size={18}
                  className="text-indigo-400 group-hover:animate-bounce"
                />
                Upload CV
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
                <Loader2 className="animate-spin text-indigo-500" size={32} />
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
                {/* File info row */}
                <div className="flex items-center gap-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-full mb-5">
                  <FileText className="text-indigo-400 shrink-0" size={22} />
                  <div className="text-left overflow-hidden flex-1">
                    <p className="text-sm font-medium truncate">{file?.name}</p>
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

                {/* JD input */}
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the Job Description here..."
                  className="w-full h-36 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors mb-4"
                />

                {/* Analyse button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAnalyze}
                  disabled={!jobDescription || analyzing}
                  className="w-full py-4 bg-indigo-600 rounded-xl text-white font-bold shadow-[0_0_24px_rgba(79,70,229,0.35)] hover:bg-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {analyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Analysing...
                    </span>
                  ) : (
                    "Start AI Alignment"
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status indicator */}
          <div className="mt-8 flex items-center justify-center gap-2">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                status === "success"
                  ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
                  : "bg-indigo-500 animate-pulse"
              }`}
            />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">
              {status === "success" ? "Ready to Process" : "System Standby"}
            </span>
          </div>
        </GlassConsole>
      </motion.div>

      {/* Analysis Results Panel */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="relative z-10 w-full max-w-xl mt-6"
          >
            <GlassConsole className="p-8">
              {/* Score header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold tracking-tight text-zinc-200">
                  Alignment Report
                </h2>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-5xl font-bold tabular-nums ${getScoreColor(analysis.score)}`}
                  >
                    {analysis.score}
                  </span>
                  <span className="text-zinc-600 text-sm">/100</span>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full h-1 bg-white/5 rounded-full mb-7 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${analysis.score}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                  className={`h-full rounded-full ${getScoreBarColor(analysis.score)}`}
                />
              </div>

              {/* Summary */}
              <p className="text-zinc-400 text-sm leading-relaxed mb-8 pb-8 border-b border-white/5">
                {analysis.summary}
              </p>

              {/* Strengths & Gaps grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-8 border-b border-white/5">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-green-400 mb-4 font-medium">
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
                        <span className="text-green-500 shrink-0 mt-0.5">
                          +
                        </span>
                        {item}
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-red-400 mb-4 font-medium">
                    Gaps
                  </h3>
                  <motion.ul
                    variants={staggerList}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {analysis.gaps?.map((item, i) => (
                      <motion.li
                        key={i}
                        variants={listItem}
                        className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                      >
                        <span className="text-red-500 shrink-0 mt-0.5">−</span>
                        {item}
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>
              </div>

              {/* Suggestions */}
              <div className="mb-8 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-medium">
                    Suggestions
                  </h3>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopySuggestions}
                    className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
                  >
                    {copied ? (
                      <>
                        <Check size={11} className="text-green-400" />
                        <span className="text-green-400">Copied</span>
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
                      <span className="text-indigo-400 shrink-0 mt-0.5">→</span>
                      {item}
                    </motion.li>
                  ))}
                </motion.ul>
              </div>

              {/* Skill Gap Learning Plan */}
              {analysis.skillGaps && analysis.skillGaps.length > 0 && (
                <div className="border-t border-white/5 pt-8 mb-8">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-medium mb-1">
                    Skill Gap Learning Plan
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    Select the skills you want to learn — get a personalised study plan
                  </p>

                  <motion.ul
                    variants={staggerListVeryLate}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-white/5"
                  >
                    {analysis.skillGaps.map((gap, i) => {
                      const checked = selectedGaps.includes(gap.skill);
                      return (
                        <motion.li
                          key={i}
                          variants={skillGapCard}
                          className="flex items-start gap-3 py-3"
                        >
                          {/* Custom checkbox */}
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
                              <Check size={10} className="text-white" strokeWidth={3} />
                            )}
                          </button>

                          {/* Row content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className="text-sm text-zinc-200 font-medium">
                                {gap.skill}
                              </span>
                              <span className="text-xs text-amber-400/70">
                                {gap.timeEstimate}
                              </span>
                              {gap.category && (
                                <span className={`text-[10px] border rounded px-1.5 py-0.5 ${
                                  gap.category === "interview_ready"
                                    ? "text-sky-400 border-sky-400/30"
                                    : gap.category === "quick_win"
                                    ? "text-emerald-400 border-emerald-400/30"
                                    : "text-rose-400 border-rose-400/30"
                                }`}>
                                  {gap.category === "interview_ready"
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

                  {/* Generate button */}
                  <motion.button
                    whileHover={{ scale: selectedGaps.length > 0 ? 1.01 : 1 }}
                    whileTap={{ scale: selectedGaps.length > 0 ? 0.98 : 1 }}
                    onClick={handleGeneratePlan}
                    disabled={selectedGaps.length === 0 || generatingPlan}
                    className="mt-4 w-full py-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-300 text-sm font-medium hover:bg-amber-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generatingPlan ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      "Generate Learning Plan"
                    )}
                  </motion.button>

                  {/* Learning plan results */}
                  {learningPlan && (
                    <div className="mt-6 space-y-4">
                      {learningPlan.plans.map((plan, i) => {
                        const isExpanded = expandedPlans.includes(plan.skill);
                        return (
                          <div
                            key={plan.skill}
                            className="border border-white/5 rounded-xl p-4"
                          >
                            {/* Collapsible header — always visible */}
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

                            {/* Animated collapsible body */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-3">
                                    {/* Study steps */}
                                    <ul className="mb-3">
                                      {plan.steps.map((step, j) => (
                                        <li
                                          key={j}
                                          className={`text-xs py-3 ${
                                            j < plan.steps.length - 1
                                              ? "border-b border-white/5"
                                              : ""
                                          }`}
                                        >
                                          {/* Step label + task */}
                                          <div className="flex gap-2 mb-1.5">
                                            <span className="text-zinc-300 shrink-0">
                                              {step.day}
                                            </span>
                                            <span className="text-zinc-200">
                                              {step.task}
                                            </span>
                                          </div>

                                          {/* Resources */}
                                          {step.resources?.length > 0 && (
                                            <ul className="ml-4 space-y-1 mb-1.5">
                                              {step.resources.map((res, k) => (
                                                <li
                                                  key={k}
                                                  className="flex items-center gap-1.5 text-zinc-400"
                                                >
                                                  <span>
                                                    {RESOURCE_EMOJI[res.type] ??
                                                      "🔗"}
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
                                                            ({res.url})
                                                          </span>
                                                        )}
                                                    </span>
                                                  )}
                                                </li>
                                              ))}
                                            </ul>
                                          )}

                                          {/* AI learning prompt */}
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

                                    {/* Demo project */}
                                    <p className="text-xs text-zinc-300 mb-2">
                                      <span className="text-zinc-500">
                                        Demo:{" "}
                                      </span>
                                      {plan.demoProject}
                                    </p>

                                    {/* Resume bullet + copy */}
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

                      {/* Download button */}
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
                  )}
                </div>
              )}

              {/* Resume & Cover Letter */}
              <div className="border-t border-white/5 pt-8 mb-8">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-medium mb-4">
                  Resume &amp; Cover Letter
                </h3>

                {/* Document type checkboxes */}
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
                        toggle: () => setGenerateCoverLetter((v) => !v),
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
                          <Check size={10} className="text-white" strokeWidth={3} />
                        )}
                      </button>
                      <span className="text-sm text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Optional extra context */}
                <textarea
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  placeholder="Optional: add extra context — e.g. 'I recently learned Angular' or 'I have Baseline Clearance'"
                  className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors mb-4"
                />

                {/* Generate button */}
                <motion.button
                  whileHover={{
                    scale:
                      !generateResume && !generateCoverLetter ? 1 : 1.01,
                  }}
                  whileTap={{
                    scale:
                      !generateResume && !generateCoverLetter ? 1 : 0.98,
                  }}
                  onClick={handleGenerateDocs}
                  disabled={
                    (!generateResume && !generateCoverLetter) || generatingDocs
                  }
                  className="w-full py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

                {/* Generated document results */}
                {documents && (
                  <div className="mt-6 space-y-6">
                    {/* Tailored resume */}
                    {documents.resume && (
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                          Tailored Resume
                        </p>
                        <pre className="text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                          {cleanMarkdown(documents.resume)}
                        </pre>
                        {/* Resume quality check */}
                        {validation?.resume && (
                          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mt-3">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                              Quality Check
                            </p>
                            <ul className="space-y-1">
                              {validation.resume.passed.map((item, i) => (
                                <li key={i} className="text-xs text-green-400">✓ {item}</li>
                              ))}
                              {validation.resume.warnings.map((item, i) => (
                                <li key={i} className="text-xs text-amber-400">⚠ {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() =>
                              handleCopyDoc(documents.resume!, "resume")
                            }
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg"
                          >
                            {copiedDoc === "resume" ? (
                              <Check size={11} className="text-green-400" />
                            ) : (
                              <ClipboardCopy size={11} />
                            )}
                            {copiedDoc === "resume" ? "Copied" : "Copy"}
                          </button>
                          <button
                            onClick={handleDownloadResume}
                            disabled={downloadingResume}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {downloadingResume ? (
                              <>
                                <Loader2 size={11} className="animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Download size={11} />
                                Download as .docx
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cover letter */}
                    {documents.coverLetter && (
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
                          Cover Letter
                        </p>
                        <pre className="text-xs text-zinc-300 bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                          {documents.coverLetter}
                        </pre>
                        {/* Cover letter quality check */}
                        {validation?.coverLetter && (
                          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mt-3">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                              Quality Check
                            </p>
                            <ul className="space-y-1">
                              {validation.coverLetter.passed.map((item, i) => (
                                <li key={i} className="text-xs text-green-400">✓ {item}</li>
                              ))}
                              {validation.coverLetter.warnings.map((item, i) => (
                                <li key={i} className="text-xs text-amber-400">⚠ {item}</li>
                              ))}
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
                              <Check size={11} className="text-green-400" />
                            ) : (
                              <ClipboardCopy size={11} />
                            )}
                            {copiedDoc === "coverLetter" ? "Copied" : "Copy"}
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
                )}
              </div>

              {/* Employer Questions */}
              {analysis && (
                <div className="mt-8">
                  <div className="border-t border-white/10 pt-6 mb-4">
                    <h3 className="text-sm font-semibold text-violet-400 mb-1 flex items-center">
                      Employer Questions
                      <span className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 ml-2">
                        Optional
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Optional: paste screening questions from your Seek or LinkedIn application
                    </p>
                  </div>

                  <textarea
                    value={employerQuestions}
                    onChange={(e) => setEmployerQuestions(e.target.value)}
                    placeholder={`e.g. Which of the following statements best describes your right to work in Australia?\nDo you hold Australian Security Clearance?`}
                    className="w-full h-28 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500/50 transition-colors mb-4"
                  />

                  <motion.button
                    whileHover={{ scale: employerQuestions.trim() ? 1.01 : 1 }}
                    whileTap={{ scale: employerQuestions.trim() ? 0.98 : 1 }}
                    onClick={handleGenerateAnswers}
                    disabled={!employerQuestions.trim() || generatingAnswers}
                    className="w-full py-3 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

                  {/* Q&A results */}
                  {questionAnswers && questionAnswers.length > 0 && (
                    <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="space-y-0">
                        {questionAnswers.map((qa, i) => (
                          <div
                            key={i}
                            className={`py-3 ${i < questionAnswers.length - 1 ? "border-b border-white/5" : ""}`}
                          >
                            <p className="text-xs text-zinc-400 mb-1">{qa.question}</p>
                            <p className="text-sm text-zinc-200 font-medium">{qa.answer}</p>
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
                    </div>
                  )}
                </div>
              )}

              {/* Run again button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetUpload}
                className="mt-8 w-full py-3 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 text-sm hover:bg-white/10 hover:text-white transition-all"
              >
                <RotateCcw size={13} />
                Run New Analysis
              </motion.button>
            </GlassConsole>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
    </>
  );
}
