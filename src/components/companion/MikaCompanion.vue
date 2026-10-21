<script setup lang="ts">
import { watch, onMounted, nextTick, ref, computed } from "vue";
import { useCompanionState } from "../../composables/useCompanionState";
import { useCompanionDialogue } from "../../composables/useCompanionDialogue";
import { useTypewriter } from "../../composables/useTypewriter";
import { useCompanion } from "../../composables/useCompanion";
import { useModal } from "../../composables/useModal";
import { getMikaPortrait } from "../../utils/mikaExpressions";

const { showCompanion } = useCompanion();
const { mode: modalMode } = useModal();
const isModalOpen = computed(() => Boolean(modalMode.value));

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
    :class="{ 'modal-active': isModalOpen }"
    aria-label="Mika Budget Companion"
  >
    <Transition name="mika-pop" mode="out-in">
      <!-- 1. Minimized Floating Portrait (Single mode: only rendered when minimized) -->
      <button
        v-if="isMinimized"
        key="minimized"
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

      <!-- 2. Visual-Novel Dialogue Box (Single mode: only rendered when dialogue open) -->
      <div
        v-else-if="isDialogueOpen"
        key="expanded"
        id="mika-dialogue-window"
        class="mika-dialogue-window"
        role="region"
        aria-label="Mika's Budget Companion Dialogue"
      >
        <!-- Mika Portrait (Seamlessly connected to dialogue card) -->
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
          <!-- Nameplate and Clean Minimize Control -->
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
                title="Minimize dialogue"
                aria-label="Minimize Mika dialogue"
                @click.stop="minimizeDialogue"
              >
                <span aria-hidden="true">—</span>
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

          <!-- Simplified Action Row: One primary action + finish/minimize without clutter -->
          <div class="mika-action-row">
            <!-- Typing state: Skip button and hint -->
            <template v-if="isTyping">
              <button
                type="button"
                id="mika-skip-btn"
                class="mika-action-btn"
                @click.stop="skipTypewriter"
              >
                <span>Skip to end</span>
                <span aria-hidden="true">›</span>
              </button>
              <span class="mika-skip-hint">Click or press Space</span>
            </template>

            <!-- Finished state: Contextual action + Got it button -->
            <template v-else>
              <button
                v-if="currentDialogue.actionLabel"
                type="button"
                id="mika-dialogue-action"
                class="mika-action-btn"
                @click.stop="onActionClick"
              >
                <span>{{ currentDialogue.actionLabel }}</span>
                <span aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                id="mika-finish-btn"
                class="mika-finish-btn"
                :class="{ 'primary-finish': !currentDialogue.actionLabel }"
                aria-label="Finish and minimize dialogue"
                @click.stop="minimizeDialogue"
              >
                Got it
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </aside>
</template>
