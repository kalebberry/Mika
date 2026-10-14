<script setup lang="ts">
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const {
  sum,
  income,
  expenses,
  scheduledIncome,
  scheduledExpenses,
  statusFilter,
  category,
  page,
} = useBudget();

function viewScheduled() {
  statusFilter.value = "Scheduled";
  category.value = "All";
  page.value = "Transactions";
}
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
      <button
        v-if="scheduledIncome > 0"
        class="stat-link"
        @click="viewScheduled"
        title="View scheduled income in Transactions"
      >
        +{{ money(scheduledIncome) }} scheduled ›
      </button>
      <span v-else class="stat-caption">Money received</span>
    </article>
    <article class="stat">
      <span>Expenses <small>this month</small></span>
      <strong>{{ money(expenses) }}</strong>
      <button
        v-if="scheduledExpenses > 0"
        class="stat-link"
        @click="viewScheduled"
        title="View scheduled expenses in Transactions"
      >
        +{{ money(scheduledExpenses) }} scheduled ›
      </button>
      <span v-else class="stat-caption">Money going out</span>
    </article>
  </div>
</template>
