<script setup lang="ts">
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const { state, budgetSpent, budgetTotal, ring, page } = useBudget();
</script>

<template>
  <section class="card">
    <div class="section-heading">
      <h2>Budgets</h2>
      <button class="text-link" @click="page = 'Budgets'">
        See details <span>›</span>
      </button>
    </div>
    <div class="budget-overview">
      <div class="donut" :style="{ background: ring }">
        <div>
          <strong>{{ money(budgetSpent) }}</strong>
          <span>of {{ money(budgetTotal) }} limit</span>
        </div>
      </div>
      <div class="budget-legend">
        <div
          v-for="b in state.budgets"
          :key="b.id"
          class="legend-item"
          :style="{ '--accent': b.color }"
        >
          <span>{{ b.name || b.category }}</span>
          <strong>{{ money(b.limit) }}</strong>
        </div>
      </div>
    </div>
    <p v-if="!state.budgets.length" class="muted">
      Choose a few categories to give your spending structure.
    </p>
  </section>
</template>
