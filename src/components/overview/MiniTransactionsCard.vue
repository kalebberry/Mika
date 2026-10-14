<script setup lang="ts">
import { colors } from "../../model";
import { money, date } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { latest, categories, page } = useBudget();
const { open } = useModal();
</script>

<template>
  <section class="card">
    <div class="section-heading">
      <h2>Transactions</h2>
      <button class="text-link" @click="page = 'Transactions'">
        View all <span>›</span>
      </button>
    </div>
    <div v-for="t in latest" :key="t.id" class="transaction-row">
      <span
        class="avatar"
        :style="{
          background:
            colors[categories.indexOf(t.category) % colors.length],
        }"
      >
        {{ t.name.slice(0, 1).toUpperCase() }}
      </span>
      <strong class="transaction-name">{{ t.name }}</strong>
      <div class="transaction-amount">
        <strong :class="{ positive: t.amount > 0 }">
          {{ t.amount > 0 ? "+" : "" }}{{ money(t.amount) }}
        </strong>
        <span>{{ date(t.date) }}</span>
      </div>
    </div>
    <div class="empty" v-if="!latest.length">
      <h3>Your fresh start.</h3>
      <p>Add your first transaction when you’re ready.</p>
      <button class="secondary" @click="open('Add transaction')">
        Add transaction
      </button>
    </div>
  </section>
</template>
