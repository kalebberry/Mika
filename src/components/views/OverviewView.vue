<script setup lang="ts">
import CompanionCard from "../overview/CompanionCard.vue";
import SafeToSpendCard from "../overview/SafeToSpendCard.vue";
import StatGrid from "../overview/StatGrid.vue";
import MiniPotsCard from "../overview/MiniPotsCard.vue";
import MiniTransactionsCard from "../overview/MiniTransactionsCard.vue";
import MiniBudgetsCard from "../overview/MiniBudgetsCard.vue";
import MiniBillsCard from "../overview/MiniBillsCard.vue";
import PaydaySummaryCard from "../overview/PaydaySummaryCard.vue";
</script>

<template>
  <CompanionCard />
  <SafeToSpendCard />
  <StatGrid />
  <div class="overview-grid">
    <div class="column">
      <PaydaySummaryCard />
      <MiniPotsCard />
      <MiniTransactionsCard />
    </div>
    <div class="column">
      <MiniBudgetsCard />
      <MiniBillsCard />
    </div>
  </div>
</template>
