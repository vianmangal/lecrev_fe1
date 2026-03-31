import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

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
      <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <span className="shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4L12 21L22 4H2Z" fill="currentColor" />
              </svg>
            </span>
            <span className="font-black text-base tracking-tighter whitespace-nowrap uppercase">LECREV</span>
          </div>
          <button
            onClick={onSignIn}
            className="rounded-full bg-cyan-primary px-4 sm:px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-black transition-colors duration-150 hover:bg-cyan-hover"
          >
            Get started
          </button>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <section className="relative min-h-dvh flex items-center pt-16">
          <div className="w-full py-16 sm:py-24">
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
                <span className="block sm:inline">{typedText}</span>
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

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mx-auto mt-12 sm:mt-16 w-full max-w-5xl px-4 sm:px-6 lg:px-8"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-surface">
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src="/landing-demo.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                <div className="absolute left-3 sm:left-4 top-3 sm:top-4 flex gap-1.5 sm:gap-2 opacity-70">
                  <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-red-400" />
                  <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400" />
                </div>

              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
