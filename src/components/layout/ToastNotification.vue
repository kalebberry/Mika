<script setup lang="ts">
import { useToast } from "../../composables/useToast";

const { notice, dismissToast } = useToast();
</script>

<template>
  <div v-if="notice" class="toast" role="status">
    {{ notice }}
    <button @click="dismissToast" aria-label="Dismiss notification">
      ×
    </button>
  </div>
</template>
