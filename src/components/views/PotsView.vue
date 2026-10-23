<script setup lang="ts">
import { money, pct } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { state } = useBudget();
const { open } = useModal();
</script>

<template>
  <p class="page-intro">
    Set money aside for what matters. Moving money into a pot reserves it
    without changing your account balance.
  </p>
  <div class="pot-grid">
    <section v-for="p in state.pots" :key="p.id" class="card pot-card">
      <div class="section-heading">
        <h2>
          <i class="color-dot" :style="{ background: p.color }"></i>
          {{ p.name }}
        </h2>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button
            class="text-link small"
            @click="open('Edit pot', p.id)"
            :aria-label="'Edit ' + p.name + ' pot'"
            title="Edit pot"
          >
            Edit
          </button>
          <button
            class="delete-icon"
            @click="open('Delete pot', p.id)"
            :aria-label="'Delete ' + p.name + ' pot'"
            title="Delete pot"
          >
            ×
          </button>
        </div>
      </div>
      <div class="pot-amount">
        <span>Total saved</span>
        <strong>{{ money(p.saved) }}</strong>
      </div>
      <div
        class="progress slim"
        role="progressbar"
        :aria-label="p.name + ' progress'"
        :aria-valuenow="Math.round(pct(p.saved, p.target))"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span
          :style="{
            width: pct(p.saved, p.target) + '%',
            background: p.color,
          }"
        ></span>
      </div>
      <div class="progress-label">
        <strong>{{ ((p.saved / p.target) * 100).toFixed(1) }}%</strong>
        <span>Target of {{ money(p.target) }}</span>
      </div>
      <div class="pot-actions">
        <button class="secondary" @click="open('Add money', p.id)">
          ＋ Add money
        </button>
        <button
          class="secondary"
          @click="open('Withdraw', p.id)"
          :disabled="!p.saved"
        >
          Withdraw
        </button>
      </div>
    </section>

    <section v-if="!state.pots.length" class="card empty">
      <h3>Something to look forward to.</h3>
      <p>A trip, a rainy day, or your next big idea.</p>
      <button class="primary" @click="open('Add pot')">
        Create your first pot
      </button>
    </section>
  </div>
</template>
