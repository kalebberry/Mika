<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { date, frequencyLabel } from "../../utils/format";

const { dailyPayday, page } = useBudget();

const payday = computed(() => dailyPayday.value);
const formattedDate = computed(() =>
  payday.value.date ? date(payday.value.date) : "Not set",
);
const freqName = computed(() => frequencyLabel(payday.value.frequency));
</script>

<template>
  <section class="card daily-payday-card" aria-labelledby="payday-status-title">
    <div class="payday-content">
      <div class="payday-left">
        <span class="payday-icon" aria-hidden="true">📅</span>
        <div class="payday-date-group">
          <span id="payday-status-title" class="payday-label">Next Payday:</span>
          <strong class="payday-date">{{ formattedDate }}</strong>
          <span class="payday-countdown">({{ payday.daysLabel }})</span>
        </div>
        <span
          v-if="payday.statusLabel === 'Manually scheduled'"
          class="badge badge-teal"
          title="Manually scheduled deposit date"
        >
          Manually scheduled
        </span>
        <span
          v-else-if="payday.statusLabel === 'Adjusted schedule'"
          class="badge badge-teal"
          title="One-time payday adjustment for this cycle"
        >
          Adjusted schedule
        </span>
        <span
          v-else-if="payday.statusLabel === 'Projected'"
          class="badge badge-neutral"
          title="Projected based on recurring schedule"
        >
          Projected
        </span>
        <span
          v-else-if="payday.statusLabel === 'Payday passed'"
          class="badge badge-amber"
          title="Scheduled payday has passed"
        >
          Payday passed
        </span>
        <span
          v-else
          class="badge badge-amber"
          title="Payday schedule is not configured"
        >
          Not configured
        </span>
      </div>

      <div class="payday-actions">
        <button
          type="button"
          class="secondary small payday-btn"
          @click="page = 'Settings'"
        >
          Settings ↗
        </button>
      </div>
    </div>
  </section>
</template>
