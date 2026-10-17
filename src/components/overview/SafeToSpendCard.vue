<script setup lang="ts">
import { today } from "../../model";
import { money, date } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const { state, sum, days, page, currentPayday } = useBudget();
</script>

<template>
  <section class="safe-card">
    <div class="safe-main">
      <div class="safe-label">
        <span class="spark">✦</span> Safe to spend
      </div>
      <div class="safe-number" :class="{ negative: sum.shortfall > 0 }">
        {{ money(sum.safe) }}
      </div>
      <p v-if="currentPayday < today()">
        Your payday has passed. Update it to refresh your spending plan.
      </p>
      <p v-else-if="sum.shortfall > 0">
        Planned reserves exceed current cash by
        <strong>{{ money(sum.shortfall) }}</strong>. Adjust your plan before spending.
      </p>
      <p v-else>
        About
        <strong>{{ money(Math.floor(sum.safe / days)) }} a day</strong>
        until your next payday.
      </p>
      <button class="text-link light" @click="page = 'Settings'">
        Next payday: {{ date(currentPayday) }} <span>↗</span>
      </button>
    </div>
    <div class="safe-breakdown">
      <div>
        <span>Current balance</span>
        <strong>{{ money(sum.balance) }}</strong>
      </div>
      <div>
        <span>Saved in pots</span>
        <span>− {{ money(sum.pots) }}</span>
      </div>
      <div>
        <span>Remaining monthly budgets</span>
        <span>− {{ money(sum.budgets) }}</span>
      </div>
      <div>
        <span>Bills due before payday</span>
        <span>− {{ money(sum.currentCycleBills) }}</span>
      </div>
      <div v-if="sum.protectedCycleBills > 0">
        <span>Next cycle bills protected</span>
        <span>− {{ money(sum.protectedCycleBills) }}</span>
      </div>
      <div v-if="sum.uncoveredScheduledExpenses > 0">
        <span>Scheduled expenses before payday</span>
        <span>− {{ money(sum.uncoveredScheduledExpenses) }}</span>
      </div>
      <div v-if="sum.totalReadyToPay > 0">
        <span>Credit card payment reserves</span>
        <span>− {{ money(sum.totalReadyToPay) }}</span>
      </div>
      <div v-if="sum.creditCardMinimums > 0">
        <span>Credit card minimums protected</span>
        <span>− {{ money(sum.creditCardMinimums) }}</span>
      </div>
      <div v-if="sum.shortfall > 0" style="color: #ff9b82; font-weight: 600;">
        <span>Reserve shortfall</span>
        <span>{{ money(sum.shortfall) }} deficit</span>
      </div>
      <div class="safe-total">
        <span>Yours to work with</span>
        <strong>{{ money(sum.safe) }}</strong>
      </div>
    </div>
  </section>
</template>
