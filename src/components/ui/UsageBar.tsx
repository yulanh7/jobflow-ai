"use client";

import { motion, AnimatePresence } from "framer-motion";

interface UsageBarProps {
  analyze: number;
  documents: number;
  globalExhausted?: boolean;
  resetAt: string | null;
}

const ANALYZE_LIMIT = 2;
const DOCUMENTS_LIMIT = 1;

function formatResetTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatResetDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const todayAEST = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const resetAEST = date.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  return todayAEST === resetAEST ? "今天" : "明天";
}

interface FeatureRowProps {
  label: string;
  count: number;
  limit: number;
  resetLabel: string;
  delay: number;
}

function FeatureRow({ label, count, limit, resetLabel, delay }: FeatureRowProps) {
  const remaining = Math.max(0, limit - count);
  const exhausted = remaining === 0;
  const dotColor = exhausted ? "#ef4444" : count >= limit - 1 && limit > 1 ? "#f97316" : "#cc2936";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-zinc-600 w-14 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: limit }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.05 * i, duration: 0.2 }}
            className="w-2 h-2 rounded-full border"
            style={
              i < count
                ? { background: dotColor, borderColor: dotColor }
                : { background: "transparent", borderColor: "rgba(255,255,255,0.15)" }
            }
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums">
        {exhausted ? (
          <span className="text-red-400">已满 · {resetLabel} 重置</span>
        ) : (
          <>
            <span style={{ color: dotColor }} className="font-medium">{count}</span>
            <span className="text-zinc-600"> / {limit}</span>
          </>
        )}
      </span>
    </div>
  );
}

export function UsageBar({ analyze, documents, globalExhausted, resetAt }: UsageBarProps) {
  const resetLabel = resetAt
    ? `${formatResetDate(resetAt)} ${formatResetTime(resetAt)} AEST`
    : "明天";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="w-full"
      >
        {globalExhausted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-center"
          >
            <p className="text-xs text-red-400 font-medium">今日网站使用总次数已满</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">请 {resetLabel} 后再试</p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            <FeatureRow label="分析" count={analyze} limit={ANALYZE_LIMIT} resetLabel={resetLabel} delay={0.2} />
            <FeatureRow label="文件生成" count={documents} limit={DOCUMENTS_LIMIT} resetLabel={resetLabel} delay={0.3} />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
