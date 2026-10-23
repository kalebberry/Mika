<script setup lang="ts">
import { ref } from "vue";
import BackupReminderBanner from "../overview/BackupReminderBanner.vue";
import SetupChecklistCard from "../overview/SetupChecklistCard.vue";
import SafeToSpendCard from "../overview/SafeToSpendCard.vue";
import DailyAttentionCard from "../overview/DailyAttentionCard.vue";
import MoneyOutlookCard from "../overview/MoneyOutlookCard.vue";
import DailyPaydayCard from "../overview/DailyPaydayCard.vue";
import QuickActionsCard from "../overview/QuickActionsCard.vue";
import StatGrid from "../overview/StatGrid.vue";
import MiniBudgetsCard from "../overview/MiniBudgetsCard.vue";
import MiniBillsCard from "../overview/MiniBillsCard.vue";
import MiniPotsCard from "../overview/MiniPotsCard.vue";
import MiniTransactionsCard from "../overview/MiniTransactionsCard.vue";
import PaydaySummaryCard from "../overview/PaydaySummaryCard.vue";
import CompanionCard from "../overview/CompanionCard.vue";

const showFinancialDetails = ref(false);
</script>

<template>
  <div class="daily-dashboard">
    <!-- Proactive backup reminder -->
    <BackupReminderBanner />

    <!-- Setup checklist with progress & dismiss/reopen -->
    <SetupChecklistCard />

    <!-- 1. Safe to Spend: Primary number and most prominent element -->
    <SafeToSpendCard />

    <!-- 2. What needs attention: Prioritized actionable items & suggested next action -->
    <DailyAttentionCard />

    <!-- 3. Money Outlook: Clickable summary with shortcut to Insights -->
    <MoneyOutlookCard />

    <!-- 4. Next payday: Date and confirmation/projection distinction -->
    <DailyPaydayCard />

    <!-- 5. Quick actions: Common daily tasks -->
    <QuickActionsCard />

    <!-- 5. Supporting financial details: Secondary, collapsed by default for compact ADHD-friendly view -->
    <section
      class="supporting-financial-details"
      aria-labelledby="supporting-details-title"
    >
      <div class="supporting-details-header">
        <button
          type="button"
          id="supporting-details-toggle"
          class="supporting-details-toggle-btn"
          :aria-expanded="showFinancialDetails"
          aria-controls="supporting-details-content"
          @click="showFinancialDetails = !showFinancialDetails"
        >
          <div class="supporting-toggle-text">
            <h2 id="supporting-details-title" class="supporting-details-heading">
              Supporting Financial Details
            </h2>
            <span class="supporting-details-caption">
              Accounts, monthly totals, and category breakdown
            </span>
          </div>
          <span class="supporting-toggle-badge" aria-hidden="true">
            {{ showFinancialDetails ? "Hide details ▲" : "Show details ▼" }}
          </span>
        </button>
      </div>

      <div
        v-show="showFinancialDetails"
        id="supporting-details-content"
        class="supporting-details-body"
      >
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
      </div>
    </section>
  </div>
</template>
