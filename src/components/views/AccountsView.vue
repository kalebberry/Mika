<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";
import type { Account } from "../../model";

const {
  activeAccounts,
  archivedAccounts,
  accountSummary,
  creditCardSummary,
  getCreditCardCoverage,
  getAccountBalance,
  toggleArchiveAccount,
} = useBudget();
const { open } = useModal();

const activeTab = ref<"active" | "archived">("active");
const expandedAccountId = ref<string | null>(null);
const openMenuId = ref<string | null>(null);

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

function toggleExpand(id: string) {
  expandedAccountId.value = expandedAccountId.value === id ? null : id;
}

function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function handleMenuAction(
  action: "adjust" | "edit" | "archive" | "delete",
  id: string,
) {
  openMenuId.value = null;
  if (action === "adjust") open("Adjust balance", id);
  else if (action === "edit") open("Edit account", id);
  else if (action === "archive") toggleArchiveAccount(id);
  else if (action === "delete") open("Delete account", id);
}

function onDocumentClick(e: MouseEvent) {
  if (openMenuId.value) {
    const target = e.target as HTMLElement;
    if (!target.closest(".menu-container")) {
      openMenuId.value = null;
    }
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    openMenuId.value = null;
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeyDown);
});

function getCoverage(acc: Account) {
  return getCreditCardCoverage(acc);
}

function getCoverageBadge(status: string) {
  switch (status) {
    case "fully_covered":
      return {
        label: "Fully Covered",
        icon: "✓",
        class: "coverage-fully-covered",
        description:
          "100% of this card's balance is backed by cash waiting in your checking account.",
      };
    case "partially_covered":
      return {
        label: "Partially Covered",
        icon: "⚠️",
        class: "coverage-partially-covered",
        description:
          "Part of this card's balance is backed by cash, but uncovered debt remains.",
      };
    case "uncovered":
      return {
        label: "Uncovered Debt",
        icon: "⚠️",
        class: "coverage-uncovered",
        description:
          "This card balance has no reserved cash backing. Reserve cash from Safe to Spend to cover it.",
      };
    case "statement_credit":
      return {
        label: "Statement Credit",
        icon: "💳",
        class: "coverage-credit",
        description:
          "Card has a positive credit balance. Future charges will consume this credit first.",
      };
    case "zero_balance":
    default:
      return {
        label: "Zero Balance",
        icon: "✓",
        class: "coverage-zero",
        description: "No balance is owed on this credit card.",
      };
  }
}
</script>

<template>
  <div class="accounts-view">
    <p class="page-intro">
      Manage your checking, savings, and credit card accounts manually. Cash balances represent assets, while credit cards represent liabilities. Mika's Covered Credit reserves cash in your checking account to pay off card purchases automatically.
    </p>

    <!-- Overview Stat Cards: 3 Top-Level Metrics -->
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

      <article class="stat stat-ready-to-pay">
        <span>Ready to Pay</span>
        <strong style="color: var(--color-teal, #277c78);">
          {{ money(creditCardSummary.readyToPay) }}
        </strong>
        <span class="stat-caption">Cash reserved for card payments</span>
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

      <button
        v-if="activeTab === 'active'"
        class="secondary small add-acc-btn"
        @click="open('Add account')"
      >
        ＋ Add account
      </button>
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

      <div class="accounts-list">
        <article
          v-for="acc in cashAccounts"
          :key="acc.id"
          class="account-row-card"
          :class="{
            'is-expanded': expandedAccountId === acc.id,
            'is-archived': acc.archived,
          }"
        >
          <!-- Collapsed Header Row -->
          <div
            class="account-row-header"
            role="button"
            tabindex="0"
            :aria-expanded="expandedAccountId === acc.id"
            :aria-controls="'acc-details-' + acc.id"
            @click="toggleExpand(acc.id)"
            @keydown.enter.prevent="toggleExpand(acc.id)"
            @keydown.space.prevent="toggleExpand(acc.id)"
          >
            <!-- Left: Type Icon & Account Name & Secondary Label -->
            <div class="row-left">
              <span class="account-type-icon" aria-hidden="true">
                {{ acc.type === 'checking' ? '🏦' : '💰' }}
              </span>
              <div class="account-identity">
                <span class="account-name-text">{{ acc.name }}</span>
                <div class="account-sub-label">
                  <span
                    v-if="acc.includeInSafeToSpend"
                    class="sub-badge safe-spend"
                    title="Cash in this account is part of Safe to Spend"
                  >
                    ✓ In Safe to Spend
                  </span>
                  <span
                    v-else
                    class="sub-badge separate-savings"
                    title="Dedicated savings: not counted toward daily Safe to Spend"
                  >
                    Protected Savings
                  </span>
                  <span v-if="acc.archived" class="sub-badge archived">Archived</span>
                </div>
              </div>
            </div>

            <!-- Right: Balance, 3-dot Menu, Chevron -->
            <div class="row-right">
              <div class="row-balance-wrap" @click="toggleExpand(acc.id)">
                <span class="row-balance-label">Current Balance</span>
                <strong class="row-balance-amount">
                  {{ money(getAccountBalance(acc)) }}
                </strong>
              </div>

              <!-- Secondary Actions Menu -->
              <div class="menu-container" @click.stop>
                <button
                  type="button"
                  class="icon-btn menu-trigger"
                  :aria-expanded="openMenuId === acc.id"
                  aria-haspopup="true"
                  :aria-label="'More actions for ' + acc.name"
                  @click.stop="toggleMenu(acc.id)"
                >
                  <span class="three-dots" aria-hidden="true">⋮</span>
                </button>

                <div
                  v-if="openMenuId === acc.id"
                  class="menu-dropdown"
                  role="menu"
                >
                  <button
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="handleMenuAction('adjust', acc.id)"
                  >
                    Adjust balance
                  </button>
                  <button
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="handleMenuAction('edit', acc.id)"
                  >
                    Edit details
                  </button>
                  <button
                    v-if="acc.id !== 'acc-default-checking'"
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="handleMenuAction('archive', acc.id)"
                  >
                    {{ acc.archived ? "Restore account" : "Archive account" }}
                  </button>
                  <button
                    v-if="acc.id !== 'acc-default-checking'"
                    type="button"
                    class="menu-item danger"
                    role="menuitem"
                    @click="handleMenuAction('delete', acc.id)"
                  >
                    Delete account...
                  </button>
                </div>
              </div>

              <!-- Chevron Toggle Button -->
              <button
                type="button"
                class="icon-btn chevron-btn"
                :aria-label="expandedAccountId === acc.id ? 'Collapse details' : 'Expand details'"
                @click.stop="toggleExpand(acc.id)"
              >
                <span
                  class="chevron-icon"
                  :class="{ rotated: expandedAccountId === acc.id }"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </div>
          </div>

          <!-- Inline Expanded Details -->
          <transition name="expand">
            <div
              v-if="expandedAccountId === acc.id"
              :id="'acc-details-' + acc.id"
              class="account-expanded-body"
            >
              <div class="expanded-cash-content">
                <p class="expanded-desc">
                  <template v-if="acc.includeInSafeToSpend">
                    Cash in this account is eligible for Safe to Spend calculations.
                  </template>
                  <template v-else>
                    Protected savings account. Funds are kept separate from daily Safe to Spend.
                  </template>
                </p>
                <div class="expanded-actions">
                  <button
                    class="secondary small"
                    @click="open('Adjust balance', acc.id)"
                  >
                    Adjust balance
                  </button>
                  <button
                    class="secondary small"
                    @click="open('Edit account', acc.id)"
                  >
                    Edit details
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </article>
      </div>
    </section>

    <!-- Credit Cards Section (Liabilities & Covered Credit) -->
    <section v-if="creditAccounts.length > 0" class="accounts-section">
      <div class="section-heading">
        <h2>Credit Cards</h2>
        <span class="muted small">
          {{ creditAccounts.length }} {{ creditAccounts.length === 1 ? 'card' : 'cards' }}
        </span>
      </div>

      <div class="accounts-list">
        <article
          v-for="acc in creditAccounts"
          :key="acc.id"
          class="account-row-card credit-row-card"
          :class="{
            'is-expanded': expandedAccountId === acc.id,
            'is-archived': acc.archived,
            'is-fully-covered': getCoverage(acc).status === 'fully_covered',
            'has-uncovered': getCoverage(acc).status === 'uncovered' || getCoverage(acc).status === 'partially_covered',
          }"
        >
          <!-- Collapsed Header Row -->
          <div
            class="account-row-header"
            role="button"
            tabindex="0"
            :aria-expanded="expandedAccountId === acc.id"
            :aria-controls="'acc-details-' + acc.id"
            @click="toggleExpand(acc.id)"
            @keydown.enter.prevent="toggleExpand(acc.id)"
            @keydown.space.prevent="toggleExpand(acc.id)"
          >
            <!-- Left: Type Icon & Name & Secondary Status Label -->
            <div class="row-left">
              <span class="account-type-icon credit-icon" aria-hidden="true">
                💳
              </span>
              <div class="account-identity">
                <span class="account-name-text">{{ acc.name }}</span>
                <div class="account-sub-label">
                  <span
                    class="sub-badge"
                    :class="getCoverageBadge(getCoverage(acc).status).class"
                    :title="getCoverageBadge(getCoverage(acc).status).description"
                  >
                    {{ getCoverageBadge(getCoverage(acc).status).icon }}
                    <template v-if="getCoverage(acc).uncoveredDebt > 0">
                      {{ money(getCoverage(acc).uncoveredDebt) }} Uncovered
                    </template>
                    <template v-else>
                      {{ getCoverageBadge(getCoverage(acc).status).label }}
                    </template>
                  </span>
                  <span v-if="acc.archived" class="sub-badge archived">Archived</span>
                </div>
              </div>
            </div>

            <!-- Right: Total Owed, 3-dot Menu, Chevron -->
            <div class="row-right">
              <div class="row-balance-wrap" @click="toggleExpand(acc.id)">
                <span class="row-balance-label">Total Owed</span>
                <strong
                  class="row-balance-amount"
                  :class="{ 'liability-text': getCoverage(acc).totalOwed > 0 }"
                >
                  {{ money(getCoverage(acc).totalOwed) }}
                </strong>
              </div>

              <!-- Secondary Actions Menu -->
              <div class="menu-container" @click.stop>
                <button
                  type="button"
                  class="icon-btn menu-trigger"
                  :aria-expanded="openMenuId === acc.id"
                  aria-haspopup="true"
                  :aria-label="'More actions for ' + acc.name"
                  @click.stop="toggleMenu(acc.id)"
                >
                  <span class="three-dots" aria-hidden="true">⋮</span>
                </button>

                <div
                  v-if="openMenuId === acc.id"
                  class="menu-dropdown"
                  role="menu"
                >
                  <button
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="handleMenuAction('adjust', acc.id)"
                  >
                    Adjust balance
                  </button>
                  <button
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="handleMenuAction('edit', acc.id)"
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="handleMenuAction('archive', acc.id)"
                  >
                    {{ acc.archived ? "Restore account" : "Archive account" }}
                  </button>
                  <button
                    type="button"
                    class="menu-item danger"
                    role="menuitem"
                    @click="handleMenuAction('delete', acc.id)"
                  >
                    Delete account...
                  </button>
                </div>
              </div>

              <!-- Chevron Toggle Button -->
              <button
                type="button"
                class="icon-btn chevron-btn"
                :aria-label="expandedAccountId === acc.id ? 'Collapse details' : 'Expand details'"
                @click.stop="toggleExpand(acc.id)"
              >
                <span
                  class="chevron-icon"
                  :class="{ rotated: expandedAccountId === acc.id }"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </div>
          </div>

          <!-- Inline Expanded Details -->
          <transition name="expand">
            <div
              v-if="expandedAccountId === acc.id"
              :id="'acc-details-' + acc.id"
              class="account-expanded-body"
            >
              <div class="expanded-credit-content">
                <!-- 4-Stat Pillar Grid (Requirement 7) -->
                <div class="cc-details-grid">
                  <div class="cc-stat-box">
                    <span class="cc-stat-label">Ready to Pay</span>
                    <strong class="cc-stat-val ready-text">
                      {{ money(getCoverage(acc).readyToPay) }}
                    </strong>
                    <small class="cc-stat-sub">Reserved in checking</small>
                  </div>
                  <div class="cc-stat-box">
                    <span class="cc-stat-label">Uncovered Debt</span>
                    <strong
                      class="cc-stat-val"
                      :class="getCoverage(acc).uncoveredDebt > 0 ? 'uncovered-text' : 'muted-val'"
                    >
                      {{ money(getCoverage(acc).uncoveredDebt) }}
                    </strong>
                    <small class="cc-stat-sub">Awaiting cash backing</small>
                  </div>
                  <div class="cc-stat-box">
                    <span class="cc-stat-label">Available Credit</span>
                    <strong class="cc-stat-val credit-text">
                      {{ money(getCoverage(acc).availableCredit) }}
                    </strong>
                    <small class="cc-stat-sub">Remaining credit line</small>
                  </div>
                  <div class="cc-stat-box">
                    <span class="cc-stat-label">Credit Limit</span>
                    <strong class="cc-stat-val">
                      {{ money(acc.creditLimit || 0) }}
                    </strong>
                    <small class="cc-stat-sub">Total limit</small>
                  </div>
                </div>

                <!-- One Coverage Progress Bar (Requirement 7) -->
                <div class="coverage-bar-container">
                  <div class="coverage-bar-header">
                    <span class="coverage-bar-title">
                      <template v-if="getCoverage(acc).status === 'fully_covered'">
                        ✓ 100% covered by cash in checking
                      </template>
                      <template v-else-if="getCoverage(acc).status === 'partially_covered'">
                        {{ Math.round((getCoverage(acc).readyToPay / (getCoverage(acc).totalOwed || 1)) * 100) }}% cash-backed ({{ money(getCoverage(acc).uncoveredDebt) }} gap)
                      </template>
                      <template v-else-if="getCoverage(acc).status === 'uncovered'">
                        0% cash-backed — reserve {{ money(getCoverage(acc).uncoveredDebt) }} to cover
                      </template>
                      <template v-else-if="getCoverage(acc).status === 'statement_credit'">
                        Positive statement credit ({{ money(getCoverage(acc).statementCredit) }})
                      </template>
                      <template v-else>
                        Zero balance owed
                      </template>
                    </span>
                    <span class="coverage-bar-numbers" v-if="getCoverage(acc).totalOwed > 0">
                      {{ money(getCoverage(acc).readyToPay) }} / {{ money(getCoverage(acc).totalOwed) }}
                    </span>
                  </div>
                  <div
                    class="progress slim"
                    role="progressbar"
                    :aria-valuenow="getCoverage(acc).totalOwed > 0 ? Math.min(100, Math.round((getCoverage(acc).readyToPay / getCoverage(acc).totalOwed) * 100)) : 100"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Payment coverage percentage"
                  >
                    <span
                      :style="{
                        width: (getCoverage(acc).totalOwed > 0 ? Math.min(100, (getCoverage(acc).readyToPay / getCoverage(acc).totalOwed) * 100) : 100) + '%',
                        background: getCoverage(acc).status === 'fully_covered' || getCoverage(acc).status === 'zero_balance'
                          ? 'var(--color-teal, #277c78)'
                          : getCoverage(acc).status === 'partially_covered'
                            ? 'var(--color-warning, #d97706)'
                            : 'var(--color-danger, #c94736)'
                      }"
                    ></span>
                  </div>
                </div>

                <!-- Releasable Manual Reserve Notice if any -->
                <div v-if="getCoverage(acc).manualReleasable > 0" class="manual-reserve-callout">
                  💡 <strong>{{ money(getCoverage(acc).manualReleasable) }}</strong> manually reserved cash can be released to Safe to Spend. Automatically covered budget funds remain permanently protected.
                </div>

                <!-- Due day / Min payment meta -->
                <div v-if="acc.dueDay || acc.minPayment" class="cc-meta-row">
                  <span v-if="acc.dueDay">Payment due: {{ acc.dueDay }}th of month</span>
                  <span v-if="acc.minPayment">Minimum payment: {{ money(acc.minPayment) }}</span>
                </div>

                <!-- Action Buttons: Record Payment / Reserve Cash / Release (Requirement 7 & 12) -->
                <div class="expanded-actions">
                  <button
                    v-if="getCoverage(acc).totalOwed > 0"
                    class="primary small btn-pay"
                    @click="open('Add transaction', acc.id, 'Credit Card Payment')"
                    title="Record a payment from checking to this card"
                  >
                    💳 Record payment ({{ money(getCoverage(acc).readyToPay > 0 ? getCoverage(acc).readyToPay : getCoverage(acc).totalOwed) }})
                  </button>
                  <button
                    v-if="getCoverage(acc).uncoveredDebt > 0"
                    class="secondary small highlight-btn"
                    @click="open('Reserve for payment', acc.id, 'reserve')"
                    title="Reserve cash from Safe to Spend for uncovered debt"
                  >
                    + Reserve cash
                  </button>
                  <button
                    v-if="getCoverage(acc).manualReleasable > 0"
                    class="secondary small"
                    @click="open('Reserve for payment', acc.id, 'release')"
                    title="Release manually assigned cash back to Safe to Spend"
                  >
                    Release reserve
                  </button>
                </div>
              </div>
            </div>
          </transition>
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

.add-acc-btn {
  margin-left: auto;
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
  gap: 0.875rem;
}

/* Full-width Stacked Account Rows */
.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.account-row-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
  overflow: visible;
  transition: border-color var(--transition-fast, 0.15s ease), box-shadow var(--transition-fast, 0.15s ease);
}

.account-row-card:hover {
  border-color: #d0d0d8;
}

.account-row-card.is-expanded {
  border-color: #cce8de;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.account-row-card.is-archived {
  opacity: 0.7;
}

/* Collapsed Header */
.account-row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1.25rem;
  cursor: pointer;
  user-select: none;
  gap: 1rem;
  transition: background var(--transition-fast, 0.15s ease);
}

.account-row-header:hover {
  background: var(--color-surface-subtle, #fbfbfd);
}

.row-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}

.account-type-icon {
  font-size: 1.25rem;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-subtle, #f0f0f4);
  border-radius: var(--radius-sm, 6px);
  flex-shrink: 0;
}

.account-type-icon.credit-icon {
  background: #fff0e9;
}

.account-identity {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.account-name-text {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text, #201f24);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-sub-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex-shrink: 0;
}

.row-balance-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.row-balance-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.row-balance-amount {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text, #201f24);
}

.liability-text {
  color: var(--color-danger, #c94736);
}

.ready-text {
  color: var(--color-teal, #277c78);
}

.uncovered-text {
  color: #b45309;
}

.muted-val {
  color: var(--color-muted);
}

.credit-text {
  color: #2563eb;
}

/* Secondary Three-Dot Menu */
.menu-container {
  position: relative;
  display: flex;
  align-items: center;
}

.icon-btn {
  background: transparent;
  border: none;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm, 6px);
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast, 0.15s ease), color var(--transition-fast, 0.15s ease);
}

.icon-btn:hover {
  background: var(--color-surface-subtle, #f0f0f4);
  color: var(--color-text, #201f24);
}

.three-dots {
  font-size: 1.25rem;
  line-height: 1;
  font-weight: 700;
}

.chevron-icon {
  font-size: 0.875rem;
  display: inline-block;
  transition: transform 0.2s ease;
  line-height: 1;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.menu-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--color-surface);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 0.35rem 0;
  min-width: 160px;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.menu-item {
  background: transparent;
  border: none;
  padding: 0.55rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  color: var(--color-text, #201f24);
  cursor: pointer;
  width: 100%;
  transition: background var(--transition-fast, 0.15s ease);
}

.menu-item:hover {
  background: var(--color-surface-subtle, #f0f0f4);
}

.menu-item.danger {
  color: var(--color-danger, #c94736);
}

.menu-item.danger:hover {
  background: #fff0ee;
}

/* Inline Expanded Body */
.account-expanded-body {
  border-top: 1px solid var(--color-border, #f0f0f4);
  padding: 1.125rem 1.25rem;
  background: var(--color-surface-subtle, #fbfbfd);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.expanded-cash-content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.expanded-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

.expanded-credit-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Credit Details Grid */
.cc-details-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.cc-stat-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border, #e8e8ee);
  border-radius: var(--radius-sm, 6px);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.cc-stat-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.cc-stat-val {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cc-stat-sub {
  font-size: 0.6875rem;
  color: var(--color-muted);
}

/* Coverage Progress Bar Container */
.coverage-bar-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border, #e8e8ee);
  border-radius: var(--radius-sm, 6px);
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.coverage-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}

.coverage-bar-title {
  font-weight: 600;
  color: var(--color-text, #201f24);
}

.coverage-bar-numbers {
  color: var(--color-muted);
  font-weight: 500;
  font-feature-settings: "tnum";
}

.manual-reserve-callout {
  background: #fefce8;
  border: 1px solid #fef08a;
  color: #854d0e;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.cc-meta-row {
  display: flex;
  gap: 1.5rem;
  color: var(--color-muted);
  font-size: 0.8125rem;
}

.expanded-actions {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
  align-items: center;
}

.btn-pay {
  background: var(--color-teal, #277c78);
  color: white;
  border: none;
  font-weight: 600;
}

.btn-pay:hover {
  background: #1f6460;
}

.highlight-btn {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  font-weight: 600;
  transition: all 0.15s ease;
}

.highlight-btn:hover {
  background: #fde68a;
  color: #78350f;
}

/* Sub-badges */
.sub-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.sub-badge.safe-spend {
  background: #e6f3ef;
  color: #1b5e4f;
  border: 1px solid #cce8de;
}

.sub-badge.separate-savings {
  background: #f0f0f4;
  color: #555566;
}

.sub-badge.coverage-fully-covered {
  background: #e6f3ef;
  color: #1b5e4f;
  border: 1px solid #cce8de;
}

.sub-badge.coverage-partially-covered {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fef3c7;
}

.sub-badge.coverage-uncovered {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.sub-badge.coverage-credit {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #dbeafe;
}

.sub-badge.coverage-zero {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}

.sub-badge.archived {
  background: #eee;
  color: #777;
}

/* Expand Animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease-out;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .accounts-stat-grid {
    grid-template-columns: 1fr;
  }

  .account-row-header {
    padding: 0.75rem 1rem;
    gap: 0.5rem;
  }

  .account-name-text {
    font-size: 0.95rem;
  }

  .row-balance-amount {
    font-size: 1.1rem;
  }

  .cc-details-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
