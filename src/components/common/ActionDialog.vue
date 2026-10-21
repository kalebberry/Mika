<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import {
  colors,
  themeColors,
  today,
  cents,
  getBillOccurrenceStatus,
  nextUnpaidDueDate,
  previewCreditCardExpenseImpact,
} from "../../model";
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const {
  page,
  categories,
  backup,
  state,
  sum,
  getCreditCardCoverage,
  getAccountBalance,
  getAccountTransactionCount,
  getAccountDeletionBlockReason,
  toggleArchiveAccount,
} = useBudget();
const {
  dialogRef,
  mode,
  selected,
  error,
  resetChoice,
  resetConfirmed,
  payMethod,
  form,
  open,
  close,
  submit,
} = useModal();

const currentAccount = computed(() =>
  (state.value.accounts || []).find((a) => a.id === selected.value),
);

const currentBill = computed(() => {
  if (mode.value !== "Pay bill" && mode.value !== "Settle bill") return null;
  return state.value.bills.find((b) => b.id === selected.value) || null;
});

const currentBillTargetDueDate = computed(() => {
  if (!currentBill.value) return "";
  return (
    form.value.billDueDate ||
    nextUnpaidDueDate(state.value, currentBill.value, today())
  );
});

const currentBillOccurrenceStatus = computed(() => {
  if (!currentBill.value || !currentBillTargetDueDate.value) return null;
  return getBillOccurrenceStatus(
    state.value,
    currentBill.value,
    currentBillTargetDueDate.value,
  );
});

const currentAccountBalance = computed(() => {
  if (!currentAccount.value) return 0;
  return getAccountBalance(currentAccount.value);
});

const currentAccountTxCount = computed(() => {
  if (mode.value !== "Delete account" || !selected.value) return 0;
  return getAccountTransactionCount(selected.value);
});

const currentAccountBlockReason = computed(() => {
  if (mode.value !== "Delete account" || !selected.value) return null;
  return getAccountDeletionBlockReason(selected.value);
});

function archiveFromDeleteDialog() {
  if (selected.value) {
    toggleArchiveAccount(selected.value);
    close();
  }
}

const activeAccounts = computed(() =>
  (state.value.accounts || []).filter((a) => !a.archived),
);

const activeCashAccounts = computed(() =>
  activeAccounts.value.filter(
    (a) => a.type === "checking" || a.type === "savings",
  ),
);

const activeCreditAccounts = computed(() =>
  activeAccounts.value.filter((a) => a.type === "credit"),
);

const selectedAccount = computed(() =>
  (state.value.accounts || []).find((a) => a.id === form.value.accountId),
);

const isCreditCardSelected = computed(
  () => selectedAccount.value?.type === "credit",
);

const targetReserveCard = computed(() => {
  if (mode.value !== "Reserve for payment") return null;
  const cardId = form.value.accountId || selected.value;
  return (
    activeCreditAccounts.value.find((a) => a.id === cardId) ||
    activeCreditAccounts.value[0] ||
    null
  );
});

const targetReserveCoverage = computed(() => {
  if (!targetReserveCard.value) return null;
  return getCreditCardCoverage(targetReserveCard.value);
});

function onReserveCardChange() {
  if (targetReserveCard.value && targetReserveCoverage.value) {
    form.value.name = targetReserveCard.value.name;
    const cov = targetReserveCoverage.value;
    if (form.value.reserveAction === "release") {
      form.value.amount =
        cov.manualReleasable > 0 ? String(cov.manualReleasable / 100) : "";
    } else {
      form.value.amount =
        cov.uncoveredDebt > 0 ? String(cov.uncoveredDebt / 100) : "";
    }
  }
}

function onReserveActionChange() {
  if (targetReserveCoverage.value) {
    const cov = targetReserveCoverage.value;
    if (form.value.reserveAction === "release") {
      form.value.amount =
        cov.manualReleasable > 0 ? String(cov.manualReleasable / 100) : "";
    } else {
      form.value.amount =
        cov.uncoveredDebt > 0 ? String(cov.uncoveredDebt / 100) : "";
    }
  }
}

const targetPaymentCard = computed(() => {
  if (form.value.type !== "Credit Card Payment" || !form.value.targetAccountId) {
    return null;
  }
  return (
    (state.value.accounts || []).find(
      (a) => a.id === form.value.targetAccountId && a.type === "credit",
    ) || null
  );
});

const targetPaymentCoverage = computed(() => {
  if (!targetPaymentCard.value) return null;
  return getCreditCardCoverage(targetPaymentCard.value);
});

function onPaymentTargetChange() {
  if (targetPaymentCard.value && targetPaymentCoverage.value) {
    const cov = targetPaymentCoverage.value;
    const cardDebt = cov.totalOwed;
    const prefill =
      cov.readyToPay > 0 ? Math.min(cov.readyToPay, cardDebt) : cardDebt;
    form.value.amount = prefill > 0 ? String(prefill / 100) : "";
  }
}

function onTransactionTypeChange() {
  if (form.value.type === "Transfer") {
    if (!form.value.accountId || selectedAccount.value?.type === "credit") {
      form.value.accountId =
        activeCashAccounts.value[0]?.id || "acc-default-checking";
    }
    const other = activeCashAccounts.value.find(
      (a) => a.id !== form.value.accountId,
    );
    if (
      !form.value.targetAccountId ||
      form.value.targetAccountId === form.value.accountId
    ) {
      form.value.targetAccountId = other?.id || "";
    }
  } else if (form.value.type === "Credit Card Payment") {
    if (!form.value.accountId || selectedAccount.value?.type === "credit") {
      form.value.accountId =
        activeCashAccounts.value[0]?.id || "acc-default-checking";
    }
    if (
      !form.value.targetAccountId ||
      (state.value.accounts || []).find(
        (a) => a.id === form.value.targetAccountId,
      )?.type !== "credit"
    ) {
      form.value.targetAccountId = activeCreditAccounts.value[0]?.id || "";
    }
    const card = (state.value.accounts || []).find(
      (a) => a.id === form.value.targetAccountId && a.type === "credit",
    );
    if (card) {
      const cov = getCreditCardCoverage(card);
      const cardDebt = cov.totalOwed;
      const prefill =
        cov.readyToPay > 0 ? Math.min(cov.readyToPay, cardDebt) : cardDebt;
      form.value.amount = prefill > 0 ? String(prefill / 100) : "";
    }
  } else {
    if (!form.value.accountId) {
      form.value.accountId =
        activeAccounts.value[0]?.id || "acc-default-checking";
    }
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === dialogRef.value) {
    close();
  }
}

function cancelStartFresh() {
  close();
  page.value = "Settings";
}

const isColorFieldVisible = computed(() =>
  ["Add budget", "Edit budget", "Add pot"].includes(mode.value),
);

const usedColorsInCurrentMode = computed(() => {
  if (mode.value === "Add budget" || mode.value === "Edit budget") {
    return state.value.budgets
      .filter((b) => mode.value !== "Edit budget" || b.id !== selected.value)
      .map((b) => b.color.toLowerCase());
  }
  if (mode.value === "Add pot") {
    return state.value.pots.map((p) => p.color.toLowerCase());
  }
  return [];
});

const isCustomColor = computed(() => {
  if (form.value.color === "__custom__") return true;
  if (!form.value.color) return false;
  return !themeColors.some(
    (tc) => tc.value.toLowerCase() === form.value.color.toLowerCase(),
  );
});

function selectColor(hex: string) {
  form.value.color = hex;
  form.value.customColor = hex;
}

function onCustomColorPickerInput(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  form.value.customColor = hex;
  form.value.color = "__custom__";
}

function onColorSelectChange() {
  if (form.value.color !== "__custom__") {
    form.value.customColor = form.value.color;
  }
}

const showCycleOverride = ref(false);

watch(
  () => mode.value,
  (newMode) => {
    showCycleOverride.value = false;
    if (newMode) {
      nextTick(() => {
        const firstInput = dialogRef.value?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
        );
        firstInput?.focus();
      });
    }
  },
);

const creditImpactPreview = computed(() => {
  if (
    (mode.value !== "Add transaction" && mode.value !== "Edit transaction") ||
    form.value.type !== "Expense" ||
    !isCreditCardSelected.value ||
    !selectedAccount.value
  ) {
    return null;
  }
  const amtCents = cents(Number(form.value.amount || 0));
  const cat =
    form.value.category === "__custom__"
      ? (form.value.customCategory || "General").trim()
      : form.value.category || "General";
  return previewCreditCardExpenseImpact(
    state.value,
    selectedAccount.value,
    cat,
    amtCents,
    form.value.date || today(),
    {
      status: form.value.status,
      existingTxId: mode.value === "Edit transaction" ? selected.value : undefined,
    },
  );
});

function onDateInput() {
  if (form.value.date > today()) {
    form.value.status = "scheduled";
  }
}
</script>

<template>
  <dialog
    aria-modal="true"
    aria-labelledby="dialog-title"
    ref="dialogRef"
    @click="handleBackdropClick"
    @cancel="close"
    @close="close"
  >
    <form @submit.prevent="submit">
      <div class="section-heading">
        <h2 id="dialog-title">
          {{
            mode === "Adjust balance"
              ? "Adjust balance — " + form.name
              : mode === "Reserve for payment"
                ? "Reserve for payment — " + (targetReserveCard ? targetReserveCard.name : form.name)
                : mode
          }}
        </h2>
        <button
          type="button"
          class="close"
          @click="close"
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>

      <template v-if="mode === 'Start fresh'">
        <p class="muted">
          A fresh start is always here when you need it. Choose what to keep.
        </p>
        <fieldset class="reset-options">
          <legend>Reset options</legend>
          <label class="reset-option">
            <input type="radio" v-model="resetChoice" value="keep" />
            <span>
              <strong>Keep my budgets and bills</strong>
              <small>
                Keep category limits and recurring bill details. Clear
                transactions, pots, balance, and payday.
              </small>
            </span>
          </label>
          <label class="reset-option">
            <input type="radio" v-model="resetChoice" value="all" />
            <span>
              <strong>Clear everything</strong>
              <small>
                Remove all entries and plans, including any demo data.
              </small>
            </span>
          </label>
        </fieldset>
        <p class="formula-note">
          Your balance will reset to $0 and your payday to two weeks from
          today. Set both again in Settings. Kept bills will be marked unpaid;
          review this month’s payments before relying on safe-to-spend.
        </p>
        <button class="secondary" type="button" @click="backup">
          Download a backup first
        </button>
        <label class="reset-confirm">
          <input type="checkbox" v-model="resetConfirmed" />
          <span>I understand this reset cannot be undone in the app.</span>
        </label>
        <button
          type="button"
          class="text-link"
          @click="cancelStartFresh"
        >
          Cancel and return to Settings
        </button>
      </template>

      <template v-if="mode === 'Delete account'">
        <p class="muted">
          Permanently delete <strong>{{ form.name }}</strong>?
        </p>

        <!-- Blocked: Primary checking -->
        <div
          v-if="currentAccountBlockReason === 'primary_checking'"
          style="background: rgba(201, 71, 54, 0.08); border-left: 3px solid var(--color-danger, #c94736); padding: 0.875rem; border-radius: 6px; margin: 0.75rem 0;"
        >
          <strong style="color: var(--color-danger, #c94736); display: block; margin-bottom: 0.25rem;">
            ⚠️ Deletion Prohibited
          </strong>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
            Primary Checking is your foundational cash ledger and cannot be deleted.
          </p>
        </div>

        <!-- Blocked: Nonzero Balance -->
        <div
          v-else-if="currentAccountBlockReason === 'has_balance'"
          style="background: rgba(201, 71, 54, 0.08); border-left: 3px solid var(--color-danger, #c94736); padding: 0.875rem; border-radius: 6px; margin: 0.75rem 0;"
        >
          <strong style="color: var(--color-danger, #c94736); display: block; margin-bottom: 0.25rem;">
            ⚠️ Nonzero Balance ({{ money(currentAccountBalance) }})
          </strong>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
            This account currently has a balance of <strong>{{ money(currentAccountBalance) }}</strong>. An account must have a balance of $0.00 before it can be permanently deleted.
          </p>
          <p style="margin: 0.5rem 0 0; font-size: 0.85rem; line-height: 1.4;">
            Use <strong>Adjust balance</strong> to zero out the balance first, or <strong>Archive</strong> this account instead.
          </p>
        </div>

        <!-- Blocked: Existing Transactions -->
        <div
          v-else-if="currentAccountBlockReason === 'has_transactions'"
          style="background: rgba(201, 71, 54, 0.08); border-left: 3px solid var(--color-danger, #c94736); padding: 0.875rem; border-radius: 6px; margin: 0.75rem 0;"
        >
          <strong style="color: var(--color-danger, #c94736); display: block; margin-bottom: 0.25rem;">
            ⚠️ Financial History Linked
          </strong>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
            This account has <strong>{{ currentAccountTxCount }} linked transaction{{ currentAccountTxCount === 1 ? '' : 's' }}</strong> (such as transfers, payments, or purchases).
          </p>
          <p style="margin: 0.5rem 0 0; font-size: 0.85rem; line-height: 1.4;">
            To preserve your financial history and ensure account ledgers remain balanced, this account cannot be deleted. Please <strong>Archive</strong> this account instead.
          </p>
        </div>

        <!-- Allowed: $0 balance and 0 transactions -->
        <div v-else class="formula-note">
          <p style="margin: 0; font-size: 0.85rem;">
            ✓ <strong>Verified:</strong> Account balance is $0.00 and has no linked transaction history.
          </p>
          <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--color-danger, #c94736);">
            This account will be permanently removed. This action cannot be undone.
          </p>
        </div>
      </template>

      <p v-else-if="mode.startsWith('Delete')" class="muted">
        Remove this {{ mode.replace("Delete ", "") }}?
        {{
          mode === "Delete pot"
            ? "Money reserved in this pot will become available again."
            : mode === "Delete transaction"
              ? "Your balance and budget totals will update."
              : "Existing entries will be kept."
        }}
      </p>

      <template v-if="mode === 'Pay bill'">
        <!-- Occurrence Details Display -->
        <div v-if="currentBill && currentBillOccurrenceStatus" class="bill-payment-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <strong style="font-size: 1.05rem; display: block;">{{ currentBill.name }}</strong>
              <div class="occurrence-cycle-row">
                <span class="cycle-pill">Target cycle due: <strong>{{ currentBillTargetDueDate }}</strong></span>
                <button
                  type="button"
                  class="text-link small"
                  @click="showCycleOverride = !showCycleOverride"
                >
                  {{ showCycleOverride ? "Done" : "Change cycle" }}
                </button>
              </div>
            </div>
            <span
              class="badge"
              :class="currentBillOccurrenceStatus.status.replace('_', '-')"
            >
              {{
                currentBillOccurrenceStatus.status === 'partially_paid'
                  ? 'Partially paid'
                  : currentBillOccurrenceStatus.status === 'overpaid'
                    ? 'Overpaid'
                    : currentBillOccurrenceStatus.status === 'paid'
                      ? 'Paid'
                      : 'Unpaid'
              }}
            </span>
          </div>

          <label v-if="showCycleOverride" class="cycle-override-box">
            <span class="muted small" style="display: block; margin-bottom: 0.25rem;">Change occurrence due date:</span>
            <input type="date" v-model="form.billDueDate" style="margin-bottom: 0;" />
          </label>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; background: var(--color-surface, #fff); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--color-border, #ededf2); text-align: center;">
            <div>
              <span class="muted small" style="display: block; font-size: 0.75rem;">Expected</span>
              <strong>{{ money(currentBillOccurrenceStatus.expectedAmount) }}</strong>
            </div>
            <div>
              <span class="muted small" style="display: block; font-size: 0.75rem;">Paid so far</span>
              <strong style="color: var(--color-teal, #277c78);">{{ money(currentBillOccurrenceStatus.paidAmount) }}</strong>
            </div>
            <div>
              <span class="muted small" style="display: block; font-size: 0.75rem;">Remaining</span>
              <strong :style="{ color: currentBillOccurrenceStatus.remainingAmount > 0 ? '#b25e00' : 'inherit' }">
                {{ money(currentBillOccurrenceStatus.remainingAmount) }}
              </strong>
            </div>
          </div>
        </div>

        <div v-if="payMethod === 'settled'" class="bill-settled-info-box">
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.45;">
            <strong>Already paid before setup:</strong> This will advance {{ currentBill?.name || 'this bill' }} to the next cycle without deducting money from your cash balance or creating an expense transaction.
          </p>
          <button
            type="button"
            class="text-link small"
            style="margin-top: 0.5rem; display: inline-block;"
            @click="payMethod = 'transaction'"
          >
            ← Back to cash payment
          </button>
        </div>
      </template>

      <template v-if="mode === 'Settle bill'">
        <p class="muted">
          Mark this occurrence as settled before setup. This will advance the bill to its next cycle without deducting money from your cash balance or creating an expense transaction.
        </p>
      </template>

      <p v-if="mode === 'Add money' || mode === 'Withdraw'" class="muted">
        {{
          mode === "Add money"
            ? "Reserve money for this goal."
            : "Release money back into your spending plan."
        }}
        Your total account balance stays the same.
      </p>

      <p v-if="mode === 'Adjust balance'" class="muted">
        {{
          selected === 'acc-default-checking'
            ? 'Update your current primary checking balance. Mika will calibrate your baseline opening balance while preserving your full transaction history.'
            : 'Set the updated current balance for this account. No transactions will be created or changed.'
        }}
      </p>

      <p v-if="mode === 'Edit account'" class="muted">
        Update account details. To change the account's balance, use the separate "Adjust balance" action.
      </p>

      <!-- Account Type (Add account only) -->
      <label v-if="mode === 'Add account'">
        Account Type
        <select v-model="form.accountType">
          <option value="checking">Checking (Cash asset)</option>
          <option value="savings">Savings (Cash asset)</option>
          <option value="credit">Credit Card (Liability / Balance owed)</option>
        </select>
        <small v-if="form.accountType === 'credit'">
          Credit cards represent money you owe. Available credit is never counted as spendable cash.
        </small>
        <small v-else-if="form.accountType === 'savings'">
          Savings accounts are cash assets, reserved separately from daily spending money.
        </small>
        <small v-else>
          Checking accounts hold your primary cash ledger.
        </small>
      </label>

      <!-- Account Name (Add account or Edit account) -->
      <label v-if="mode === 'Add account' || mode === 'Edit account'">
        Account Name
        <input
          v-model="form.name"
          required
          maxlength="60"
          :placeholder="
            form.accountType === 'credit'
              ? 'e.g. Chase Freedom or Apple Card'
              : form.accountType === 'savings'
                ? 'e.g. High Yield Savings'
                : 'e.g. Main Checking'
          "
        />
      </label>

      <!-- Initial Balance (Add account only) -->
      <label v-if="mode === 'Add account'">
        {{ form.accountType === 'credit' ? 'Current Balance Owed ($)' : 'Starting Balance ($)' }}
        <input
          v-model="form.amount"
          type="number"
          min="0"
          step="0.01"
          required
          inputmode="decimal"
          placeholder="0.00"
        />
        <small v-if="form.accountType === 'credit'">
          Enter the current unpaid balance on the card.
        </small>
        <small v-else>
          Enter the current cash balance in this account.
        </small>
      </label>

      <!-- Adjusted Balance (Adjust balance only) -->
      <label v-if="mode === 'Adjust balance'">
        {{ form.accountType === 'credit' ? 'New Balance Owed ($)' : 'New Current Balance ($)' }}
        <input
          v-model="form.amount"
          type="number"
          min="0"
          step="0.01"
          required
          inputmode="decimal"
          placeholder="0.00"
        />
        <small>
          Enter the updated balance. This is recorded as an authoritative adjustment.
        </small>
      </label>

      <!-- Reserve for payment form (Stage 4) -->
      <template v-if="mode === 'Reserve for payment'">
        <!-- Target card selection if multiple credit cards, or display single card name -->
        <label v-if="activeCreditAccounts.length > 1">
          Target Credit Card
          <select v-model="form.accountId" @change="onReserveCardChange" required>
            <option v-for="c in activeCreditAccounts" :key="c.id" :value="c.id">
              {{ c.name }} — Owed: {{ money(getCreditCardCoverage(c).totalOwed) }}
            </option>
          </select>
        </label>
        <div v-else-if="targetReserveCard" class="reserve-target-card-box">
          <span class="muted small">Target Credit Card</span>
          <strong>{{ targetReserveCard.name }}</strong>
        </div>

        <!-- Target Card Accounting Metrics Display (Requirement 2) -->
        <div v-if="targetReserveCoverage" class="reserve-metrics-display">
          <div class="rm-row">
            <div class="rm-col">
              <span class="rm-label">Total Owed</span>
              <strong class="rm-val liability-text">{{ money(targetReserveCoverage.totalOwed) }}</strong>
            </div>
            <div class="rm-divider"></div>
            <div class="rm-col">
              <span class="rm-label">Ready to Pay</span>
              <strong class="rm-val ready-text">{{ money(targetReserveCoverage.readyToPay) }}</strong>
            </div>
            <div class="rm-divider"></div>
            <div class="rm-col">
              <span class="rm-label">Uncovered Debt</span>
              <strong
                class="rm-val"
                :class="targetReserveCoverage.uncoveredDebt > 0 ? 'uncovered-text' : 'muted-val'"
              >
                {{ money(targetReserveCoverage.uncoveredDebt) }}
              </strong>
            </div>
          </div>

          <div class="rm-manual-badge">
            <span>Manually Releasable Reserve:</span>
            <strong>{{ money(targetReserveCoverage.manualReleasable) }}</strong>
          </div>
        </div>

        <!-- Action Toggle: Assign vs Release (Requirement 1) -->
        <fieldset class="reset-options reserve-options-group" style="margin: 0.75rem 0;">
          <legend class="sr-only">Choose Reservation Action</legend>
          <label class="reset-option" :class="{ 'is-selected': form.reserveAction === 'reserve' }">
            <input
              type="radio"
              v-model="form.reserveAction"
              value="reserve"
              @change="onReserveActionChange"
            />
            <span>
              <strong>Assign cash to payment reserve</strong>
              <small>
                Locks cash from Safe to Spend ({{ money(sum.safe) }} available) so it is ready to pay this card.
              </small>
            </span>
          </label>

          <label
            class="reset-option"
            :class="{
              'is-selected': form.reserveAction === 'release',
              'is-disabled': targetReserveCoverage && targetReserveCoverage.manualReleasable <= 0
            }"
          >
            <input
              type="radio"
              v-model="form.reserveAction"
              value="release"
              @change="onReserveActionChange"
            />
            <span>
              <strong>Release reserve back to Safe to Spend</strong>
              <small>
                Return manually assigned funds back to your spending plan.
              </small>
            </span>
          </label>
        </fieldset>

        <!-- Requirement 3: Invariant Clarity Note -->
        <div class="formula-note release-clarity-box">
          <p v-if="form.reserveAction === 'release'" style="margin: 0; font-size: 0.8125rem; line-height: 1.45;">
            🛡️ <strong>Accounting Invariant:</strong> Releasing money applies <strong>only to manually assigned funds</strong> (up to {{ money(targetReserveCoverage?.manualReleasable || 0) }}). Funds automatically covered from budgeted purchases are permanently protected and can never be released.
          </p>
          <p v-else style="margin: 0; font-size: 0.8125rem; line-height: 1.45;">
            💡 <strong>How it works:</strong> Cash remains safely in your checking account, but is reserved for this credit card so you never accidentally spend it.
          </p>
        </div>

        <!-- Amount Input with Quick-Action Fill -->
        <label>
          {{ form.reserveAction === 'release' ? 'Amount to Release ($)' : 'Amount to Reserve ($)' }}
          <div class="amount-quick-row">
            <input
              v-model="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              inputmode="decimal"
              placeholder="0.00"
            />
            <button
              v-if="form.reserveAction === 'reserve' && targetReserveCoverage && targetReserveCoverage.uncoveredDebt > 0"
              type="button"
              class="secondary small quick-btn"
              @click="form.amount = String(targetReserveCoverage.uncoveredDebt / 100)"
              title="Fill total uncovered debt"
            >
              Fill Uncovered ({{ money(targetReserveCoverage.uncoveredDebt) }})
            </button>
            <button
              v-else-if="form.reserveAction === 'release' && targetReserveCoverage && targetReserveCoverage.manualReleasable > 0"
              type="button"
              class="secondary small quick-btn"
              @click="form.amount = String(targetReserveCoverage.manualReleasable / 100)"
              title="Release full manual reserve"
            >
              Release All ({{ money(targetReserveCoverage.manualReleasable) }})
            </button>
          </div>
          <small v-if="form.reserveAction === 'reserve'">
            Up to {{ money(Math.min(sum.safe, targetReserveCoverage?.uncoveredDebt || 0)) }} (Available Safe to Spend: {{ money(sum.safe) }}).
          </small>
          <small v-else>
            Max releasable: {{ money(targetReserveCoverage?.manualReleasable || 0) }} (only manually assigned funds).
          </small>
        </label>
      </template>

      <!-- Credit card specific fields (Progressive disclosure) -->
      <template v-if="(mode === 'Add account' || mode === 'Edit account') && form.accountType === 'credit'">
        <label>
          Credit Limit ($)
          <input
            v-model="form.creditLimit"
            type="number"
            min="0"
            step="0.01"
            required
            inputmode="decimal"
            placeholder="e.g. 5000.00"
          />
          <small>Required to calculate available credit. Credit limits never increase Safe to Spend.</small>
        </label>
        <label>
          Payment Due Day of Month (Optional)
          <input
            v-model="form.dueDay"
            type="number"
            min="1"
            max="31"
            placeholder="1-31"
          />
          <small>Day of each month your payment is due.</small>
        </label>
        <label>
          Minimum Payment ($ Optional)
          <input
            v-model="form.minPayment"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            placeholder="0.00"
          />
        </label>
      </template>

      <!-- Safe to Spend inclusion (Cash accounts only) -->
      <label
        class="reset-confirm"
        v-if="(mode === 'Add account' || mode === 'Edit account') && form.accountType !== 'credit'"
        style="margin-top: 0.5rem; margin-bottom: 0.75rem;"
      >
        <input
          type="checkbox"
          v-model="form.includeInSafeToSpend"
          :disabled="selected === 'acc-default-checking'"
        />
        <span>
          <strong>Include in Safe to Spend</strong>
          <small style="display: block; color: var(--color-muted);">
            {{
              selected === 'acc-default-checking'
                ? 'Primary checking is automatically included in Safe to Spend.'
                : 'Leave unchecked for dedicated savings so these funds are protected from daily spending.'
            }}
          </small>
        </span>
      </label>

      <!-- Delete Account trigger in Edit Account mode -->
      <div
        v-if="mode === 'Edit account' && selected !== 'acc-default-checking'"
        style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end;"
      >
        <button
          type="button"
          class="text-link danger small"
          style="color: var(--color-danger, #c94736); display: inline-flex; align-items: center; gap: 0.35rem;"
          @click="open('Delete account', selected)"
        >
          🗑 Delete account...
        </button>
      </div>

      <!-- Transaction Type -->
      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction'">
        Transaction Type
        <select v-model="form.type" @change="onTransactionTypeChange">
          <option value="Expense">Expense</option>
          <option value="Income">Income</option>
          <option value="Transfer">Transfer between Cash Accounts</option>
          <option value="Credit Card Payment">Credit Card Payment</option>
        </select>
      </label>

      <!-- Transfer Account Selectors (Cash to Cash) -->
      <template v-if="(mode === 'Add transaction' || mode === 'Edit transaction') && form.type === 'Transfer'">
        <label>
          From Account (Cash Source)
          <select v-model="form.accountId" required>
            <option v-for="a in activeCashAccounts" :key="a.id" :value="a.id">
              {{ a.name }} ({{ a.type === 'checking' ? 'Checking' : 'Savings' }}) — {{ money(getAccountBalance(a)) }}
            </option>
          </select>
        </label>
        <label>
          To Account (Cash Destination)
          <select v-model="form.targetAccountId" required>
            <option
              v-for="a in activeCashAccounts"
              :key="a.id"
              :value="a.id"
              :disabled="a.id === form.accountId"
            >
              {{ a.name }} ({{ a.type === 'checking' ? 'Checking' : 'Savings' }}) — {{ money(getAccountBalance(a)) }}{{ a.id === form.accountId ? ' (Source account)' : '' }}
            </option>
          </select>
          <small class="muted">
            Transfers move funds between checking and savings without counting as income or expense.
          </small>
        </label>
      </template>

      <!-- Credit Card Payment Account Selectors (Cash to Credit Card) -->
      <template v-if="(mode === 'Add transaction' || mode === 'Edit transaction') && form.type === 'Credit Card Payment'">
        <label>
          Pay From (Cash Account)
          <select v-model="form.accountId" required>
            <option v-for="a in activeCashAccounts" :key="a.id" :value="a.id">
              {{ a.name }} ({{ a.type === 'checking' ? 'Checking' : 'Savings' }}) — {{ money(getAccountBalance(a)) }}
            </option>
          </select>
        </label>
        <label>
          Pay To (Credit Card)
          <select v-model="form.targetAccountId" required @change="onPaymentTargetChange">
            <option v-for="a in activeCreditAccounts" :key="a.id" :value="a.id">
              {{ a.name }} — Owed: {{ money(getAccountBalance(a)) }} (Limit: {{ money(a.creditLimit || 0) }})
            </option>
          </select>
          <small v-if="activeCreditAccounts.length === 0" style="color: var(--color-danger); display: block;">
            No active credit cards available. Create a credit card in Accounts first.
          </small>
          <small v-else class="muted">
            Reduces your cash balance and card balance owed, freeing up available credit without creating a spending expense.
          </small>
        </label>

        <!-- Coverage & Reserve status callout for Credit Card Payment (Requirement 6 & Partial Coverage Edge Case) -->
        <div
          v-if="targetPaymentCoverage"
          class="payment-coverage-callout"
          :class="{
            'uncovered-warning': targetPaymentCoverage.readyToPay === 0 && targetPaymentCoverage.totalOwed > 0,
            'covered-info': targetPaymentCoverage.readyToPay > 0 && cents(Number(form.amount || 0)) <= targetPaymentCoverage.readyToPay,
            'partial-warning': targetPaymentCoverage.readyToPay > 0 && cents(Number(form.amount || 0)) > targetPaymentCoverage.readyToPay
          }"
        >
          <template v-if="targetPaymentCoverage.readyToPay > 0">
            <template v-if="cents(Number(form.amount || 0)) <= targetPaymentCoverage.readyToPay">
              <div class="callout-header">
                <span class="badge covered-badge">🛡️ Reserve-Backed</span>
                <span class="muted"><strong>{{ money(targetPaymentCoverage.readyToPay) }}</strong> Ready to Pay reserved</span>
              </div>
              <small class="callout-note">
                ✓ This payment is fully covered by existing cash reserved for this card. Safe to Spend will not be reduced.
              </small>
            </template>
            <template v-else>
              <div class="callout-header">
                <span class="badge partial-badge">⚡ Partially Covered</span>
                <span class="uncovered-note">
                  <strong>{{ money(targetPaymentCoverage.readyToPay) }}</strong> covered / <strong>{{ money(cents(Number(form.amount || 0)) - targetPaymentCoverage.readyToPay) }}</strong> uncovered
                </span>
              </div>
              <small class="callout-note text-warning">
                Of this {{ money(cents(Number(form.amount || 0))) }} payment, <strong>{{ money(targetPaymentCoverage.readyToPay) }}</strong> is funded from reserved cash. The remaining <strong>{{ money(cents(Number(form.amount || 0)) - targetPaymentCoverage.readyToPay) }}</strong> is uncovered debt and will directly reduce your Safe to Spend.
              </small>
            </template>
          </template>
          <template v-else-if="targetPaymentCoverage.totalOwed > 0">
            <div class="callout-header">
              <span class="badge uncovered-badge">⚠️ Direct Uncovered Payment</span>
              <span class="uncovered-note"><strong>$0.00 Ready to Pay</strong></span>
            </div>
            <small class="callout-note text-warning">
              This card has $0.00 reserved in Ready to Pay. This payment is <strong>not funded by an existing reserve</strong> and will directly reduce your cash and Safe to Spend.
            </small>
          </template>
          <template v-else>
            <small class="callout-note muted">
              This card has no outstanding debt owed ($0.00).
            </small>
          </template>
        </div>
      </template>

      <!-- Standard Expense or Income or Bill Payment Account Selector -->
      <template
        v-if="
          ((mode === 'Add transaction' || mode === 'Edit transaction') &&
            (form.type === 'Expense' || form.type === 'Income')) ||
          (mode === 'Pay bill' && payMethod === 'transaction')
        "
      >
        <label>
          Account
          <select v-model="form.accountId" required>
            <optgroup label="Cash Accounts (Assets)">
              <option v-for="a in activeCashAccounts" :key="a.id" :value="a.id">
                {{ a.name }} ({{ a.type === 'checking' ? 'Checking' : 'Savings' }}) — {{ money(getAccountBalance(a)) }}
              </option>
            </optgroup>
            <optgroup v-if="activeCreditAccounts.length > 0" label="Credit Cards (Liabilities)">
              <option v-for="a in activeCreditAccounts" :key="a.id" :value="a.id">
                {{ a.name }} (Credit Card) — Owed: {{ money(getAccountBalance(a)) }}
              </option>
            </optgroup>
          </select>
          <small v-if="mode === 'Pay bill'">
            Select the source checking, savings, or credit card account paying this bill.
          </small>
          <template v-else-if="isCreditCardSelected && form.type === 'Expense'">
            <!-- Credit Card Expense Impact Preview -->
            <div v-if="creditImpactPreview" class="credit-impact-card" :class="creditImpactPreview.status">
              <div class="impact-header">
                <span class="badge" :class="creditImpactPreview.status">
                  {{
                    creditImpactPreview.status === 'neutral'
                      ? 'ℹ️ Card Impact'
                      : creditImpactPreview.isScheduled
                        ? (creditImpactPreview.status === 'fully_covered'
                            ? '🗓️ Scheduled (Fully Covered)'
                            : creditImpactPreview.status === 'partially_covered'
                              ? '🗓️ Scheduled (Partially Covered)'
                              : '🗓️ Scheduled (Uncovered)')
                        : (creditImpactPreview.status === 'fully_covered'
                            ? (creditImpactPreview.statementCreditAbsorbed === creditImpactPreview.totalAmount
                                ? '🛡️ Absorbed by Credit'
                                : '🛡️ Fully Covered')
                            : creditImpactPreview.status === 'partially_covered'
                              ? '⚡ Partially Covered'
                              : '⚠️ Uncovered Debt')
                  }}
                </span>
                <span v-if="creditImpactPreview.hasBudget" class="muted small">
                  Budget available: {{ money(creditImpactPreview.budgetRemaining) }}
                </span>
                <span v-else class="muted small" :class="{ 'text-warning': creditImpactPreview.status !== 'neutral' }">
                  No budget for {{ creditImpactPreview.category }}
                </span>
              </div>
              <div
                v-if="
                  creditImpactPreview.totalAmount > 0 &&
                  (creditImpactPreview.statementCreditAbsorbed > 0 ||
                    (creditImpactPreview.coveredAmount > 0 && creditImpactPreview.uncoveredAmount > 0))
                "
                class="impact-breakdown-row"
              >
                <span v-if="creditImpactPreview.statementCreditAbsorbed > 0" class="breakdown-pill credit-pill">
                  Statement Credit: {{ money(creditImpactPreview.statementCreditAbsorbed) }}
                </span>
                <span v-if="creditImpactPreview.coveredAmount > 0" class="breakdown-pill ready-pill">
                  Ready to Pay: {{ money(creditImpactPreview.coveredAmount) }}
                </span>
                <span v-if="creditImpactPreview.uncoveredAmount > 0" class="breakdown-pill uncovered-pill">
                  Uncovered Debt: {{ money(creditImpactPreview.uncoveredAmount) }}
                </span>
              </div>
              <p class="impact-explanation">{{ creditImpactPreview.explanation }}</p>
            </div>
            <small v-else style="color: #a63223; font-weight: 500; display: block;">
              💳 Charges on this credit card increase the balance owed and reduce available credit. They do NOT decrease your cash balance.
            </small>
          </template>
          <small v-else-if="isCreditCardSelected && form.type === 'Income'" style="color: #1b5e4f; font-weight: 500; display: block;">
            💳 Statement credits or refunds reduce the balance owed on this card and restore available credit.
          </small>
        </label>
      </template>

      <!-- Amount -->
      <label
        v-if="
          [
            'Add transaction',
            'Edit transaction',
            'Add budget',
            'Edit budget',
            'Add bill',
            'Edit bill',
            'Add money',
            'Withdraw',
          ].includes(mode) || (mode === 'Pay bill' && payMethod === 'transaction')
        "
      >
        Amount ($)
        <div :class="{ 'amount-quick-row': mode === 'Pay bill' }">
          <input
            v-model="form.amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            inputmode="decimal"
            placeholder="0.00"
          />
          <button
            v-if="mode === 'Pay bill' && currentBillOccurrenceStatus && currentBillOccurrenceStatus.remainingAmount > 0"
            type="button"
            class="secondary small quick-btn"
            @click="form.amount = String(currentBillOccurrenceStatus.remainingAmount / 100)"
            title="Fill remaining balance"
          >
            Fill Remaining ({{ money(currentBillOccurrenceStatus.remainingAmount) }})
          </button>
        </div>
        <small
          v-if="form.type === 'Credit Card Payment' && targetPaymentCoverage && targetPaymentCoverage.totalOwed > 0"
          class="muted"
          style="display: block; margin-top: 0.25rem;"
        >
          Maximum payable: {{ money(targetPaymentCoverage.totalOwed) }} outstanding debt.
        </small>
        <small v-else-if="mode === 'Pay bill'" class="muted" style="display: block; margin-top: 0.25rem;">
          Enter payment amount. Supports partial payments, full payments, or overpayments.
        </small>
      </label>

      <!-- Date -->
      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction' || (mode === 'Pay bill' && payMethod === 'transaction')">
        {{ mode === 'Pay bill' ? 'Payment Date' : 'Date' }}
        <input type="date" v-model="form.date" @input="onDateInput" required />
      </label>

      <!-- Future date callout -->
      <div
        v-if="(mode === 'Add transaction' || mode === 'Edit transaction' || mode === 'Pay bill') && form.date > today()"
        class="future-date-callout"
      >
        <span class="callout-icon" aria-hidden="true">ℹ️</span>
        <small v-if="form.type === 'Income'">
          Scheduled income is planned for the future and is not yet available in your spendable cash or Safe to Spend.
        </small>
        <small v-else>
          Scheduled transactions are held in planning and will not deduct from your cash balance until confirmed.
        </small>
      </div>

      <!-- Payee or Description (Name) -->
      <label
        v-if="
          [
            'Add transaction',
            'Edit transaction',
            'Add pot',
            'Add bill',
            'Edit bill',
            'Add budget',
            'Edit budget',
          ].includes(mode)
        "
      >
        {{
          (mode === 'Add transaction' || mode === 'Edit transaction')
            ? (form.type === 'Transfer' || form.type === 'Credit Card Payment'
                ? 'Description (Optional)'
                : form.type === 'Income'
                  ? 'Payer / Description (Optional)'
                  : 'Payee / Description (Optional)')
            : mode.includes('budget')
              ? 'Name'
              : 'Name'
        }}
        <input
          v-model="form.name"
          :required="
            ['Add pot', 'Add bill', 'Edit bill'].includes(mode)
          "
          maxlength="80"
          :placeholder="
            (mode === 'Add transaction' || mode === 'Edit transaction')
              ? (form.type === 'Transfer'
                  ? 'e.g. Transfer to Savings (Optional)'
                  : form.type === 'Credit Card Payment'
                    ? 'e.g. Card Payment (Optional)'
                    : form.type === 'Income'
                      ? 'e.g. Paycheck (Optional — defaults to Income)'
                      : (form.category && form.category !== '__custom__'
                          ? `e.g. Merchant (Optional — defaults to ${form.category})`
                          : 'e.g. Weekly groceries (Optional)'))
              : mode.includes('budget')
                ? 'e.g. Work Lunches or Groceries'
                : mode.includes('bill')
                  ? 'e.g. Rent or Internet'
                  : 'e.g. Weekly groceries'
          "
        />
      </label>

      <!-- Category (Expenses and Budgets only) -->
      <label
        v-if="
          ((mode === 'Add transaction' || mode === 'Edit transaction') &&
            form.type === 'Expense') ||
          mode === 'Add budget' ||
          mode === 'Edit budget'
        "
      >
        Category
        <select v-model="form.category">
          <option
            v-for="c in categories.filter(
              (cat) =>
                cat !== 'Income' &&
                cat !== 'Transfer' &&
                cat !== 'Payment' &&
                (!(mode === 'Add budget' || mode === 'Edit budget') ||
                  cat !== 'Bills'),
            )"
            :key="c"
          >
            {{ c }}
          </option>
          <option value="__custom__">+ Custom category...</option>
        </select>
      </label>

      <!-- Custom category name -->
      <label
        v-if="
          form.category === '__custom__' &&
          (((mode === 'Add transaction' || mode === 'Edit transaction') &&
            form.type === 'Expense') ||
            mode === 'Add budget' ||
            mode === 'Edit budget')
        "
      >
        Custom category name
        <input
          v-model="form.customCategory"
          placeholder="e.g. Electricity, Water, or Gas"
          maxlength="40"
          required
        />
        <small>Use specific names like Electricity or Utilities for variable bills.</small>
      </label>

      <!-- Status (Add / Edit transaction or Pay bill) -->
      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction' || (mode === 'Pay bill' && payMethod === 'transaction')">
        Status
        <select v-model="form.status">
          <option value="posted">Posted — Submitted / authorized in ledger</option>
          <option value="scheduled">Scheduled — Planned, not in cash balance</option>
          <option value="cleared" :disabled="form.date > today()">
            Cleared — Confirmed against bank statement {{ form.date > today() ? "(Cannot clear future date)" : "" }}
          </option>
        </select>
        <small v-if="form.status === 'scheduled'">
          Scheduled transactions do not affect your current account balance until posted.
        </small>
        <small v-else-if="form.status === 'pending' || form.status === 'posted'">
          Immediately updates your current ledger balance.
        </small>
        <small v-else-if="form.status === 'cleared'">
          Cleared transactions are confirmed against your statement.
        </small>
      </label>

      <label v-if="mode === 'Add pot'">
        Savings target ($)
        <input
          type="number"
          v-model="form.target"
          min="0.01"
          step="0.01"
          required
        />
      </label>

      <label v-if="mode === 'Add bill' || mode === 'Edit bill'">
        Day of each month
        <input
          type="number"
          v-model="form.day"
          min="1"
          max="31"
          required
        />
        <small>For shorter months, we use the last day.</small>
      </label>

      <label
        class="reset-confirm"
        v-if="mode === 'Add bill' || mode === 'Edit bill'"
        style="margin-top: 0.5rem; margin-bottom: 0.75rem;"
      >
        <input type="checkbox" v-model="form.protected" />
        <span>Protect this bill for the following pay cycle if due before next paycheck</span>
      </label>

      <div v-if="isColorFieldVisible" class="color-picker-group">
        <label>
          Color theme
          <select
            v-model="form.color"
            @change="onColorSelectChange"
          >
            <option
              v-for="tc in themeColors"
              :key="tc.value"
              :value="tc.value"
            >
              {{ tc.name }}{{ usedColorsInCurrentMode.includes(tc.value.toLowerCase()) ? " (Already used)" : "" }}
            </option>
            <option value="__custom__">+ Custom color...</option>
          </select>
        </label>

        <!-- Visual swatch grid for quick 1-click selection -->
        <div class="color-swatches-grid" role="group" aria-label="Theme color swatches">
          <button
            v-for="tc in themeColors"
            :key="tc.value"
            type="button"
            class="swatch-btn"
            :class="{
              active: form.color.toLowerCase() === tc.value.toLowerCase(),
              used: usedColorsInCurrentMode.includes(tc.value.toLowerCase()),
            }"
            :style="{ background: tc.value }"
            :title="tc.name + (usedColorsInCurrentMode.includes(tc.value.toLowerCase()) ? ' (Already used)' : '')"
            :aria-label="tc.name"
            @click="selectColor(tc.value)"
          >
            <span
              v-if="form.color.toLowerCase() === tc.value.toLowerCase()"
              class="swatch-check"
            >✓</span>
          </button>
        </div>

        <!-- Custom color input (shown when custom chosen) -->
        <div v-if="isCustomColor" class="custom-color-row">
          <input
            type="color"
            class="custom-color-input"
            :value="form.customColor && form.customColor.startsWith('#') ? form.customColor : '#277c78'"
            @input="onCustomColorPickerInput"
            title="Choose custom color"
          />
          <input
            type="text"
            v-model="form.customColor"
            placeholder="#277C78"
            maxlength="7"
            class="custom-hex-input"
            @input="form.color = '__custom__'"
            aria-label="Custom color hex code"
          />
          <small class="muted">Enter any hex code (e.g. #277C78)</small>
        </div>
      </div>

      <p class="form-error" v-if="error" role="alert" aria-live="assertive">{{ error }}</p>

      <!-- Secondary settlement option for bill payment -->
      <div v-if="mode === 'Pay bill' && payMethod === 'transaction'" class="bill-settle-alt">
        <button
          type="button"
          class="text-link muted small"
          @click="payMethod = 'settled'"
        >
          Already paid this bill before setup? Mark settled without cash deduction →
        </button>
      </div>

      <template v-if="mode === 'Delete account' && currentAccountBlockReason">
        <button
          class="primary full"
          type="button"
          @click="archiveFromDeleteDialog"
        >
          Archive account instead
        </button>
      </template>
      <button
        v-else
        class="primary full"
        :class="{
          danger: mode.startsWith('Delete') || mode === 'Start fresh',
        }"
        type="submit"
      >
        {{
          mode === "Start fresh"
            ? "Confirm and start fresh"
            : mode === "Delete account"
              ? "Confirm permanent deletion"
              : mode === "Reserve for payment"
                ? (form.reserveAction === "release" ? "Release to Safe to Spend" : "Assign to Payment Reserve")
                : mode.startsWith("Delete")
                  ? "Confirm removal"
                  : mode === "Adjust balance"
                    ? "Update balance"
                    : mode === "Settle bill" || (mode === "Pay bill" && payMethod === "settled")
                      ? "Confirm settlement"
                      : mode === "Pay bill"
                        ? "Confirm payment"
                        : mode.startsWith("Edit")
                          ? "Save changes"
                          : "Save"
        }}
      </button>
    </form>
  </dialog>
</template>

<style scoped>
.reserve-target-card-box {
  background: var(--color-surface-subtle, #f8f8fa);
  border: 1px solid var(--color-border, #ededf2);
  border-radius: var(--radius-sm, 6px);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.reserve-target-card-box strong {
  font-size: 1.125rem;
  color: var(--color-text, #201f24);
}

.occurrence-cycle-row {
  margin-top: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cycle-pill {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.cycle-override-box {
  background: var(--color-surface, #fff);
  border: 1px dashed var(--color-border, #ededf2);
  border-radius: var(--radius-sm, 6px);
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}

.bill-settled-info-box {
  background: var(--color-surface-subtle, #f8f8fa);
  border: 1px solid var(--color-border, #ededf2);
  border-radius: var(--radius-sm, 6px);
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
}

.bill-settle-alt {
  margin: 0.5rem 0 0.875rem;
  text-align: center;
}

.credit-impact-card {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--color-border, #ededf2);
  background: var(--color-surface-subtle, #f8f8fa);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.credit-impact-card.fully_covered {
  background: rgba(39, 124, 120, 0.06);
  border-color: rgba(39, 124, 120, 0.25);
}

.credit-impact-card.partially_covered {
  background: rgba(180, 83, 9, 0.06);
  border-color: rgba(180, 83, 9, 0.25);
}

.credit-impact-card.uncovered {
  background: rgba(201, 71, 54, 0.06);
  border-color: rgba(201, 71, 54, 0.25);
}

.credit-impact-card.neutral {
  background: var(--color-surface, #f9fafb);
  border-color: var(--color-border, #e5e7eb);
}

.impact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.impact-header .badge.neutral {
  background: #f1f5f9;
  color: #475569;
}

.impact-header .badge.fully_covered {
  background: rgba(39, 124, 120, 0.15);
  color: var(--color-teal, #277c78);
}

.impact-header .badge.partially_covered {
  background: rgba(180, 83, 9, 0.15);
  color: #b45309;
}

.impact-header .badge.uncovered {
  background: rgba(201, 71, 54, 0.15);
  color: var(--color-danger, #c94736);
}

.impact-explanation {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--color-text, #201f24);
}

.impact-breakdown-row {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
  margin-bottom: 0.15rem;
}

.breakdown-pill {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.breakdown-pill.credit-pill {
  background: rgba(38, 85, 166, 0.12);
  color: #2655a6;
}

.breakdown-pill.ready-pill {
  background: rgba(39, 124, 120, 0.15);
  color: var(--color-teal, #277c78);
}

.breakdown-pill.uncovered-pill {
  background: rgba(201, 71, 54, 0.12);
  color: var(--color-danger, #c94736);
}

.future-date-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: #eef6f5;
  border-left: 3px solid var(--color-teal, #277c78);
  border-radius: 4px;
  margin-top: -0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-text, #201f24);
}

.reserve-metrics-display {
  background: var(--color-surface-subtle, #f8f8fa);
  border: 1px solid var(--color-border, #ededf2);
  border-radius: var(--radius-sm, 6px);
  padding: 0.875rem 1rem;
  margin-bottom: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.rm-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.rm-col {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rm-divider {
  width: 1px;
  height: 28px;
  background: var(--color-border, #e5e7eb);
}

.rm-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.rm-val {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
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

.rm-manual-badge {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border, #ededf2);
  color: var(--color-muted);
}

.rm-manual-badge strong {
  color: var(--color-teal, #277c78);
  font-weight: 700;
}

.release-clarity-box {
  background: #fdfaf6;
  border: 1px solid #f6ebe1;
  padding: 0.75rem;
  border-radius: var(--radius-sm, 6px);
  margin-bottom: 0.875rem;
  color: #7c4a1e;
}

.amount-quick-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.amount-quick-row input {
  flex: 1;
}

.quick-btn {
  white-space: nowrap;
  font-size: 0.75rem;
  padding: 0.5rem 0.65rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
  transition: all 0.15s ease;
}

.quick-btn:hover {
  background: #fde68a;
  color: #78350f;
}

.reset-option.is-selected {
  border-color: var(--color-teal);
  background: #edf6f3;
}

.reset-option.is-disabled {
  opacity: 0.6;
}

.payment-coverage-callout {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-radius: var(--radius-sm, 6px);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
  background: var(--color-surface, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
}

.payment-coverage-callout.covered-info {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.payment-coverage-callout.uncovered-warning {
  background: #fffbeb;
  border-color: #fde68a;
}

.payment-coverage-callout .callout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.payment-coverage-callout .callout-note {
  font-size: 0.8125rem;
  line-height: 1.4;
}

.payment-coverage-callout .text-warning {
  color: #92400e;
}

.covered-badge {
  background: #dcfce7;
  color: #166534;
  font-weight: 600;
  font-size: 0.6875rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.uncovered-badge {
  background: #fef3c7;
  color: #92400e;
  font-weight: 600;
  font-size: 0.6875rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.partial-badge {
  background: #fef3c7;
  color: #92400e;
  font-weight: 600;
  font-size: 0.6875rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.payment-coverage-callout.partial-warning {
  background: #fffbeb;
  border-color: #fde68a;
}

.uncovered-note {
  color: #b45309;
}

.bill-payment-card {
  background: var(--color-surface-subtle, #f8f8fa);
  border: 1px solid var(--color-border, #ededf2);
  border-radius: var(--radius-sm, 6px);
  padding: 0.875rem 1rem;
  margin-bottom: 0.875rem;
}
</style>
