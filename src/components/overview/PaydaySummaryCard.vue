<script setup lang="ts">
import { computed } from "vue";
import {
  today,
  isValidDateString,
  getCurrentPayday,
  getFollowingPayday,
  reserveBillsBreakdown,
  getUpcomingPaydays,
} from "../../model.ts";
import { money, date, frequencyLabel } from "../../utils/format.ts";
import { useBudget } from "../../composables/useBudget.ts";

const { state, sum, days, page } = useBudget();

const activeFrequency = computed(
  () => state.value.paydaySchedule?.frequency || "manual",
);
const activeFrequencyName = computed(() =>
  frequencyLabel(activeFrequency.value),
);

// Next payday from engine
const nextPaydayDate = computed(() => {
  const current = getCurrentPayday(state.value);
  return isValidDateString(current) ? current : "";
});

// Following payday from engine
const followingPaydayDate = computed(() => {
  const fol = getFollowingPayday(state.value);
  return isValidDateString(fol) ? fol : "";
});

// Is manual schedule incomplete / missing an upcoming payday?
const isManualIncomplete = computed(() => {
  if (activeFrequency.value !== "manual") return false;
  // If no upcoming occurrences exist in the engine
  const upcoming = getUpcomingPaydays(state.value.paydaySchedule, today(), 1);
  return upcoming.length === 0;
});

// Days countdown label
const daysLabel = computed(() => {
  if (!nextPaydayDate.value) return "";
  const now = today();
  if (nextPaydayDate.value === now) return "Today";
  if (nextPaydayDate.value < now) return "Past due";
  return days.value === 1 ? "in 1 day" : `in ${days.value} days`;
});

// Bill breakdown and overdue obligations from engine
const breakdown = computed(() => reserveBillsBreakdown(state.value, today()));

// Check for legitimately overdue unpaid bills
const overdueBills = computed(() => {
  const now = today();
  return breakdown.value.details.filter((d) => d.dueDate < now);
});
const overdueCount = computed(() => overdueBills.value.length);
const overdueTotal = computed(() =>
  overdueBills.value.reduce((acc, b) => acc + b.amount, 0),
);

// Total reserved bills
const totalReserved = computed(
  () => sum.value.currentCycleBills + sum.value.protectedCycleBills,
);
</script>

<template>
  <section class="card payday-summary-card">
    <div class="section-heading">
      <h2>
        <span class="payday-heading-icon">📅</span>
        Payday & Protection
      </h2>
      <button class="text-link" @click="page = 'Settings'">
        Manage schedule <span>›</span>
      </button>
    </div>

    <!-- Empty State for Manual Schedule without known upcoming payday -->
    <div v-if="isManualIncomplete" class="payday-empty-state">
      <div class="empty-icon">🗓</div>
      <h3>No upcoming payday set</h3>
      <p class="muted">
        Your manual schedule doesn't have an upcoming payday configured.
        Set your next payday date in Settings so Mika can protect your bills and show your daily spending allowance.
      </p>
      <button class="primary small" @click="page = 'Settings'">
        Set payday in Settings ›
      </button>
    </div>

    <!-- Active Payday Summary -->
    <div v-else class="payday-summary-content">
      <div class="payday-highlight-row">
        <span class="badge" :class="`frequency-${activeFrequency}`">
          {{ activeFrequencyName }}
        </span>
        <div class="payday-main-info">
          <div class="payday-next-line">
            <span class="payday-label">Next payday:</span>
            <strong>{{ date(nextPaydayDate) }}</strong>
            <span v-if="daysLabel" class="payday-tag">{{ daysLabel }}</span>
          </div>
          <div
            v-if="followingPaydayDate && followingPaydayDate !== nextPaydayDate"
            class="payday-following-line muted"
          >
            <span>Following payday:</span>
            <span>{{ date(followingPaydayDate) }}</span>
          </div>
        </div>
      </div>

      <!-- Bill Protection Explanation -->
      <div class="bill-protection-explainer">
        <div class="explainer-header">
          <strong>How your money is protected until payday:</strong>
        </div>

        <div class="protection-items">
          <!-- Current Cycle Reserved Bills -->
          <div class="protection-item">
            <div class="protection-item-row">
              <span class="protection-dot blue">●</span>
              <span class="protection-name">Bills due before payday</span>
              <strong class="protection-amount">{{
                money(sum.currentCycleBills)
              }}</strong>
            </div>
            <p class="protection-item-sub muted">
              Unpaid recurring bills falling before your next paycheck are reserved
              so you don’t accidentally spend bill money.
            </p>
          </div>

          <!-- Following Cycle Protected Bills -->
          <div v-if="sum.protectedCycleBills > 0" class="protection-item">
            <div class="protection-item-row">
              <span class="protection-dot purple">●</span>
              <span class="protection-name">Next cycle bills protected</span>
              <strong class="protection-amount">{{
                money(sum.protectedCycleBills)
              }}</strong>
            </div>
            <p class="protection-item-sub muted">
              Essential bills (like next month's rent) protected early for peace of
              mind.
            </p>
          </div>

          <!-- Overdue Obligations -->
          <div v-if="overdueCount > 0" class="protection-item overdue-item">
            <div class="protection-item-row">
              <span class="protection-dot peach">●</span>
              <span class="protection-name">Overdue unpaid obligations</span>
              <strong class="protection-amount">{{
                money(overdueTotal)
              }}</strong>
            </div>
            <p class="protection-item-sub muted">
              {{ overdueCount }} unpaid bill occurrence{{
                overdueCount > 1 ? "s" : ""
              }}
              from past cycles remain reserved obligations until settled or paid.
            </p>
          </div>
        </div>

        <!-- Safe to Spend Relationship / Shortfall -->
        <div v-if="sum.shortfall > 0" class="protection-footer shortfall-banner">
          <span class="status-icon">⚠</span>
          <div>
            <strong>Reserve Shortfall: {{ money(sum.shortfall) }}</strong>
            <p class="muted">
              Your planned reserves exceed available cash by {{ money(sum.shortfall) }}.
              Safe to spend is $0.00 until this deficit is resolved.
            </p>
          </div>
        </div>
        <div v-else class="protection-footer safe-banner">
          <span class="status-icon">✓</span>
          <div>
            <strong
              >Safe to Spend accounts for all
              {{ money(totalReserved) }} in reserved bills</strong
            >
            <p class="muted">
              Your spending plan already reserves these amounts from your cash
              balance.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
