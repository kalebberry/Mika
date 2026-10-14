<script setup lang="ts">
import { isBillPaid, nextUnpaidDueDate, getFollowingPayday } from "../../model";
import { money, formatNextDue, billStatus, date } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { state, sum, toggleProtectBill } = useBudget();
const { open } = useModal();
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

    <section class="card">
      <div v-for="b in state.bills" :key="b.id" class="bill-row">
        <div>
          <h3>{{ b.name }}</h3>
          <span class="muted">{{ formatNextDue(nextUnpaidDueDate(state, b)) }}</span>
        </div>
        <span
          class="badge"
          :class="billStatus(state, b).toLowerCase().replace(/[^a-z0-9]+/g, '-')"
        >
          {{ billStatus(state, b) }}
        </span>
        <strong>{{ money(b.amount) }}</strong>

        <!-- Protect toggle for bills due after next payday but before following payday -->
        <button
          v-if="
            nextUnpaidDueDate(state, b) > state.payday &&
            nextUnpaidDueDate(state, b) <= getFollowingPayday(state) &&
            !isBillPaid(state, b, nextUnpaidDueDate(state, b))
          "
          class="secondary"
          style="font-size: 0.75rem; padding: 0.35rem 0.6rem; white-space: nowrap;"
          @click="toggleProtectBill(b.id)"
          :title="b.protected ? 'Remove protection for following cycle' : 'Protect this bill out of current balance'"
        >
          {{ b.protected ? "Protected ✓" : "Protect" }}
        </button>

        <button
          class="secondary"
          @click="open('Pay bill', b.id)"
          :disabled="isBillPaid(state, b, nextUnpaidDueDate(state, b))"
        >
          {{ isBillPaid(state, b, nextUnpaidDueDate(state, b)) ? "Paid ✓" : "Mark paid" }}
        </button>

        <button
          v-if="!isBillPaid(state, b, nextUnpaidDueDate(state, b))"
          class="secondary"
          style="font-size: 0.75rem; padding: 0.35rem 0.6rem; white-space: nowrap;"
          @click="open('Settle bill', b.id)"
          title="Mark this occurrence as settled before setup without deducting cash"
        >
          Paid before setup
        </button>
        <button
          class="delete-icon"
          @click="open('Delete bill', b.id)"
          :aria-label="'Delete ' + b.name"
        >
          ×
        </button>
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
