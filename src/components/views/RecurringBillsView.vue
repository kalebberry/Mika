<script setup lang="ts">
import { getFollowingPayday } from "../../model";
import { money, date, pct } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { state, sum, organizedBills, toggleProtectBill } = useBudget();
const { open } = useModal();

function formatDate(iso: string) {
  if (!iso) return "—";
  const dt = new Date(iso + "T12:00:00");
  const isDiffYear = dt.getFullYear() !== new Date().getFullYear();
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(isDiffYear ? { year: "numeric" } : {}),
  });
}
</script>

<template>
  <p class="page-intro">
    Bills due by your next payday ({{ date(state.payday) }}) are reserved automatically.
    You can also protect essential bills due before your following paycheck ({{ date(getFollowingPayday(state)) }}).
  </p>
  <div class="bills-layout">
    <section class="stat dark bill-total" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <span style="font-size: 0.875rem; color: rgba(255, 255, 255, 0.75);">Monthly commitments</span>
        <strong style="font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1;">{{
          money(state.bills.reduce((n, b) => n + b.amount, 0))
        }}</strong>
        <div style="font-size: 0.8125rem; opacity: 0.8;">
          {{ state.bills.length }} recurring bill{{ state.bills.length === 1 ? "" : "s" }}
        </div>
      </div>

      <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.15); display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8125rem;">
        <div style="display: flex; justify-content: space-between;">
          <span>Due before payday:</span>
          <strong>{{ money(sum.currentCycleBills) }}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Next cycle protected:</span>
          <strong>{{ money(sum.protectedCycleBills) }}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.35rem; margin-top: 0.15rem;">
          <span>Total reserved:</span>
          <strong>{{ money(sum.bills) }}</strong>
        </div>
      </div>
    </section>

    <section class="bills-list-card">
      <div
        v-for="item in organizedBills"
        :key="item.bill.id"
        class="bill-item"
        :class="{
          'is-paid': item.isPaid,
          'is-overdue': item.isOverdue,
          'is-due-soon': item.isDueSoon,
          'is-partial': item.isPartiallyPaid,
        }"
      >
        <div class="bill-header">
          <div class="bill-title-group">
            <div class="bill-title-row">
              <h3 class="bill-name">{{ item.bill.name }}</h3>
              <span class="badge" :class="item.status.replace('_', '-')">
                {{ item.statusLabel }}
              </span>
            </div>
            <div class="bill-protection-row">
              <span
                class="protection-tag"
                :class="item.protectionStatus"
                :title="item.protectionLabel"
              >
                <span class="protection-dot"></span>
                {{ item.protectionLabel }}
              </span>
            </div>
          </div>

          <div class="bill-menu-actions">
            <button
              class="icon-btn edit-bill-btn"
              @click="open('Edit bill', item.bill.id)"
              title="Edit bill"
              :aria-label="'Edit ' + item.bill.name"
            >
              ✎
            </button>
            <button
              class="icon-btn delete-bill-btn"
              @click="open('Delete bill', item.bill.id)"
              title="Delete bill"
              :aria-label="'Delete ' + item.bill.name"
            >
              ×
            </button>
          </div>
        </div>

        <!-- The 4 Core Questions Grid -->
        <div class="bill-grid">
          <div class="bill-metric">
            <span class="metric-label">When is it due?</span>
            <strong class="metric-value due-date">{{ formatDate(item.dueDate) }}</strong>
          </div>

          <div class="bill-metric">
            <span class="metric-label">What do I owe?</span>
            <strong class="metric-value expected">{{ money(item.expectedAmount) }}</strong>
          </div>

          <div class="bill-metric">
            <span class="metric-label">Already paid</span>
            <strong class="metric-value paid" :class="{ 'has-paid': item.paidAmount > 0 }">
              {{ money(item.paidAmount) }}
            </strong>
          </div>

          <div class="bill-metric highlight">
            <span class="metric-label">Still to pay</span>
            <strong
              class="metric-value remaining"
              :class="{ 'zero-remaining': item.remainingAmount === 0 }"
            >
              {{ money(item.remainingAmount) }}
            </strong>
          </div>
        </div>

        <!-- Visual progress for partial payments -->
        <div v-if="item.isPartiallyPaid" class="bill-progress">
          <div
            class="bill-progress-bar"
            :style="{ width: pct(item.paidAmount, item.expectedAmount) + '%' }"
          ></div>
        </div>

        <!-- Card Action Controls -->
        <div class="bill-footer">
          <div class="bill-actions-left">
            <!-- Protect toggle for bills due after next payday but before following payday -->
            <button
              v-if="
                item.remainingAmount > 0 &&
                item.dueDate > state.payday &&
                item.dueDate <= getFollowingPayday(state)
              "
              class="secondary btn-protect"
              @click="toggleProtectBill(item.bill.id)"
              :title="item.bill.protected ? 'Remove protection for following cycle' : 'Protect this bill out of current balance'"
            >
              {{ item.bill.protected ? "Protected ✓" : "Protect next cycle" }}
            </button>

            <button
              v-if="!item.isPaid"
              class="secondary btn-settle"
              @click="open('Settle bill', item.bill.id, item.dueDate)"
              title="Mark this occurrence as settled before setup without deducting cash"
            >
              Paid before setup
            </button>
          </div>

          <div class="bill-actions-right">
            <button
              v-if="!item.isPaid"
              class="secondary btn-pay"
              @click="open('Pay bill', item.bill.id, item.dueDate)"
            >
              {{ item.isPartiallyPaid ? "Pay remaining (" + money(item.remainingAmount) + ")" : "Pay bill" }}
            </button>
            <span v-else class="paid-indicator">
              ✓ {{ item.overpaidAmount > 0 ? "Overpaid (" + money(item.overpaidAmount) + ")" : "Paid in full" }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!state.bills.length" class="empty">
        <h3>Make room for the essentials.</h3>
        <p>Add rent, utilities, and subscriptions here.</p>
        <button class="primary" @click="open('Add bill')">
          Add a recurring bill
        </button>
      </div>
    </section>
  </div>
</template>
