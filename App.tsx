import React, { useState, useEffect, useRef, forwardRef, useMemo } from 'react';

import {
  User,
  Home,
  Scan,
  PlusSquare,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  RefreshCw,
  Calculator,
  Zap,
  Menu,
  X,
  ArrowRight,
  ImageIcon,
  History,
  Download,
  CheckCircle2,
  BookOpen,
  Moon,
  Sun,
  Shield,
  Search,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  Layout,
  Cpu,
  Activity,
  FileDigit,
  BrainCircuit,
  Dna,
  Shapes,
  Maximize2,
  Loader2,
  Eye,
  EyeOff,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';

// --- Types ---
interface LayoutElement {
  id: string;
  type: 'header' | 'question_number' | 'problem' | 'white_space' | 'footer' | 'instruction' | 'word_problem' | 'diagram' | 'section_header' | 'response_area';
  content: string;
  mirroredContent?: string;
  solution?: string;
  skill?: string;
  boundingBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] (normalized 0-1000)
  style?: {
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'lighter';
    alignment: 'left' | 'center' | 'right';
    fontFamily?: 'serif' | 'sans-serif';
  };
}
type ViewState = 'home' | 'mirror' | 'generator' | 'archive' | 'settings' | 'detail';

import { Logo } from './src/components/Logo';
import { Auth } from './src/components/Auth';
import { useSupabaseWorksheets } from './src/hooks/useSupabaseWorksheets';
import { useAuth } from './src/context/AuthContext';

interface Worksheet {
  id: string;
  title: string;
  type: 'Mirror' | 'Topic';
  date: string;
  elements?: LayoutElement[];
  originalImageUrl?: string;
  content?: {
    problems: Array<{
      original: string;
      mirrored: string;
      solution: string;
      skill: string;
    }>;
    solution?: string;
    showAnswers?: boolean;
  };
  isArchived?: boolean;
}

// --- AI Initialization ---
import { supabase } from './src/lib/supabase';

// --- Shared Components ---
const MathText: React.FC<{ tex: string; className?: string; inline?: boolean }> = ({ tex, className = "", inline = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Use \displaystyle for block math, \textstyle for inline text flow
        // The previous forced \displaystyle broke inline text spacing
        let styledTex = tex;
        if (!inline) {
          styledTex = tex.startsWith('\\displaystyle') ? tex : `\\displaystyle{ ${tex} }`;
        } else {
          // For inline, we trust the caller or default to standard sizing
          styledTex = tex.startsWith('\\textstyle') ? tex : `\\textstyle{ ${tex} }`;
        }

        katex.render(styledTex, containerRef.current, {
          throwOnError: true, // Throw so we can catch and fallback
          displayMode: false,
          trust: true,
          strict: false
        });
      } catch (err) {
        // Fallback: Just show the raw text if KaTeX fails
        // This prevents "Red Text" error messages from ruining the worksheet
        console.warn("KaTeX render failed, falling back to text:", tex);
        if (containerRef.current) {
          containerRef.current.textContent = tex;
          containerRef.current.style.fontFamily = 'sans-serif'; // Revert to readable font
          containerRef.current.style.fontStyle = 'normal';
        }
      }
    }
  }, [tex, inline]);

  return (
    <span
      ref={containerRef}
      className={`katex-math-block ${inline ? 'inline' : 'inline-block align-middle'} ${className}`}
      style={{
        lineHeight: 'normal', // CRITICAL FIX: 'inherit' causes SVG vector lines (fractions) to drift upwards. 'normal' resets it.
        fontSize: '1em',      // Ensure it matches native text size
        color: 'inherit',
        fontFamily: 'KaTeX_Main, "Times New Roman", serif',
        fontVariantNumeric: 'tabular-nums'
      }}
    />
  );
};

// Parses text with \( ... \) and \[ ... \] delimiters and renders mixed content
// Parses text with \( ... \) and \[ ... \] delimiters and renders mixed content
// Also converts underscore sequences (e.g. ___) into clean border-bottom lines
const RichTextRenderer: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split by LaTeX delimiters and underscore sequences (2 or more)
  const parts = text.split(/(\\\(.*?\\\)|\\\[.*?\\\]|__+)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const mathContent = part.slice(2, -2);
          return <MathText key={index} tex={mathContent} inline={true} />;
        }
        if (part.startsWith('\\\[') && part.endsWith('\\\]')) {
          const mathContent = part.slice(2, -2);
          return <MathText key={index} tex={mathContent} inline={false} />;
        }
        if (part.startsWith('__')) {
          // Identify underscores and replace with a professional line
          // width: ~8px per underscore
          return (
            <span
              key={index}
              className="border-b-2 border-slate-300 mx-1"
              style={{
                width: `${part.length * 8}px`,
                minWidth: '40px',
                display: 'inline-block',
                verticalAlign: 'baseline', // CRITICAL FIX: Aligns with text bottom
                marginBottom: '-2px'       // Fine-tuned to sit EXACTLY on baseline
              }}
            />
          );
        }
        // Render regular text, unescaping \$ back to $
        return <span key={index}>{part.replace(/\\(\$)/g, '$')}</span>;
      })}
    </span>
  );
};


// --- Logo Component moved to src/components/Logo.tsx ---

// --- Tilt Card Component ---
const TiltCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        perspective: 1200,
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={`relative ${className}`}
    >
      <div style={{ transform: "translateZ(30px)" }} className="h-full">
        {children}
      </div>
    </motion.div>
  );
};

// --- Sidebar ---
const Sidebar: React.FC<{
  activeView: ViewState;
  setView: (v: ViewState) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}> = ({ activeView, setView, collapsed, setCollapsed }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Library' },
    { id: 'mirror', icon: Scan, label: 'Mirror' },
    { id: 'generator', icon: PlusSquare, label: 'Generate' },
    { id: 'archive', icon: Archive, label: 'Archive' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-6 flex items-center gap-3">
        <Logo size={32} />
        {!collapsed && (
          <div>
            <h1 className="font-black text-xl tracking-tighter text-slate-900 dark:text-white">
              Mirror<span className="text-sky-500">Math</span>
            </h1>

          </div>
        )}
      </div>
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="fixed left-0 top-0 h-screen bg-white dark:bg-slate-900 border-r border-sky-100 dark:border-slate-800 z-50 hidden md:flex flex-col shadow-sm overflow-hidden"
      >
        <div className={`flex items-center h-20 ${collapsed ? 'justify-center' : 'p-6 gap-3'}`}>
          <div className="shrink-0 cursor-pointer" onClick={() => window.location.reload()}>
            <Logo size={40} />
          </div>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl font-bold tracking-tight text-slate-800 dark:text-white whitespace-nowrap">
              MirrorMath
            </motion.span>
          )}
        </div>

        <nav className={`flex-1 mt-6 space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`w-full flex items-center rounded-xl transition-all ${collapsed ? 'justify-center p-3' : 'p-3 gap-4'
                } ${activeView === item.id
                  ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              <item.icon size={22} />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-50 dark:border-slate-800">
          <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center p-3 text-slate-400 hover:text-slate-600">
            {collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-[100] flex md:hidden items-center justify-around px-2 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewState)}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all active:scale-90 ${activeView === item.id
              ? 'text-sky-500'
              : 'text-slate-400 dark:text-slate-500'
              }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeView === item.id ? 'bg-sky-50 dark:bg-sky-900/20 shadow-sm ring-1 ring-sky-100 dark:ring-sky-900/50' : ''}`}>
              <item.icon size={20} weight={activeView === item.id ? "fill" : "regular"} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

// --- Landing Page ---
const LandingPage: React.FC<{ onStart: () => void; isDark: boolean }> = ({ onStart, isDark }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  const headlineScale = useTransform(scrollY, [0, 800], [1, 1.05]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.7]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 blueprint-grid pointer-events-none opacity-30 z-0" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[60] bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-sky-100/30 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="group-hover:rotate-6 transition-transform">
              <Logo size={48} className="drop-shadow-xl" />
            </div>
            <span className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              MirrorMath
            </span>
          </div>

          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-slate-500 dark:text-slate-400 hover:text-sky-600 font-semibold transition-all">Features</a>
            <a href="#workflow" className="text-slate-500 dark:text-slate-400 hover:text-sky-600 font-semibold transition-all">Workflow</a>
            <button onClick={onStart} className="bg-sky-500 hover:bg-sky-600 text-white px-7 py-2.5 rounded-full font-bold transition-all shadow-md">Get Started</button>
          </div>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-slate-600">
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 md:pt-48 pb-20 min-h-screen flex items-center z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 bg-sky-50 dark:bg-sky-900/30 border border-sky-200/50 px-5 py-2 rounded-full text-sky-600 dark:text-sky-400 text-[10px] md:text-xs font-bold mb-8 shadow-sm">
            <Sparkles size={14} className="text-amber-500 animate-pulse" />
            <span className="uppercase tracking-widest">AI-Powered Reflection Engine</span>
          </motion.div>

          <motion.h1 style={{ scale: headlineScale, opacity: heroOpacity }} className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tighter mb-8 md:mb-12 leading-[1.1]">
            Master Math <br />
            with a <span className="text-sky-500">Reflection.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="max-w-3xl mx-auto text-lg md:text-2xl text-slate-500 dark:text-slate-400 mb-12 md:mb-16 leading-relaxed font-medium">
            Instantly "Mirror" your assignments with fresh problems. Same concepts, same difficulty, entirely new obstacles.
          </motion.p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 mb-20 md:mb-32">
            <button onClick={onStart} className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white px-8 md:px-10 py-4 md:py-5 rounded-full font-black text-base md:text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Upload size={20} /> Upload Worksheet
            </button>
            <button onClick={onStart} className="w-full sm:w-auto bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-8 md:px-10 py-4 md:py-5 rounded-full font-black text-base md:text-lg hover:bg-white transition-all flex items-center justify-center gap-3">
              <BookOpen size={20} /> Browse Topics
            </button>
          </div>
        </div>
      </section>

      {/* Metric Bar */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border-y border-sky-100 dark:border-slate-800 py-12 relative overflow-hidden z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-12 text-center md:text-left">
            {[
              { val: "1M+", label: "Problems Reflected" },
              { val: "99.8%", label: "Logic Accuracy" },
              { val: "< 3 Secs", label: "Processing Time" },
              { val: "50k+", label: "Active Educators" },
            ].map((stat, i) => (
              <div key={i} className="space-y-1">
                <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{stat.val}</p>
                <p className="text-xs md:text-sm font-bold text-sky-500 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-40 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 space-y-12">
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-tight">Your practice, <br /><span className="text-sky-500">Supercharged.</span></h2>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Capture the Core", text: "Upload any worksheet. Our AI deciphers messy handwriting and complex formulas instantly.", icon: <Upload className="text-sky-500" /> },
                  { step: "02", title: "Reflective Analysis", text: "We understand the 'why' behind the math to generate logically equivalent variants.", icon: <Cpu className="text-blue-500" /> },
                  { step: "03", title: "Infinite Practice", text: "Export professional PDFs. One assignment becomes a hundred unique challenges.", icon: <Layers className="text-indigo-500" /> }
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex gap-6 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xl font-black text-slate-400 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm">{item.step}</div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">{item.title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="flex-1 relative">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative glass-card p-4 rounded-[40px] shadow-2xl overflow-hidden border border-sky-100/50">
                <div className="aspect-[4/5] bg-slate-50 dark:bg-slate-900 rounded-[32px] overflow-hidden flex flex-col">
                  <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 p-8 space-y-6">
                    <div className="h-4 bg-sky-200 dark:bg-sky-900 rounded-full w-3/4 animate-pulse" />
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-sky-100 dark:border-sky-900">
                      <div className="math-font text-sky-600 font-bold">Solving for X...</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* --- REFINED PREMIUM COMPARISON SECTION --- */}
      <section className="relative pt-60 pb-80 overflow-hidden bg-slate-950">

        {/* PREMIUM DIVIDER: Sharp SVG Parabolic Arc */}
        <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none translate-y-[-1px]">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-[180px] fill-white dark:fill-slate-950">
            <path d="M0,160 C480,320 960,320 1440,160 L1440,0 L0,0 Z" />
          </svg>
          {/* Subtle Glow Line following the arc */}
          <div className="absolute top-[80%] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent blur-[4px]" />
        </div>

        {/* Navy Background Decor: Dot Grid */}
        <div className="absolute inset-0 z-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Floating Ambient Glows */}
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity }} className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-sky-600 rounded-full blur-[200px] pointer-events-none" />
        <motion.div animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.15, 0.05] }} transition={{ duration: 12, repeat: Infinity }} className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-blue-700 rounded-full blur-[180px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-30">
          <div className="text-center mb-24">
            <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest mb-6">
              <Activity size={14} /> The Competitive edge
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6">The Mirror Advantage</h2>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto font-medium">Why manual prep is a thing of the past.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
            <TiltCard>
              <div className="h-full bg-white/5 backdrop-blur-sm p-12 rounded-[48px] border border-white/5 space-y-8 relative group overflow-hidden transition-colors hover:bg-white/10">
                <div className="absolute top-8 right-8 text-slate-700 opacity-20"><Calculator size={48} /></div>
                <h3 className="text-2xl font-bold text-slate-500 uppercase tracking-widest">Traditional Prep</h3>
                <ul className="space-y-6">
                  {["Hours spent changing numbers manually", "High risk of calculation errors", "Messy formatting and print layouts", "Limited variation for students"].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-slate-500 font-medium">
                      <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <X className="text-red-500" size={14} strokeWidth={3} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </TiltCard>

            <TiltCard>
              <div className="h-full relative p-12 rounded-[48px] border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-blue-600/10 shadow-2xl space-y-8 overflow-hidden group">
                <motion.div animate={{ top: ['-100%', '200%'] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-sky-400/20 to-transparent z-10 pointer-events-none" />
                <div className="absolute top-8 right-8 text-sky-500 opacity-20"><Zap size={48} fill="currentColor" /></div>
                <h3 className="text-2xl font-black text-sky-400 uppercase tracking-widest">MirrorMath</h3>
                <ul className="space-y-6 relative z-20">
                  {["Instant mirroring of any assignment", "Verified logic with 99.8% precision", "Blueprint-perfect A4 PDF exports", "Unlimited variants in one click"].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-slate-100 font-semibold text-lg">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="text-sky-400" size={20} strokeWidth={3} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-6 relative z-20">
                  <div className="px-6 py-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div className="flex gap-2 items-center">
                      <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Active Engine</span>
                    </div>
                    <div className="h-1 w-20 bg-sky-900 rounded-full overflow-hidden">
                      <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity }} className="h-full bg-sky-500 w-1/2" />
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>

        {/* BOTTOM DIVIDER: Reversing the arc for the white transition */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none translate-y-[1px]">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-[180px] fill-white dark:fill-slate-950">
            <path d="M0,160 C480,0 960,0 1440,160 L1440,320 L0,320 Z" />
          </svg>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 relative text-center z-10 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-12">
            <h2 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1]">
              Stop calculating. <br /> Start <span className="text-sky-500 underline decoration-sky-200 underline-offset-8">Reflecting.</span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              Join thousands of educators saving hours every week with AI-assisted math generation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
              <button onClick={onStart} className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white px-12 py-6 rounded-full font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-3">
                Launch MirrorMath <Zap size={24} fill="white" />
              </button>
              <button className="w-full sm:w-auto text-slate-400 hover:text-sky-500 font-bold text-lg transition-colors">
                Learn More
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-40 bg-slate-50 dark:bg-slate-900/20 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6">Designed for <span className="text-sky-500">Learning</span></h2>
            <div className="w-24 h-2 bg-sky-500 mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { title: "Recursive Learning", desc: "Our engine analyzes the deep structure of your problems to ensure mirrors are mathematically equivalent.", icon: <RefreshCw size={28} /> },
              { title: "Verifiable Logic", desc: "Not just random numbers. We verify every variable change to maintain logical consistency.", icon: <Shield size={28} /> },
              { title: "Adaptive Difficulty", desc: "Fine-tune the complexity of generated tasks to match student performance levels.", icon: <Zap size={28} /> }
            ].map((f, i) => (
              <motion.div key={i} whileHover={{ y: -10 }} className="glass-card p-12 rounded-[48px] border border-sky-100 hover:bg-white transition-all">
                <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mb-8 text-sky-500 shadow-inner">{f.icon}</div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-5">{f.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-lg font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-sky-100 dark:border-slate-900 py-24 transition-colors z-20 relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-6 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Logo size={40} />
              <span className="text-2xl font-black text-slate-900 dark:text-white">MirrorMath</span>
            </div>
            <p className="text-slate-400 dark:text-slate-500 font-medium max-w-sm">Reinventing practice. Built for students, by students. <br /> © {new Date().getFullYear()}</p>
          </div>
          <div className="flex gap-12 text-sm font-black uppercase tracking-widest text-slate-400">
            <a href="#" className="hover:text-sky-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-sky-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-sky-500 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// --- Problem Workspaces ---
const HomeWorkspace: React.FC<{
  worksheets: Worksheet[];
  onArchive: (id: string) => void;
  setView: (v: ViewState) => void;
  onSelect: (w: Worksheet) => void;
  onRename: (id: string, newTitle: string) => void;
}> = ({ worksheets, onArchive, setView, onSelect, onRename }) => {
  if (worksheets.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 bg-sky-50 dark:bg-sky-900/30 rounded-[40px] flex items-center justify-center text-sky-500 shadow-inner"
        >
          <Layers size={60} strokeWidth={1.5} />
        </motion.div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-4">Your Library is Empty</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed">
            Begin your journey by uploading a worksheet or generating a new topic. Your reflections will appear here.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            onClick={() => setView('mirror')}
            className="px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center gap-3 active:scale-95"
          >
            <Scan size={20} /> Mirror Tool
          </button>
          <button
            onClick={() => setView('generator')}
            className="px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95"
          >
            <PlusSquare size={20} /> Topic Generator
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Workspace Library</h1>
        <div className="text-sm font-bold text-sky-500 uppercase tracking-widest bg-sky-50 dark:bg-sky-900/30 px-4 py-2 rounded-full">
          {worksheets.length} {worksheets.length === 1 ? 'Project' : 'Projects'}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {worksheets.filter(w => !w.isArchived).map(ws => (
          <WorksheetCard
            key={ws.id}
            worksheet={ws}
            onClick={() => onSelect(ws)}
            onDelete={(id) => {
              if (confirm("Move this worksheet to the archives?")) {
                onArchive(id);
              }
            }}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  );
};

const ArchiveWorkspace: React.FC<{
  worksheets: Worksheet[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  setView: (v: ViewState) => void;
  onSelect: (w: Worksheet) => void;
  onRename: (id: string, newTitle: string) => void;
}> = ({ worksheets, onRestore, onDelete, setView, onSelect, onRename }) => {
  const archivedWorksheets = worksheets.filter(w => w.isArchived);

  if (archivedWorksheets.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-[40px] flex items-center justify-center text-slate-400 border-4 border-dashed border-slate-200 dark:border-slate-700"
        >
          <Archive size={60} strokeWidth={1.5} />
        </motion.div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-4">Archive Empty</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed">
            No worksheets have been archived. Items you delete from the library will appear here.
          </p>
        </div>
        <button
          onClick={() => setView('home')}
          className="px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95"
        >
          <Layout size={20} /> Return to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Archive size={32} className="text-slate-400" />
          Archives
        </h1>
        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
          {archivedWorksheets.length} {archivedWorksheets.length === 1 ? 'Item' : 'Items'}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 opacity-75 hover:opacity-100 transition-opacity">
        {archivedWorksheets.map(ws => (
          <WorksheetCard
            key={ws.id}
            worksheet={ws}
            onClick={() => onSelect(ws)}
            onRestore={(id) => {
              if (confirm("Restore this worksheet to your library?")) {
                onRestore(id);
              }
            }}
            onDelete={(id) => {
              if (confirm("PERMANENTLY delete this worksheet? This cannot be undone.")) {
                onDelete(id);
              }
            }}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  );
};


// --- Worksheet Preview Component ---
const WorksheetPreview = forwardRef<HTMLDivElement, { elements: LayoutElement[]; originalImageUrl?: string; showAnswers?: boolean }>(({ elements, originalImageUrl, showAnswers }, ref) => {
  const pageWidth = 794; // A4 width at 96 DPI
  const pageHeight = 1123; // A4 height at 96 DPI

  return (
    <div
      ref={ref}
      className="relative bg-white mx-auto overflow-hidden text-slate-900"
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        aspectRatio: '210 / 297',
        color: '#0f172a',
        fontFeatureSettings: '"kern" 1, "liga" 1',
        textRendering: 'optimizeLegibility',
        WebkitFontSmoothing: 'antialiased'
      }}
    >
      {/* Background Grid for Structure (Optional, can be toggled) */}
      {/* <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div> */}

      {elements.map((el, idx) => {
        if (el.type === 'white_space') return null;

        const [ymin, xmin, ymax, xmax] = el.boundingBox;
        // Convert 0-1000 scale to strict INTEGER pixels for 100% stable alignment
        const x = Math.round(xmin * 0.794);
        const y = Math.round(ymin * 1.123);
        const w = Math.round((xmax - xmin) * 0.794);
        const h = Math.round((ymax - ymin) * 1.123);

        // Visual Polish: Normalize font sizes slightly to avoid "ransom note" effect if AI varies by 1px
        const baseSize = el.style?.fontSize || 12;
        const normalizedFontSize = Math.round(baseSize);

        const fontSize = Math.max(normalizedFontSize, 11);
        const fontWeight = el.style?.fontWeight || 'normal';
        const textAlign = el.style?.alignment || 'left';

        // Sophisticated Color Palette
        const isHeader = el.type === 'header' || el.type === 'section_header';
        const color = isHeader ? 'text-slate-700' : 'text-slate-900';

        const content = el.mirroredContent || el.content;

        // Professional Font Stacks
        const serifStack = "'EB Garamond', 'Times New Roman', serif";
        const sansStack = "'Inter', system-ui, -apple-system, sans-serif";
        const fontFamily = el.style?.fontFamily === 'serif' ? serifStack : sansStack;

        // Special styling for Question Numbers to make them pop
        const isQuestionNumber = el.type === 'question_number';
        const finalFontWeight = isQuestionNumber ? '700' : fontWeight;
        const finalColor = isQuestionNumber ? 'text-sky-600' : color;

        return (
          <div
            key={el.id || idx}
            className={`absolute ${finalColor} overflow-visible transition-colors`}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: el.type === 'header' ? 'auto' : `${w}px`,
              minWidth: el.type === 'header' ? '120px' : 'auto',
              height: `${h}px`,
              fontSize: `${fontSize}px`,
              fontWeight: finalFontWeight,
              textAlign: textAlign,
              fontFamily: isQuestionNumber ? sansStack : fontFamily, // Numbers look better in Sans
              lineHeight: el.type === 'word_problem' ? '1.6' : '1.25',
              display: 'flex', // Flexbox for better control than table
              flexDirection: 'column',
              justifyContent: el.type === 'problem' || el.type === 'header' ? 'center' : 'flex-start',
              letterSpacing: (isHeader || isQuestionNumber) ? '-0.01em' : 'normal',
            }}
          >
            <div
              style={{
                width: '100%',
                // No inner flex needed usually, but keeps text flow standard
              }}
            >
              {el.type === 'problem' ? (
                <div className="w-full inline-block" style={{ lineHeight: '1', overflow: 'visible' }}>
                  {content ? (
                    <MathText tex={content} />
                  ) : (
                    <div className="text-slate-300 italic text-[10px]">Empty problem</div>
                  )}
                </div>
              ) : el.type === 'word_problem' ? (
                <div className="w-full inline-block text-slate-800" style={{ whiteSpace: 'pre-wrap' }}>
                  <RichTextRenderer text={content} />
                </div>
              ) : el.type === 'diagram' ? (
                <div className="w-full h-full relative overflow-hidden rounded-md border border-slate-100">
                  {originalImageUrl ? (
                    // Clip the original image to this bounding box
                    // The logic is: We display the Full Page image locally, but shift it so only the relevant part is visible
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      <img
                        src={originalImageUrl}
                        style={{
                          position: 'absolute',
                          // Negative offsets to shift the image
                          top: `-${y}px`,
                          left: `-${x}px`,
                          // The image size must match the specific page dimensions we are rendering
                          width: `${pageWidth}px`,
                          height: `${pageHeight}px`,
                          maxWidth: 'none'
                        }}
                        alt="Diagram from original"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center p-2 bg-slate-50">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">{content || "Diagram Missing"}</span>
                    </div>
                  )}
                </div>
              ) : el.type === 'response_area' ? (
                // Use a positioned scale to ensure line feels "grounded" but not too thick
                <div className="w-full h-full flex items-end pb-1">
                  <div className="w-full border-b-2 border-slate-200" />
                </div>
              ) : el.type === 'section_header' ? (
                <div className="w-full inline-block font-black uppercase tracking-widest text-slate-800 border-b-2 border-slate-200 pb-1 mb-2">
                  <RichTextRenderer text={content} />
                </div>
              ) : (
                <div className="inline-block">
                  <RichTextRenderer text={content || " "} />
                  {showAnswers && el.solution && (
                    <div className="mt-2 p-2 bg-sky-50 dark:bg-sky-900/10 border-l-2 border-sky-500 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                      <span className="uppercase text-[8px] block opacity-60 mb-1">Answer</span>
                      <RichTextRenderer text={el.solution} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

const WorksheetCard: React.FC<{
  worksheet: Worksheet;
  onClick: () => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}> = ({ worksheet, onClick, onDelete, onRestore, onRename }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(worksheet.title);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRenameCommit = () => {
    if (onRename && newName.trim() && newName !== worksheet.title) {
      onRename(worksheet.id, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(worksheet.title);
    }
  };

  return (
    <div className="group relative" onContextMenu={handleContextMenu}>
      <TiltCard
        onClick={isRenaming ? undefined : onClick}
        className={`p-8 cursor-pointer border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 transition-all dark:bg-slate-900/50 ${isRenaming ? 'ring-2 ring-sky-500' : ''}`}
      >
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className={`w-12 h-12 ${onRestore ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-500'} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              {onRestore ? <Archive size={24} /> : <Layers size={24} />}
            </div>
            <div className="flex items-center gap-2 text-slate-400 group-hover:text-sky-500 transition-colors">
              <Calendar size={14} />
              <span className="text-[10px] font-black uppercase tracking-wider">{worksheet.date}</span>
            </div>
          </div>

          <div>
            {isRenaming ? (
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRenameCommit}
                onKeyDown={handleKeyDown}
                className="w-full text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2 bg-slate-50 dark:bg-slate-800 border-b-2 border-sky-500 outline-none px-2 py-1 rounded-sm"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2 group-hover:text-sky-500 transition-colors truncate">
                {worksheet.title}
              </h3>
            )}
            <div className="flex gap-2 flex-wrap">
              {worksheet.content?.problems.slice(0, 3).map((_, i) => (
                <div key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-500">
                  Concept {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </TiltCard>

      {/* Standard Icons for hover actions (Legacy UI support) */}
      <div className="absolute -top-2 -right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onRestore && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore(worksheet.id);
            }}
            className="p-2 bg-sky-500 text-white rounded-xl shadow-lg hover:bg-sky-600 transition-colors"
            title="Restore to Library"
          >
            <RefreshCw size={16} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(worksheet.id);
          }}
          className="p-2 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-colors"
          title={onRestore ? "Delete Permanently" : "Archive"}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Sleek Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000,
            }}
            className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 py-3 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setContextMenu(null);
                setIsRenaming(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-all rounded-xl text-left"
            >
              <Edit2 size={16} /> Rename
            </button>
            {onRestore ? (
              <button
                onClick={() => {
                  setContextMenu(null);
                  onRestore(worksheet.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-all rounded-xl text-left"
              >
                <RefreshCw size={16} /> Restore
              </button>
            ) : (
              <button
                onClick={() => {
                  setContextMenu(null);
                  onDelete(worksheet.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 transition-all rounded-xl text-left"
              >
                <Archive size={16} /> Archive
              </button>
            )}
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button
              onClick={() => {
                setContextMenu(null);
                onDelete(worksheet.id);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded-xl text-left"
            >
              <Trash2 size={16} /> {onRestore ? "Delete Permanently" : "Delete"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Detail View ---
const DetailView: React.FC<{ worksheet: Worksheet; onBack: () => void }> = ({ worksheet, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'logic'>(worksheet.elements ? 'preview' : 'logic');
  const [showAnswers, setShowAnswers] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- SILENT HIGH-FIDELITY ENGINE ---
  // Uses html-to-image to generate an Ultra-Resolution snapshot (6x) 
  // which is indistinguishable from vector for 99% of use cases, 
  // bypassing the print dialog while maintaining "Pro" quality.
  const handleDownloadPDF = async () => {
    if (!exportRef.current) return;
    setIsGenerating(true);
    try {
      // 1. Wait for fonts/images to settle (Critical for layout stability)
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 800));

      // 2. Generate Ultra-Res Image (6x Scale = ~600 DPI)
      // html-to-image uses strictly better font rendering than html2canvas
      const dataUrl = await htmlToImage.toPng(exportRef.current, {
        quality: 1.0,
        pixelRatio: 6, // Ultra-High Resolution
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)', // Ensure no pre-scaling artifacts
        }
      });

      // 3. Generate PDF
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // 4. Inject Image (FAST compression to avoid artifacts, or NONE)
      doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      doc.save(`${worksheet.title}.pdf`);

    } catch (err) {
      console.error("Silent export failed:", err);
      alert("Failed to generate PDF. See console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-12"
    >
      {/* Hidden Export Container for WYSIWYG Capture - DIRECT SNAPSHOT VERSION */}
      <div
        data-export-root
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '794px',
          height: '1123px',
          overflow: 'visible',
          zIndex: -9999,
          pointerEvents: 'none',
          opacity: 0, // Truly hidden but rendered in DOM for capture
          background: 'white'
        }}
        aria-hidden="true"
      >
        <WorksheetPreview
          ref={exportRef}
          elements={worksheet.elements || []}
          originalImageUrl={worksheet.originalImageUrl}
          showAnswers={showAnswers}
        />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all shrink-0"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate" title={worksheet.title}>
              {worksheet.title}
            </h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Generated on {worksheet.date}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {worksheet.elements && (
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-slate-800/50">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-slate-700 text-sky-500 shadow-md ring-1 ring-slate-100 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Layout size={14} />
                <span className="hidden sm:inline">Sheet</span>
                <span className="sm:hidden text-[10px]">Sheet</span>
              </button>
              <button
                onClick={() => setViewMode('logic')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'logic' ? 'bg-white dark:bg-slate-700 text-sky-500 shadow-md ring-1 ring-slate-100 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Activity size={14} />
                <span className="hidden sm:inline">Logic</span>
                <span className="sm:hidden text-[10px]">Logic</span>
              </button>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${showAnswers
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-200 dark:shadow-none'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
                <span className="hidden sm:inline">Answers</span>
                <span className="sm:hidden text-[10px]">Ans</span>
              </button>
            </div>
          )}

          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-2xl font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-sky-200 dark:hover:border-sky-900 transition-all disabled:opacity-50 group"
          >
            {isGenerating ? (
              <RefreshCw className="animate-spin text-sky-500" size={18} />
            ) : (
              <Download className="text-slate-400 group-hover:text-sky-500 transition-colors" size={18} />
            )}
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden text-xs">PDF</span>
          </button>
        </div>
      </div>

      {viewMode === 'preview' && worksheet.elements ? (
        <div className="flex justify-center p-4 md:p-12 bg-slate-100/50 dark:bg-slate-900/30 rounded-[32px] md:rounded-[48px] border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[500px] md:min-h-[900px]">
          <div className="origin-top shadow-2xl border border-slate-200 transition-transform" style={{ transform: isMobile ? `scale(${window.innerWidth / 850})` : 'scale(0.75)' }}>
            <WorksheetPreview
              elements={worksheet.elements}
              originalImageUrl={worksheet.originalImageUrl}
              showAnswers={showAnswers}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {worksheet.elements?.filter(el => el.type === 'problem' || el.type === 'word_problem').map((el, idx) => (
            <TiltCard key={el.id || idx} className="p-8 border-l-4 border-l-sky-500">
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="px-3 py-1 bg-sky-50 dark:bg-sky-900/30 text-sky-500 text-[10px] font-black uppercase tracking-wider rounded-lg">
                    {el.skill || "Mathematics"}
                  </div>
                  <div className="text-slate-300 dark:text-slate-700 font-black text-4xl">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                </div>

                {worksheet.type === 'Mirror' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Original Logic</h4>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                        {el.type === 'problem' ? (
                          <MathText tex={el.content || ""} className="text-slate-600 dark:text-slate-300" />
                        ) : (
                          <RichTextRenderer text={el.content || ""} />
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-sky-500">Mirrored Reflection</h4>
                      <div className="p-5 bg-sky-50/50 dark:bg-sky-900/20 rounded-2xl text-slate-800 dark:text-white font-bold text-lg leading-relaxed shadow-sm">
                        {el.type === 'problem' ? (
                          <MathText tex={el.mirroredContent || ""} className="dark:text-slate-200" />
                        ) : (
                          <RichTextRenderer text={el.mirroredContent || ""} />
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Problem Content</h4>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-800 dark:text-white font-bold text-xl leading-relaxed">
                      {el.type === 'problem' ? (
                        <MathText tex={el.content || ""} className="text-xl" />
                      ) : (
                        <RichTextRenderer text={el.content || ""} />
                      )}
                    </div>
                  </div>
                )}

                {showAnswers && el.solution && (
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                      <CheckCircle2 size={14} /> Official Solution
                    </h4>
                    <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-300 font-bold">
                      <RichTextRenderer text={el.solution} />
                    </div>
                  </div>
                )}
              </div>
            </TiltCard>
          )) || worksheet.content?.problems.map((prob, idx) => (
            <TiltCard key={idx} className="p-8 border-l-4 border-l-sky-500">
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="px-3 py-1 bg-sky-50 dark:bg-sky-900/30 text-sky-500 text-[10px] font-black uppercase tracking-wider rounded-lg">
                    {prob.skill || "Mathematics"}
                  </div>
                  <div className="text-slate-300 dark:text-slate-700 font-black text-4xl">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                </div>

                {worksheet.type === 'Mirror' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Original Logic</h4>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                        <MathText tex={prob.original || ""} className="text-slate-600 dark:text-slate-300" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-sky-500">Mirrored Reflection</h4>
                      <div className="p-5 bg-sky-50/50 dark:bg-sky-900/20 rounded-2xl text-slate-800 dark:text-white font-bold text-lg leading-relaxed shadow-sm">
                        <MathText tex={prob.mirrored} className="dark:text-slate-200" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Problem Content</h4>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-800 dark:text-white font-bold text-xl leading-relaxed">
                      <MathText tex={prob.mirrored} className="text-xl" />
                    </div>
                  </div>
                )}

                {showAnswers && prob.solution && (
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                      <CheckCircle2 size={14} /> Official Solution
                    </h4>
                    <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-300 font-bold">
                      <RichTextRenderer text={prob.solution} />
                    </div>
                  </div>
                )}
              </div>
            </TiltCard>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const MirrorWorkspace: React.FC<{
  onCreate: (worksheet: Worksheet, file?: File) => Promise<any>;
  setView: (v: ViewState) => void;
}> = ({ onCreate, setView }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [scanningElements, setScanningElements] = useState<LayoutElement[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert file to generative part
  async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        data: (await base64EncodedDataPromise) as string,
        mimeType: file.type
      },
    };
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
      setUploadStatus('idle');
    }
  };

  const startMirroring = async () => {
    if (!selectedFile) return;
    setUploadStatus('processing');
    setScanningElements([]);
    setScanProgress(0);

    try {
      const imagePart = await fileToGenerativePart(selectedFile);

      const prompt = `
        Analyze this worksheet and perform a precise structural and spatial parsing. 
        CRITICAL: I need to reconstruct this worksheet EXACTLY as it appears. 

        Identify every element on the page including:
        - Header Labels (e.g., "Name:", "Date:", "Score:")
        - Question numbers (e.g., "1.", "2)")
        - Pure Math Problems (type: 'problem'). content MUST be a standalone equation (e.g. "x^2 + 5 = 10"). Do NOT put instructions or sentences here.
        - Word Problems / Mixed Content (type: 'word_problem'). Use this for ANY content that contains words, sentences, or instructions.
             CRITICAL: If the text contains math, wrap the math parts in LaTeX delimiters.
             Use \\( ... \\) for inline math and \\\[ ... \\\] for block math.
             Example: "Solve for \\(x\\) in the equation \\(y = mx + b\\)." NOT "$x$" or "x"
        - Currency/Money: Use a plain $ sign (e.g., "$10.00"). DO NOT escape it with a backslash (no "\$").
        - Diagrams or Graphs (CRITICAL: Only identify charts, graphs, or geometric figures ESSENTIAL to solving a problem. Do NOT include logos, clipart, or page borders).
        - Section Headers (e.g., "Part A", "Geometry")
        - Response Areas (CRITICAL: Identify ALL underlines '_______', empty boxes, or writing spaces intended for student answers. Extract as type 'response_area').
        - Footer or instructions (type: 'instruction'). Treat same as 'word_problem' for mixed math/text.

        LAYOUT RULES:
        1. Bounding Boxes: Provide generous [ymin, xmin, ymax, xmax] boxes (normalized 0-1000). 
           - CRITICAL: Math problems and Word Problems NEED vertical breathing room. Give them 30% MORE vertical height (ymin, ymax).
           - CRITICAL: Question Numbers (e.g. "1.") MUST be kept separate from the Problem Text. Ensure their boxes do NOT overlap.
           - IGNORE logos, school branding, or decorative images at the top/corners of the page.
           - IGNORE copyright symbols (©), publisher names, website URLs, and page numbers at the bottom.
           - Ensure the width (xmax-xmin) is wide enough to contain full content without clipping.
           - If a problem has multiple lines, group them or ensure boxes are vertically aligned.
        2. Visual Hierarchy: Detect font size (in pts), font weight (bold/normal), horizontal alignment (left/center/right), and font family (serif/sans-serif).
        3. Mirroring:
           - For every problem (math or word), generate a "Mirrored" version using different numbers/variables/scenarios but maintaining the same logic and difficulty.
           - Return the mirrored problem in LaTeX for equations, or text for word problems.
           - For diagrams, if possible, describe a mirrored version or keep the original description.
           - For Response Areas, keep them as is (e.g. "__________" or "[Box]").
           - Keep labels like "Name:" or "Date:" as they are.

        GENERATE JSON:
        Return strict JSON in this format:
        {
          "title": "Clear Title of Worksheet",
          "elements": [
            {
              "id": "unique_id",
              "type": "header" | "problem" | "question_number" | "white_space" | "instruction" | "word_problem" | "diagram" | "section_header" | "response_area",
              "content": "Original text or LaTeX",
              "mirroredContent": "New problem LaTeX/text or original label",
              "boundingBox": [ymin, xmin, ymax, xmax],
              "style": {
                "fontSize": number,
                "fontWeight": "normal" | "bold",
                "alignment": "left" | "center" | "right",
                "fontFamily": "serif" | "sans-serif"
              }
            }
          ]
        }
      `;

      console.log("Starting AI analysis with spatial reasoning (Edge Function)...");

      // Call Edge Function using raw fetch and Anon Key
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mirror-ai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mirror',
          payload: {
            image: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Edge Function Failed:", response.status, errorText);
        alert(`Edge Function Failed: ${errorText}`);
        throw new Error(`Edge Function returned ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      const text = responseData.data;

      console.log("AI result received");

      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON parsing failed:", text);
        // Try to find any JSON array/object in the text if the block was missing
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Invalid AI response format");
        }
      }

      // Robustly extract elements
      const elements = Array.isArray(data) ? data : (data.elements || []);
      if (elements.length === 0) {
        console.warn("AI returned zero elements:", data);
      }
      for (let i = 0; i <= elements.length; i++) {
        setScanningElements(elements.slice(0, i));
        setScanProgress(Math.floor((i / elements.length) * 100));
        await new Promise(r => setTimeout(r, 100)); // Visual delay
      }

      const newWorksheet: Worksheet = {
        id: Date.now().toString(),
        title: data.title || selectedFile.name.split('.')[0] + ' Reflection',
        type: 'Mirror',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        elements: elements,
        originalImageUrl: previewUrl || undefined,
        content: {
          problems: elements
            .filter((el: any) => el.type === 'problem')
            .map((el: any) => ({
              original: el.content,
              mirrored: el.mirroredContent || el.content,
              skill: el.skill || 'Math Reflection'
            })),
          solution: "Generated by Layout-Aware Mirroring System"
        }
      };

      await onCreate(newWorksheet, selectedFile || undefined);
      setUploadStatus('done');

      setTimeout(() => {
        setView('home');
      }, 1500);

    } catch (error: any) {
      console.error("Mirroring failed:", error);
      alert(`AI analysis failed: ${error.message || "Unknown error"}`);
      setUploadStatus('idle');
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadStatus('idle');
  };

  if (uploadStatus === 'processing') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden">
        <div className="relative w-full max-w-2xl aspect-[3/4] bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
          {/* Original Preview Background */}
          {previewUrl && (
            <img src={previewUrl} alt="Scanning" className="w-full h-full object-contain opacity-30 grayscale" />
          )}

          {/* Scanning Beam */}
          <motion.div
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_15px_rgba(14,165,233,0.5)] z-20"
          />

          {/* Detected Elements Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {scanningElements.map((el, idx) => (
              <motion.div
                key={el.id || idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 0.6, scale: 1 }}
                className={`absolute border rounded-sm ${el.type === 'problem' ? 'border-sky-500 bg-sky-500/10' :
                  el.type === 'header' ? 'border-purple-500 bg-purple-500/10' :
                    el.type === 'question_number' ? 'border-green-500 bg-green-500/10' :
                      'border-slate-400 bg-slate-400/5'
                  }`}
                style={{
                  top: `${el.boundingBox[0] / 10}%`,
                  left: `${el.boundingBox[1] / 10}%`,
                  height: `${(el.boundingBox[2] - el.boundingBox[0]) / 10}%`,
                  width: `${(el.boundingBox[3] - el.boundingBox[1]) / 10}%`,
                }}
              >
                {el.type === 'problem' && (
                  <div className="absolute -top-4 left-0 text-[8px] font-bold text-sky-600 uppercase">Problem mapped</div>
                )}
              </motion.div>
            ))}
          </div>

          {!previewUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-12 h-12 text-slate-300 animate-spin" />
            </div>
          )}
        </div>

        <div className="mt-8 text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Scan className="w-5 h-5 text-sky-500 animate-pulse" />
            <h2 className="text-xl font-bold dark:text-white">Mapping Coordinates...</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">
            Gemini is identifying worksheet structure and generating mathematically equivalent mirrored problems.
          </p>
          <div className="w-64 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mx-auto">
            <motion.div
              className="h-full bg-sky-500"
              initial={{ width: 0 }}
              animate={{ width: `${scanProgress}%` }}
            />
          </div>
          <div className="text-xs font-mono text-slate-400">{scanProgress}% - Spatial Parsing Active</div>
        </div>
      </div>
    );
  }

  if (uploadStatus === 'done') {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-8">
        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-500">
          <CheckCircle2 size={48} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-800 dark:text-white">Reflection Complete!</h2>
          <p className="text-slate-500 font-medium">Your new worksheet is ready in the library.</p>
        </div>
        <button
          onClick={reset}
          className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          Mirror Another One
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf"
      />

      {!selectedFile ? (
        <div className="text-center space-y-8">
          <motion.div
            whileHover={{ y: -5 }}
            onClick={() => fileInputRef.current?.click()}
            className="w-40 h-40 mx-auto bg-white dark:bg-slate-900 border-4 border-dashed border-sky-100 dark:border-slate-800 rounded-[48px] flex items-center justify-center text-sky-500 cursor-pointer shadow-sm hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all"
          >
            <Upload size={60} strokeWidth={1.5} />
          </motion.div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Start Mirroring</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-md mx-auto">
              Upload a snapshot of your worksheet. We'll handle the handwriting and the math.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-10 py-5 bg-sky-500 hover:bg-sky-600 text-white font-black text-lg rounded-3xl shadow-xl transition-all active:scale-95 flex items-center gap-3 mx-auto"
          >
            {/* Standard mobile browser behavior for <input type="file" accept="image/*"> shows Camera option */}
            Choose File or Take Photo
          </button>
        </div>
      ) : (
        <div className="w-full max-w-2xl space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Document Preview</h2>
            <button onClick={reset} className="text-slate-400 hover:text-red-500 font-bold flex items-center gap-2">
              <X size={20} /> Remove
            </button>
          </div>

          <div className="glass-card rounded-[40px] overflow-hidden border border-sky-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 min-h-[400px] flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-h-[500px] w-auto object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <FileText size={80} strokeWidth={1} />
                <span className="font-bold text-xl">{selectedFile.name}</span>
                <span className="text-sm font-medium uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
                  PDF Document
                </span>
              </div>
            )}
          </div>

          <button
            onClick={startMirroring}
            className="w-full py-6 bg-gradient-to-r from-sky-400 to-blue-600 text-white font-black text-2xl rounded-[32px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            <Zap fill="white" /> Reflect This Worksheet
          </button>

          <p className="text-center text-slate-400 font-medium">
            AI reflection typically takes 3-5 seconds depending on logic complexity.
          </p>
        </div>
      )}
    </div>
  );
};

const GeneratorWorkspace: React.FC<{ onCreate: (worksheet: Worksheet) => Promise<any> }> = ({ onCreate }) => {
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("Grade 3");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [wordProblemPercent, setWordProblemPercent] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState("Initializing AI...");

  // Cycling loading text (Technical Theme)
  useEffect(() => {
    if (!isGenerating) return;
    const messages = [
      `Initializing construct: "${topic}"...`,
      "Synthesizing problem matrix...",
      "Calibrating difficulty vectors...",
      "Rendering output schema...",
      "Verifying logic integrity...",
      "Finalizing sequence..."
    ];
    let i = 0;
    setLoadingText(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingText(messages[i]);
    }, 1200);
    return () => clearInterval(interval);
  }, [isGenerating, topic]);



  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);

    try {
      // 1. Construct Prompt for Creation (BLOCK FORMAT - No JSON)
      const prompt = `
        Create a ${gradeLevel} math worksheet about "${topic}".
        Difficulty: ${difficulty}.
        
        Total Questions: ${questionCount}.
        Target Composition:
        - Word Problems: ${Math.round(questionCount * (wordProblemPercent / 100))}
        - Pure Equations: ${questionCount - Math.round(questionCount * (wordProblemPercent / 100))}

        Generate exactly ${questionCount} distinct problems.

        RETURN A RAW TEXT BLOCK using these exact delimiters. Do not use Markdown or JSON.

        ---TITLE---
        Creative Title Here
        ---PROBLEM---
        Type: problem
        Content: \\frac{1}{2} + \\frac{1}{3}
        Solution: \\( \\frac{5}{6} \\)
        ---PROBLEM---
        Type: word_problem
        Content: A train leaves a station...
        Solution: 120 miles. Logic: Distance = Speed * Time.
        ---PROBLEM---
        ...

        RULES:
        1. CONTENT for 'problem' types must be **PURE LATEX ONLY**. NO TEXT. NO "Calculate". NO "Solve".
        2. CONTENT for 'word_problem' types must use \\( ... \\) around ALL math expressions. Example: "Calculate \\( \\sum_{n=1}^{\\infty} \\frac{1}{n} \\)."
        3. Do NOT escape currency symbols like \\$10 anymore. Just use $10. The system uses LaTeX delimiters for math now.
        4. Maintain proper sentence structure and spacing in word problems.
        5. Do NOT use command words like 'Solve' in 'problem' content. Just the expression.
        6. **ABSOLUTELY CRITICAL**: You MUST provide a "Solution" for every problem. 
           - For numerical problems, provide the final number or expression.
           - For word problems, providing the final answer + a very brief 1-sentence explanation of the logic.
        7. **STRICT RATIO**: You MUST generate exactly ${Math.round(questionCount * (wordProblemPercent / 100))} Word Problems and ${questionCount - Math.round(questionCount * (wordProblemPercent / 100))} Equations. Do not vary from this.
      `;

      // 2. Call Edge Function using raw fetch and Anon Key (to avoid User Token 401s)
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!anonKey) throw new Error("Missing Supabase Anon Key");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mirror-ai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate',
          payload: {
            topic,
            gradeLevel,
            difficulty,
            questionCount,
            wordProblemPercent
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Edge Function Failed:", response.status, errorText);
        alert(`Generation Failed (${response.status}): ${errorText}`);
        throw new Error(`Edge Function returned ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const text = responseData.data;

      // PARSE BLOCK FORMAT
      // 1. Extract Title
      const titleMatch = text.match(/---TITLE---\s*\n?(.*?)\n?---PROBLEM---/s);
      const title = titleMatch ? titleMatch[1].trim() : "Generated Worksheet";

      // 2. Extract Problems
      const problemBlocks = text.split('---PROBLEM---').slice(1); // Skip everything before first delimiter
      const parsedProblems = problemBlocks.map(block => {
        const typeMatch = block.match(/Type:\s*(problem|word_problem)/i);
        const contentMatch = block.match(/Content:\s*([\s\S]*?)(?=Solution:|$|---PROBLEM---)/i);
        const solutionMatch = block.match(/Solution:\s*([\s\S]*?)(?=$|---PROBLEM---)/i);

        if (!contentMatch) return null;

        return {
          type: typeMatch ? typeMatch[1].toLowerCase() as 'problem' | 'word_problem' : 'problem',
          content: contentMatch[1].trim(),
          solution: solutionMatch ? solutionMatch[1].trim() : ""
        };
      }).filter(p => p !== null).slice(0, questionCount) as { type: 'problem' | 'word_problem', content: string, solution: string }[];

      const data = { title, problems: parsedProblems };

      // 2. Synthesize Layout (Two-Column Grid)
      const elements: LayoutElement[] = [];
      const pageHeight = 1000;
      const pageWidth = 1000;
      const margin = 50;
      const headerHeight = 150;
      const contentStart = headerHeight + 20;

      // Header: Minimalist with unified label/line for perfect alignment
      elements.push(
        {
          id: 'h1', type: 'header', content: 'Name: ___________________________',
          boundingBox: [50, margin, 80, 450],
          style: { fontSize: 12, fontWeight: 'normal', alignment: 'left', fontFamily: 'sans-serif' }
        },
        {
          id: 'h2', type: 'header', content: 'Date: ___________________________',
          boundingBox: [50, 650, 80, pageWidth - margin],
          style: { fontSize: 12, fontWeight: 'normal', alignment: 'right', fontFamily: 'sans-serif' }
        },
        {
          id: 'title', type: 'section_header', content: data.title.toUpperCase(),
          boundingBox: [100, margin, 140, pageWidth - margin],
          style: { fontSize: 16, fontWeight: 'bold', alignment: 'center', fontFamily: 'sans-serif' }
        }
      );

      // Grid Calculation
      const numProblems = data.problems.length;
      const cols = 2;
      const colGap = 60;
      const colWidth = (pageWidth - (2 * margin) - colGap) / cols;

      const rows = Math.ceil(numProblems / cols);
      const availableHeight = pageHeight - contentStart - margin;
      const rowHeight = Math.floor(availableHeight / rows);

      // "60/40 Rule": Content uses top 40%, 60% is whitespace
      const minRowHeight = 150;
      const effectiveRowHeight = Math.max(rowHeight, minRowHeight);
      const contentZoneHeight = effectiveRowHeight * 0.4;

      // --- AUTO-FORMATTING HELPER ---
      // Detects LaTeX/Math in text and ensures it's wrapped in \( ... \)
      const autoFormatMath = (text: string): string => {
        let processed = text;

        // 1. Already has delimiters? Skip wrapping if it looks balanced
        const hasDelimiters = /\\\(.*?\\\)|\\\[.*?\\\]/.test(processed);
        if (hasDelimiters) return processed;

        // 2. Wrap math-y chunks
        // Expanded regex to capture commands with subscripts/superscripts (e.g. \sum_{n=1}) and standard operations
        return processed.replace(/(\\[a-zA-Z]+(?:\[[^[\]]*\])?(?:\{[^{}]*\}|\s*[\^_](?:\{[^{}]*\}|[a-zA-Z0-9]+)|\s+)*|[\d]+[\d+=\-/*()^._<>!]*[\d]+|[\d+=\-/*()^._<>!]{2,})/g, (match) => {
          // Skip if it's just a number without any operators or LaTeX
          if (!/[\\]|[\^_{}=/*+]/.test(match)) return match;

          // Heuristic: If it ends with space, trim it to avoid eating into next word
          // trimming match.trim() is already done below, but the regex might consume leading/trailing space if \s+ matched.
          // The regex allows \s+ inside the command structure (for \sum _...), which is good.

          return ` \\(${match.trim()}\\) `;
        });
      };

      data.problems.forEach((prob, idx) => {
        const numId = `q${idx}`;
        const probId = `p${idx}`;

        const colIndex = idx % cols;
        const rowIndex = Math.floor(idx / cols);

        const xStart = margin + (colIndex * (colWidth + colGap));
        const yStart = contentStart + (rowIndex * effectiveRowHeight);

        // Content Processing & Type Correction
        let finalType = prob.type;
        let cleanContent = prob.content;

        // 1. Clean up "Solve" commands ONLY for pure problems
        if (finalType === 'problem') {
          cleanContent = cleanContent.replace(/^(Solve|Calculate|Evaluate|Simplify|Find|Determine)\s*:?\s*/i, '');
        }

        // 2. Format Math
        if (finalType === 'problem') {
          // If it looks like text, switch to word_problem
          if (/[a-zA-Z]{4,}\s/.test(cleanContent) && !cleanContent.includes('\\text')) {
            finalType = 'word_problem';
            cleanContent = autoFormatMath(cleanContent);
          } else {
            // Pure math: Ensure no $ (MathText handles display mode)
            cleanContent = cleanContent.replace(/\$/g, '');
          }
        } else {
          // word_problem: Ensure $ wrappers
          cleanContent = autoFormatMath(cleanContent);
        }

        // Question Number (Bold, Sans-Serif)
        elements.push({
          id: numId,
          type: 'question_number', // Ensure this type exists in types
          content: `${idx + 1}.`,
          boundingBox: [yStart, xStart, yStart + 30, xStart + 40],
          style: { fontSize: 14, fontWeight: 'bold', fontFamily: 'sans-serif', alignment: 'left' }
        });

        // Problem Text (Light/Normal, Sans-Serif)
        elements.push({
          id: probId,
          type: finalType as any,
          content: cleanContent,
          solution: autoFormatMath(prob.solution),
          boundingBox: [yStart, xStart + 50, yStart + contentZoneHeight, xStart + colWidth],
          style: { fontSize: 12, fontWeight: 'normal', fontFamily: 'sans-serif', alignment: 'left' }
        });
      });

      const newWorksheet: Worksheet = {
        id: crypto.randomUUID(),
        title: data.title,
        type: 'Topic',
        date: new Date().toLocaleDateString(),
        elements: elements,
        originalImageUrl: undefined // No image for generated worksheets
      };

      await onCreate(newWorksheet);

    } catch (err: any) {
      console.error("Generation failed:", err);
      alert(`Failed to generate worksheet: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 w-full max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full bg-white dark:bg-slate-950 rounded-[40px] border border-slate-200 dark:border-slate-800 p-8 md:p-10 overflow-hidden shadow-sm"
      >
        {/* Blueprint Grid Overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <div className="relative z-10 flex flex-col gap-10">

          {/* Header */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800 text-sky-600 dark:text-sky-400 font-bold text-[10px] tracking-widest uppercase">
              <Cpu size={14} /> Generator Protocol
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
              Topic <br /><span className="text-sky-500">Construct.</span>
            </h1>
            <p className="max-w-xl text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed border-l-2 border-slate-200 dark:border-slate-800 pl-4">
              Enter parameters to synthesize a new worksheet schema.
            </p>
          </div>

          {/* Topic Input */}
          <div className="space-y-3 group">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-sky-500 transition-colors">Primary Subject</label>
            <div className="relative">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Linear Algebra, Roman History"
                className="w-full h-14 pl-6 pr-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-sky-500 outline-none font-bold text-lg text-slate-900 dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                <div className="px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono">TXT</div>
              </div>
            </div>
          </div>

          {/* Grade Level */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Audience / Grade</label>
            <div className="space-y-3">
              {/* 1. Free Input */}
              <div className="relative group">
                <input
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. 5th Grade, AP Calc, Special Ed..."
                  className="w-full h-12 pl-4 pr-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-sky-500 outline-none font-bold text-sm text-slate-900 dark:text-white transition-all shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-700"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors">
                  <User size={16} />
                </div>
              </div>

              {/* 2. Scrollable Chips */}
              <div className="flex gap-2 overflow-x-auto pb-2 mask-fade-right">
                {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'Uni', 'Adult'].map(g => (
                  <button
                    key={g}
                    onClick={() => setGradeLevel(g)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${gradeLevel === g
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-sky-400 hover:text-sky-500'
                      }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parameters Row: Difficulty & Quantity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Difficulty */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Complexity Matrix</label>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                {['Easy', 'Medium', 'Hard'].map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-3 rounded-lg text-xs font-black transition-all relative z-10 ${difficulty === d ? 'text-sky-600 dark:text-sky-400 shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700' : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Slider */}
            <div className="space-y-5">
              <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Output Quantity</label>
                <div className="font-mono text-xl text-slate-900 dark:text-white font-bold">
                  {questionCount.toString().padStart(2, '0')} <span className="text-xs text-slate-400 font-sans">units</span>
                </div>
              </div>
              <input
                type="range"
                min="1" max="10"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </div>

          {/* New Mix Slider */}
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question Mix Protocol</label>
              <div className="flex items-center gap-4 font-bold text-[10px] uppercase tracking-tighter">
                <span className={wordProblemPercent < 100 ? "text-sky-500" : "text-slate-300"}>Equations</span>
                <span className="text-slate-300">/</span>
                <span className={wordProblemPercent > 0 ? "text-purple-500" : "text-slate-300"}>Word Problems</span>
              </div>
            </div>
            <div className="relative pt-2">
              <input
                type="range"
                min="0" max="100" step="10"
                value={wordProblemPercent}
                onChange={(e) => setWordProblemPercent(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between mt-3 px-1">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Static Equations</span>
                  <span className="text-lg font-mono font-bold text-slate-900 dark:text-white">{100 - wordProblemPercent}%</span>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Contextual Logic</span>
                  <span className="text-lg font-mono font-bold text-slate-900 dark:text-white">{wordProblemPercent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={!topic || isGenerating}
              className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black text-lg shadow-xl shadow-sky-500/10 flex items-center justify-center gap-3 transition-all ${!topic || isGenerating
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-600 text-white hover:shadow-sky-500/30 hover:-translate-y-0.5 active:translate-y-0'
                }`}
            >
              {isGenerating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="font-mono text-sm tracking-tight uppercase">{loadingText}</span>
                </div>
              ) : (
                <>
                  <Zap size={20} className="fill-white" />
                  <span>Generate Worksheet</span>
                </>
              )}
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
};

// Implemented missing SettingsWorkspace component to handle appearance and user preferences
const SettingsWorkspace: React.FC<{ isDark: boolean; setIsDark: (v: boolean) => void }> = ({ isDark, setIsDark }) => {
  const { signOut, userPlan, user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your workspace preferences.</p>
      </div>

      <div className="grid gap-8">
        {/* User Profile Card */}
        <div className="glass-card p-8 rounded-[40px] border border-sky-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center text-white text-2xl font-black uppercase">
              {user?.email?.[0] || "U"}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{user?.email}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Plan:</span>
                <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${userPlan === 'pro' ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {userPlan}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="px-6 py-3 bg-red-50 dark:bg-red-900/10 text-red-500 font-bold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center gap-2"
          >
            <Trash2 size={18} /> Sign Out
          </button>
        </div>

        <div className="glass-card p-10 rounded-[40px] border border-sky-100 dark:border-slate-800 space-y-10">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400">
                  {isDark ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                Appearance
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Switch between light and dark themes for the dashboard.</p>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`w-16 h-9 rounded-full relative transition-colors duration-300 ${isDark ? 'bg-sky-500' : 'bg-slate-200'}`}
            >
              <motion.div
                animate={{ x: isDark ? 30 : 4 }}
                className="absolute top-1 w-7 h-7 bg-white rounded-full shadow-lg"
              />
            </button>
          </div>

          <div className="pt-10 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between opacity-50">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-slate-400">
                    <Shield size={20} />
                  </div>
                  Security & Privacy
                </h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your data and encryption settings.</p>
              </div>
              <div className="text-slate-400 font-bold text-sm uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-md">Pro</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Dashboard ---
const Dashboard: React.FC<{
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  worksheets: Worksheet[];
  onRename: (id: string, title: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (w: Worksheet, f?: File) => Promise<any>;
}> = ({ isDark, setIsDark, worksheets, onRename, onArchive, onRestore, onDelete, onCreate }) => {
  const [view, setView] = useState<ViewState>('home');
  const [collapsed, setCollapsed] = useState(true);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const selectedWorksheet = useMemo(() => worksheets.find(w => w.id === selectedWorksheetId) || null, [worksheets, selectedWorksheetId]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectWorksheet = (w: Worksheet) => {
    setSelectedWorksheetId(w.id);
    setView('detail');
  };

  return (
    <div className="min-h-screen flex bg-slate-50/50 dark:bg-slate-950/50 blueprint-grid overflow-hidden">
      <Sidebar activeView={view === 'detail' ? 'home' : view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} />
      <motion.main
        initial={false}
        animate={{
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 260),
          width: isMobile ? '100%' : `calc(100% - ${collapsed ? 80 : 260}px)`
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="flex-1 p-6 md:p-12 pb-24 md:pb-12 relative h-screen overflow-y-auto"
      >
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
            {view === 'home' && (
              <HomeWorkspace
                worksheets={worksheets}
                onArchive={onArchive}
                setView={setView}
                onSelect={handleSelectWorksheet}
                onRename={onRename}
              />
            )}
            {view === 'mirror' && <MirrorWorkspace onCreate={onCreate} setView={setView} />}
            {view === 'generator' && <GeneratorWorkspace onCreate={async (w) => {
              // Critical Fix: onCreate returns the NEW worksheet with the REAL database ID.
              // We must use this returned object for navigation, not the temporary 'w' which has a discarded ID.
              const created = await onCreate(w);
              if (created) handleSelectWorksheet(created);
            }} />}
            {view === 'settings' && <SettingsWorkspace isDark={isDark} setIsDark={setIsDark} />}
            {view === 'archive' && (
              <ArchiveWorkspace
                worksheets={worksheets}
                onRestore={onRestore}
                onDelete={onDelete}
                setView={setView}
                onSelect={handleSelectWorksheet}
                onRename={onRename}
              />
            )}
            {view === 'detail' && selectedWorksheet && (
              <DetailView
                worksheet={selectedWorksheet}
                onBack={() => {
                  setView('home');
                  setSelectedWorksheetId(null);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  );
};

// --- Root App ---
const App: React.FC = () => {
  const { session, loading } = useAuth();
  const [isOnDashboard, setIsOnDashboard] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (session) {
      setIsOnDashboard(true);
      setShowAuth(false);
    } else {
      setIsOnDashboard(false);
    }
  }, [session]);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mirror-math-theme');
      if (saved) return saved === 'dark';
      // Default to light mode (false) even if system prefers dark
      return false;
    }
    return false;
  });

  const { worksheets, createWorksheet, updateWorksheet, deleteWorksheet } = useSupabaseWorksheets();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mirror-math-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mirror-math-theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen transition-colors overflow-x-hidden">
      <AnimatePresence mode="wait">
        {showAuth && !session ? (
          <motion.div key="auth" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/30 dark:bg-slate-950/50 backdrop-blur-md">
            <div className="relative w-full max-w-md">
              <button
                onClick={() => setShowAuth(false)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
              <Auth disableSignup={true} />
            </div>
          </motion.div>
        ) : !isOnDashboard ? (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.6 }}>
            <LandingPage onStart={() => session ? setIsOnDashboard(true) : setShowAuth(true)} isDark={isDark} />
          </motion.div>
        ) : (
          <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <Dashboard
              isDark={isDark}
              setIsDark={setIsDark}
              worksheets={worksheets}
              onCreate={createWorksheet}
              onRename={(id, title) => {
                const ws = worksheets.find(w => w.id === id);
                const updates: Partial<Worksheet> = { title };

                // If it's a generated worksheet with a title element, update that too
                if (ws?.elements) {
                  const hasTitleElement = ws.elements.some(el => el.id === 'title');
                  if (hasTitleElement) {
                    updates.elements = ws.elements.map(el =>
                      el.id === 'title' ? { ...el, content: title.toUpperCase() } : el
                    );
                  }
                }

                updateWorksheet(id, updates);
              }}
              onArchive={(id) => updateWorksheet(id, { isArchived: true })}
              onRestore={(id) => updateWorksheet(id, { isArchived: false })}
              onDelete={deleteWorksheet}
            />  </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


export default App;
