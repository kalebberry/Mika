<script setup lang="ts">
import { watch, onMounted, nextTick } from "vue";
import { colors, today, formatMonthYear } from "../../model";
import { money, date } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const {
  state,
  search,
  sort,
  category,
  categories,
  accountFilter,
  accounts,
  statusFilter,
  monthFilter,
  availableMonths,
  activeReconciliation,
  getTransactionInsightsStatus,
  list,
  sum,
  postTransaction,
  targetedTransactionId,
} = useBudget();
const { open } = useModal();

function getAccountName(id?: string): string {
  if (!id || id === "acc-default-checking") {
    const acc = (state.value.accounts || []).find((a) => a.id === "acc-default-checking");
    return acc ? acc.name : "Primary Checking";
  }
  const acc = (state.value.accounts || []).find((a) => a.id === id);
  if (!acc) return "Account";
  return acc.archived ? `${acc.name} (Archived)` : acc.name;
}

function scrollToTargeted() {
  if (targetedTransactionId.value) {
    nextTick(() => {
      const el = document.getElementById(`tx-row-${targetedTransactionId.value}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
}

onMounted(() => {
  scrollToTargeted();
});

watch(targetedTransactionId, () => {
  scrollToTargeted();
});
</script>

<template>
  <div v-if="sum.scheduledIncome > 0 || sum.scheduledExpenses > 0" class="card" style="margin-bottom: 1rem; padding: 0.875rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; background: #faf9f6; border-left: 4px solid var(--color-teal);">
    <div>
      <strong style="color: var(--color-text-main); font-size: 0.875rem;">Scheduled transactions pending</strong>
      <p style="margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--color-muted);">
        Scheduled items do not alter your cash balance or Safe to Spend until you confirm they arrived or were paid.
      </p>
    </div>
    <div style="display: flex; gap: 1rem; font-size: 0.8125rem;">
      <span v-if="sum.scheduledIncome > 0" style="color: var(--color-teal); font-weight: 600;">
        + {{ money(sum.scheduledIncome) }} upcoming income
      </span>
      <span v-if="sum.scheduledExpenses > 0" style="color: var(--color-danger); font-weight: 600;">
        − {{ money(sum.scheduledExpenses) }} upcoming expenses
      </span>
    </div>
  </div>

  <section class="card">
    <div class="filters">
      <label class="search">
        <span class="sr-only">Search transactions</span>
        <input v-model="search" placeholder="Search transactions" />
        <span>⌕</span>
      </label>
      <label>
        Account
        <select v-model="accountFilter">
          <option value="All">All accounts</option>
          <option v-for="a in accounts" :key="a.id" :value="a.id">
            {{ a.name }}{{ a.archived ? " (Archived)" : "" }}
          </option>
        </select>
      </label>
      <label>
        Status
        <select v-model="statusFilter">
          <option>All</option>
          <option>Scheduled</option>
          <option>Pending</option>
          <option>Cleared</option>
        </select>
      </label>
      <label>
        Sort by
        <select v-model="sort">
          <option>Latest</option>
          <option>Oldest</option>
          <option>Largest amount</option>
        </select>
      </label>
      <label>
        Period
        <select v-model="monthFilter">
          <option value="All">All months</option>
          <option v-for="m in availableMonths" :key="m" :value="m">
            {{ formatMonthYear(m) }}
          </option>
        </select>
      </label>
      <label>
        Category
        <select v-model="category">
          <option>All</option>
          <option v-for="c in categories" :key="c">{{ c }}</option>
        </select>
      </label>
      <div style="display: flex; align-items: flex-end; gap: 0.5rem; flex-wrap: wrap;">
        <button
          type="button"
          class="primary"
          style="white-space: nowrap; height: 2.8125rem; padding: 0 1.25rem; font-size: 0.875rem;"
          @click="open('Add transaction')"
        >
          ＋ Add transaction
        </button>
        <button
          type="button"
          class="secondary"
          style="white-space: nowrap; height: 2.8125rem; padding: 0 1rem; font-size: 0.875rem;"
          @click="open('Add transaction', '', 'Transfer')"
          title="Transfer between accounts"
        >
          ⇄ Transfer
        </button>
      </div>
    </div>

    <!-- Active Filter Indicator Banner (when navigated from Insights or filtered by Month / Category) -->
    <div
      v-if="monthFilter !== 'All' || category !== 'All'"
      class="active-drilldown-banner"
      style="margin-bottom: 1.25rem; padding: 0.875rem 1.125rem; background: rgba(39, 124, 120, 0.08); border-radius: var(--radius-md, 8px); border: 1px solid rgba(39, 124, 120, 0.2); display: flex; flex-direction: column; gap: 0.5rem;"
    >
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; font-size: 0.875rem; flex-wrap: wrap;">
        <span>
          Filtering:
          <strong v-if="category !== 'All'">{{ category }}</strong>
          <span v-if="category !== 'All' && monthFilter !== 'All'"> · </span>
          <strong v-if="monthFilter !== 'All'">{{ formatMonthYear(monthFilter) }}</strong>
          <span class="muted" style="margin-left: 0.5rem;">({{ list.length }} {{ list.length === 1 ? 'total transaction' : 'total transactions' }} in ledger)</span>
        </span>
        <button
          type="button"
          class="text-link small"
          @click="category = 'All'; monthFilter = 'All'"
          style="font-size: 0.8125rem;"
        >
          Reset filters ✕
        </button>
      </div>

      <!-- Insights Reconciliation Box when drilling down category + month -->
      <div
        v-if="activeReconciliation"
        class="reconciliation-info-box"
        style="padding-top: 0.5rem; border-top: 1px solid rgba(39, 124, 120, 0.15); display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8125rem;"
      >
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <span>
            Insights Net Spending:
            <strong style="color: var(--color-teal); font-size: 0.95rem;">{{ money(activeReconciliation.insightsNetSpent) }}</strong>
          </span>
          <span class="muted">
            ({{ activeReconciliation.qualifyingCount }} qualifying {{ activeReconciliation.qualifyingCount === 1 ? 'expense' : 'expenses' }})
          </span>
        </div>
        <p style="margin: 0.125rem 0 0; color: var(--color-muted); line-height: 1.4;">
          {{ activeReconciliation.reconciliationSummary }}
        </p>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recipient / Sender</th>
            <th>Category</th>
            <th>Transaction date</th>
            <th class="align-right">Amount</th>
            <th class="align-right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in list"
            :key="t.id"
            :id="'tx-row-' + t.id"
            :class="{
              'targeted-transaction': t.id === targetedTransactionId,
            }"
          >
            <td>
              <div class="person">
                <span
                  class="avatar"
                  :style="{
                    background:
                      t.kind === 'transfer'
                        ? '#597c7c'
                        : t.kind === 'payment'
                          ? '#2655a6'
                          : colors[
                              categories.indexOf(t.category) % colors.length
                            ],
                  }"
                >
                  {{ t.kind === 'transfer' ? '⇄' : t.kind === 'payment' ? '💳' : t.name.slice(0, 1).toUpperCase() }}
                </span>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                    <strong>{{ t.name }}</strong>
                    <span
                      v-if="t.id === targetedTransactionId"
                      class="badge targeted-badge"
                    >
                      ✓ Selected
                    </span>
                    <span
                      class="badge"
                      :class="{
                        'status-scheduled': t.status === 'scheduled',
                        'status-pending': t.status === 'pending' || t.status === 'posted',
                        'status-cleared': t.status === 'cleared' || !t.status,
                      }"
                      style="font-size: 0.7rem; font-weight: 600;"
                    >
                      {{ t.status === 'scheduled' ? 'Scheduled' : (t.status === 'pending' || t.status === 'posted') ? 'Pending' : 'Cleared' }}
                    </span>
                    <!-- Insights Reconciliation Badge in category drilldown -->
                    <span
                      v-if="monthFilter !== 'All' && category !== 'All'"
                      class="badge insights-status-badge"
                      :style="{
                        fontSize: '0.675rem',
                        fontWeight: 600,
                        background:
                          getTransactionInsightsStatus(t).status === 'qualifying_expense'
                            ? 'rgba(39, 124, 120, 0.12)'
                            : getTransactionInsightsStatus(t).status === 'refund_offset'
                              ? 'rgba(38, 85, 166, 0.1)'
                              : 'rgba(100, 100, 115, 0.12)',
                        color:
                          getTransactionInsightsStatus(t).status === 'qualifying_expense'
                            ? 'var(--color-teal)'
                            : getTransactionInsightsStatus(t).status === 'refund_offset'
                              ? '#2655a6'
                              : '#555462',
                      }"
                      :title="getTransactionInsightsStatus(t).explanation"
                    >
                      {{ getTransactionInsightsStatus(t).badgeLabel }}
                    </span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--color-muted); margin-top: 0.125rem;">
                    <span v-if="t.kind === 'transfer'">
                      ⇄ {{ getAccountName(t.accountId) }} → {{ getAccountName(t.targetAccountId) }}
                    </span>
                    <span v-else-if="t.kind === 'payment'">
                      💳 {{ getAccountName(t.accountId) }} → {{ getAccountName(t.targetAccountId) }}
                    </span>
                    <span v-else>
                      {{ getAccountName(t.accountId) }}
                    </span>
                  </div>
                </div>
              </div>
            </td>
            <td>{{ t.category }}</td>
            <td>
              {{ date(t.date) }}
              <span
                v-if="t.status === 'scheduled' && t.date <= today()"
                class="badge paid"
                style="margin-left: 0.375rem; font-size: 0.7rem;"
              >
                Due for posting
              </span>
              <span
                v-else-if="t.date > today()"
                class="badge"
                style="margin-left: 0.375rem; font-size: 0.7rem;"
              >
                Upcoming
              </span>
            </td>
            <td
              class="align-right amount"
              :class="{ positive: t.amount > 0 }"
            >
              {{ t.amount > 0 ? "+" : "" }}{{ money(t.amount) }}
            </td>
            <td class="align-right">
              <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.375rem;">
                <button
                  v-if="t.status === 'scheduled'"
                  class="secondary"
                  style="padding: 0.25rem 0.5rem; font-size: 0.75rem; white-space: nowrap;"
                  @click="postTransaction(t.id, 'cleared')"
                  :title="t.amount > 0 ? 'Confirm income arrived and clear' : 'Confirm expense paid and clear'"
                >
                  {{ t.amount > 0 ? "Confirm receipt" : "Confirm payment" }}
                </button>
                <button
                  v-else-if="t.status === 'pending' || t.status === 'posted'"
                  class="secondary"
                  style="padding: 0.25rem 0.5rem; font-size: 0.75rem; white-space: nowrap;"
                  @click="postTransaction(t.id, 'cleared')"
                  title="Mark transaction cleared against bank"
                >
                  Mark cleared
                </button>
                <button
                  class="secondary"
                  style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                  @click="open('Edit transaction', t.id)"
                  :aria-label="'Edit ' + t.name"
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  class="delete-icon"
                  @click="open('Delete transaction', t.id)"
                  :aria-label="'Delete ' + t.name"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty" v-if="!list.length">
      <h3>No transactions here yet.</h3>
      <p>
        {{
          state.transactions.length
            ? "Try a different search or status filter."
            : "Your next small step: record one expense."
        }}
      </p>
      <button
        v-if="!state.transactions.length"
        type="button"
        class="primary"
        style="margin-top: 0.75rem;"
        @click="open('Add transaction')"
      >
        ＋ Record first transaction
      </button>
    </div>

    <div class="table-footer">
      {{ list.length }} transaction{{ list.length === 1 ? "" : "s" }}
    </div>
  </section>
</template>

<style scoped>
tr.targeted-transaction {
  background-color: rgba(39, 124, 120, 0.12) !important;
  outline: 2px solid var(--color-teal, #277c78);
  outline-offset: -2px;
}

.targeted-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--color-teal, #277c78);
  color: #fff;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}
</style>
