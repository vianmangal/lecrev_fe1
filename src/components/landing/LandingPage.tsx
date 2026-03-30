import React, { useEffect, useState } from 'react';

const HERO_PREFIX_TEXT = 'is the best way to implement...';
const FLIP_WORDS = ['workflows.', 'functions.', 'websites.', 'features.'];
const FLIP_WORD_WIDTH_CH = Math.max(...FLIP_WORDS.map((word) => word.length));
const FLIP_ANIMATION_MS = 520;
const FLIP_SWAP_MS = Math.round(FLIP_ANIMATION_MS * 0.5);
const FLIP_HOLD_MS = 2000;

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const [typedText, setTypedText] = useState('');
  const [flipIndex, setFlipIndex] = useState(0);
  const [isFlippingWord, setIsFlippingWord] = useState(false);

  useEffect(() => {
    let index = 0;
    let timeoutId = 0;

    const typeNext = () => {
      if (index <= HERO_PREFIX_TEXT.length) {
        setTypedText(HERO_PREFIX_TEXT.slice(0, index));
        index += 1;
        const delay = 50 + Math.floor(Math.random() * 31);
        timeoutId = window.setTimeout(typeNext, delay);
      }
    };

    typeNext();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const typingComplete = typedText.length >= HERO_PREFIX_TEXT.length;

  useEffect(() => {
    if (!typingComplete) {
      return;
    }

    let cancelled = false;
    let cycleTimeoutId = 0;
    let swapTimeoutId = 0;
    let completeTimeoutId = 0;

    const runCycle = () => {
      if (cancelled) {
        return;
      }
      setIsFlippingWord(true);
      swapTimeoutId = window.setTimeout(() => {
        setFlipIndex((prev) => (prev + 1) % FLIP_WORDS.length);
      }, FLIP_SWAP_MS);

      completeTimeoutId = window.setTimeout(() => {
        setIsFlippingWord(false);
        cycleTimeoutId = window.setTimeout(runCycle, FLIP_HOLD_MS);
      }, FLIP_ANIMATION_MS);
    };

    cycleTimeoutId = window.setTimeout(runCycle, FLIP_HOLD_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(cycleTimeoutId);
      window.clearTimeout(swapTimeoutId);
      window.clearTimeout(completeTimeoutId);
    };
  }, [typingComplete]);

  return (
    <div className="min-h-dvh bg-bg text-white font-sans">
      <button
        onClick={onSignIn}
        className="fixed right-4 top-4 z-[90] rounded-full border border-border bg-surface/85 px-4 py-2 text-[10px] uppercase tracking-[0.13em] text-sub shadow-[0_10px_30px_rgba(0,0,0,0.38)] backdrop-blur transition-colors duration-150 hover:border-white hover:text-white sm:right-6 sm:top-5 lg:right-8"
      >
        Sign in
      </button>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-4 top-5 z-10 flex items-center gap-2.5 text-white sm:left-6 lg:left-8" aria-hidden="true">
          <span className="shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
            </svg>
          </span>
          <span className="font-black text-base tracking-tighter whitespace-nowrap uppercase">LECREV</span>
        </div>

        <section className="relative min-h-dvh flex items-center">
          <div className="w-full py-24 sm:py-28">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <h1 className="mx-auto min-h-[5.75rem] max-w-[1200px] text-center text-2xl font-medium leading-tight tracking-[-0.02em] text-white sm:min-h-[6.75rem] sm:text-4xl md:min-h-[8rem] md:text-5xl lg:whitespace-nowrap xl:max-w-[1400px]">
                <span className="mr-[0.24em] inline-flex items-center gap-[0.18em] align-baseline">
                  <span className="relative top-[0.02em] shrink-0" aria-hidden="true">
                    <svg width="0.78em" height="0.78em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="font-black tracking-tighter uppercase">LECREV</span>
                </span>
                {typedText}
                {typingComplete && (
                  <span className="flip-word-perspective" aria-hidden="true">
                    <span
                      className={`flip-word ${isFlippingWord ? 'flipping' : ''}`}
                      style={{ width: `${FLIP_WORD_WIDTH_CH}ch` }}
                    >
                      {FLIP_WORDS[flipIndex]}
                    </span>
                  </span>
                )}
              </h1>
            </div>

            <div className="mx-auto mt-8 w-full max-w-5xl px-4 sm:mt-12 sm:px-6 lg:px-8">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-md bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.08),transparent_55%)]" />
                <div className="absolute left-4 top-4 flex gap-2 opacity-70">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={onSignIn}
                    aria-label="Play demo"
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/60 transition-colors duration-150 hover:bg-black/80"
                  >
                    <span className="ml-1 block h-0 w-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-white/90" />
                  </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
