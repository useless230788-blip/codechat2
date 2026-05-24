/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Sparkles, Cpu, Zap, Radio } from 'lucide-react';

export default function IronManHelmet() {
  const [isOverdrive, setIsOverdrive] = useState(false);
  const [faceplateOpen, setFaceplateOpen] = useState(false);

  // Constants for coloring
  const redPrimary = '#dc2626';     // Red-600
  const redDark = '#7f1d1d';        // Red-900
  const goldPrimary = '#eab308';    // Yellow-500
  const goldDark = '#a16207';       // Yellow-700
  const cyanPrimary = '#22d3ee';    // Cyan-400
  const cyanGlow = 'rgba(34, 211, 238, 0.85)';
  const overdriveColor = '#ec4899'; // Pink-500

  // Animation constants for nanotech assembly
  const baseTransition = { type: 'spring', stiffness: 80, damping: 15 };

  return (
    <div className="flex flex-col items-center justify-center py-6 relative select-none">
      {/* Animated HUD telemetry surrounding the main helmet */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        
        {/* Outermost diagnostic circular ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 15 }}
          className="w-80 h-80 absolute rounded-full border border-dashed border-cyan-500/10"
        />

        {/* Mid-sized technical interface ring with tick notches */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 10 }}
          className="w-72 h-72 absolute rounded-full border border-cyan-400/20 flex items-center justify-center"
          style={{ borderStyle: 'double', borderWidth: '3px' }}
        >
          {/* Angular targeting reticle nodes */}
          <div className="absolute top-1/2 left-[-6px] w-3 h-3 bg-cyan-400 border border-cyan-200 rounded-sm translate-y-[-50%]" />
          <div className="absolute top-1/2 right-[-6px] w-3 h-3 bg-cyan-400 border border-cyan-200 rounded-sm translate-y-[-50%]" />
        </motion.div>

        {/* Inner high-frequency pulse scanner orbit */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 6 }}
          className="w-56 h-56 absolute rounded-full border border-cyan-500/30 flex items-center justify-center"
        >
          {/* Telemetry textual readings hanging around the scanner */}
          <div className="absolute -top-10 text-[9px] font-mono text-cyan-400/80 tracking-widest whitespace-nowrap bg-slate-950/80 px-2 py-0.5 border border-cyan-500/15 rounded-md">
            SYS_CHARGE: {isOverdrive ? '200% MAX_OUTPUT' : '100% OPERATIONAL'}
          </div>
          <div className="absolute -bottom-10 text-[9px] font-mono text-pink-500/80 tracking-widest whitespace-nowrap bg-slate-950/80 px-2 py-0.5 border border-pink-500/15 rounded-md">
            NANOTECH: MK LXXXV
          </div>
          {/* Target locked node indicators */}
          <div className="absolute top-0 w-2 h-2 bg-pink-500 rounded-full" />
          <div className="absolute bottom-0 w-2 h-2 bg-pink-500 rounded-full" />
        </motion.div>

        {/* Interactive holographic vertical grids */}
        <div className="w-1 h-80 absolute border-l border-cyan-500/5 left-[50%]" />
        <div className="h-1 w-80 absolute border-t border-cyan-500/5 top-[50%]" />
      </div>

      {/* Main Interactive Helmet Frame */}
      <motion.div 
        whileHover={{ scale: 1.03 }}
        onClick={() => setIsOverdrive(!isOverdrive)}
        className="w-56 h-64 p-2 cursor-pointer relative z-10 flex items-center justify-center group"
        title="Toggle Overdrive Protocols"
      >
        <svg viewBox="0 0 200 240" className="w-full h-full filter drop-shadow-[0_0_25px_rgba(6,182,212,0.3)]">
          
          {/* MARK LXXXV Background / Helmet Silhouette Outline */}
          <motion.path 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...baseTransition, delay: 0.1 }}
            d="M 50 40 
               L 150 40 
               L 175 90 
               L 170 160 
               L 155 210 
               L 100 230 
               L 45 210 
               L 30 160 
               L 25 90 Z" 
            fill={isOverdrive ? '#1e1b4b' : '#0f172a'} 
            stroke={isOverdrive ? overdriveColor : '#4f46e5'} 
            strokeWidth="2" 
          />

          {/* Left Main Crimson Crimson Helmet Substructure */}
          <motion.path
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={baseTransition}
            d="M 50 40 
               L 100 38 
               L 100 230 
               L 70 215 
               L 45 210 
               L 30 160 
               L 38 120 
               L 28 85 L 50 78 Z"
            fill={isOverdrive ? '#831843' : redDark}
            stroke={isOverdrive ? '#db2777' : '#ef4444'}
            strokeWidth="1.5"
          />

          {/* Right Main Crimson Helmet Substructure */}
          <motion.path
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={baseTransition}
            d="M 150 40 
               L 100 38 
               L 100 230 
               L 130 215 
               L 155 210 
               L 170 160 
               L 162 120 
               L 172 85 L 150 78 Z"
            fill={isOverdrive ? '#9d174d' : redPrimary}
            stroke={isOverdrive ? '#f472b6' : '#f87171'}
            strokeWidth="1.5"
          />

          {/* Golden Nanotech Faceplate Structure */}
          {/* Framer motion animate for faceplate sliding up / down interactively */}
          <motion.g
            animate={{ 
              y: faceplateOpen ? -35 : 0, 
              opacity: faceplateOpen ? 0.4 : 1,
              scale: faceplateOpen ? 0.95 : 1
            }}
            transition={{ type: 'spring', stiffness: 120, damping: 12 }}
            onClick={(e) => {
              // Toggle open status when clicking inside golden faceplate
              e.stopPropagation();
              setFaceplateOpen(!faceplateOpen);
            }}
            className="cursor-pointer"
          >
            {/* Crown Crest Brow */}
            <path
              d="M 60 76 
                 L 100 68 
                 L 140 76 
                 L 155 110 
                 L 100 115 
                 L 45 110 Z"
              fill={isOverdrive ? '#be185d' : goldPrimary}
              stroke="#fbbf24"
              strokeWidth="1.5"
            />

            {/* Cheekbones Outline left */}
            <path
              d="M 45 110 
                 L 100 115 
                 L 100 170 
                 L 58 178 
                 L 44 140 Z"
              fill={isOverdrive ? '#a21caf' : goldDark}
              stroke="#ca8a04"
              strokeWidth="1"
            />

            {/* Cheekbones Outline right */}
            <path
              d="M 155 110 
                 L 100 115 
                 L 100 170 
                 L 142 178 
                 L 156 140 Z"
              fill={isOverdrive ? '#d946ef' : goldPrimary}
              stroke="#fbbf24"
              strokeWidth="1"
            />

            {/* Jaw Plate (Gold) */}
            <path
              d="M 58 178
                 L 100 170
                 L 142 178
                 L 130 215
                 L 100 230
                 L 70 215 Z"
              fill={isOverdrive ? '#be185d' : goldPrimary}
              stroke="#fbbf24"
              strokeWidth="1"
            />

            {/* Center Nose Ridge Bridge */}
            <path
              d="M 90 98 L 100 92 L 110 98 L 100 125 Z"
              fill={isOverdrive ? '#4c0519' : '#854d0e'}
            />

            {/* Holographic glowing eye plates */}
            {/* Eyes are glowing cyan, but switch to super pink during overdrive */}
            <motion.path
              animate={{ 
                opacity: [0.8, 1, 0.9, 1, 0.8],
                filter: isOverdrive 
                  ? [`drop-shadow(0 0 2px ${overdriveColor})`, `drop-shadow(0 0 10px ${overdriveColor})`, `drop-shadow(0 0 4px ${overdriveColor})`]
                  : [`drop-shadow(0 0 2px ${cyanPrimary})`, `drop-shadow(0 0 10px ${cyanPrimary})`, `drop-shadow(0 0 4px ${cyanPrimary})`]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              d="M 60 112 
                 L 90 116 
                 L 88 122 
                 L 64 120 Z"
              fill={isOverdrive ? '#f472b6' : '#ffffff'}
              stroke={isOverdrive ? overdriveColor : cyanPrimary}
              strokeWidth="2.5"
            />

            <motion.path
              animate={{ 
                opacity: [0.8, 1, 0.9, 1, 0.8],
                filter: isOverdrive 
                  ? [`drop-shadow(0 0 2px ${overdriveColor})`, `drop-shadow(0 0 10px ${overdriveColor})`, `drop-shadow(0 0 4px ${overdriveColor})`]
                  : [`drop-shadow(0 0 2px ${cyanPrimary})`, `drop-shadow(0 0 10px ${cyanPrimary})`, `drop-shadow(0 0 4px ${cyanPrimary})`]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              d="M 140 112 
                 L 110 116 
                 L 112 122 
                 L 136 120 Z"
              fill={isOverdrive ? '#f472b6' : '#ffffff'}
              stroke={isOverdrive ? overdriveColor : cyanPrimary}
              strokeWidth="2.5"
            />
          </motion.g>

          {/* Underlay HUD grid visible only when faceplate is open! */}
          {faceplateOpen && (
            <g opacity="0.9">
              <path
                d="M 65 95 L 135 95 M 65 130 L 135 130 M 100 70 L 100 150"
                stroke={cyanPrimary}
                strokeWidth="1"
                strokeDasharray="2, 2"
              />
              <circle cx="100" cy="110" r="28" fill="none" stroke={cyanPrimary} strokeWidth="1.5" strokeDasharray="4, 4" />
              <text x="100" y="114" fill={cyanPrimary} fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                J.A.R.V.I.S.
              </text>
            </g>
          )}

          {/* Glowing Arc Node underneath neck area */}
          <motion.circle
            cx="100"
            cy="215"
            r="8"
            animate={{ 
              scale: isOverdrive ? [1, 1.4, 1] : [1, 1.15, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{ repeat: Infinity, duration: 2 }}
            fill={isOverdrive ? overdriveColor : cyanPrimary}
          />
        </svg>

        {/* Small badge saying interactive controls */}
        <div className="absolute -bottom-4 bg-slate-900/90 text-slate-400 group-hover:text-cyan-400 border border-indigo-500/20 px-3 py-1 rounded-full text-[9px] font-mono tracking-wider transition-all shadow-md">
          {faceplateOpen ? 'CLICK IN FACEPLATE TO SEAL' : 'CLICK HELMET TO OVERCHARGE'}
        </div>
      </motion.div>

      {/* Auxiliary interactive mode indicators */}
      <div className="flex items-center gap-6 mt-6 text-[10px] font-mono tracking-widest text-[#a5b4fc]">
        <div className="flex items-center gap-1.5 bg-slate-950/50 px-3 py-1 rounded border border-indigo-500/10">
          <Zap className={`w-3.5 h-3.5 ${isOverdrive ? 'text-pink-500 animate-bounce' : 'text-yellow-400'}`} />
          MODE: {isOverdrive ? 'OVERDRIVE MAXIMUM' : 'NORMAL COMPILING'}
        </div>
        <button 
          onClick={() => setFaceplateOpen(!faceplateOpen)}
          className="flex items-center gap-1.5 hover:text-cyan-400 bg-slate-950/50 hover:bg-cyan-500/15 transition-all px-3 py-1 rounded border border-indigo-500/10 hover:border-cyan-500/20"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          {faceplateOpen ? 'ENGAGE faceplate' : 'SLIDE nano-plate'}
        </button>
      </div>
    </div>
  );
}
