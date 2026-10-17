<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";
import { money, date } from "../../utils/format";
import type { DailyAttentionItem } from "../../model";

const {
  state,
  dailyAttentionSummary,
  dailySuggestedAction,
  statusFilter,
  page,
} = useBudget();
const { open } = useModal();

const items = computed(() => dailyAttentionSummary.value.items);
const totalCount = computed(() => dailyAttentionSummary.value.totalCount);
const hasMore = computed(() => dailyAttentionSummary.value.hasMore);
const moreLabel = computed(() => dailyAttentionSummary.value.moreLabel);
const moreTargetPage = computed(
  () => dailyAttentionSummary.value.moreTargetPage || "Recurring Bills",
);

const suggested = computed(() => dailySuggestedAction.value);

const hasAccountsOrTransactions = computed(() => {
  return (
    (state.value.accounts && state.value.accounts.length > 0) ||
    state.value.transactions.length > 0 ||
    state.value.opening > 0
  );
});

function handleAction(item: DailyAttentionItem) {
  if (item.category === "overdue_bill" || item.category === "due_soon_bill") {
    if (item.billId && item.billDueDate) {
      open("Pay bill", item.billId, item.billDueDate);
      return;
    }
  }
  if (item.category === "scheduled_expense") {
    statusFilter.value = "Scheduled";
    page.value = "Transactions";
    return;
  }
  if (item.targetPage) {
    page.value = item.targetPage as any;
  }
}

function handleSuggestedAction() {
  const act = suggested.value;
  if (act.modalAction) {
    open(
      act.modalAction.modal,
      act.modalAction.id || "",
      act.modalAction.category || "",
    );
  } else if (act.targetPage) {
    page.value = act.targetPage as any;
  }
}
</script>

<template>
  <section class="card daily-attention-card" aria-labelledby="attention-title">
    <div class="section-heading">
      <div class="attention-header-left">
        <h2 id="attention-title">
          <span class="attention-icon" aria-hidden="true">⚡</span>
          What Needs Attention
        </h2>
        <span
          v-if="totalCount > 0"
          class="badge"
          :class="totalCount > 1 ? 'badge-amber' : 'badge-neutral'"
        >
          {{ totalCount }} {{ totalCount === 1 ? "item" : "items" }}
        </span>
        <span v-else class="badge badge-teal">
          All clear
        </span>
      </div>
      <button
        v-if="hasMore"
        class="text-link"
        @click="page = moreTargetPage as any"
      >
        {{ moreLabel }} <span>›</span>
      </button>
    </div>

    <!-- Suggested Next Action (at most one primary recommendation) -->
    <div
      class="suggested-action-callout"
      :class="{ urgent: suggested.isUrgent }"
      role="region"
      aria-label="Suggested next step"
    >
      <div class="suggested-action-meta">
        <span class="suggested-pill">
          {{ suggested.isUrgent ? "ACTION NEEDED" : "SUGGESTED STEP" }}
        </span>
      </div>
      <div class="suggested-action-content">
        <div>
          <h3 class="suggested-action-title">{{ suggested.title }}</h3>
          <p class="suggested-action-desc">{{ suggested.description }}</p>
        </div>
        <button
          type="button"
          class="primary small suggested-action-btn"
          @click="handleSuggestedAction"
        >
          {{ suggested.actionLabel }}
        </button>
      </div>
    </div>

    <!-- Prioritized Attention Items (maximum 3) -->
    <div v-if="items.length > 0" class="attention-items-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="attention-item"
        :class="`severity-${item.severity}`"
      >
        <div class="attention-item-left">
          <span
            class="severity-indicator"
            :class="`sev-${item.severity}`"
            aria-hidden="true"
          >
            {{ item.severity === 'critical' ? '!' : item.severity === 'warning' ? '▲' : '●' }}
          </span>
          <div class="attention-item-body">
            <div class="attention-item-title-row">
              <strong class="attention-item-title">{{ item.title }}</strong>
              <span v-if="item.amount !== undefined" class="attention-item-amount">
                {{ money(item.amount) }}
              </span>
            </div>
            <p class="attention-item-desc">{{ item.description }}</p>
          </div>
        </div>
        <div class="attention-item-actions">
          <button
            type="button"
            class="secondary small attention-btn"
            @click="handleAction(item)"
          >
            {{ item.actionLabel }}
          </button>
        </div>
      </article>
    </div>

    <!-- Calm empty state if no attention items -->
    <div v-else class="attention-calm-state">
      <span class="calm-icon" aria-hidden="true">✓</span>
      <div>
        <strong v-if="hasAccountsOrTransactions">
          Nothing needs immediate attention today.
        </strong>
        <strong v-else>
          No active bills or pending obligations recorded yet.
        </strong>
        <p>
          Your tracked bills, minimum payments, and reserves are currently balanced.
        </p>
      </div>
    </div>
  </section>
</template>
