/**
 * Companion Visibility & Session State Composable
 *
 * Manages Mika's dialogue visibility, minimized state, and ensures
 * the greeting occurs once per user session without re-triggering on route changes.
 */

import { ref, computed } from "vue";
import { useCompanion } from "./useCompanion.ts";

export const SESSION_GREETED_KEY = "mika_companion_session_greeted";

function readSessionStorage(): boolean {
  try {
    if (typeof window !== "undefined") {
      if (window.location && window.location.search && window.location.search.includes("mika_minimized")) {
        return true;
      }
      if (window.sessionStorage) {
        return window.sessionStorage.getItem(SESSION_GREETED_KEY) === "true";
      }
    }
  } catch {}
  return false;
}

function writeSessionStorage(value: boolean): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (value) {
        window.sessionStorage.setItem(SESSION_GREETED_KEY, "true");
      } else {
        window.sessionStorage.removeItem(SESSION_GREETED_KEY);
      }
    }
  } catch {}
}

export type CompanionViewMode = "expanded" | "minimized";

// Module-level reactive singleton state to persist across route/view transitions
const hasGreetedThisSession = ref(readSessionStorage());
const companionMode = ref<CompanionViewMode>("minimized");
const isDialogueOpen = computed(() => companionMode.value === "expanded");
const isMinimized = computed(() => companionMode.value === "minimized");
const isGreeting = ref(false);

export function useCompanionState() {
  /**
   * Initializes the session greeting if not already performed.
   * Safe to call multiple times or on view mount; only opens once per session.
   */
  function checkAndTriggerGreeting(): void {
    const { enableGreetings } = useCompanion();
    if (!enableGreetings.value) {
      companionMode.value = "minimized";
      isGreeting.value = false;
      return;
    }
    if (typeof window !== "undefined" && window.location && window.location.search && window.location.search.includes("mika_minimized")) {
      companionMode.value = "minimized";
      isGreeting.value = false;
      return;
    }
    if (!hasGreetedThisSession.value) {
      companionMode.value = "expanded";
      isGreeting.value = true;
      // Mark greeted immediately so route changes do not restart greeting
      markGreeted();
    }
  }

  function markGreeted(): void {
    hasGreetedThisSession.value = true;
    writeSessionStorage(true);
  }

  function openDialogue(): void {
    companionMode.value = "expanded";
    isGreeting.value = false;
  }

  function minimizeDialogue(): void {
    companionMode.value = "minimized";
    isGreeting.value = false;
    markGreeted();
  }

  function dismissDialogue(): void {
    minimizeDialogue();
  }

  function toggleDialogue(): void {
    if (companionMode.value === "expanded") {
      minimizeDialogue();
    } else {
      openDialogue();
    }
  }

  function resetSessionGreeting(): void {
    hasGreetedThisSession.value = false;
    writeSessionStorage(false);
    const { enableGreetings } = useCompanion();
    if (!enableGreetings.value) {
      companionMode.value = "minimized";
      isGreeting.value = false;
    } else {
      companionMode.value = "expanded";
      isGreeting.value = true;
    }
  }

  return {
    isDialogueOpen,
    isMinimized,
    hasGreetedThisSession,
    isGreeting,
    checkAndTriggerGreeting,
    openDialogue,
    minimizeDialogue,
    dismissDialogue,
    toggleDialogue,
    resetSessionGreeting,
  };
}
