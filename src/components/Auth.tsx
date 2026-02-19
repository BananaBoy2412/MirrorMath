
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, Loader2, CheckCircle2, AlertCircle, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';

export const Auth: React.FC<{ disableSignup?: boolean }> = ({ disableSignup = false }) => {
    const { signInWithPassword, signUpWithPassword } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false); // Used for signup confirmation if needed
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp && !disableSignup) {
                const { data, error } = await signUpWithPassword(email, password);
                if (error) throw error;

                // If signup is successful but no session, it means email confirmation is required
                if (data?.user && !data?.session) {
                    setSent(true);
                }
            } else {
                const { error } = await signInWithPassword(email, password);
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[32px] shadow-2xl overflow-hidden relative"
            >
                {/* Decorative Glows */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

                <div className="p-8 md:p-10 relative z-10">
                    <div className="text-center mb-10 space-y-4">
                        <div className="inline-flex justify-center p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-lg shadow-sky-900/5 mb-2 ring-1 ring-slate-100 dark:ring-slate-700">
                            <Logo size={48} className="drop-shadow-sm" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {isSignUp ? "Create Account" : "Welcome Back"}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mt-2">
                                {isSignUp ? "Start your journey." : "Sign in to continue."}
                            </p>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {!sent ? (
                            <motion.form
                                key="login-form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleSubmit}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Email Address</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Mail className="text-slate-400 group-focus-within:text-sky-500 transition-colors" size={20} />
                                            </div>
                                            <input
                                                id="email"
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="teacher@school.edu"
                                                className="w-full bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-200 dark:border-slate-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 dark:text-white outline-none transition-all placeholder:font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="password" className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Password</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Lock className="text-slate-400 group-focus-within:text-sky-500 transition-colors" size={20} />
                                            </div>
                                            <input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={6}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-200 dark:border-slate-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl py-4 pl-12 pr-12 font-bold text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-sky-500 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold">
                                        <AlertCircle size={18} className="shrink-0" />
                                        {error}
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-sky-500/20 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24} /> : (
                                        <>
                                            {isSignUp ? "Create Account" : "Sign In"} <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>

                                {!disableSignup && (
                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setIsSignUp(!isSignUp)}
                                            className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-sky-500 transition-colors"
                                        >
                                            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                                        </button>
                                    </div>
                                )}

                                <p className="text-center text-xs font-semibold text-slate-400 dark:text-slate-600 max-w-[240px] mx-auto leading-relaxed">
                                    By continuing, you agree to our Terms of Service.
                                </p>
                            </motion.form>
                        ) : (
                            <motion.div
                                key="success-message"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center space-y-6 py-4"
                            >
                                <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-green-50/50 dark:ring-green-900/10">
                                    <CheckCircle2 size={48} className="text-green-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">Check your email</h3>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                        We sent a confirmation link to <br /><span className="text-sky-500 font-bold">{email}</span>
                                    </p>
                                </div>
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                    <button onClick={() => setSent(false)} className="text-sm font-bold text-slate-400 hover:text-sky-500 transition-colors flex items-center justify-center gap-2 mx-auto">
                                        <ArrowRight size={14} className="rotate-180" /> Use a different email
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Strip */}
                <div className="bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 py-4 px-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider backdrop-blur-md">
                    <span className="flex items-center gap-1.5"><Shield size={12} className="text-emerald-500" /> End-to-End Encrypted</span>
                    <span>MirrorMath Secure ID</span>
                </div>
            </motion.div>
        </div>
    );
};
