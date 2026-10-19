/**
 * Companion Dialogue Content & Prioritization Composable
 *
 * Provides contextual messages for Mika's dialogue by integrating:
 * - Session greetings (warm, lightly playful introductory message)
 * - Authoritative financial engine advice from companion.ts (companionMessage)
 * - Zero duplicated math or fabricated numbers
 */

import { computed } from "vue";
import { useBudget } from "./useBudget.ts";
import { useModal } from "./useModal.ts";
import { useCompanionState } from "./useCompanionState.ts";
import { companionMessage, type CompanionMessage } from "../companion.ts";
import type { MikaExpression } from "../utils/mikaExpressions.ts";

export interface DialoguePayload {
  expression: MikaExpression;
  name: string;
  title: string;
  text: string;
  actionLabel?: string;
  actionDestination?: string;
  isGreeting: boolean;
}

export function useCompanionDialogue() {
  const { state, page } = useBudget();
  const { open } = useModal();
  const { isGreeting, minimizeDialogue } = useCompanionState();

  const standardAdvice = computed<CompanionMessage>(() => companionMessage(state.value));

  const currentDialogue = computed<DialoguePayload>(() => {
    if (isGreeting.value) {
      return {
        expression: "welcome",
        name: "Mika",
        title: "Hi there! I’m Mika",
        text: state.value.demo
          ? "Welcome! I’m your budgeting companion. Feel free to explore the demo numbers, and let me know when you'd like to check in on your spending plan."
          : "Welcome back! I’m here to keep your daily spending calm, clear, and ADHD-friendly. One small check-in at a time is all it takes.",
        actionLabel: "Let’s check in",
        actionDestination: "Overview",
        isGreeting: true,
      };
    }

    const advice = standardAdvice.value;
    return {
      expression: advice.expression as MikaExpression,
      name: "Mika",
      title: advice.title,
      text: advice.text,
      actionLabel: advice.action,
      actionDestination: advice.destination,
      isGreeting: false,
    };
  });

  function executeAction(): void {
    const payload = currentDialogue.value;
    if (payload.isGreeting) {
      minimizeDialogue();
      return;
    }

    if (payload.actionDestination) {
      const dest = payload.actionDestination;
      if (dest === "Add transaction") {
        open("Add transaction");
      } else {
        page.value = dest as any;
      }
      minimizeDialogue();
    } else {
      minimizeDialogue();
    }
  }

  return {
    currentDialogue,
    executeAction,
  };
}
