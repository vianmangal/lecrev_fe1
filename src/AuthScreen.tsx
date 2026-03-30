import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Github } from 'lucide-react';
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
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="w-full max-w-xs flex flex-col items-center gap-8"
      >
        {/* Logo + Name */}
        <div className="flex items-center gap-3">
          <div className="text-white shrink-0">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-3xl tracking-tighter font-black uppercase">LECREV</h1>
        </div>

        {/* GitHub Button */}
        <CyanBtn
          className="w-full py-3"
          disabled={isLoading || !githubConfigured}
          onClick={() => { void handleGithubAuth(); }}
        >
          <span className="flex items-center justify-center gap-2">
            <Github size={16} />
            {isLoading
              ? 'Redirecting to GitHub...'
              : mode === 'signin'
                ? 'Sign in with GitHub'
                : 'Register with GitHub'}
          </span>
        </CyanBtn>

        {/* Error */}
        {error && (
          <p className="text-[11px] text-red-400 text-center">{error}</p>
        )}

        {/* Toggle + Back */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')}
            className="text-[11px] text-sub hover:text-white transition-colors bg-transparent border-none cursor-pointer"
          >
            {mode === 'signin' ? 'No account? Register →' : 'Already have an account? Sign in →'}
          </button>

          {!required && (
            <button
              onClick={onBack}
              className="text-[10px] text-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer"
            >
              ← Return to Dashboard
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
