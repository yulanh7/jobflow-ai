"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";

interface SkillGap {
  skill: string;
  reason: string;
  learnable: boolean;
  timeEstimate: string;
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
  const [status, setStatus] = useState<"idle" | "uploading" | "success">(
    "idle"
  );
  const [resumeText, setResumeText] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedGaps, setSelectedGaps] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection and trigger resume parsing API
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

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
    setStatus("idle");
    setResumeText("");
    setJobDescription("");
    setAnalysis(null);
    setSelectedGaps([]);
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
                              {!gap.learnable && (
                                <span className="text-[10px] text-red-400 border border-red-400/30 rounded px-1.5 py-0.5">
                                  Cannot self-learn
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
                    onClick={() => console.log("Selected gaps:", selectedGaps)}
                    disabled={selectedGaps.length === 0}
                    className="mt-4 w-full py-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-300 text-sm font-medium hover:bg-amber-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Generate Learning Plan
                  </motion.button>
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
