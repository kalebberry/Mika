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
      <div class="payday-info">
        <div class="payday-badge-row">
          <span class="payday-icon" aria-hidden="true">📅</span>
          <h2 id="payday-status-title" class="payday-title">Next Payday</h2>
          <span
            v-if="payday.isConfirmed"
            class="badge badge-teal"
            title="Explicitly confirmed deposit date"
          >
            Confirmed
          </span>
          <span
            v-else-if="payday.isProjected"
            class="badge badge-neutral"
            title="Projected based on recurring schedule"
          >
            Projected
          </span>
          <span
            v-else
            class="badge badge-amber"
            title="Requires update in Settings"
          >
            Needs update
          </span>
        </div>
        <div class="payday-date-row">
          <strong class="payday-date">{{ formattedDate }}</strong>
          <span class="payday-countdown">
            ({{ payday.daysLabel }})
          </span>
        </div>
        <p class="payday-desc">
          {{ payday.statusDescription }}
        </p>
      </div>

      <div class="payday-actions">
        <button
          type="button"
          class="secondary small payday-btn"
          @click="page = 'Settings'"
        >
          Manage schedule ↗
        </button>
      </div>
    </div>
  </section>
</template>
