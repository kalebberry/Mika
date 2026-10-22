<script setup lang="ts">
import { computed, ref } from "vue";
import { useBudget } from "../../composables/useBudget";
import { money } from "../../utils/format";

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
} = useBudget();

const showHistoryTable = ref(false);

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
