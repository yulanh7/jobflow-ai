"use client";
import { motion } from "framer-motion";

export const FloatingGeometry = () => {
  return (
    <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
      {/* === Set 1: large outline shapes (section-geometric) === */}

      {/* geo-circle */}
      <motion.div
        className="absolute w-[300px] h-[300px] top-[10%] left-[5%] rounded-full border-2 border-[var(--highlight)] opacity-10 bg-transparent"
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* geo-diamond */}
      <motion.div
        className="absolute w-[150px] h-[150px] top-[20%] right-[10%] rounded-[8px] border-2 border-[var(--highlight)] opacity-10 bg-transparent"
        style={{ rotate: "45deg" }}
        animate={{ y: [0, 20, 0], rotate: ["45deg", "50deg", "45deg"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* geo-square */}
      <motion.div
        className="absolute w-[200px] h-[200px] bottom-[5%] left-[5%] rounded-[8px] border-2 border-[var(--highlight)] opacity-10 bg-transparent"
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* === Set 2: small frosted-glass filled shapes (floating-element) === */}

      {/* float-1: rounded square */}
      <motion.div
        className="absolute w-[120px] h-[120px] top-[15%] right-[15%] rounded-[20px] border border-white/20 backdrop-blur-[10px] bg-[linear-gradient(135deg,rgba(255,182,185,0.15),rgba(204,41,54,0.1))]"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* float-2: organic blob shape */}
      <motion.div
        className="absolute w-20 h-20 bottom-0 right-[20%] rounded-[30%_70%_70%_30%/30%_30%_70%_70%] border border-white/20 backdrop-blur-[10px] bg-[linear-gradient(135deg,rgba(255,182,185,0.15),rgba(204,41,54,0.1))]"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* float-3: circle */}
      {/* <motion.div
        className="absolute w-[100px] h-[100px] top-[90%] right-[40%] rounded-full border border-white/20 backdrop-blur-[10px] bg-[linear-gradient(135deg,rgba(255,182,185,0.15),rgba(204,41,54,0.1))]"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      /> */}
    </div>
  );
};
