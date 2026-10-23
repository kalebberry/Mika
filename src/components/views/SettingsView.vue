<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  today,
  type PaydaySchedule,
  getUpcomingPaydays,
  resolveNominalOccurrenceDate,
} from "../../model";
import { date, frequencyLabel } from "../../utils/format";
import { companionPortraits } from "../../companion";
import { useBudget } from "../../composables/useBudget";
import { useCompanion } from "../../composables/useCompanion";
import { useModal } from "../../composables/useModal";

const {
  state,
  settingsBalance,
  settingsSaved,
  saveSettings,
  saveSchedule,
  addScheduleOverride,
  removeScheduleOverride,
  currentPayday,
  backup,
  importBackup,
  storageHealth,
  prepareRestoreFromFile,
  restoreRollbackSnapshot,
  reloadFromStorage,
  downloadCorruptData,
} = useBudget();

const {
  showCompanion,
  enableGreetings,
  reduceAnimations,
  selectedWebModel,
  webGpuAvailable,
  availableWebModels,
} = useCompanion();

const { open } = useModal();

async function onImportFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const res = await prepareRestoreFromFile(file);
  if (res.success) {
    open("Restore backup");
  }
  (e.target as HTMLInputElement).value = "";
}

function initDraft(): PaydaySchedule {
  const sched = state.value.paydaySchedule;
  const currPayday = currentPayday.value || today();
  return {
    frequency: sched?.frequency || "manual",
    anchorDate: sched?.anchorDate || currPayday,
    dayOfMonth:
      sched?.dayOfMonth ??
      (sched?.anchorDate ? Number(sched.anchorDate.split("-")[2]) : 1),
    firstDay: sched?.firstDay ?? 15,
    secondDay: sched?.secondDay ?? 31,
    weekendRule: sched?.weekendRule || "exact",
    manualFollowingPayday:
      sched?.manualFollowingPayday || state.value.followingPayday || "",
    overrides: sched?.overrides
      ? JSON.parse(JSON.stringify(sched.overrides))
      : [],
  };
}

const draftSchedule = ref<PaydaySchedule>(initDraft());
const scheduleError = ref("");
const scheduleSaved = ref(false);

const isScheduleFormDirty = computed(() => {
  const orig = state.value.paydaySchedule;
  if (!orig) return true;
  const d = draftSchedule.value;
  if (d.frequency !== orig.frequency) return true;
  if (d.anchorDate !== orig.anchorDate) return true;
  if (d.weekendRule !== orig.weekendRule) return true;
  if (d.frequency === "monthly" && Number(d.dayOfMonth) !== Number(orig.dayOfMonth)) return true;
  if (d.frequency === "semimonthly") {
    const draftD1 = Math.min(Number(d.firstDay) || 0, Number(d.secondDay) || 0);
    const draftD2 = Math.max(Number(d.firstDay) || 0, Number(d.secondDay) || 0);
    const origD1 = Math.min(Number(orig.firstDay) || 0, Number(orig.secondDay) || 0);
    const origD2 = Math.max(Number(orig.firstDay) || 0, Number(orig.secondDay) || 0);
    if (draftD1 !== origD1 || draftD2 !== origD2) return true;
  }
  if (
    d.frequency === "manual" &&
    (d.manualFollowingPayday || "") !== (orig.manualFollowingPayday || "")
  )
    return true;
  return false;
});

const hasOverridesChanged = computed(() => {
  const orig = state.value.paydaySchedule;
  const origOverrides = orig?.overrides || [];
  const draftOverrides = draftSchedule.value.overrides || [];
  if (origOverrides.length !== draftOverrides.length) return true;
  for (const o of origOverrides) {
    const match = draftOverrides.find((dO) => dO.scheduledDate === o.scheduledDate);
    if (!match || match.overrideDate !== o.overrideDate || (match.note || "") !== (o.note || "")) {
      return true;
    }
  }
  return false;
});

const isDirty = computed(() => isScheduleFormDirty.value || hasOverridesChanged.value);

watch(
  () => state.value.paydaySchedule,
  (newSched) => {
    if (!isDirty.value && newSched) {
      draftSchedule.value = initDraft();
    }
  },
  { deep: true },
);

const upcomingPreview = computed(() => {
  try {
    const d = draftSchedule.value;
    if (!d.anchorDate) return [];
    if (
      d.frequency === "monthly" &&
      (!d.dayOfMonth || d.dayOfMonth < 1 || d.dayOfMonth > 31)
    )
      return [];
    if (
      d.frequency === "semimonthly" &&
      (!d.firstDay || !d.secondDay || d.firstDay === d.secondDay)
    )
      return [];
    return getUpcomingPaydays(d, today(), 3);
  } catch {
    return [];
  }
});

const incompatibleOverrides = computed(() => {
  const d = draftSchedule.value;
  if (!d.frequency || !d.anchorDate) return [];
  const overrides = d.overrides || [];
  if (overrides.length === 0) return [];

  const testSched: PaydaySchedule = {
    frequency: d.frequency,
    anchorDate: d.anchorDate,
    dayOfMonth:
      d.frequency === "monthly" ? Number(d.dayOfMonth) : undefined,
    firstDay:
      d.frequency === "semimonthly"
        ? Math.min(Number(d.firstDay), Number(d.secondDay))
        : undefined,
    secondDay:
      d.frequency === "semimonthly"
        ? Math.max(Number(d.firstDay), Number(d.secondDay))
        : undefined,
    weekendRule: d.weekendRule || "exact",
    manualFollowingPayday:
      d.frequency === "manual" ? d.manualFollowingPayday : undefined,
    overrides: [],
  };

  return overrides.filter(
    (o) => !resolveNominalOccurrenceDate(testSched, o.scheduledDate),
  );
});

function removeIncompatibleOverrides() {
  const badDates = new Set(incompatibleOverrides.value.map((o) => o.scheduledDate));
  draftSchedule.value.overrides = (draftSchedule.value.overrides || []).filter(
    (o) => !badDates.has(o.scheduledDate),
  );
  scheduleError.value = "";
}

function onFrequencyChange() {
  scheduleError.value = "";
  const d = draftSchedule.value;
  if (d.frequency === "monthly" && !d.dayOfMonth) {
    d.dayOfMonth = Number(d.anchorDate?.split("-")[2]) || 1;
  }
  if (d.frequency === "semimonthly") {
    if (!d.firstDay) d.firstDay = 15;
    if (!d.secondDay) d.secondDay = 31;
  }
  if (d.frequency === "manual" && !d.anchorDate) {
    d.anchorDate = currentPayday.value || today();
  }
}

function handleSaveSchedule() {
  scheduleError.value = "";
  const result = saveSchedule(draftSchedule.value);
  if (result.success) {
    scheduleSaved.value = true;
    draftSchedule.value = initDraft(); // Re-sync draft with normalized persisted schedule
    setTimeout(() => {
      scheduleSaved.value = false;
    }, 3000);
  } else {
    scheduleError.value =
      result.message || "Please correct the schedule errors.";
  }
}

function handleCancelSchedule() {
  draftSchedule.value = initDraft();
  scheduleError.value = "";
}

// One-time overrides state
const showAddOverride = ref(false);
const newOverride = ref({ scheduledDate: "", overrideDate: "", note: "" });
const overrideError = ref("");

const activeOverrides = computed(
  () => draftSchedule.value.overrides || [],
);

function handleAddOverride() {
  overrideError.value = "";
  if (isScheduleFormDirty.value) {
    overrideError.value =
      "Please save your schedule settings above before adding a one-time override.";
    return;
  }
  if (!newOverride.value.scheduledDate || !newOverride.value.overrideDate) {
    overrideError.value =
      "Please select both a scheduled date and a substitute override date.";
    return;
  }
  const result = addScheduleOverride({
    scheduledDate: newOverride.value.scheduledDate,
    overrideDate: newOverride.value.overrideDate,
    note: newOverride.value.note.trim() || undefined,
  });
  if (result.success) {
    newOverride.value = { scheduledDate: "", overrideDate: "", note: "" };
    showAddOverride.value = false;
    draftSchedule.value.overrides = JSON.parse(
      JSON.stringify(state.value.paydaySchedule?.overrides || []),
    );
  } else {
    overrideError.value = result.error || "Could not apply override.";
  }
}

function handleRemoveOverride(idOrDate: string) {
  if (isScheduleFormDirty.value) {
    draftSchedule.value.overrides = (draftSchedule.value.overrides || []).filter(
      (o) => o.id !== idOrDate && o.scheduledDate !== idOrDate,
    );
  } else {
    removeScheduleOverride(idOrDate);
    draftSchedule.value.overrides = JSON.parse(
      JSON.stringify(state.value.paydaySchedule?.overrides || []),
    );
  }
}
</script>

<template>
  <div class="settings-layout">
    <div class="settings-col">
      <section class="card settings-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">💰</span>
            Financial Baseline
          </h2>
        </div>
        <p class="muted settings-desc">
          Update your starting cash balance. Paydays and recurring schedules are
          managed in the Payday Schedule section below.
        </p>
        <form @submit.prevent="saveSettings" class="settings-form">
          <label>
            <span>Current account balance ($)</span>
            <input
              v-model="settingsBalance"
              type="text"
              inputmode="decimal"
              required
              placeholder="0.00"
            />
            <small>
              Total cash available across your primary checking and cash accounts.
            </small>
          </label>
          <div class="formula-note">
            <strong>Formula:</strong> Safe to spend = balance − pots − remaining
            monthly budgets − unpaid bills through payday − protected next cycle
            bills − credit card payment reserves.
          </div>
          <div class="settings-action-row">
            <button class="primary" type="submit">Save baseline</button>
            <span v-if="settingsSaved" class="saved-badge">
              ✓ Changes saved
            </span>
          </div>
        </form>
      </section>

      <section class="card settings-card" id="payday-schedule-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">📅</span>
            Payday Schedule
          </h2>
          <span class="badge" :class="`frequency-${draftSchedule.frequency}`">
            {{ frequencyLabel(draftSchedule.frequency) }}
          </span>
        </div>
        <p class="muted settings-desc">
          Configure how frequently you receive income. Mika uses this schedule to
          automatically reserve money for upcoming bills and calculate your daily
          spending allowance.
        </p>

        <form @submit.prevent="handleSaveSchedule" class="settings-form">
          <!-- Frequency Selection -->
          <label>
            <span>Schedule frequency</span>
            <select
              v-model="draftSchedule.frequency"
              @change="onFrequencyChange"
            >
              <option value="biweekly">Biweekly (Every 2 weeks)</option>
              <option value="weekly">Weekly</option>
              <option value="semimonthly">Semimonthly (Twice a month)</option>
              <option value="monthly">Monthly</option>
              <option value="manual">Manual (Specific dates)</option>
            </select>
            <small>How often your primary income arrives.</small>
          </label>

          <!-- Progressive Disclosure Fields -->

          <!-- 1. Weekly & Biweekly -->
          <template
            v-if="
              draftSchedule.frequency === 'weekly' ||
              draftSchedule.frequency === 'biweekly'
            "
          >
            <label>
              <span>Anchor payday date</span>
              <input
                v-model="draftSchedule.anchorDate"
                type="date"
                required
              />
              <small>
                A recent or upcoming payday to establish the
                {{
                  draftSchedule.frequency === "weekly"
                    ? "weekly day of the week"
                    : "2-week cycle"
                }}.
              </small>
            </label>
          </template>

          <!-- 2. Monthly -->
          <template v-else-if="draftSchedule.frequency === 'monthly'">
            <label>
              <span>Payday day of month (1–31)</span>
              <input
                v-model.number="draftSchedule.dayOfMonth"
                type="number"
                min="1"
                max="31"
                step="1"
                required
                placeholder="e.g. 1 or 15 or 31"
              />
              <small>
                Day of the month you get paid. Months with fewer days use the
                last calendar day.
              </small>
            </label>
            <label>
              <span>Anchor date</span>
              <input
                v-model="draftSchedule.anchorDate"
                type="date"
                required
              />
              <small>Reference date for the monthly cycle.</small>
            </label>
          </template>

          <!-- 3. Semimonthly -->
          <template v-else-if="draftSchedule.frequency === 'semimonthly'">
            <div class="form-row-2col">
              <label>
                <span>First payday (day 1–31)</span>
                <input
                  v-model.number="draftSchedule.firstDay"
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  required
                  placeholder="15"
                />
                <small>e.g., 15th</small>
              </label>
              <label>
                <span>Second payday (day 1–31)</span>
                <input
                  v-model.number="draftSchedule.secondDay"
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  required
                  placeholder="31"
                />
                <small>e.g., 31st (last day)</small>
              </label>
            </div>
            <small class="field-hint">
              Two distinct days each month (e.g. 15th and 31st).
            </small>
            <label>
              <span>Anchor date</span>
              <input
                v-model="draftSchedule.anchorDate"
                type="date"
                required
              />
              <small>Reference date for the semimonthly cycle.</small>
            </label>
          </template>

          <!-- 4. Manual -->
          <template v-else-if="draftSchedule.frequency === 'manual'">
            <label>
              <span>Next payday date</span>
              <input
                v-model="draftSchedule.anchorDate"
                type="date"
                required
              />
              <small>Your next confirmed upcoming payday.</small>
            </label>
            <label>
              <span>Following payday date (optional)</span>
              <input
                v-model="draftSchedule.manualFollowingPayday"
                type="date"
                :min="draftSchedule.anchorDate"
              />
              <small>
                The payday after your next one. Used to identify upcoming
                essential bills to protect (like next month’s rent).
              </small>
            </label>
          </template>

          <!-- Weekend Adjustment Rule (for non-manual frequencies) -->
          <label v-if="draftSchedule.frequency !== 'manual'">
            <span>Weekend adjustment</span>
            <select v-model="draftSchedule.weekendRule">
              <option value="exact">Exact date (No weekend shift)</option>
              <option value="preceding_friday">
                Preceding Friday (If payday is Sat/Sun)
              </option>
            </select>
            <small
              >If your payday falls on a weekend, automatically shift it to
              Friday.</small
            >
          </label>

          <!-- Upcoming Preview -->
          <div v-if="upcomingPreview.length > 0" class="payday-preview-box">
            <span class="preview-label">Upcoming paydays preview</span>
            <div class="preview-dates">
              <span
                v-for="(pDate, idx) in upcomingPreview"
                :key="pDate"
                class="preview-date-chip"
              >
                {{ idx === 0 ? "Next: " : "" }}{{ date(pDate) }}
              </span>
            </div>
          </div>

          <!-- Incompatible Overrides Warning Banner -->
          <div
            v-if="incompatibleOverrides.length > 0"
            class="formula-note warning incompatible-overrides-banner"
            role="alert"
          >
            <strong>⚠️ Incompatible Overrides Detected</strong>
            <p>
              Switching to this {{ frequencyLabel(draftSchedule.frequency) }} schedule makes
              {{ incompatibleOverrides.length }} existing one-time override{{
                incompatibleOverrides.length > 1 ? "s" : ""
              }}
              incompatible:
            </p>
            <ul class="incompatible-list">
              <li
                v-for="ov in incompatibleOverrides"
                :key="ov.scheduledDate"
              >
                {{ date(ov.scheduledDate) }} → {{ date(ov.overrideDate) }}
                <span v-if="ov.note">({{ ov.note }})</span>
              </li>
            </ul>
            <p class="muted">
              These overrides will not affect the new schedule. Remove them to proceed with saving, or click Cancel to restore your previous schedule.
            </p>
            <div class="incompatible-actions">
              <button
                type="button"
                class="secondary small remove-incompatible-btn"
                @click="removeIncompatibleOverrides"
              >
                Remove incompatible {{ incompatibleOverrides.length > 1 ? "overrides" : "override" }}
              </button>
            </div>
          </div>

          <!-- Error Alert Banner -->
          <div
            v-if="scheduleError"
            class="formula-note warning schedule-error"
            role="alert"
          >
            ⚠ {{ scheduleError }}
          </div>

          <!-- Action Buttons: Save & Cancel -->
          <div class="settings-action-row">
            <button class="primary" type="submit">Save schedule</button>
            <button
              class="secondary"
              type="button"
              @click="handleCancelSchedule"
              :disabled="!isDirty && !scheduleError"
            >
              Cancel
            </button>
            <span v-if="scheduleSaved" class="saved-badge">
              ✓ Schedule saved
            </span>
          </div>
        </form>

        <!-- One-Time Overrides Section -->
        <div class="overrides-section">
          <div class="overrides-header">
            <h3>One-Time Payday Overrides</h3>
            <button
              type="button"
              class="text-link"
              :disabled="isScheduleFormDirty"
              @click="showAddOverride = !showAddOverride; overrideError = '';"
              :title="isScheduleFormDirty ? 'Save your schedule settings first' : ''"
            >
              {{ showAddOverride ? "Hide" : "+ Add override" }}
            </button>
          </div>
          <p class="muted settings-desc">
            Temporarily shift a specific payday (e.g., for early holiday
            deposits) without altering your recurring schedule.
          </p>
          <p v-if="isScheduleFormDirty" class="formula-note warning" style="margin-bottom: 0.75rem;">
            Save your schedule changes above before adding or editing one-time overrides.
          </p>

          <!-- List of existing overrides -->
          <div v-if="activeOverrides.length > 0" class="overrides-list">
            <div
              v-for="ov in activeOverrides"
              :key="ov.id || ov.scheduledDate"
              class="override-item"
            >
              <div class="override-info">
                <strong
                  >{{ date(ov.scheduledDate) }} →
                  {{ date(ov.overrideDate) }}</strong
                >
                <span v-if="ov.note" class="override-note">{{ ov.note }}</span>
              </div>
              <button
                type="button"
                class="secondary small delete-btn"
                @click="handleRemoveOverride(ov.id || ov.scheduledDate)"
                title="Remove override"
              >
                Remove
              </button>
            </div>
          </div>
          <p v-else-if="!showAddOverride" class="muted field-hint">
            No active one-time overrides.
          </p>

          <!-- Add Override Form -->
          <form
            v-if="showAddOverride"
            @submit.prevent="handleAddOverride"
            class="add-override-form"
          >
            <div class="form-row-2col">
              <label>
                <span>Scheduled occurrence date</span>
                <input
                  v-model="newOverride.scheduledDate"
                  type="date"
                  required
                />
              </label>
              <label>
                <span>Substitute payday date</span>
                <input
                  v-model="newOverride.overrideDate"
                  type="date"
                  required
                />
              </label>
            </div>
            <label>
              <span>Note (optional)</span>
              <input
                v-model="newOverride.note"
                type="text"
                placeholder="e.g. Early Thanksgiving direct deposit"
              />
            </label>
            <div
              v-if="overrideError"
              class="formula-note warning override-error"
              role="alert"
            >
              ⚠ {{ overrideError }}
            </div>
            <div class="settings-action-row">
              <button class="primary small" type="submit">
                Add override
              </button>
              <button
                class="secondary small"
                type="button"
                @click="showAddOverride = false; overrideError = '';"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </section>

      <section class="card settings-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">💾</span>
            Data Storage & Privacy
          </h2>
        </div>

        <!-- Storage Health Status Banner -->
        <div
          v-if="storageHealth.status === 'quota_exceeded'"
          class="storage-banner quota-banner"
          role="alert"
        >
          <span class="banner-icon" aria-hidden="true">⚠️</span>
          <div class="banner-content">
            <strong>Storage Quota Exceeded</strong>
            <p>Your browser storage limit has been reached. New changes cannot be saved locally. Export a backup immediately to prevent data loss.</p>
          </div>
          <button type="button" class="primary sm" @click="backup">
            Export backup now
          </button>
        </div>

        <div
          v-else-if="storageHealth.hasCorruptedStash"
          class="storage-banner recovery-banner"
          role="alert"
        >
          <span class="banner-icon" aria-hidden="true">⚠️</span>
          <div class="banner-content">
            <strong>Recovery Mode Active</strong>
            <p>Previous browser data could not be parsed safely. Your original unparsed data is preserved so nothing is overwritten. You can download the raw data below.</p>
          </div>
          <button type="button" class="secondary sm" @click="downloadCorruptData">
            Download raw data (.json)
          </button>
        </div>

        <div
          v-else-if="storageHealth.status === 'conflict'"
          class="storage-banner conflict-banner"
          role="alert"
        >
          <span class="banner-icon" aria-hidden="true">⚠️</span>
          <div class="banner-content">
            <strong>Storage Conflict: Unsaved Changes Protected</strong>
            <p>{{ storageHealth.errorMessage }}</p>
            <div class="banner-actions">
              <button type="button" class="primary sm" @click="backup">
                Export unsaved changes ↓
              </button>
              <button type="button" class="secondary sm" @click="reloadFromStorage">
                Reload & sync latest ↺
              </button>
            </div>
          </div>
        </div>

        <div
          v-else-if="storageHealth.status === 'concurrency_warning'"
          class="storage-banner concurrency-banner"
          role="alert"
        >
          <span class="banner-icon" aria-hidden="true">ℹ️</span>
          <div class="banner-content">
            <strong>Multi-Tab Sync Notice</strong>
            <p>{{ storageHealth.errorMessage || 'Storage was modified from another browser tab.' }}</p>
          </div>
        </div>

        <div v-else class="storage-health-indicator" role="status">
          <span class="health-dot active" aria-hidden="true">●</span>
          <span><strong>Local Browser Storage: Active & Healthy</strong></span>
        </div>

        <p class="muted settings-desc">
          Your financial details are stored 100% locally on this device in browser storage. Zero tracking and no external servers.
        </p>

        <div class="settings-data-actions">
          <div class="data-action-item">
            <div>
              <strong>Export Backup</strong>
              <p class="muted">
                Download a complete, versioned JSON backup containing all accounts, transactions, budgets, pots, and bills.
              </p>
            </div>
            <button type="button" class="secondary" @click="backup">
              Download backup ↓
            </button>
          </div>

          <div class="data-action-item">
            <div>
              <strong>Import & Restore Backup</strong>
              <p class="muted">
                Preview and safely restore your budget records from an exported backup. A rollback snapshot of your current data is saved automatically.
              </p>
            </div>
            <label class="secondary file-upload-btn">
              <span>Choose file ↑</span>
              <input
                type="file"
                accept=".json"
                @change="onImportFileSelected"
                class="sr-only"
                aria-label="Upload backup JSON file to restore"
              />
            </label>
          </div>

          <!-- Rollback Snapshot Item -->
          <div v-if="storageHealth.hasRollbackSnapshot" class="data-action-item rollback-item">
            <div>
              <strong>Undo Last Restore / Rollback</strong>
              <p class="muted">
                Restore the automatic rollback snapshot taken before your last restore or reset{{ storageHealth.rollbackTimestamp ? ` (${new Date(storageHealth.rollbackTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })})` : '' }}.
              </p>
            </div>
            <button type="button" class="secondary" @click="restoreRollbackSnapshot">
              Restore rollback snapshot ↺
            </button>
          </div>

          <!-- Raw Corrupted Stash Item (if exists) -->
          <div v-if="storageHealth.hasCorruptedStash" class="data-action-item corrupt-stash-item">
            <div>
              <strong>Download Raw Unparseable Data</strong>
              <p class="muted">
                Export the preserved raw storage string that failed loading during startup for manual recovery or inspection.
              </p>
            </div>
            <button type="button" class="secondary" @click="downloadCorruptData">
              Download raw data (.json)
            </button>
          </div>
        </div>

        <p class="muted settings-desc storage-educational-note">
          🔒 <strong>Browser Storage Durability:</strong> Local browser storage is specific to this browser and profile. Private browsing mode, clearing your browser website data, or switching devices will not retain your records. Download regular backups to keep your financial records permanently safe.
        </p>

        <div class="reset-settings">
          <div>
            <h3>Need a fresh start?</h3>
            <p class="muted">
              Restart anytime. You can keep your budgets and recurring bills or clear everything. A rollback snapshot is saved before reset.
            </p>
          </div>
          <button
            class="secondary"
            type="button"
            @click="open('Start fresh')"
          >
            Start fresh ›
          </button>
        </div>
      </section>
    </div>

    <div class="settings-col">
      <section class="card settings-card" id="budget-companion-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">✨</span>
            Budget Companion
          </h2>
          <span class="companion-tag">Deterministic Rules</span>
        </div>
        <div class="companion-settings-banner">
          <div class="companion-preview-avatar">
            <img
              :src="companionPortraits.welcome"
              alt="Mika avatar"
              width="56"
              height="56"
            />
          </div>
          <div class="companion-preview-info">
            <strong>Mika</strong>
            <p class="muted">
              Your mindful companion providing deterministic guidance based on actual cash, bills, and card coverage.
            </p>
          </div>
        </div>

        <div class="formula-note" style="margin-bottom: 1rem;">
          🛡️ <strong>Deterministic Guidance:</strong> Mika’s tips and observations are calculated directly from your actual accounts, budgets, and bill cycles using local deterministic rules—never AI hallucinations or third-party cloud services.
        </div>

        <div class="settings-toggles-stack">
          <div class="toggle-card">
            <label>
              <input type="checkbox" v-model="showCompanion" id="pref-show-companion" />
              <div>
                <strong>Enable Mika Companion</strong>
                <small>
                  Display Mika’s companion portrait and mindful budget guidance across the application.
                </small>
              </div>
            </label>
          </div>

          <div class="toggle-card" :class="{ 'is-disabled': !showCompanion }">
            <label>
              <input
                type="checkbox"
                v-model="enableGreetings"
                :disabled="!showCompanion"
                id="pref-enable-greetings"
              />
              <div>
                <strong>Enable Automatic Greetings</strong>
                <small>
                  Automatically expand dialogue once per session with mindful observations. When disabled, Mika stays minimized until clicked.
                </small>
              </div>
            </label>
          </div>

          <div class="toggle-card" :class="{ 'is-disabled': !showCompanion }">
            <label>
              <input
                type="checkbox"
                v-model="reduceAnimations"
                :disabled="!showCompanion"
                id="pref-reduce-animations"
              />
              <div>
                <strong>Reduce Companion Animations</strong>
                <small>
                  Reveal dialogue text immediately without typewriter delays, and disable floating avatar motions.
                </small>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section class="card settings-card" id="webgpu-ai-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">⚡</span>
            On-Device AI (Optional WebGPU)
          </h2>
          <span
            class="ai-status-tag"
            :class="{ online: webGpuAvailable }"
          >
            {{ webGpuAvailable ? "● WebGPU Active" : "○ WebGPU Inactive" }}
          </span>
        </div>
        <p class="muted settings-desc">
          An optional, experimental in-browser neural model for natural-language inquiries. 100% private, runs directly on your device GPU, and completely distinct from Mika’s core deterministic budgeting rules.
        </p>
        <div class="ai-settings-form">
          <label>
            <span>On-Device Model</span>
            <select v-model="selectedWebModel">
              <option
                v-for="m in availableWebModels"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }} — {{ m.sizeDesc }}
              </option>
            </select>
          </label>
          <div v-if="webGpuAvailable" class="formula-note success-note">
            ✓ <strong>Hardware acceleration active!</strong> The model downloads
            once directly into browser cache on your first "Ask Mika" click and
            executes locally via WebGPU.
          </div>
          <div v-else class="formula-note warning">
            ⚠ <strong>Hardware acceleration not active.</strong> Ensure "Use
            graphics acceleration when available" is turned on in browser
            settings (Chrome/Edge/Brave). In the meantime, Mika uses smart
            built-in rule guidance.
          </div>
          <div class="ai-features-list">
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>
                <strong>100% Private:</strong> Financial amounts and transaction
                history never leave your computer
              </span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>
                <strong>Zero Subscription Costs:</strong> No API keys or token
                fees required
              </span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>
                <strong>Offline Capable:</strong> Once downloaded, models run
                without needing an internet connection
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
