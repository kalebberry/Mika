<script setup lang="ts">
import { watch, onMounted, nextTick, ref } from "vue";
import { useCompanionState } from "../../composables/useCompanionState";
import { useCompanionDialogue } from "../../composables/useCompanionDialogue";
import { useTypewriter } from "../../composables/useTypewriter";
import { useCompanion } from "../../composables/useCompanion";
import { getMikaPortrait } from "../../utils/mikaExpressions";

const { showCompanion } = useCompanion();
const {
  isDialogueOpen,
  isMinimized,
  checkAndTriggerGreeting,
  openDialogue,
  minimizeDialogue,
  dismissDialogue,
} = useCompanionState();

const { currentDialogue, executeAction } = useCompanionDialogue();

const dialogueCardRef = ref<HTMLElement | null>(null);

const { displayedText, isTyping, isFinished, start: startTypewriter, skip: skipTypewriter } = useTypewriter({
  speedMs: 22,
});

// Sync dialogue text changes with typewriter
watch(
  () => currentDialogue.value.text,
  (newText) => {
    if (isDialogueOpen.value && newText) {
      startTypewriter(newText);
    }
  },
  { immediate: true },
);

// When dialogue opens, ensure typewriter starts and focus is ready
watch(
  () => isDialogueOpen.value,
  (open) => {
    if (open) {
      startTypewriter(currentDialogue.value.text);
      nextTick(() => {
        dialogueCardRef.value?.focus();
      });
    }
  },
);

onMounted(() => {
  // Greet once per session if companion is enabled
  if (showCompanion.value) {
    checkAndTriggerGreeting();
  }
});

function handleCardClick() {
  if (isTyping.value) {
    skipTypewriter();
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    minimizeDialogue();
  } else if (event.key === "Enter" || event.key === " ") {
    if (isTyping.value) {
      event.preventDefault();
      skipTypewriter();
    }
  }
}

function onActionClick() {
  if (isTyping.value) {
    skipTypewriter();
  } else {
    executeAction();
  }
}
</script>

<template>
  <aside
    v-if="showCompanion"
    class="mika-companion-root"
    aria-label="Mika Budget Companion"
  >
    <!-- 1. Minimized Floating Portrait -->
    <button
      v-if="isMinimized"
      type="button"
      id="mika-minimized-trigger"
      class="mika-minimized-avatar"
      aria-label="Open Mika dialogue"
      title="Talk with Mika"
      @click="openDialogue"
    >
      <img
        :src="getMikaPortrait('calm')"
        alt="Mika, your budget companion"
        class="mika-minimized-img"
        width="112"
        height="112"
      />
      <span class="mika-status-dot" aria-hidden="true"></span>
      <span class="mika-minimized-tooltip" role="tooltip">Talk with Mika</span>
    </button>

    <!-- 2. Visual-Novel Dialogue Box -->
    <div
      v-else-if="isDialogueOpen"
      id="mika-dialogue-window"
      class="mika-dialogue-window"
      role="region"
      aria-label="Mika's Budget Companion Dialogue"
    >
      <!-- Mika Portrait (Beside / partially overlapping dialogue card) -->
      <div class="mika-dialogue-portrait">
        <img
          :src="getMikaPortrait(currentDialogue.expression)"
          :alt="'Mika portrait — ' + currentDialogue.expression"
          class="mika-portrait-img"
          width="240"
          height="280"
        />
      </div>

      <!-- Dialogue Card -->
      <div
        ref="dialogueCardRef"
        class="mika-dialogue-card"
        tabindex="0"
        @click="handleCardClick"
        @keydown="handleKeyDown"
      >
        <!-- Nameplate and Controls Bar -->
        <div class="mika-nameplate-bar">
          <div class="mika-nameplate">
            <span class="mika-name-text">{{ currentDialogue.name }}</span>
            <span class="mika-role-badge">Budget Companion</span>
          </div>

          <div class="mika-window-controls">
            <button
              type="button"
              id="mika-dialogue-minimize"
              class="mika-control-btn"
              title="Minimize to portrait"
              aria-label="Minimize Mika dialogue"
              @click.stop="minimizeDialogue"
            >
              <span aria-hidden="true">—</span>
            </button>
            <button
              type="button"
              id="mika-dialogue-close"
              class="mika-control-btn"
              title="Dismiss dialogue"
              aria-label="Close Mika dialogue"
              @click.stop="dismissDialogue"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <!-- Dialogue Body with Progressive Typewriter -->
        <div class="mika-dialogue-body">
          <h3 class="mika-dialogue-title">{{ currentDialogue.title }}</h3>
          <p
            id="mika-dialogue-text"
            class="mika-dialogue-text"
            aria-live="polite"
          >
            {{ displayedText }}
            <span v-if="isTyping" class="mika-typing-cursor" aria-hidden="true">|</span>
            <span v-else class="mika-advance-prompt" aria-hidden="true">▼</span>
          </p>
        </div>

        <!-- Action Row -->
        <div class="mika-action-row">
          <button
            type="button"
            id="mika-dialogue-action"
            class="mika-action-btn"
            @click.stop="onActionClick"
          >
            <span>{{ isTyping ? "Show message" : (currentDialogue.actionLabel || "Got it") }}</span>
            <span aria-hidden="true">›</span>
          </button>

          <span v-if="isTyping" class="mika-skip-hint">Click or press Space to skip</span>
          <button
            v-else
            type="button"
            id="mika-dialogue-dismiss"
            class="mika-dismiss-btn"
            @click.stop="minimizeDialogue"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
