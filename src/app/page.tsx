"use client";

import { useState, useRef } from "react";
import { AmbientGlow } from "@/components/visual/AmbientGlow";
import { GlassConsole } from "@/components/ui/GlassConsole";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, X, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success">(
    "idle",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 同时加一个state存储解析出的文本
  const [resumeText, setResumeText] = useState<string>("");

  const [jobDescription, setJobDescription] = useState<string>("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 替换原来的 handleFileChange
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        console.error(data.error);
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

  const resetUpload = () => {
    setFile(null);
    setStatus("idle");
    setResumeText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

// src/app/page.tsx 中的 handleAnalyze 修改
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
      // 捕获 429 或 500 错误
      alert(data.error || "AI is busy, please try again in a minute.");
      return;
    }
    
    setAnalysis(data);
  } catch (err) {
    console.error("Analysis failed:", err);
    alert("Check your internet connection or API Quota.");
  } finally {
    setAnalyzing(false);
  }
};

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden font-[family-name:var(--font-geist-sans)]">
      <AmbientGlow />

      <section className="relative z-10 w-full max-w-2xl px-6">
        <GlassConsole className="p-12 md:p-16 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            JobFlow <span className="text-indigo-500">AI</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl font-light tracking-widest uppercase opacity-80 mb-10">
            Canberra Professional Edition{" "}
            <span className="mx-2 text-zinc-700">//</span> 2026
          </p>

          {/* 隐藏的 Input 标签 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx"
            className="hidden"
          />

          <div className="relative flex justify-center items-center">
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.button
                  key="idle-btn"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-medium tracking-wide backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
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
                  className="flex flex-col items-center w-full max-w-xs"
                >
                  <div className="flex items-center gap-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-full mb-6">
                    <FileText className="text-indigo-400 shrink-0" size={24} />
                    <div className="text-left overflow-hidden">
                      <p className="text-sm font-medium truncate">
                        {file?.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 uppercase">
                        File Ready for Analysis
                      </p>
                    </div>
                    <button
                      onClick={resetUpload}
                      className="ml-auto hover:bg-white/10 p-1 rounded-lg transition-colors"
                    >
                      <X size={14} className="text-zinc-500" />
                    </button>
                  </div>

                  {/* JD Input */}
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the Job Description here..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors mb-4"
                  />

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalyze}
                    disabled={!jobDescription || analyzing}
                    className="w-full py-4 bg-indigo-600 rounded-xl text-white font-bold shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:bg-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          </div>

          <div className="mt-12 flex items-center justify-center gap-2">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${status === "success" ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-indigo-500 animate-pulse"}`}
            />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">
              {status === "success" ? "Ready to Process" : "System Standby"}
            </span>
          </div>
        </GlassConsole>
      </section>
    </main>
  );
}
