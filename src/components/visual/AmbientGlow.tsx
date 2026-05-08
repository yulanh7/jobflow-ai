"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const GLOW_SIZE = 600;

export const AmbientGlow = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [mouseX, mouseY]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        style={{
          position: "absolute",
          width: GLOW_SIZE,
          height: GLOW_SIZE,
          left: -GLOW_SIZE / 2,
          top: -GLOW_SIZE / 2,
          x: springX,
          y: springY,
          /* Brand red core fading to highlight pink — matches --brand-red and --highlight */
          background: "radial-gradient(circle, rgba(204, 41, 54, 0.06) 0%, rgba(255, 182, 185, 0.03) 50%, transparent 100%)",
          filter: "blur(40px)",
        }}
      />
    </div>
  );
};
