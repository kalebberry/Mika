<script setup lang="ts">
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { state } = useBudget();
const { open } = useModal();
</script>

<template>
  <div v-if="state.demo" class="demo-banner">
    <span>
      <strong>Make yourself at home.</strong> You’re exploring demo data.
    </span>
    <button @click="open('Start fresh')">
      Use my own numbers <span>→</span>
    </button>
  </div>
</template>
