<script setup lang="ts">
import { colors, today } from "../../model";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { page, categories, backup } = useBudget();
const {
  dialogRef,
  mode,
  error,
  resetChoice,
  resetConfirmed,
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

      <p v-if="mode === 'Pay bill'" class="muted">
        This records one expense today and marks this bill paid. Only continue
        if you have actually paid it.
      </p>

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
            'Add pot',
            'Add bill',
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
              : 'e.g. Weekly groceries'
          "
        />
      </label>

      <label v-if="mode === 'Add transaction'">
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
            'Add budget',
            'Edit budget',
            'Add bill',
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
          (mode === 'Add transaction' && form.type === 'Expense') ||
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
        </select>
      </label>

      <label v-if="mode === 'Add transaction'">
        Date
        <input type="date" v-model="form.date" required />
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

      <label v-if="mode === 'Add bill'">
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

      <label v-if="['Add budget', 'Edit budget', 'Add pot'].includes(mode)">
        Color
        <select v-model="form.color">
          <option v-for="(c, i) in colors" :key="c" :value="c">
            {{ ["Teal", "Sky", "Slate", "Peach", "Lavender"][i] }}
          </option>
        </select>
      </label>

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
              : mode === "Pay bill"
                ? "Confirm payment"
                : "Save"
        }}
      </button>
    </form>
  </dialog>
</template>
