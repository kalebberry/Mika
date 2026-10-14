<script setup lang="ts">
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const { state, sum, page } = useBudget();
</script>

<template>
  <section class="card">
    <div class="section-heading">
      <h2>Pots</h2>
      <button class="text-link" @click="page = 'Pots'">
        See details <span>›</span>
      </button>
    </div>
    <div class="pots-summary">
      <div class="saved-total">
        <span class="pot-symbol">▣</span>
        <div>
          <span>Total saved</span>
          <strong>{{ money(sum.pots) }}</strong>
        </div>
      </div>
      <div class="mini-pots">
        <div
          v-for="p in state.pots.slice(0, 4)"
          :key="p.id"
          class="legend-item"
          :style="{ '--accent': p.color }"
        >
          <span>{{ p.name }}</span>
          <strong>{{ money(p.saved) }}</strong>
        </div>
        <p v-if="!state.pots.length" class="muted">
          Give your next goal a home.
        </p>
      </div>
    </div>
  </section>
</template>
