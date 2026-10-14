<script setup lang="ts">
import { paid, isBillUnpaidThisMonth } from "../../model";
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const { state, sum, page } = useBudget();
</script>

<template>
  <section class="card">
    <div class="section-heading">
      <h2>Recurring Bills</h2>
      <button class="text-link" @click="page = 'Recurring Bills'">
        See details <span>›</span>
      </button>
    </div>
    <div class="bill-summary">
      <span>Paid this month</span>
      <strong>{{
        money(
          state.bills
            .filter((b) => paid(state, b))
            .reduce((n, b) => n + b.amount, 0),
        )
      }}</strong>
    </div>
    <div class="bill-summary peach">
      <span>Unpaid this month</span>
      <strong>{{
        money(
          state.bills
            .filter((b) => isBillUnpaidThisMonth(state, b))
            .reduce((n, b) => n + b.amount, 0),
        )
      }}</strong>
    </div>
    <div class="bill-summary blue">
      <span>Due before payday</span>
      <strong>{{ money(sum.currentCycleBills) }}</strong>
    </div>
    <div v-if="sum.protectedCycleBills > 0" class="bill-summary purple">
      <span>Next cycle protected</span>
      <strong>{{ money(sum.protectedCycleBills) }}</strong>
    </div>
  </section>
</template>
