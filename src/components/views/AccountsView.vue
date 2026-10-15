<script setup lang="ts">
import { ref, computed } from "vue";
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";
import type { Account } from "../../model";

const {
  activeAccounts,
  archivedAccounts,
  accountSummary,
  getAccountBalance,
  getAvailableCredit,
  toggleArchiveAccount,
} = useBudget();
const { open } = useModal();

const activeTab = ref<"active" | "archived">("active");

const displayedAccounts = computed(() =>
  activeTab.value === "active" ? activeAccounts.value : archivedAccounts.value,
);

const cashAccounts = computed(() =>
  displayedAccounts.value.filter(
    (a) => a.type === "checking" || a.type === "savings",
  ),
);

const creditAccounts = computed(() =>
  displayedAccounts.value.filter((a) => a.type === "credit"),
);
</script>

<template>
  <div class="accounts-view">
    <p class="page-intro">
      Manage your checking, savings, and credit card accounts manually. Cash balances represent assets, while credit cards represent money owed. Credit limits never count as spendable cash.
    </p>

    <!-- Overview Stat Cards -->
    <div class="stat-grid accounts-stat-grid">
      <article class="stat dark">
        <span>Total Cash Assets</span>
        <strong>{{ money(accountSummary.totalCashAssets) }}</strong>
        <span class="stat-caption">Checking & savings balances</span>
      </article>

      <article class="stat">
        <span>Total Credit Card Debt</span>
        <strong style="color: var(--color-danger, #c94736);">
          {{ money(accountSummary.totalCreditDebt) }}
        </strong>
        <span class="stat-caption">Total liabilities currently owed</span>
      </article>

      <article class="stat">
        <span>Total Available Credit</span>
        <strong>{{ money(accountSummary.totalAvailableCredit) }}</strong>
        <span class="stat-caption">Not included in spendable cash</span>
      </article>
    </div>

    <!-- Tab / Filter Controls -->
    <div class="accounts-header-row">
      <div class="accounts-tabs" role="tablist" aria-label="Accounts filter">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'active' }"
          @click="activeTab = 'active'"
          role="tab"
          :aria-selected="activeTab === 'active'"
        >
          Active Accounts ({{ activeAccounts.length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'archived' }"
          @click="activeTab = 'archived'"
          role="tab"
          :aria-selected="activeTab === 'archived'"
        >
          Archived ({{ archivedAccounts.length }})
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="displayedAccounts.length === 0" class="card empty-accounts">
      <p class="muted">
        {{
          activeTab === "active"
            ? "No active accounts found. Click '+ Add account' to set up checking, savings, or credit cards."
            : "No archived accounts."
        }}
      </p>
      <button
        v-if="activeTab === 'active'"
        class="secondary"
        @click="open('Add account')"
      >
        ＋ Add your first account
      </button>
    </div>

    <!-- Cash Accounts Section (Checking & Savings) -->
    <section v-if="cashAccounts.length > 0" class="accounts-section">
      <div class="section-heading">
        <h2>Cash Accounts</h2>
        <span class="muted small">
          {{ cashAccounts.length }} {{ cashAccounts.length === 1 ? 'account' : 'accounts' }}
        </span>
      </div>

      <div class="accounts-grid">
        <article
          v-for="acc in cashAccounts"
          :key="acc.id"
          class="card account-card"
          :class="{ archived: acc.archived }"
        >
          <div class="account-card-header">
            <div class="account-title-wrap">
              <h3 class="account-name">{{ acc.name }}</h3>
              <div class="badge-group">
                <span
                  class="badge"
                  :class="acc.type === 'checking' ? 'account-checking' : 'account-savings'"
                >
                  {{ acc.type === 'checking' ? 'Checking' : 'Savings' }}
                </span>
                <span
                  v-if="acc.includeInSafeToSpend"
                  class="badge safe-spend"
                  title="Cash in this account is part of Safe to Spend"
                >
                  ✓ In Safe to Spend
                </span>
                <span
                  v-else
                  class="badge separate-savings"
                  title="Dedicated savings: not counted toward daily Safe to Spend"
                >
                  Protected Savings
                </span>
                <span v-if="acc.archived" class="badge archived">Archived</span>
              </div>
            </div>
          </div>

          <div class="account-balance-block">
            <span class="account-balance-label">Current Balance</span>
            <strong class="account-balance-amount">
              {{ money(getAccountBalance(acc)) }}
            </strong>
          </div>

          <div class="account-card-actions">
            <button
              class="secondary small"
              @click="open('Adjust balance', acc.id)"
              title="Explicit manual balance adjustment"
            >
              Adjust balance
            </button>
            <button
              class="secondary small"
              @click="open('Edit account', acc.id)"
              title="Edit account details"
            >
              Edit details
            </button>
            <button
              v-if="acc.id !== 'acc-default-checking'"
              class="text-link small"
              @click="toggleArchiveAccount(acc.id)"
            >
              {{ acc.archived ? "Restore" : "Archive" }}
            </button>
            <button
              v-if="acc.id !== 'acc-default-checking'"
              class="text-link small danger-link"
              @click="open('Delete account', acc.id)"
              title="Delete account"
            >
              Delete
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- Credit Cards Section (Liabilities) -->
    <section v-if="creditAccounts.length > 0" class="accounts-section">
      <div class="section-heading">
        <h2>Credit Cards</h2>
        <span class="muted small">
          {{ creditAccounts.length }} {{ creditAccounts.length === 1 ? 'card' : 'cards' }}
        </span>
      </div>

      <div class="accounts-grid">
        <article
          v-for="acc in creditAccounts"
          :key="acc.id"
          class="card account-card credit-card"
          :class="{ archived: acc.archived }"
        >
          <div class="account-card-header">
            <div class="account-title-wrap">
              <h3 class="account-name">{{ acc.name }}</h3>
              <div class="badge-group">
                <span class="badge account-credit">Credit Card</span>
                <span class="badge liability">Liability (Owed)</span>
                <span v-if="acc.archived" class="badge archived">Archived</span>
              </div>
            </div>
          </div>

          <div class="account-balance-block">
            <span class="account-balance-label">Current Balance Owed</span>
            <strong class="account-balance-amount liability-text">
              {{ money(getAccountBalance(acc)) }}
            </strong>
          </div>

          <!-- Credit Limit & Available Credit Info -->
          <div class="credit-details-block">
            <div class="credit-row">
              <span>Credit limit:</span>
              <strong>{{ money(acc.creditLimit || 0) }}</strong>
            </div>
            <div class="credit-row">
              <span>Available credit:</span>
              <strong style="color: var(--color-teal, #277c78);">
                {{ money(getAvailableCredit(acc)) }}
              </strong>
            </div>

            <!-- Credit Utilization Progress Bar -->
            <div
              v-if="acc.creditLimit"
              class="progress slim"
              role="progressbar"
              :aria-valuenow="Math.min(100, Math.round((getAccountBalance(acc) / (acc.creditLimit || 1)) * 100))"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Credit utilization"
            >
              <span
                :style="{
                  width: Math.min(100, (getAccountBalance(acc) / (acc.creditLimit || 1)) * 100) + '%',
                  background: (getAccountBalance(acc) / (acc.creditLimit || 1)) > 0.8
                    ? 'var(--color-danger, #c94736)'
                    : 'var(--color-teal, #277c78)'
                }"
              ></span>
            </div>

            <div v-if="acc.dueDay || acc.minPayment" class="credit-meta-row">
              <small v-if="acc.dueDay">Due day: {{ acc.dueDay }}th of month</small>
              <small v-if="acc.minPayment">Min payment: {{ money(acc.minPayment) }}</small>
            </div>
          </div>

          <div class="account-card-actions">
            <button
              class="secondary small"
              @click="open('Adjust balance', acc.id)"
              title="Explicit manual balance adjustment"
            >
              Adjust balance
            </button>
            <button
              class="secondary small"
              @click="open('Edit account', acc.id)"
              title="Edit account details"
            >
              Edit details
            </button>
            <button
              class="text-link small"
              @click="toggleArchiveAccount(acc.id)"
            >
              {{ acc.archived ? "Restore" : "Archive" }}
            </button>
            <button
              class="text-link small danger-link"
              @click="open('Delete account', acc.id)"
              title="Delete account"
            >
              Delete
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.accounts-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.accounts-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.accounts-tabs {
  display: inline-flex;
  background: var(--color-surface);
  border-radius: var(--radius-md, 8px);
  padding: 0.25rem;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
}

.tab-btn {
  background: transparent;
  border: 0;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.tab-btn.active {
  background: var(--color-surface-subtle, #f0f0f4);
  color: var(--color-text, #201f24);
  font-weight: 600;
}

.empty-accounts {
  text-align: center;
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.accounts-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.account-card {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  border: 1px solid var(--color-border, #e0e0e0);
  transition: transform var(--transition-fast, 0.15s ease), box-shadow var(--transition-fast, 0.15s ease);
}

.account-card.archived {
  opacity: 0.7;
}

.account-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.account-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.account-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text, #201f24);
}

.badge-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.account-balance-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-surface-subtle, #f0f0f4);
  border-bottom: 1px solid var(--color-surface-subtle, #f0f0f4);
}

.account-balance-label {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.account-balance-amount {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--color-text, #201f24);
}

.liability-text {
  color: var(--color-danger, #c94736);
}

.credit-details-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--color-surface-subtle, #f8f8fa);
  padding: 0.75rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.8125rem;
}

.credit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.credit-meta-row {
  display: flex;
  justify-content: space-between;
  color: var(--color-muted);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.account-card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  flex-wrap: wrap;
}

.badge.account-checking {
  background: #eef3fc;
  color: #2655a6;
  border: 1px solid #d4e2f8;
}

.badge.account-savings {
  background: #e6f3ef;
  color: var(--color-teal, #277c78);
  border: 1px solid #cce8de;
}

.badge.account-credit {
  background: #fff0e9;
  color: var(--color-danger, #c94736);
  border: 1px solid #fedcd2;
}

.badge.liability {
  background: #fdf0ed;
  color: #a63223;
  font-weight: 600;
}

.badge.safe-spend {
  background: #e6f3ef;
  color: #1b5e4f;
  font-weight: 600;
}

.badge.separate-savings {
  background: #f0f0f4;
  color: #555566;
}

.badge.archived {
  background: #eee;
  color: #777;
}

.danger-link {
  color: var(--color-muted);
  transition: color 0.15s ease;
}
.danger-link:hover {
  color: var(--color-danger, #c94736) !important;
}

@media (max-width: 768px) {
  .accounts-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
