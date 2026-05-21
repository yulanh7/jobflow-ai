"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface GlassConsoleProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const GlassConsole = React.forwardRef<HTMLDivElement, GlassConsoleProps>(
  ({ className, children, style, ...props }, ref) => {
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
          "relative backdrop-blur-[20px] rounded-none shadow-2xl overflow-hidden lg:rounded-[1rem] bg-[rgba(64,78,112,0.5)] border border-[rgba(255,255,255,0.08)]",
          className
        )}
        style={style}
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
              rgba(204, 41, 54, 0.1) 0%,
              rgba(255, 182, 185, 0.05) 40%,
              transparent 70%)`,
          }}
        />
        {children}
      </div>
    );
  }
);

GlassConsole.displayName = "GlassConsole";
