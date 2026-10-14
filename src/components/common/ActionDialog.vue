<script setup lang="ts">
import { computed } from "vue";
import { colors, themeColors, today } from "../../model";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { page, categories, backup, state } = useBudget();
const {
  dialogRef,
  mode,
  selected,
  error,
  resetChoice,
  resetConfirmed,
  payMethod,
  form,
  close,
  submit,
} = useModal();

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
        <h2 id="dialog-title">{{ mode }}</h2>
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

      <p v-if="mode.startsWith('Delete')" class="muted">
        Remove this {{ mode.replace("Delete ", "") }}?
        {{
          mode === "Delete pot"
            ? "Money reserved in this pot will become available again."
            : mode === "Delete transaction"
              ? "Your balance and budget totals will update."
              : "Existing transactions will be kept."
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
        Name
        <input
          v-model="form.name"
          :required="!['Add budget', 'Edit budget'].includes(mode)"
          maxlength="80"
          :placeholder="
            mode.includes('budget')
              ? 'e.g. Work Lunches or Groceries'
              : mode.includes('bill')
                ? 'e.g. Rent or Internet'
                : 'e.g. Weekly groceries'
          "
        />
      </label>

      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction'">
        Type
        <select v-model="form.type">
          <option>Expense</option>
          <option>Income</option>
        </select>
      </label>

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

      <label v-if="mode === 'Add transaction' || mode === 'Edit transaction'">
        Date
        <input type="date" v-model="form.date" @input="onDateInput" required />
        <small v-if="form.date > today()">
          Transactions dated in the future should be scheduled until they occur.
        </small>
      </label>

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
          Scheduled transactions do not affect your current bank balance.
        </small>
        <small v-else-if="form.status === 'pending'">
          Pending transactions immediately update your current cash ledger.
        </small>
        <small v-else-if="form.status === 'cleared'">
          Cleared transactions are confirmed against your bank.
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

      <button
        class="primary full"
        :class="{
          danger: mode.startsWith('Delete') || mode === 'Start fresh',
        }"
        type="submit"
      >
        {{
          mode === "Start fresh"
            ? "Confirm and start fresh"
            : mode.startsWith("Delete")
              ? "Confirm removal"
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
