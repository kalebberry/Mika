<script setup lang="ts">
import { paid } from "../../model";
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
            .filter((b) => !paid(state, b))
            .reduce((n, b) => n + b.amount, 0),
        )
      }}</strong>
    </div>
    <div class="bill-summary blue">
      <span>Reserved through payday</span>
      <strong>{{ money(sum.bills) }}</strong>
    </div>
  </section>
</template>
