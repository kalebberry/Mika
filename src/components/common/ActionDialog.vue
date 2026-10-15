<script setup lang="ts">
import { computed } from "vue";
import { colors, themeColors, today } from "../../model";
import { money } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const {
  page,
  categories,
  backup,
  state,
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

function onDateInput() {
  if (form.value.date > today() && form.value.status === "cleared") {
    form.value.status = "scheduled";
  }
}
</script>

<template>
  <dialog
    aria-labelledby="dialog-title"
    ref="dialogRef"
    @click="handleBackdropClick"
    @cancel="close"
  >
    <form @submit.prevent="submit">
      <div class="section-heading">
        <h2 id="dialog-title">
          {{ mode === "Adjust balance" ? "Adjust balance — " + form.name : mode }}
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
        <p class="muted">
          Choose how you want to record this recurring bill payment:
        </p>
        <fieldset class="reset-options" style="margin: 0.75rem 0;">
          <legend class="sr-only">Payment method</legend>
          <label class="reset-option">
            <input type="radio" v-model="payMethod" value="transaction" />
            <span>
              <strong>Record expense payment today</strong>
              <small>
                Deducts the bill amount from your cash balance and adds an expense transaction.
              </small>
            </span>
          </label>
          <label class="reset-option">
            <input type="radio" v-model="payMethod" value="settled" />
            <span>
              <strong>Already paid before setup</strong>
              <small>
                Advances this bill to the next cycle without deducting money or creating an expense transaction.
              </small>
            </span>
          </label>
        </fieldset>
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
          <select v-model="form.targetAccountId" required>
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
      </template>

      <!-- Standard Expense or Income Account Selector -->
      <template v-if="(mode === 'Add transaction' || mode === 'Edit transaction') && (form.type === 'Expense' || form.type === 'Income')">
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
          <small v-if="isCreditCardSelected && form.type === 'Expense'" style="color: #a63223; font-weight: 500; display: block;">
            💳 Charges on this credit card increase the balance owed and reduce available credit. They do NOT decrease your cash balance.
          </small>
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
          ].includes(mode)
        "
      >
        Amount ($)
        <input
          v-model="form.amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          inputmode="decimal"
          placeholder="0.00"
        />
      </label>

      <!-- Date -->
      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction'">
        Date
        <input type="date" v-model="form.date" @input="onDateInput" required />
        <small v-if="form.date > today()">
          Transactions dated in the future should be scheduled until they occur.
        </small>
      </label>

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
            ? (form.type === 'Transfer' || form.type === 'Credit Card Payment' ? 'Description (Optional)' : form.type === 'Income' ? 'Payer / Description' : 'Payee / Description')
            : mode.includes('budget')
              ? 'Name'
              : 'Name'
        }}
        <input
          v-model="form.name"
          :required="
            !['Add budget', 'Edit budget'].includes(mode) &&
            !(
              (mode === 'Add transaction' || mode === 'Edit transaction') &&
              (form.type === 'Transfer' || form.type === 'Credit Card Payment')
            )
          "
          maxlength="80"
          :placeholder="
            (mode === 'Add transaction' || mode === 'Edit transaction')
              ? (form.type === 'Transfer' ? 'e.g. Transfer to Savings' : form.type === 'Credit Card Payment' ? 'e.g. April Card Payment' : form.type === 'Income' ? 'e.g. Paycheck' : 'e.g. Weekly groceries')
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

      <!-- Status (Add / Edit transaction) -->
      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction'">
        Status
        <select v-model="form.status">
          <option value="scheduled">Scheduled — Planned, not in cash balance</option>
          <option value="pending">Pending — Submitted / authorized in ledger</option>
          <option value="cleared" :disabled="form.date > today()">
            Cleared — Confirmed against bank statement {{ form.date > today() ? "(Cannot clear future date)" : "" }}
          </option>
        </select>
        <small v-if="form.status === 'scheduled'">
          Scheduled transactions do not affect your current account balance.
        </small>
        <small v-else-if="form.status === 'pending'">
          Pending transactions immediately update your current ledger balance.
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

      <p class="form-error" v-if="error" role="alert">{{ error }}</p>

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
