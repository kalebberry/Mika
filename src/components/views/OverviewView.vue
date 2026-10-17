<script setup lang="ts">
import SafeToSpendCard from "../overview/SafeToSpendCard.vue";
import DailyAttentionCard from "../overview/DailyAttentionCard.vue";
import DailyPaydayCard from "../overview/DailyPaydayCard.vue";
import QuickActionsCard from "../overview/QuickActionsCard.vue";
import StatGrid from "../overview/StatGrid.vue";
import MiniBudgetsCard from "../overview/MiniBudgetsCard.vue";
import MiniBillsCard from "../overview/MiniBillsCard.vue";
import MiniPotsCard from "../overview/MiniPotsCard.vue";
import MiniTransactionsCard from "../overview/MiniTransactionsCard.vue";
import PaydaySummaryCard from "../overview/PaydaySummaryCard.vue";
import CompanionCard from "../overview/CompanionCard.vue";
</script>

<template>
  <div class="daily-dashboard">
    <!-- 1. Safe to Spend: Primary number and most prominent element -->
    <SafeToSpendCard />

    <!-- 2. What needs attention: Prioritized actionable items & suggested next action -->
    <DailyAttentionCard />

    <!-- 3. Next payday: Date and confirmation/projection distinction -->
    <DailyPaydayCard />

    <!-- 4. Quick actions: Common daily tasks -->
    <QuickActionsCard />

    <!-- 5. Supporting financial details: Secondary, accessible without overwhelming the main view -->
    <section
      class="supporting-financial-details"
      aria-labelledby="supporting-details-title"
    >
      <div class="supporting-details-header">
        <h2 id="supporting-details-title" class="supporting-details-heading">
          Supporting Financial Details
        </h2>
        <span class="supporting-details-caption">
          Accounts, monthly totals, and category breakdown
        </span>
      </div>

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

      <!-- Companion mascot card (if enabled in user settings) -->
      <CompanionCard />
    </section>
  </div>
</template>
