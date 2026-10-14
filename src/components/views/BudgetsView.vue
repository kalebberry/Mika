<script setup lang="ts">
import { spent } from "../../model";
import { money, pct } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const {
  state,
  budgetSpent,
  budgetTotal,
  ring,
  categoryRecent,
  category,
  page,
} = useBudget();
const { open } = useModal();

function viewCategoryTransactions(catName: string) {
  category.value = catName;
  page.value = "Transactions";
}
</script>

<template>
  <div class="budgets-layout">
    <section class="card budget-summary">
      <div class="donut large" :style="{ background: ring }">
        <div>
          <strong>{{ money(budgetSpent) }}</strong>
          <span>of {{ money(budgetTotal) }} limit</span>
        </div>
      </div>
      <h2>Spending summary</h2>
      <div
        v-for="b in state.budgets"
        :key="b.id"
        class="summary-line"
        :style="{ '--accent': b.color }"
      >
        <span>{{ b.name || b.category }}</span>
        <span>
          <strong>{{ money(spent(state, b.category)) }}</strong>
          <small>of {{ money(b.limit) }}</small>
        </span>
      </div>
      <p class="muted help">
        Budgets reset each calendar month. Unspent amounts are reserved in
        safe-to-spend.
      </p>
    </section>

    <div class="column">
      <section v-for="b in state.budgets" :key="b.id" class="card">
        <div class="section-heading">
          <h2>
            <i class="color-dot" :style="{ background: b.color }"></i>
            {{ b.name || b.category }}
          </h2>
          <div>
            <button class="text-link" @click="open('Edit budget', b.id)">
              Edit
            </button>
            <button
              class="delete-icon"
              @click="open('Delete budget', b.id)"
              :aria-label="'Delete ' + (b.name || b.category) + ' budget'"
            >
              ×
            </button>
          </div>
        </div>
        <p class="muted">
          <template v-if="b.name && b.name !== b.category">
            {{ b.category }} ·
          </template>
          Maximum of {{ money(b.limit) }}
        </p>
        <div
          class="progress"
          role="progressbar"
          :aria-label="(b.name || b.category) + ' spending'"
          :aria-valuenow="Math.round(pct(spent(state, b.category), b.limit))"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span
            :style="{
              width: pct(spent(state, b.category), b.limit) + '%',
              background: b.color,
            }"
          ></span>
        </div>
        <div class="split-stats">
          <div class="legend-item" :style="{ '--accent': b.color }">
            <span>Spent</span>
            <strong>{{ money(spent(state, b.category)) }}</strong>
          </div>
          <div class="legend-item">
            <span>
              {{
                spent(state, b.category) > b.limit
                  ? "Over budget"
                  : "Remaining"
              }}
            </span>
            <strong :class="{ negative: spent(state, b.category) > b.limit }">
              {{ money(Math.abs(b.limit - spent(state, b.category))) }}
            </strong>
          </div>
        </div>
        <div class="latest-spending">
          <div class="section-heading">
            <h3>Latest spending</h3>
            <button
              class="text-link"
              @click="viewCategoryTransactions(b.category)"
            >
              See all ›
            </button>
          </div>
          <div
            v-for="t in categoryRecent(b.category)"
            :key="t.id"
            class="small-transaction"
          >
            <span>{{ t.name }}</span>
            <strong>{{ money(t.amount) }}</strong>
          </div>
          <p v-if="!categoryRecent(b.category).length" class="muted">
            A clean slate this month.
          </p>
        </div>
      </section>

      <div v-if="!state.budgets.length" class="card empty">
        <h3>A little structure goes a long way.</h3>
        <p>Start with groceries or dining out.</p>
        <button class="primary" @click="open('Add budget')">
          Add your first budget
        </button>
      </div>
    </div>
  </div>
</template>
