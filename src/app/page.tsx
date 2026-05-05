"use client";

import { AmbientGlow } from "@/components/visual/AmbientGlow";
import { GlassConsole } from "@/components/ui/GlassConsole";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
      <AmbientGlow /> 

      <section className="relative z-10 w-full max-w-2xl px-6">
        <GlassConsole className="p-12 md:p-16 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            JobFlow <span className="text-indigo-500">AI</span>
          </h1>
          
          <p className="text-zinc-400 text-lg md:text-xl font-light tracking-widest uppercase opacity-80 mb-10">
            Canberra Professional Edition <span className="mx-2 text-zinc-700">//</span> 2026
          </p>

          {/* 增加的 Upload CV 按钮 */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
            className="px-8 py-4 bg-white/10 border border-white/10 rounded-2xl text-white font-medium tracking-wide backdrop-blur-sm transition-colors duration-200"
          >
            Upload CV
          </motion.button>
          
          <div className="mt-12 flex items-center justify-center gap-2">
             <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
             <span className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">System Standby</span>
          </div>
        </GlassConsole>
      </section>
    </main>
  );
}