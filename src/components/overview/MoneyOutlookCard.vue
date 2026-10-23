<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { money } from "../../utils/format";

const { moneyOutlook, navigateToMoneyOutlook } = useBudget();

const outlook = computed(() => moneyOutlook.value);
const hasShortfall = computed(() => outlook.value.hasShortfall);
</script>

<template>
  <article
    class="card money-outlook-summary-card"
    aria-labelledby="outlook-summary-title"
    tabindex="0"
    role="region"
    @click="navigateToMoneyOutlook"
    @keydown.enter="navigateToMoneyOutlook"
    @keydown.space.prevent="navigateToMoneyOutlook"
  >
    <div class="outlook-summary-header">
      <div class="outlook-header-title-group">
        <span class="outlook-icon" aria-hidden="true">🔭</span>
        <div>
          <h2 id="outlook-summary-title" class="outlook-title">
            Money Outlook Before Payday
          </h2>
          <span class="muted small">
            {{ outlook.hasConfiguredPayday ? `Commitments through ${outlook.paydayCutoffDate}` : 'No payday configured' }}
          </span>
        </div>
      </div>
      <span
        v-if="hasShortfall"
        class="badge badge-amber"
      >
        Shortfall warning
      </span>
      <span
        v-else
        class="badge badge-teal"
      >
        On track
      </span>
    </div>

    <!-- 3 Core Summary Metrics -->
    <div class="outlook-metrics-grid">
      <div class="metric-block">
        <span class="metric-label">Recorded Cash</span>
        <strong class="metric-value">{{ money(outlook.cashBalance) }}</strong>
      </div>
      <div class="metric-block">
        <span class="metric-label">Protected Commitments</span>
        <strong class="metric-value text-muted">− {{ money(outlook.totalProtections) }}</strong>
      </div>
      <div class="metric-block primary-metric" :class="{ 'is-shortfall': hasShortfall }">
        <span class="metric-label">{{ hasShortfall ? 'Uncovered Shortfall' : 'Safe to Spend' }}</span>
        <strong class="metric-value">
          {{ hasShortfall ? money(outlook.shortfall) : money(outlook.safe) }}
        </strong>
      </div>
    </div>

    <div class="outlook-footer-row">
      <span class="outlook-summary-note muted small">
        {{ hasShortfall ? 'Planned commitments exceed recorded cash.' : 'Protected savings, bills, and card reserves are secured.' }}
      </span>
      <button
        type="button"
        class="text-link small outlook-cta-link"
        @click.stop="navigateToMoneyOutlook"
      >
        Explore full Money Outlook in Insights →
      </button>
    </div>
  </article>
</template>

<style scoped>
.money-outlook-summary-card {
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  border-left: 4px solid var(--color-teal, #277c78);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.money-outlook-summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.outlook-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.outlook-header-title-group {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.outlook-icon {
  font-size: 1.35rem;
}

.outlook-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #1e1e1e);
}

.outlook-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--color-bg-subtle, #f8f9fa);
  border-radius: var(--radius-sm, 6px);
  margin-bottom: 0.875rem;
}

.metric-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--color-muted, #666666);
  font-weight: 500;
}

.metric-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #1e1e1e);
}

.primary-metric.is-shortfall .metric-value {
  color: var(--color-danger, #c94736);
}

.outlook-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.outlook-cta-link {
  font-weight: 600;
  color: var(--color-teal, #277c78);
  text-decoration: underline;
}

@media (max-width: 480px) {
  .outlook-metrics-grid {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }
}
</style>
