"use client";

import { useState, useRef } from "react";
import { AmbientGlow } from "@/components/visual/AmbientGlow";
import { GlassConsole } from "@/components/ui/GlassConsole";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Loader2,
  X,
  ClipboardCopy,
  Check,
  RotateCcw,
} from "lucide-react";

// Shape of the AI analysis response
interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}

// Returns a colour class based on the alignment score
function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-indigo-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
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
    } catch (err) {
      console.error("Analysis failed:", err);
      alert("Check your internet connection and try again.");
    } finally {
      setAnalyzing(false);
    }
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
                  <ul className="space-y-3">
                    {analysis.strengths?.map((item, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.07 }}
                        className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                      >
                        <span className="text-green-500 shrink-0 mt-0.5">
                          +
                        </span>
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-red-400 mb-4 font-medium">
                    Gaps
                  </h3>
                  <ul className="space-y-3">
                    {analysis.gaps?.map((item, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.07 }}
                        className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                      >
                        <span className="text-red-500 shrink-0 mt-0.5">−</span>
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggestions */}
              <div>
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
                <ul className="space-y-3">
                  {analysis.suggestions?.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.07 }}
                      className="text-sm text-zinc-300 flex gap-2.5 leading-relaxed"
                    >
                      <span className="text-indigo-400 shrink-0 mt-0.5">→</span>
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>

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
  );
}
