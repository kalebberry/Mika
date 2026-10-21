<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const { page } = useBudget();
const { open } = useModal();

const actionLabel = computed(() => {
  if (page.value === "Accounts") return "Add account";
  if (page.value === "Budgets") return "Add budget";
  if (page.value === "Pots") return "Add pot";
  if (page.value === "Recurring Bills") return "Add bill";
  return "Add transaction";
});
</script>

<template>
  <header class="page-header">
    <div>
      <div class="eyebrow">
        {{
          page === "Settings"
            ? "MANAGE YOUR WORKSPACE"
            : page === "Insights"
              ? "MONTHLY SPENDING PATTERNS"
              : "YOUR MONEY, AT A GLANCE"
        }}
      </div>
      <h1>{{ page === "Insights" ? "Your Insights" : page }}</h1>
    </div>
    <div class="header-actions">
      <button
        class="icon-button"
        :class="{ active: page === 'Settings' }"
        @click="page = 'Settings'"
        aria-label="Account settings"
        title="Settings"
      >
        ⚙
      </button>
      <button
        v-if="page !== 'Settings' && page !== 'Insights'"
        class="primary"
        @click="open(actionLabel)"
      >
        ＋
        <span>{{ actionLabel }}</span>
      </button>
    </div>
  </header>
</template>
