<script setup lang="ts">
import { useBudget } from "../../composables/useBudget";

const { state, backup } = useBudget();
</script>

<template>
  <footer>
    <span>
      Stored in this browser ·
      {{ state.demo ? "Demo workspace" : "Personal workspace" }}
    </span>
    <button class="text-link" @click="backup">Export backup ↓</button>
  </footer>
</template>
