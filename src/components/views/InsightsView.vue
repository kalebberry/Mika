<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { money } from "../../utils/format";

const {
  state,
  selectedInsightsMonth,
  insightsSummary,
  reportingPeriods,
  page,
  category,
} = useBudget();

const periods = computed(() => [
  reportingPeriods.value.thisMonth,
  reportingPeriods.value.lastMonth,
]);

function setPeriod(monthStr: string) {
  selectedInsightsMonth.value = monthStr;
}

function viewCategoryInTransactions(catName: string) {
  category.value = catName;
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

    <!-- Factual Observation Card (At most one concise observation based strictly on recorded data) -->
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

    <!-- Spending Summary Cards Grid -->
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

    <!-- Category Breakdown Section -->
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

          <!-- Direct action to view transaction list in this category -->
          <div class="category-action-row">
            <button
              type="button"
              class="text-link small"
              @click="viewCategoryInTransactions(cat.name)"
            >
              View {{ cat.name }} transactions →
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
  </div>
</template>
