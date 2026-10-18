<script setup lang="ts">
import { useToast } from "../../composables/useToast";

const { notice, toastAction, dismissToast, triggerAction } = useToast();
</script>

<template>
  <div v-if="notice" class="toast" role="status">
    <span class="toast-message">{{ notice }}</span>
    <button
      v-if="toastAction"
      type="button"
      class="toast-action-btn"
      @click="triggerAction"
    >
      {{ toastAction.label }}
    </button>
    <button class="toast-dismiss-btn" @click="dismissToast" aria-label="Dismiss notification">
      ×
    </button>
  </div>
</template>

