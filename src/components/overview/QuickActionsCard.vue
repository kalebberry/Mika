<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { state, dailyAttentionSummary, page } = useBudget();
const { open } = useModal();

const urgentBill = computed(() => {
  const items = dailyAttentionSummary.value.items;
  return items.find(
    (i) =>
      (i.category === "overdue_bill" || i.category === "due_soon_bill") &&
      i.billId,
  );
});

function handleAddExpense() {
  open("Add transaction", "", "Expense");
}

function handleAddIncome() {
  open("Add transaction", "", "Income");
}

function handleRecordBillPayment() {
  // If an overdue or due-soon bill requires attention, preselect its exact occurrence
  if (urgentBill.value?.billId && urgentBill.value?.billDueDate) {
    open("Pay bill", urgentBill.value.billId, urgentBill.value.billDueDate);
    return;
  }

  // If user tracks exactly one bill, preselect it
  if (state.value.bills.length === 1) {
    open("Pay bill", state.value.bills[0]!.id);
    return;
  }

  // Otherwise, navigate to Bills so the user can choose which bill and occurrence to pay
  page.value = "Recurring Bills";
}

function handleViewBills() {
  page.value = "Recurring Bills";
}
</script>

<template>
  <section class="card quick-actions-card" aria-labelledby="quick-actions-title">
    <div class="quick-actions-header">
      <h2 id="quick-actions-title">
        <span class="quick-actions-icon" aria-hidden="true">⚡</span>
        Quick Actions
      </h2>
      <span class="quick-actions-caption">Common daily tasks</span>
    </div>

    <div class="quick-actions-grid" role="group" aria-label="Quick financial actions">
      <button
        type="button"
        class="quick-action-btn"
        @click="handleAddExpense"
        aria-label="Add expense transaction"
      >
        <span class="btn-icon" aria-hidden="true">−</span>
        <span class="btn-text">
          <strong>Add expense</strong>
          <small>Record daily spending</small>
        </span>
      </button>

      <button
        type="button"
        class="quick-action-btn"
        @click="handleAddIncome"
        aria-label="Add income transaction"
      >
        <span class="btn-icon plus" aria-hidden="true">＋</span>
        <span class="btn-text">
          <strong>Add income</strong>
          <small>Record money received</small>
        </span>
      </button>

      <button
        type="button"
        class="quick-action-btn"
        @click="handleRecordBillPayment"
        aria-label="Record a bill payment"
      >
        <span class="btn-icon check" aria-hidden="true">✓</span>
        <span class="btn-text">
          <strong>Record bill payment</strong>
          <small v-if="urgentBill">
            Pay {{ urgentBill.title.replace(" Overdue", "").replace(" Due Soon", "") }}
          </small>
          <small v-else>Pay an upcoming bill</small>
        </span>
      </button>

      <button
        type="button"
        class="quick-action-btn"
        @click="handleViewBills"
        aria-label="View all recurring bills"
      >
        <span class="btn-icon doc" aria-hidden="true">▤</span>
        <span class="btn-text">
          <strong>View bills</strong>
          <small>Manage recurring list</small>
        </span>
      </button>
    </div>
  </section>
</template>
