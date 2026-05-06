"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface GlassConsoleProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const GlassConsole = React.forwardRef<HTMLDivElement, GlassConsoleProps>(
  ({ className, children, ...props }, ref) => {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative backdrop-blur-2xl border border-white/10 rounded-[2.5rem] bg-zinc-900/20 shadow-2xl overflow-hidden",
          className
        )}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...props}
      >
        {/* Mouse-tracked shimmer spotlight */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            opacity: hovered ? 1 : 0,
            background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px,
              rgba(99,102,241,0.13) 0%,
              rgba(139,92,246,0.06) 40%,
              transparent 70%)`,
          }}
        />
        {children}
      </div>
    );
  }
);

GlassConsole.displayName = "GlassConsole";
