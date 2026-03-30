import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Github, Shield } from 'lucide-react';
import { CyanBtn } from './components/UI';
import { authClient } from './lib/auth-client';

interface AuthScreenProps {
  initialMode?: 'signin' | 'register';
  onSuccess: () => void;
  onBack: () => void;
  required?: boolean;
  githubConfigured?: boolean;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'GitHub sign-in failed. Check your Better Auth and GitHub OAuth settings.';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode = 'signin',
  onSuccess,
  onBack,
  required = false,
  githubConfigured = true,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGithubAuth = async () => {
    if (!githubConfigured) {
      setError('GitHub OAuth is not configured yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env.local, then restart npm run dev.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const callbackURL = window.location.origin;
      const response = await authClient.signIn.social({
        provider: 'github',
        callbackURL,
        errorCallbackURL: callbackURL,
        disableRedirect: true,
      });

      if (response.data?.url) {
        window.location.href = response.data.url;
        return;
      }

      setIsLoading(false);
      onSuccess();
    } catch (err) {
      setIsLoading(false);
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-[440px] relative z-10"
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
          <p className="text-[10px] uppercase tracking-[0.2em] text-sub">
            Better Auth + GitHub OAuth
          </p>
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
              <div className="flex items-start gap-4 mb-8">
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-cyan-primary shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <h2 className="text-lg uppercase tracking-tight mb-2">
                    {mode === 'signin' ? 'Sign In With GitHub' : 'Create Your Access Account'}
                  </h2>
                  <p className="text-[11px] leading-5 text-sub">
                    {mode === 'signin'
                      ? 'Access the dashboard through GitHub instead of the old mock auth flow.'
                      : 'New accounts are provisioned through GitHub OAuth and stored by Better Auth.'}
                  </p>
                </div>
              </div>

              <div className="border border-border bg-black/20 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Github size={18} />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.15em]">GitHub Provider</p>
                    <p className="text-[10px] text-sub mt-1">
                      Redirects to GitHub, then returns to this dashboard with a session cookie.
                    </p>
                  </div>
                </div>

                <CyanBtn
                  className="w-full py-3"
                  disabled={isLoading || !githubConfigured}
                  onClick={() => {
                    void handleGithubAuth();
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {isLoading
                      ? 'Redirecting to GitHub...'
                      : !githubConfigured
                        ? 'GitHub Auth Not Configured'
                        : mode === 'signin'
                          ? 'Continue with GitHub'
                          : 'Create with GitHub'}
                    {!isLoading && <ArrowRight size={14} />}
                  </span>
                </CyanBtn>

                <p className="text-[10px] uppercase tracking-[0.15em] text-muted text-center mt-4">
                  Callback URL: `/api/auth/callback/github`
                </p>

                {!githubConfigured && (
                  <div className="mt-4 border border-amber-500/30 bg-amber-500/8 p-3 text-[10px] leading-5 text-amber-200">
                    Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `BETTER_AUTH_SECRET` to `.env.local`, then restart `npm run dev`.
                  </div>
                )}

                {error && (
                  <p className="text-[10px] leading-5 text-red-400 mt-4">
                    {error}
                  </p>
                )}
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
              ? 'Need first-time access? Create account view →'
              : 'Already invited? Back to sign in →'}
          </button>

          {!required && (
            <button
              onClick={onBack}
              className="text-[10px] uppercase tracking-[0.15em] text-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer"
            >
              ← Return to Dashboard
            </button>
          )}
        </div>
      </motion.div>

      <div className="absolute bottom-6 left-6 right-6 flex justify-between text-[9px] uppercase tracking-[0.2em] text-muted pointer-events-none">
        <span>Auth_Protocol: GitHub_OAuth</span>
        <span>{required ? 'Status: Authentication Required' : 'Status: Ready'}</span>
      </div>
    </div>
  );
};
