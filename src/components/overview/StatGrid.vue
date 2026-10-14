<script setup lang="ts">
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const { sum, income, expenses, page } = useBudget();
</script>

<template>
  <div class="stat-grid">
    <article class="stat dark">
      <span>Current balance</span>
      <strong>{{ money(sum.balance) }}</strong>
      <button @click="page = 'Settings'">Update balance ↗</button>
    </article>
    <article class="stat">
      <span>Income <small>this month</small></span>
      <strong>{{ money(income) }}</strong>
      <span class="stat-caption">Money coming in</span>
    </article>
    <article class="stat">
      <span>Expenses <small>this month</small></span>
      <strong>{{ money(expenses) }}</strong>
      <span class="stat-caption">Money going out</span>
    </article>
  </div>
</template>
