"use client";

import { motion, AnimatePresence } from "framer-motion";

interface UsageBarProps {
  ipCount: number;
  ipLimit: number;
  /** If true, also shows the global limit exhausted banner */
  globalExhausted?: boolean;
  resetAt: string | null;
}

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

export function UsageBar({ ipCount, ipLimit, globalExhausted, resetAt }: UsageBarProps) {
  const remaining = Math.max(0, ipLimit - ipCount);
  const isExhausted = remaining === 0 || globalExhausted;
  const pct = Math.min(100, (ipCount / ipLimit) * 100);

  const barColor = isExhausted
    ? "#ef4444"
    : ipCount >= ipLimit - 1
    ? "#f97316"
    : "#cc2936";

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
        {/* Global exhausted banner */}
        {globalExhausted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-center"
          >
            <p className="text-xs text-red-400 font-medium">
              今日网站使用总次数已满
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              请 {resetLabel} 后再试
            </p>
          </motion.div>
        )}

        {/* Per-IP usage row */}
        {!globalExhausted && (
          <div className="flex items-center gap-3">
            {/* Dots */}
            <div className="flex items-center gap-1">
              {Array.from({ length: ipLimit }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05 * i, duration: 0.25 }}
                  className="w-2 h-2 rounded-full border"
                  style={
                    i < ipCount
                      ? { background: barColor, borderColor: barColor }
                      : { background: "transparent", borderColor: "rgba(255,255,255,0.15)" }
                  }
                />
              ))}
            </div>

            {/* Label */}
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {isExhausted ? (
                <span className="text-red-400">今日额度已满 · {resetLabel} 重置</span>
              ) : (
                <>
                  <span style={{ color: barColor }} className="font-medium">{ipCount}</span>
                  <span className="text-zinc-600"> / {ipLimit} 次</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {!globalExhausted && (
          <div className="mt-2 w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: barColor }}
            />
          </div>
        )}

        {/* Exhausted: IP limit */}
        {isExhausted && !globalExhausted && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 text-[10px] text-zinc-600"
          >
            额度将于 {resetLabel} 重置
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
