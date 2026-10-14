<script setup lang="ts">
import { companionPortraits } from "../../companion";
import { useBudget } from "../../composables/useBudget";
import { useCompanion } from "../../composables/useCompanion";
import { useModal } from "../../composables/useModal";

const { page } = useBudget();
const { open } = useModal();
const {
  showCompanion,
  webGpuAvailable,
  aiAdvice,
  isAiLoading,
  aiProgressText,
  aiProgressPercent,
  aiError,
  activeCompanion,
  askMika,
  resetToStandardAdvice,
} = useCompanion();

function companionAction(targetDest?: string) {
  const destination = targetDest || activeCompanion.value.destination;
  if (destination === "Add transaction") {
    open(destination);
  } else {
    page.value = destination as any;
  }
}
</script>

<template>
  <section
    v-if="showCompanion"
    class="companion-card"
    aria-labelledby="mika-title"
  >
    <div class="companion-portrait">
      <img
        :src="companionPortraits[activeCompanion.expression]"
        :alt="'Mika, your budgeting companion — ' + activeCompanion.expression"
        width="1254"
        height="1254"
      />
    </div>
    <div class="companion-copy">
      <div class="companion-header-meta">
        <span class="companion-name">MIKA · YOUR BUDGET COMPANION</span>
        <span v-if="aiAdvice" class="ai-pill active">
          ✦ On-Device AI ({{ aiAdvice.modelUsed }})
        </span>
        <span
          v-else-if="webGpuAvailable"
          class="ai-pill ready"
          title="WebGPU active — 100% private in-browser AI"
        >
          ● On-Device AI ready
        </span>
        <span
          v-else
          class="ai-pill offline"
          title="WebGPU not available in this browser"
        >
          ● Built-in Guidance
        </span>
      </div>
      <h2 id="mika-title">{{ activeCompanion.title }}</h2>
      <p v-if="!isAiLoading">{{ activeCompanion.text }}</p>
      <div v-else class="ai-thinking">
        <div class="ai-thinking-row">
          <span class="ai-spinner"></span>
          <em>{{
            aiProgressText ||
            "Mika is analyzing your finances on-device (100% private)..."
          }}</em>
        </div>
        <div v-if="aiProgressPercent > 0" class="ai-progress-track">
          <div
            class="ai-progress-bar"
            :style="{ width: aiProgressPercent + '%' }"
          ></div>
        </div>
      </div>
      <div class="companion-actions-bar">
        <button
          class="text-link companion-action"
          @click="companionAction(activeCompanion.destination)"
          :disabled="isAiLoading"
        >
          {{ activeCompanion.action }} <span aria-hidden="true">›</span>
        </button>
        <div class="companion-ai-controls">
          <button
            class="ai-sparkle-btn"
            @click="askMika"
            :disabled="isAiLoading"
            title="Get smart suggestions from private on-device AI"
          >
            <span>{{
              isAiLoading
                ? aiProgressPercent > 0
                  ? `Loading ${aiProgressPercent}%`
                  : "Thinking..."
                : aiAdvice
                  ? "Ask Mika Again"
                  : "Ask Mika"
            }}</span>
          </button>
          <button
            v-if="aiAdvice"
            class="ai-reset-btn"
            @click="resetToStandardAdvice"
            title="Show standard rule-based tip"
          >
            Standard tip
          </button>
        </div>
      </div>
      <div v-if="aiError" class="ai-error-banner">
        <span>{{ aiError }}</span>
        <button type="button" class="text-link" @click="page = 'Settings'">
          AI Settings ↗
        </button>
      </div>
    </div>
    <button
      class="companion-hide"
      @click="showCompanion = false"
      aria-label="Hide Mika companion"
      title="Hide Mika · show again in Settings"
    >
      ×
    </button>
  </section>
</template>
