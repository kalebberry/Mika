/**
 * Companion Visibility & Session State Composable
 *
 * Manages Mika's dialogue visibility, minimized state, and ensures
 * the greeting occurs once per user session without re-triggering on route changes.
 */

import { ref } from "vue";

export const SESSION_GREETED_KEY = "mika_companion_session_greeted";

function readSessionStorage(): boolean {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(SESSION_GREETED_KEY) === "true";
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

// Module-level reactive singleton state to persist across route/view transitions
const hasGreetedThisSession = ref(readSessionStorage());
const isDialogueOpen = ref(!hasGreetedThisSession.value);
const isMinimized = ref(hasGreetedThisSession.value);
const isGreeting = ref(!hasGreetedThisSession.value);

export function useCompanionState() {
  /**
   * Initializes the session greeting if not already performed.
   * Safe to call multiple times or on view mount; only opens once per session.
   */
  function checkAndTriggerGreeting(): void {
    if (!hasGreetedThisSession.value) {
      isDialogueOpen.value = true;
      isMinimized.value = false;
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
    isDialogueOpen.value = true;
    isMinimized.value = false;
    isGreeting.value = false;
  }

  function minimizeDialogue(): void {
    isDialogueOpen.value = false;
    isMinimized.value = true;
    isGreeting.value = false;
    markGreeted();
  }

  function dismissDialogue(): void {
    minimizeDialogue();
  }

  function toggleDialogue(): void {
    if (isDialogueOpen.value) {
      minimizeDialogue();
    } else {
      openDialogue();
    }
  }

  function resetSessionGreeting(): void {
    hasGreetedThisSession.value = false;
    writeSessionStorage(false);
    isDialogueOpen.value = true;
    isMinimized.value = false;
    isGreeting.value = true;
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
