<script setup lang="ts">
import { onMounted } from "vue";
import { useBudget } from "./composables/useBudget";
import { useCompanion } from "./composables/useCompanion";

import AppSidebar from "./components/layout/AppSidebar.vue";
import AppHeader from "./components/layout/AppHeader.vue";
import AppFooter from "./components/layout/AppFooter.vue";
import ToastNotification from "./components/layout/ToastNotification.vue";
import DemoBanner from "./components/common/DemoBanner.vue";
import ActionDialog from "./components/common/ActionDialog.vue";
import MikaCompanion from "./components/companion/MikaCompanion.vue";

import OverviewView from "./components/views/OverviewView.vue";
import AccountsView from "./components/views/AccountsView.vue";
import TransactionsView from "./components/views/TransactionsView.vue";
import BudgetsView from "./components/views/BudgetsView.vue";
import PotsView from "./components/views/PotsView.vue";
import RecurringBillsView from "./components/views/RecurringBillsView.vue";
import SettingsView from "./components/views/SettingsView.vue";

const { page, collapsed, registerModelContext } = useBudget();
const { checkWebGpu } = useCompanion();

onMounted(() => {
  checkWebGpu();
  registerModelContext();
});
</script>

<template>
  <div class="app" :class="{ collapsed }">
    <a href="#main-content" class="skip-to-content">Skip to main content</a>
    <AppSidebar />
    <main id="main-content" tabindex="-1">
      <AppHeader />
      <DemoBanner />

      <OverviewView v-if="page === 'Overview'" />
      <AccountsView v-else-if="page === 'Accounts'" />
      <TransactionsView v-else-if="page === 'Transactions'" />
      <BudgetsView v-else-if="page === 'Budgets'" />
      <PotsView v-else-if="page === 'Pots'" />
      <RecurringBillsView v-else-if="page === 'Recurring Bills'" />
      <SettingsView v-else-if="page === 'Settings'" />

      <AppFooter />
    </main>

    <ActionDialog />
    <ToastNotification />
    <MikaCompanion />
  </div>
</template>
