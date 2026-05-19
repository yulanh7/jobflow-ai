"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export const CustomCursor = () => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [cursorType, setCursorType] = useState<"default" | "pointer" | "text">("default");

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const dotX = useSpring(mouseX, { stiffness: 600, damping: 35 });
  const dotY = useSpring(mouseY, { stiffness: 600, damping: 35 });
  const ringX = useSpring(mouseX, { stiffness: 90, damping: 22 });
  const ringY = useSpring(mouseY, { stiffness: 90, damping: 22 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setMounted(true);

    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setVisible(true);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a") ||
        target.style.cursor === "pointer" ||
        window.getComputedStyle(target).cursor === "pointer"
      ) {
        setCursorType("pointer");
      } else if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        setCursorType("text");
      } else {
        setCursorType("default");
      }
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [mouseX, mouseY]);

  if (!mounted) return null;

  return (
    <div aria-hidden="true">
      {/* Inner dot — hidden when hovering a button/link */}
      <motion.div
        className="pointer-events-none fixed z-[9999] rounded-full"
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
          background: "#cc2936",
          width: 5,
          height: 5,
        }}
        animate={{
          opacity: visible && cursorType !== "pointer" ? 1 : 0,
        }}
        transition={{ duration: 0.15 }}
      />

      {/* Outer ring — morphs based on cursor context */}
      <motion.div
        className="pointer-events-none fixed z-[9998]"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: cursorType === "pointer" ? 12 : cursorType === "text" ? 2 : 36,
          height: cursorType === "pointer" ? 12 : cursorType === "text" ? 24 : 36,
          background: cursorType === "default" ? "transparent" : cursorType === "pointer" ? "#ffffff" : "#cc2936",
          border: cursorType === "default" ? "1.5px solid rgba(204,41,54,0.72)" : "none",
          boxShadow: cursorType === "default" ? "0 0 8px rgba(204,41,54,0.22)" : cursorType === "pointer" ? "0 0 12px rgba(255, 255, 255, 0.6)" : "none",
          borderRadius: cursorType === "text" ? "1px" : "50%",
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      />
    </div>
  );
};
