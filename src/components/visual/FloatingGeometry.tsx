"use client";
import { motion } from "framer-motion";

export const FloatingGeometry = () => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* === Set 1: large outline shapes (section-geometric) === */}

      {/* geo-circle */}
      <motion.div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          top: "10%",
          left: "5%",
          borderRadius: "50%",
          border: "2px solid #ffb6b9",
          opacity: 0.1,
          background: "transparent",
        }}
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* geo-diamond */}
      <motion.div
        style={{
          position: "absolute",
          width: 150,
          height: 150,
          top: "20%",
          right: "10%",
          borderRadius: "8px",
          border: "2px solid #ffb6b9",
          opacity: 0.1,
          background: "transparent",
          rotate: "45deg",
        }}
        animate={{ y: [0, 20, 0], rotate: ["45deg", "50deg", "45deg"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* geo-square */}
      <motion.div
        style={{
          position: "absolute",
          width: 200,
          height: 200,
          bottom: "5%",
          left: "5%",
          borderRadius: "8px",
          border: "2px solid #ffb6b9",
          opacity: 0.1,
          background: "transparent",
        }}
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* === Set 2: small frosted-glass filled shapes (floating-element) === */}

      {/* float-1: rounded square */}
      <motion.div
        style={{
          position: "absolute",
          width: 120,
          height: 120,
          top: "15%",
          right: "15%",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, rgba(255,182,185,0.15), rgba(204,41,54,0.1))",
          border: "1px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)",
        }}
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* float-2: organic blob shape */}
      <motion.div
        style={{
          position: "absolute",
          width: 80,
          height: 80,
          bottom: "0%",
          right: "20%",
          borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
          background:
            "linear-gradient(135deg, rgba(255,182,185,0.15), rgba(204,41,54,0.1))",
          border: "1px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)",
        }}
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* float-3: circle */}
      {/* <motion.div
        style={{
          position: "absolute",
          width: 100,
          height: 100,
          top: "90%",
          right: "40%",
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(255,182,185,0.15), rgba(204,41,54,0.1))",
          border: "1px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)",
        }}
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      /> */}
    </div>
  );
};
