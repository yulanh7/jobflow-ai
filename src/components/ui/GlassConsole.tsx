"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassConsoleProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const GlassConsole = React.forwardRef<HTMLDivElement, GlassConsoleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "backdrop-blur-2xl border border-white/10 rounded-[2.5rem] bg-zinc-900/20 shadow-2xl",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassConsole.displayName = "GlassConsole";