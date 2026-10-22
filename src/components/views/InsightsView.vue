<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";
import { money, dateWithDay } from "../../utils/format";
import {
  companionPortraits,
  type OutlookTopic,
  type MikaOutlookExplanation,
} from "../../companion";

const {
  state,
  selectedInsightsMonth,
  insightsSummary,
  reportingPeriods,
  monthComparison,
  categoryTrends,
  spendingHistory,
  monthFilter,
  page,
  category,
  moneyOutlook,
  beforePaydayCommitments,
  outlookExplanation,
  getMikaOutlookExplanation,
} = useBudget();

const { open: openModal } = useModal();

const showHistoryTable = ref(false);
const showOutlookDetails = ref(false);

const activeMikaTopic = ref<OutlookTopic>(
  moneyOutlook.value.hasShortfall ? "shortfall" : "safe_to_spend",
);

watch(
  () => moneyOutlook.value.hasShortfall,
  (hasShortfall) => {
    if (hasShortfall && activeMikaTopic.value === "safe_to_spend") {
      activeMikaTopic.value = "shortfall";
    }
  },
);

const currentMikaExplanation = computed<MikaOutlookExplanation>(() =>
  getMikaOutlookExplanation(activeMikaTopic.value),
);

function handleMikaAction(explanation: MikaOutlookExplanation) {
  if (!explanation.actionDestination) return;
  if (explanation.actionDestination === "Add transaction") {
    openModal("Add transaction");
  } else {
    page.value = explanation.actionDestination as any;
  }
}

const periods = computed(() => [
  reportingPeriods.value.thisMonth,
  reportingPeriods.value.lastMonth,
]);

function setPeriod(monthStr: string) {
  selectedInsightsMonth.value = monthStr;
}

function viewCategoryInTransactions(catName: string) {
  category.value = catName;
  monthFilter.value = selectedInsightsMonth.value;
  page.value = "Transactions";
}
</script>

<template>
  <div class="insights-view" id="insights-page">
    <!-- Subtitle & Calm Context Header -->
    <header class="insights-intro-header">
      <p class="insights-subtitle">
        Understand your money at your own pace.
        <span class="insights-pending-tag">Includes pending transactions.</span>
      </p>
      
      <!-- Reporting Period Selector -->
      <div
        class="period-selector-group"
        role="radiogroup"
        aria-label="Select reporting period"
      >
        <button
          v-for="p in periods"
          :key="p.id"
          type="button"
          class="period-pill"
          :class="{ active: selectedInsightsMonth === p.month }"
          :aria-checked="selectedInsightsMonth === p.month"
          role="radio"
          @click="setPeriod(p.month)"
        >
          <span class="period-name">{{ p.label }}</span>
          <span class="period-full-label">{{ p.fullLabel }}</span>
        </button>
      </div>
    </header>

    <!-- Factual Observation Card (Phase 5A) -->
    <section
      class="card observation-card"
      aria-label="Monthly spending observation"
    >
      <div class="observation-content">
        <span class="observation-icon" aria-hidden="true">💡</span>
        <div class="observation-body">
          <span class="observation-tag">Factual Observation</span>
          <p class="observation-text">{{ insightsSummary.observation }}</p>
        </div>
      </div>
    </section>

    <!-- Primary Spending Summary Cards Grid -->
    <section class="insights-metrics-grid" aria-label="Spending summary metrics">
      <!-- Total Spending Card -->
      <div class="card metric-card metric-primary">
        <span class="metric-label">Total Recorded Spending</span>
        <strong class="metric-value">{{ money(insightsSummary.totalSpent) }}</strong>
        <span class="metric-subtext">
          {{ insightsSummary.periodLabel }} · Includes pending transactions
        </span>
      </div>

      <!-- Transaction Count Card -->
      <div class="card metric-card">
        <span class="metric-label">Qualifying Expenses</span>
        <strong class="metric-value">{{ insightsSummary.transactionCount }}</strong>
        <span class="metric-subtext">
          {{ insightsSummary.transactionCount === 1 ? "expense transaction" : "expense transactions" }}
        </span>
      </div>

      <!-- Largest Category Card -->
      <div class="card metric-card">
        <span class="metric-label">Top Spending Area</span>
        <strong class="metric-value metric-category-name">
          {{ insightsSummary.largestCategory ? insightsSummary.largestCategory.name : "None" }}
        </strong>
        <span class="metric-subtext" v-if="insightsSummary.largestCategory">
          {{ money(insightsSummary.largestCategory.amount) }} ({{ insightsSummary.largestCategory.percentage }}% of total)
        </span>
        <span class="metric-subtext" v-else-if="insightsSummary.transactionCount > 0">
          Fully offset by refunds
        </span>
        <span class="metric-subtext" v-else>
          No category spending
        </span>
      </div>
    </section>

    <!-- =======================================================================
         Phase 5C: Money Outlook & Safe to Spend Explanation
         ======================================================================= -->
    <section
      class="card money-outlook-card"
      id="money-outlook-section"
      aria-labelledby="money-outlook-heading"
    >
      <div class="section-card-header">
        <div class="outlook-header-title-area">
          <div class="header-with-badge">
            <h2 id="money-outlook-heading">Money Outlook</h2>
            <span
              v-if="moneyOutlook.hasShortfall"
              class="outlook-shortfall-badge"
              role="status"
            >
              Shortfall Active
            </span>
            <span
              v-else
              class="outlook-healthy-badge"
            >
              Plan In Balance
            </span>
          </div>
          <p class="muted section-caption">
            What is recorded, what is protected, and what remains available before payday.
          </p>
        </div>

        <button
          type="button"
          class="btn btn-secondary outlook-toggle-btn"
          :aria-expanded="showOutlookDetails"
          aria-controls="outlook-details-panel"
          @click="showOutlookDetails = !showOutlookDetails"
        >
          {{ showOutlookDetails ? "Hide breakdown" : "Show detailed breakdown" }}
        </button>
      </div>

      <!-- Top-Level 3-Card Summary Grid -->
      <div class="outlook-summary-grid">
        <!-- Eligible Recorded Cash -->
        <div class="card outlook-metric-card">
          <div class="outlook-metric-top">
            <span class="metric-label">Eligible Recorded Cash</span>
            <span
              class="outlook-freshness-pill"
              :class="`freshness-${moneyOutlook.overallFreshness}`"
            >
              {{ moneyOutlook.freshnessLabel }}
            </span>
          </div>
          <strong class="outlook-metric-value">{{ money(moneyOutlook.cashBalance) }}</strong>
          <span class="metric-subtext">
            {{
              moneyOutlook.isFallbackCash
                ? "Ledger baseline (no cash accounts linked)"
                : `${moneyOutlook.cashAccountCount} checking/savings ${moneyOutlook.cashAccountCount === 1 ? 'account' : 'accounts'}`
            }}
          </span>
        </div>

        <!-- Total Protected Reserves -->
        <div class="card outlook-metric-card">
          <div class="outlook-metric-top">
            <span class="metric-label">Total Protected Reserves</span>
            <span class="outlook-protection-pill">Protected</span>
          </div>
          <strong class="outlook-metric-value text-muted-amount">
            -{{ money(moneyOutlook.totalProtections) }}
          </strong>
          <span class="metric-subtext">
            Reserved for pots, budgets, bills & card debt
          </span>
        </div>

        <!-- Safe to Spend Bottom Line -->
        <div
          class="card outlook-metric-card"
          :class="{ 'outlook-card-shortfall': moneyOutlook.hasShortfall, 'outlook-card-safe': !moneyOutlook.hasShortfall }"
        >
          <div class="outlook-metric-top">
            <span class="metric-label">Safe to Spend</span>
            <span
              v-if="moneyOutlook.hasShortfall"
              class="outlook-deficit-pill"
            >
              Shortfall: -{{ money(moneyOutlook.shortfall) }}
            </span>
            <span
              v-else
              class="outlook-available-pill"
            >
              Available
            </span>
          </div>
          <strong class="outlook-metric-value outlook-final-safe">
            {{ money(moneyOutlook.safe) }}
          </strong>
          <span class="metric-subtext">
            {{
              moneyOutlook.hasShortfall
                ? `Plan is short by ${money(moneyOutlook.shortfall)}`
                : "Available for unbudgeted spending"
            }}
          </span>
        </div>
      </div>

      <!-- Plain-English Calculation Explanation Banner -->
      <div class="outlook-explanation-banner" role="region" aria-label="Safe to Spend explanation">
        <span class="explanation-icon" aria-hidden="true">ℹ️</span>
        <div class="explanation-body">
          <strong class="explanation-title">How Safe to Spend is Calculated</strong>
          <p class="explanation-text">{{ outlookExplanation }}</p>
        </div>
      </div>

      <!-- Progressive Disclosure: Detailed Breakdown Panel -->
      <div
        v-if="showOutlookDetails"
        id="outlook-details-panel"
        class="outlook-breakdown-panel"
      >
        <h3 class="outlook-panel-title">Itemized Protection Allocations</h3>
        <p class="muted small">
          Every dollar subtracted from your recorded cash is accounted for below. Protections are never independently subtracted from Safe to Spend.
        </p>

        <!-- Protection items list -->
        <div class="outlook-items-table" role="table" aria-label="Protection items breakdown">
          <div class="outlook-table-header" role="row">
            <span role="columnheader">Protection Category</span>
            <span role="columnheader">Details</span>
            <span role="columnheader" class="text-right">Reserved Amount</span>
          </div>
          <div
            v-for="item in moneyOutlook.protectionItems"
            :key="item.id"
            class="outlook-table-row"
            role="row"
          >
            <div class="item-name-cell" role="cell">
              <strong>{{ item.name }}</strong>
              <span v-if="item.count !== undefined" class="item-count-tag">
                {{ item.count }} {{ item.count === 1 ? 'item' : 'items' }}
              </span>
            </div>
            <div class="item-desc-cell" role="cell">
              <span class="muted small">{{ item.description }}</span>
              <span v-if="item.subdetails" class="item-subdetails small">
                {{ item.subdetails }}
              </span>
            </div>
            <div class="item-amount-cell text-right" role="cell">
              <strong>-{{ money(item.amount) }}</strong>
            </div>
          </div>
        </div>

        <!-- Exact Reconciliation Formula Banner -->
        <div class="outlook-reconciliation-formula" aria-label="Reconciliation formula">
          <div class="formula-line">
            <span class="formula-part">
              <span class="formula-label">Recorded Cash</span>
              <strong>{{ money(moneyOutlook.cashBalance) }}</strong>
            </span>
            <span class="formula-operator">−</span>
            <span class="formula-part">
              <span class="formula-label">Total Protections</span>
              <strong>{{ money(moneyOutlook.totalProtections) }}</strong>
            </span>
            <span class="formula-operator">=</span>
            <span class="formula-part formula-result">
              <span class="formula-label">
                {{ moneyOutlook.hasShortfall ? "Raw Shortfall" : "Safe to Spend" }}
              </span>
              <strong :class="{ 'text-negative': moneyOutlook.hasShortfall }">
                {{ moneyOutlook.hasShortfall ? `-${money(moneyOutlook.shortfall)}` : money(moneyOutlook.safe) }}
              </strong>
            </span>
          </div>
          <span class="reconciliation-verified-tag">
            ✓ Exactly matches core financial engine
          </span>
        </div>

        <!-- Account Freshness Detail List -->
        <div class="outlook-accounts-freshness-box">
          <h4 class="freshness-box-title">Account Balance Freshness</h4>
          <div class="freshness-accounts-grid">
            <div
              v-for="acc in moneyOutlook.freshnessList"
              :key="acc.accountId"
              class="freshness-account-pill"
              :class="`status-${acc.status}`"
            >
              <div class="acc-info">
                <strong>{{ acc.accountName }}</strong>
                <span class="muted small">{{ acc.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- =======================================================================
         Phase 5C: Before Payday Timeline
         ======================================================================= -->
    <section
      class="card timeline-commitments-card"
      id="before-payday-timeline-section"
      aria-labelledby="before-payday-heading"
    >
      <div class="section-card-header">
        <div>
          <div class="header-with-badge">
            <h2 id="before-payday-heading">Before Payday Timeline</h2>
            <span
              v-if="beforePaydayCommitments.hasConfiguredPayday"
              class="timeline-payday-badge"
            >
              Through {{ dateWithDay(beforePaydayCommitments.cutoffDate) }}
            </span>
          </div>
          <p class="muted section-caption">
            All approaching recurring bills and scheduled commitments due before your next paycheck.
          </p>
        </div>
      </div>

      <!-- Setup State: No Payday Configured -->
      <div
        v-if="beforePaydayCommitments.setupRequired"
        class="timeline-setup-state"
        role="region"
        aria-label="Payday configuration needed"
      >
        <span class="setup-icon" aria-hidden="true">🗓️</span>
        <div class="setup-body">
          <h3>Set your payday schedule</h3>
          <p class="muted">
            {{ beforePaydayCommitments.setupMessage }}
          </p>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="page = 'Settings'"
          >
            Configure Payday in Settings →
          </button>
        </div>
      </div>

      <!-- Configured Payday Timeline -->
      <div v-else class="timeline-content-wrapper">
        <!-- Paycheck Transparency Notice -->
        <div class="timeline-income-notice" role="note">
          <span class="notice-icon" aria-hidden="true">💡</span>
          <p class="notice-text">
            <strong>Income Safety:</strong> Expected paychecks are never counted as available money until they are actually received and recorded in your accounts.
          </p>
        </div>

        <!-- Commitments List -->
        <div
          v-if="beforePaydayCommitments.commitments.length > 0"
          class="commitments-list"
          role="list"
          aria-label="Upcoming commitments before payday"
        >
          <div
            v-for="commit in beforePaydayCommitments.commitments"
            :key="commit.id"
            class="commitment-item-row"
            role="listitem"
          >
            <!-- Left: Date indicator -->
            <div class="commitment-date-badge">
              <span class="date-main">{{ dateWithDay(commit.date) }}</span>
            </div>

            <!-- Middle: Name, details, badges -->
            <div class="commitment-details-area">
              <div class="commitment-name-row">
                <strong class="commitment-name">{{ commit.name }}</strong>
                <span
                  class="commitment-status-pill"
                  :class="`status-${commit.protectionStatus}`"
                  :title="commit.protectionReason"
                >
                  {{ commit.protectionStatus === 'protected' ? '✓ Protected' : 'Uncovered' }}
                </span>
                <span
                  v-if="commit.sourceType === 'linked_bill_scheduled'"
                  class="commitment-type-pill"
                >
                  Scheduled Bill
                </span>
                <span
                  v-else-if="commit.sourceType === 'recurring_bill'"
                  class="commitment-type-pill"
                >
                  Recurring Bill
                </span>
                <span
                  v-else
                  class="commitment-type-pill"
                >
                  Scheduled
                </span>
              </div>

              <!-- Reason / partial note -->
              <div class="commitment-subtext-row">
                <span class="muted small">{{ commit.protectionReason }}</span>
                <span v-if="commit.paymentDetails" class="commitment-partial-note small">
                  {{ commit.paymentDetails }}
                </span>
              </div>
            </div>

            <!-- Right: Amount -->
            <div class="commitment-amount-col text-right">
              <strong class="commitment-amount">{{ money(commit.amount) }}</strong>
              <span class="muted micro">due</span>
            </div>
          </div>
        </div>

        <!-- Empty State: No Commitments -->
        <div
          v-else
          class="insights-empty-state"
          role="region"
          aria-label="No upcoming commitments"
        >
          <span class="empty-icon" aria-hidden="true">🌿</span>
          <h3>No upcoming commitments before payday</h3>
          <p class="muted">
            You have no recurring bills or scheduled expenses due between now and {{ dateWithDay(beforePaydayCommitments.cutoffDate) }}.
          </p>
        </div>
      </div>
    </section>

    <!-- =======================================================================
         Phase 5C: Mika Explains Your Money
         Deterministic, rules-based companion financial explanations
         ======================================================================= -->
    <section
      class="card mika-explains-card"
      id="mika-explains-section"
      aria-labelledby="mika-explains-heading"
    >
      <div class="mika-explains-layout">
        <!-- Companion Portrait Column -->
        <div class="mika-character-col">
          <img
            :src="companionPortraits[currentMikaExplanation.expression]"
            :alt="`Mika looking ${currentMikaExplanation.expression}`"
            class="mika-avatar-img"
            width="88"
            height="88"
          />
          <span class="mika-name-label">Mika</span>
        </div>

        <!-- Speech Bubble Column -->
        <div class="mika-speech-col">
          <!-- Topic Selector Chips -->
          <div
            class="mika-topic-pills"
            role="tablist"
            aria-label="Select explanation topic"
          >
            <button
              v-if="moneyOutlook.hasShortfall"
              type="button"
              class="mika-topic-btn"
              :class="{ active: activeMikaTopic === 'shortfall' }"
              :aria-selected="activeMikaTopic === 'shortfall'"
              role="tab"
              @click="activeMikaTopic = 'shortfall'"
            >
              Shortfall
            </button>
            <button
              type="button"
              class="mika-topic-btn"
              :class="{ active: activeMikaTopic === 'safe_to_spend' }"
              :aria-selected="activeMikaTopic === 'safe_to_spend'"
              role="tab"
              @click="activeMikaTopic = 'safe_to_spend'"
            >
              Safe to Spend
            </button>
            <button
              type="button"
              class="mika-topic-btn"
              :class="{ active: activeMikaTopic === 'protected_bills' }"
              :aria-selected="activeMikaTopic === 'protected_bills'"
              role="tab"
              @click="activeMikaTopic = 'protected_bills'"
            >
              Protected Bills
            </button>
            <button
              type="button"
              class="mika-topic-btn"
              :class="{ active: activeMikaTopic === 'commitments' }"
              :aria-selected="activeMikaTopic === 'commitments'"
              role="tab"
              @click="activeMikaTopic = 'commitments'"
            >
              Commitments
            </button>
            <button
              type="button"
              class="mika-topic-btn"
              :class="{ active: activeMikaTopic === 'balance_freshness' }"
              :aria-selected="activeMikaTopic === 'balance_freshness'"
              role="tab"
              @click="activeMikaTopic = 'balance_freshness'"
            >
              Account Freshness
            </button>
          </div>

          <!-- Dialogue Speech Bubble -->
          <div
            class="mika-speech-bubble"
            role="region"
            :aria-label="`Mika's explanation for ${currentMikaExplanation.title}`"
          >
            <h3 id="mika-explains-heading" class="mika-bubble-title">
              {{ currentMikaExplanation.title }}
            </h3>
            <p class="mika-bubble-text">
              {{ currentMikaExplanation.text }}
            </p>
            <p v-if="currentMikaExplanation.detail" class="mika-bubble-detail">
              {{ currentMikaExplanation.detail }}
            </p>

            <div v-if="currentMikaExplanation.actionLabel" class="mika-bubble-action-row">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="handleMikaAction(currentMikaExplanation)"
              >
                {{ currentMikaExplanation.actionLabel }} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Phase 5B: Month-over-Month Comparison Card -->
    <section
      class="card month-comparison-card"
      aria-labelledby="mom-comparison-heading"
    >
      <div class="section-card-header">
        <div>
          <div class="header-with-badge">
            <h2 id="mom-comparison-heading">Month-over-Month Comparison</h2>
            <span
              v-if="monthComparison.isPartialMonth"
              class="comparison-partial-badge"
            >
              Partial Month · Days 1–{{ monthComparison.elapsedDays }}
            </span>
          </div>
          <p class="muted section-caption">
            Comparing {{ monthComparison.selectedLabel }} with {{ monthComparison.prevLabel }}.
          </p>
        </div>
      </div>

      <!-- Factual Neutral Headline -->
      <div class="comparison-headline-banner">
        <span class="comparison-headline-icon" aria-hidden="true">📊</span>
        <p class="comparison-headline-text">{{ monthComparison.headline }}</p>
      </div>

      <!-- Comparison Metrics Grid -->
      <div class="comparison-stats-grid">
        <!-- Selected Period Spending -->
        <div class="comparison-stat-item">
          <span class="comparison-stat-label">
            {{ monthComparison.selectedLabel }}
            <span v-if="monthComparison.isPartialMonth" class="sub-label">
              (Days 1–{{ monthComparison.elapsedDays }})
            </span>
          </span>
          <strong class="comparison-stat-value">{{ money(monthComparison.selectedSpent) }}</strong>
          <span class="comparison-stat-subtext">
            {{ monthComparison.isPartialMonth ? "Current elapsed spending" : "Full calendar month" }}
          </span>
        </div>

        <!-- Preceding Period Spending -->
        <div class="comparison-stat-item">
          <span class="comparison-stat-label">
            {{ monthComparison.prevLabel }}
            <span v-if="monthComparison.isPartialMonth" class="sub-label">
              (Days 1–{{ monthComparison.elapsedDays }})
            </span>
          </span>
          <strong class="comparison-stat-value">{{ money(monthComparison.comparisonBaseline) }}</strong>
          <span class="comparison-stat-subtext">
            {{
              monthComparison.isPartialMonth
                ? `Full month was ${money(monthComparison.prevSpentFull)}`
                : "Preceding calendar month"
            }}
          </span>
        </div>

        <!-- Dollar & Percentage Difference -->
        <div class="comparison-stat-item comparison-diff-item">
          <span class="comparison-stat-label">Difference</span>
          <strong class="comparison-stat-value">
            {{
              monthComparison.diffAmount > 0
                ? `+${money(monthComparison.diffAmount)}`
                : monthComparison.diffAmount < 0
                  ? `-${money(monthComparison.absDiffAmount)}`
                  : "$0.00"
            }}
          </strong>
          <span class="comparison-stat-subtext">
            {{
              monthComparison.percentChange !== null
                ? `${monthComparison.percentChange > 0 ? `+${monthComparison.percentChange}%` : `${monthComparison.percentChange}%`} change`
                : monthComparison.comparisonBaseline === 0 && monthComparison.selectedSpent === 0
                  ? "No spending recorded"
                  : "No prior baseline for percentage"
            }}
          </span>
        </div>
      </div>

      <!-- Partial Month Informational Callout -->
      <p v-if="monthComparison.isPartialMonth" class="comparison-coverage-note muted">
        <span class="info-icon" aria-hidden="true">ℹ️</span>
        <span>
          <strong>Elapsed comparison:</strong> Because {{ monthComparison.selectedLabel }} is ongoing, the baseline uses the first {{ monthComparison.elapsedDays }} days of {{ monthComparison.prevLabel }} ({{ money(monthComparison.prevSpentElapsed) }}) for an equal elapsed comparison. The full previous month total was {{ money(monthComparison.prevSpentFull) }}.
        </span>
      </p>
    </section>

    <!-- Phase 5B: 6-Month Spending History Card -->
    <section
      class="card spending-history-card"
      aria-labelledby="spending-history-heading"
    >
      <div class="section-card-header">
        <div>
          <h2 id="spending-history-heading">6-Month Spending History</h2>
          <p class="muted section-caption">
            Net recorded spending across the most recent six calendar months. Reuses verified spending rules from actual ledger entries.
          </p>
        </div>
        <button
          type="button"
          class="history-table-toggle-btn"
          @click="showHistoryTable = !showHistoryTable"
          :aria-expanded="showHistoryTable"
          aria-controls="spending-history-table-panel"
        >
          {{ showHistoryTable ? "Hide data table" : "Show data table equivalent" }}
        </button>
      </div>

      <!-- Pure Accessible CSS Bar Chart -->
      <div
        class="history-chart-wrapper"
        role="region"
        aria-label="6-Month spending history bar chart"
      >
        <div class="history-bars-track">
          <div
            v-for="point in spendingHistory.months"
            :key="point.month"
            class="history-bar-col"
            :class="{
              'is-selected': point.month === selectedInsightsMonth,
              'is-partial': point.isPartial,
            }"
          >
            <!-- Amount Label on top -->
            <span class="history-bar-amount">
              {{ money(point.totalSpent) }}
            </span>

            <!-- Bar Track and Fill -->
            <div
              class="history-bar-slot"
              role="img"
              :aria-label="`${point.fullLabel}: ${money(point.totalSpent)} recorded spending${point.isPartial ? ' (partial month)' : ''}`"
            >
              <div
                class="history-bar-fill"
                :style="{
                  height: `${point.totalSpent > 0 ? Math.max(point.percentageOfMax, 6) : 0}%`,
                }"
              />
            </div>

            <!-- Month Label Below -->
            <div class="history-bar-meta">
              <span class="history-bar-label">{{ point.shortLabel }}</span>
              <span v-if="point.isPartial" class="history-partial-pill">Partial</span>
              <span
                v-else-if="point.month === selectedInsightsMonth"
                class="history-active-pill"
              >
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Accessible Data Table Equivalent -->
      <div
        v-if="showHistoryTable"
        id="spending-history-table-panel"
        class="history-table-panel"
      >
        <table class="history-data-table" aria-label="Detailed 6-month spending numbers">
          <thead>
            <tr>
              <th scope="col">Calendar Month</th>
              <th scope="col">Status</th>
              <th scope="col" class="align-right">Qualifying Expenses</th>
              <th scope="col" class="align-right">Net Recorded Spending</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="point in spendingHistory.months"
              :key="point.month"
              :class="{ 'row-selected': point.month === selectedInsightsMonth }"
            >
              <td>
                <strong>{{ point.fullLabel }}</strong>
                <span v-if="point.month === selectedInsightsMonth" class="table-selected-tag">
                  (Selected)
                </span>
              </td>
              <td>
                {{ point.isPartial ? "Partial month (in progress)" : "Full calendar month" }}
              </td>
              <td class="align-right">{{ point.transactionCount }}</td>
              <td class="align-right">
                <strong>{{ money(point.totalSpent) }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- History Summary Footer -->
      <div class="history-summary-footer">
        <div class="history-summary-metric">
          <span class="summary-metric-label">6-Month Total Spending</span>
          <strong class="summary-metric-val">{{ money(spendingHistory.totalSixMonthsSpent) }}</strong>
        </div>
        <div class="history-summary-metric">
          <span class="summary-metric-label">Monthly Average</span>
          <strong class="summary-metric-val">{{ money(spendingHistory.averageSpent) }}</strong>
        </div>
      </div>
    </section>

    <!-- Phase 5A: Category Breakdown Section -->
    <section
      class="card category-breakdown-card"
      aria-labelledby="category-breakdown-heading"
    >
      <div class="breakdown-header">
        <div>
          <h2 id="category-breakdown-heading">Category Breakdown</h2>
          <p class="muted breakdown-caption">
            Qualifying expenses grouped by category, sorted highest first. Includes pending transactions; excludes transfers and credit card debt repayments.
          </p>
        </div>
        <span
          class="badge"
          v-if="insightsSummary.categories.length > 0"
        >
          {{ insightsSummary.categories.length }} {{ insightsSummary.categories.length === 1 ? "category" : "categories" }}
        </span>
      </div>

      <!-- Active Breakdown List -->
      <div
        v-if="insightsSummary.categories.length > 0"
        class="category-list"
        role="list"
      >
        <div
          v-for="cat in insightsSummary.categories"
          :key="cat.name"
          class="category-item"
          role="listitem"
        >
          <!-- Category Header Line -->
          <div class="category-meta-row">
            <div class="category-title-area">
              <span
                class="category-swatch"
                :style="{ backgroundColor: cat.color }"
                aria-hidden="true"
              />
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-count muted">
                {{ cat.count }} {{ cat.count === 1 ? "tx" : "txs" }}
              </span>
            </div>
            <div class="category-values-area">
              <strong class="category-amount">{{ money(cat.amount) }}</strong>
              <span class="category-percentage-badge">
                {{ cat.percentage }}%
              </span>
            </div>
          </div>

          <!-- Simple Proportional CSS Bar -->
          <div
            class="category-bar-track"
            role="progressbar"
            :aria-valuenow="cat.percentage"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${cat.name}: ${money(cat.amount)}, ${cat.percentage} percent of total recorded spending`"
          >
            <div
              class="category-bar-fill"
              :style="{
                width: `${cat.exactPercentage}%`,
                backgroundColor: cat.color,
              }"
            />
          </div>

          <!-- Direct action to view transaction list in this category with preserved month -->
          <div class="category-action-row">
            <button
              type="button"
              class="text-link small"
              @click="viewCategoryInTransactions(cat.name)"
            >
              View {{ cat.name }} transactions in {{ insightsSummary.periodLabel }} →
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="insights-empty-state"
        role="region"
        aria-label="No spending recorded"
      >
        <span class="empty-icon" aria-hidden="true">🌱</span>
        <h3>
          {{
            insightsSummary.transactionCount > 0
              ? "No net spending recorded for this period"
              : "No spending recorded for this period yet"
          }}
        </h3>
        <p class="muted">
          {{
            insightsSummary.transactionCount > 0
              ? `Recorded refunds equaled or exceeded purchases in ${insightsSummary.periodLabel}.`
              : `When you record purchases or bill payments in ${insightsSummary.periodLabel}, your category breakdown and proportional summaries will appear here.`
          }}
        </p>
      </div>
    </section>

    <!-- Phase 5B: Category Trends Section -->
    <section
      class="card category-trends-card"
      aria-labelledby="category-trends-heading"
    >
      <div class="section-card-header">
        <div>
          <h2 id="category-trends-heading">Category Trends</h2>
          <p class="muted section-caption">
            Month-over-month category spending changes between {{ monthComparison.prevLabel }} and {{ monthComparison.selectedLabel }}, sorted by largest absolute dollar change.
          </p>
        </div>
      </div>

      <!-- Active Category Trends List -->
      <div
        v-if="categoryTrends.length > 0"
        class="category-trends-list"
        role="list"
      >
        <div
          v-for="trend in categoryTrends"
          :key="trend.name"
          class="category-trend-item"
          role="listitem"
        >
          <div class="trend-main-row">
            <div class="trend-category-identity">
              <span
                class="category-swatch"
                :style="{ backgroundColor: trend.color }"
                aria-hidden="true"
              />
              <span class="trend-category-name">{{ trend.name }}</span>
              
              <!-- Neutral Status Badges -->
              <span
                class="trend-status-badge"
                :class="`status-${trend.status}`"
              >
                {{
                  trend.status === 'new'
                    ? 'New'
                    : trend.status === 'no_spending'
                      ? 'No spending this month'
                      : trend.status === 'increased'
                        ? 'Increased'
                        : trend.status === 'decreased'
                          ? 'Decreased'
                          : 'Unchanged'
                }}
              </span>
            </div>

            <!-- Spending Comparison Numbers -->
            <div class="trend-amounts-area">
              <div class="trend-amount-comparison">
                <span class="muted small">
                  {{ money(trend.prevAmount) }} → {{ money(trend.selectedAmount) }}
                </span>
                <strong class="trend-diff-amount">
                  {{ trend.changeText }}
                </strong>
              </div>
            </div>
          </div>

          <!-- Drill-down link preserving category + month -->
          <div class="trend-action-row">
            <button
              type="button"
              class="text-link small"
              @click="viewCategoryInTransactions(trend.name)"
            >
              View {{ trend.name }} transactions in {{ insightsSummary.periodLabel }} →
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="insights-empty-state"
        role="region"
        aria-label="No category trends recorded"
      >
        <span class="empty-icon" aria-hidden="true">🌱</span>
        <h3>No category spending changes recorded</h3>
        <p class="muted">
          No qualifying expenses were recorded in either {{ monthComparison.selectedLabel }} or {{ monthComparison.prevLabel }}.
        </p>
      </div>
    </section>
  </div>
</template>
