import React from "react";

export const LogoStartupScreen: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Starting Wellness Voice"
      className="min-h-screen bg-[#0E1012] text-white flex flex-col items-center justify-center relative overflow-hidden select-none px-4"
    >
      {/* Subtle ambient lighting */}
      <div className="bg-[#009ADA] blur-[140px] absolute -top-20 -right-20 h-64 w-64 opacity-25 pointer-events-none" />
      <div className="bg-[#3B82F6] blur-[150px] absolute -bottom-20 -left-20 h-64 w-64 opacity-20 pointer-events-none" />

      {/* Brand Identity Container */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-5 animate-fade-in">
        {/* Brand Emblem */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-[#0EA5E9]/25 blur-xl pointer-events-none" />
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-[#1b1d1f] border border-[#0EA5E9]/35 flex items-center justify-center shadow-2xl shadow-cyan-950/50">
            <span className="text-[#0EA5E9] font-black text-3xl sm:text-4xl tracking-tighter select-none">
              W
            </span>
          </div>
        </div>

        {/* Brand Title */}
        <div className="flex items-center justify-center">
          <span className="font-bold text-2xl sm:text-3xl tracking-tight text-white">
            well<span className="text-[#0EA5E9]">Ness</span>
          </span>
          <span className="text-white/80 font-medium text-2xl sm:text-3xl ml-1.5">
            Voice
          </span>
        </div>
      </div>
    </div>
  );
};

export default LogoStartupScreen;

