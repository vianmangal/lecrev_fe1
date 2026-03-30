import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextInput, CyanBtn, GhostBtn } from './components/UI';
import { Shield, ArrowRight, Github, Mail } from 'lucide-react';

interface AuthScreenProps {
  initialMode?: 'signin' | 'register';
  onSuccess: () => void;
  onBack: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ initialMode = 'signin', onSuccess, onBack }) => {
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate auth delay
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-white shrink-0">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
              </svg>
            </div>
            <h1 className="text-3xl tracking-tighter font-black uppercase">LECREV</h1>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-sub">Secure Infrastructure Access</p>
        </div>

        <div className="bg-surface border border-border p-8 shadow-2xl relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'signin' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'signin' ? 10 : -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-lg uppercase tracking-tight mb-8">
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {mode === 'register' && (
                  <TextInput label="Full Name" placeholder="Alex Chen" />
                )}
                <TextInput label="Email Address" placeholder="alex@lecrev.sh" />
                <TextInput label="Password" placeholder="••••••••" />
                
                {mode === 'register' && (
                  <TextInput label="Confirm Password" placeholder="••••••••" />
                )}

                <div className="mt-4">
                  <CyanBtn className="w-full py-3">
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {mode === 'signin' ? 'Access Dashboard' : 'Initialize Account'}
                        <ArrowRight size={14} />
                      </span>
                    )}
                  </CyanBtn>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-border">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted text-center mb-6">
                  Or continue with
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <GhostBtn className="flex items-center justify-center gap-2 py-2.5">
                    <Github size={14} />
                    Github
                  </GhostBtn>
                  <GhostBtn className="flex items-center justify-center gap-2 py-2.5">
                    <Mail size={14} />
                    Google
                  </GhostBtn>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button 
            onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')}
            className="text-[10px] uppercase tracking-[0.15em] text-sub hover:text-white transition-colors bg-transparent border-none cursor-pointer"
          >
            {mode === 'signin' 
              ? "Don't have an account? Register →" 
              : "Already have an account? Sign In →"}
          </button>
          
          <button 
            onClick={onBack}
            className="text-[10px] uppercase tracking-[0.15em] text-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer"
          >
            ← Return to Dashboard
          </button>
        </div>
      </motion.div>

      {/* System Status Footer */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between text-[9px] uppercase tracking-[0.2em] text-muted pointer-events-none">
        <span>Auth_Protocol: TLS_1.3</span>
        <span>Status: Ready</span>
      </div>
    </div>
  );
};
