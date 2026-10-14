<script setup lang="ts">
import { isBillPaid, nextDueDate } from "../../model";
import { money, formatNextDue, billStatus } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { state } = useBudget();
const { open } = useModal();
</script>

<template>
  <p class="page-intro">
    Monthly bills are reserved through your next payday, including
    anything still unpaid this month. Mark a bill paid once to record its
    expense.
  </p>
  <div class="bills-layout">
    <section class="stat dark bill-total">
      <span>Monthly commitments</span>
      <strong>{{
        money(state.bills.reduce((n, b) => n + b.amount, 0))
      }}</strong>
      <span>{{ state.bills.length }} recurring bills</span>
    </section>
    <section class="card">
      <div v-for="b in state.bills" :key="b.id" class="bill-row">
        <div>
          <h3>{{ b.name }}</h3>
          <span class="muted">{{ formatNextDue(nextDueDate(b)) }}</span>
        </div>
        <span
          class="badge"
          :class="billStatus(state, b).toLowerCase().replace(/\s+/g, '-')"
        >
          {{ billStatus(state, b) }}
        </span>
        <strong>{{ money(b.amount) }}</strong>
        <button
          class="secondary"
          @click="open('Pay bill', b.id)"
          :disabled="isBillPaid(state, b)"
        >
          {{ isBillPaid(state, b) ? "Paid ✓" : "Mark paid" }}
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
