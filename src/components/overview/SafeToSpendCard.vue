<script setup lang="ts">
import { today } from "../../model";
import { money, date } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";

const { state, sum, days, page } = useBudget();
</script>

<template>
  <section class="safe-card">
    <div class="safe-main">
      <div class="safe-label">
        <span class="spark">✦</span> Safe to spend
      </div>
      <div class="safe-number" :class="{ negative: sum.safe < 0 }">
        {{ money(sum.safe) }}
      </div>
      <p v-if="state.payday < today()">
        Your payday has passed. Update it to refresh your spending plan.
      </p>
      <p v-else-if="sum.safe >= 0">
        About
        <strong>{{ money(Math.floor(sum.safe / days)) }} a day</strong>
        until your next payday.
      </p>
      <p v-else>
        Your current reserves exceed your balance. Adjust your plan before
        spending.
      </p>
      <button class="text-link light" @click="page = 'Settings'">
        Next payday: {{ date(state.payday) }} <span>↗</span>
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
        <span>Bills reserved through payday</span>
        <span>− {{ money(sum.bills) }}</span>
      </div>
      <div class="safe-total">
        <span>Yours to work with</span>
        <strong>{{ money(sum.safe) }}</strong>
      </div>
    </div>
  </section>
</template>
