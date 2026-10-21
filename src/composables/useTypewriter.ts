/**
 * Typewriter Effect Composable
 *
 * Implements character-by-character progressive text reveal with:
 * - Instant skip on click/tap/keypress
 * - Immediate text reveal when prefers-reduced-motion is enabled
 * - Non-blocking execution and clean timer cleanup
 */

import { ref, onUnmounted, unref, type Ref } from "vue";

export interface TypewriterOptions {
  speedMs?: number;
  onComplete?: () => void;
  reduceAnimations?: boolean | Ref<boolean> | (() => boolean);
}

export function useTypewriter(options?: TypewriterOptions) {
  const speedMs = options?.speedMs ?? 20;
  const displayedText = ref("");
  const isTyping = ref(false);
  const isFinished = ref(false);

  let targetText = "";
  let timer: ReturnType<typeof setInterval> | null = null;

  function isReducedMotion(): boolean {
    if (options?.reduceAnimations !== undefined) {
      const pref =
        typeof options.reduceAnimations === "function"
          ? options.reduceAnimations()
          : unref(options.reduceAnimations);
      if (pref) return true;
    }
    try {
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }
    } catch {}
    return false;
  }

  function start(text: string): void {
    stopTimer();
    targetText = text || "";
    displayedText.value = "";
    isFinished.value = false;

    if (!targetText) {
      isTyping.value = false;
      isFinished.value = true;
      options?.onComplete?.();
      return;
    }

    // Bypass typewriter if user prefers reduced motion
    if (isReducedMotion()) {
      displayedText.value = targetText;
      isTyping.value = false;
      isFinished.value = true;
      options?.onComplete?.();
      return;
    }

    isTyping.value = true;
    let charIndex = 0;

    timer = setInterval(() => {
      charIndex++;
      displayedText.value = targetText.slice(0, charIndex);

      if (charIndex >= targetText.length) {
        stopTimer();
        isTyping.value = false;
        isFinished.value = true;
        options?.onComplete?.();
      }
    }, speedMs);
  }

  function skip(): void {
    if (isTyping.value) {
      stopTimer();
      displayedText.value = targetText;
      isTyping.value = false;
      isFinished.value = true;
      options?.onComplete?.();
    }
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  onUnmounted(() => {
    stopTimer();
  });

  return {
    displayedText,
    isTyping,
    isFinished,
    start,
    skip,
    stopTimer,
  };
}
