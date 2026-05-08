"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export const CustomCursor = () => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);

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

    const onOver = (e: MouseEvent) => {
      if (
        (e.target as Element).closest(
          "button, a, textarea, input, label, [data-cursor-hover]"
        )
      )
        setHovering(true);
    };

    const onOut = (e: MouseEvent) => {
      if (
        (e.target as Element).closest(
          "button, a, textarea, input, label, [data-cursor-hover]"
        )
      )
        setHovering(false);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, [mouseX, mouseY]);

  if (!mounted) return null;

  return (
    <div aria-hidden="true">
      {/* Inner dot — brand red */}
      <motion.div
        className="pointer-events-none fixed z-[9999] rounded-full"
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
          background: "#cc2936",
        }}
        animate={{
          width: hovering ? 10 : 5,
          height: hovering ? 10 : 5,
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.15 }}
      />

      {/* Outer ring — spring-lagged, brand red */}
      <motion.div
        className="pointer-events-none fixed z-[9998] rounded-full"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          border: "1.5px solid rgba(204, 41, 54, 0.4)",
          boxShadow: "0 0 8px rgba(204, 41, 54, 0.2)",
        }}
        animate={{
          width: hovering ? 44 : 30,
          height: hovering ? 44 : 30,
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </div>
  );
};
