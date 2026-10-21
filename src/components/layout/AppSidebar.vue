<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useBudget, navItems, type PageName } from "../../composables/useBudget";

const { page, collapsed, isMobileMenuOpen } = useBudget();

const isMoreOpen = ref(false);
const moreBtnRef = ref<HTMLButtonElement | null>(null);
const sheetRef = ref<HTMLElement | null>(null);

const secondaryPages: PageName[] = ["Insights", "Pots", "Settings"];

const isSecondaryActive = computed(() =>
  secondaryPages.includes(page.value),
);

const activeSecondaryItem = computed(() => {
  return navItems.find(([label]) => label === page.value);
});

// Primary items to show in the mobile bottom navigation bar
const mobilePrimaryItems: PageName[] = [
  "Overview",
  "Accounts",
  "Transactions",
  "Budgets",
  "Recurring Bills",
];

function isMobilePrimary(label: PageName): boolean {
  return mobilePrimaryItems.includes(label);
}

function selectPage(label: PageName) {
  page.value = label;
  isMoreOpen.value = false;
  isMobileMenuOpen.value = false;
}

function toggleMore() {
  isMoreOpen.value = !isMoreOpen.value;
  isMobileMenuOpen.value = isMoreOpen.value;
  if (isMoreOpen.value) {
    nextTick(() => {
      const firstBtn = sheetRef.value?.querySelector<HTMLElement>("button.mobile-more-item");
      firstBtn?.focus();
    });
  }
}

function closeMore() {
  if (isMoreOpen.value) {
    isMoreOpen.value = false;
    isMobileMenuOpen.value = false;
    moreBtnRef.value?.focus();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isMoreOpen.value) {
    e.preventDefault();
    closeMore();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <aside class="sidebar">
    <a
      class="brand"
      href="#"
      @click.prevent="page = 'Overview'"
      aria-label="Budget - Go to Overview"
    >
      <span class="brand-mark">b.</span>
      <span class="brand-name">budget<span class="brand-dot">.</span></span>
    </a>
    <nav aria-label="Main navigation">
      <button
        v-for="[label, icon] in navItems"
        :key="label"
        :class="{
          active: page === label,
          'desktop-only-nav': !isMobilePrimary(label),
        }"
        @click="selectPage(label)"
        :aria-current="page === label ? 'page' : undefined"
        :title="label"
      >
        <span class="nav-icon" :class="{ 'has-svg': label === 'Accounts' }">
          <svg
            v-if="label === 'Accounts'"
            class="sidebar-icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <template v-else>{{ icon }}</template>
        </span>
        <span class="nav-label">{{ label }}</span>
      </button>

      <!-- Mobile More (Overflow) Trigger -->
      <button
        ref="moreBtnRef"
        type="button"
        class="mobile-more-btn"
        :class="{ active: isSecondaryActive }"
        @click="toggleMore"
        :aria-expanded="isMoreOpen"
        aria-haspopup="dialog"
        :aria-current="isSecondaryActive ? 'page' : undefined"
        title="More destinations"
      >
        <span class="nav-icon">
          {{ isSecondaryActive && activeSecondaryItem ? activeSecondaryItem[1] : "⋯" }}
        </span>
        <span class="nav-label">
          {{ isSecondaryActive && activeSecondaryItem ? activeSecondaryItem[0] : "More" }}
        </span>
      </button>
    </nav>

    <!-- Mobile Secondary Overflow Drawer / Sheet -->
    <div
      v-if="isMoreOpen"
      class="mobile-more-overlay"
      @click.self="closeMore"
    >
      <div
        ref="sheetRef"
        class="mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="More destinations"
      >
        <div class="mobile-more-header">
          <span class="mobile-more-title">More Destinations</span>
          <button
            type="button"
            class="mobile-more-close"
            @click="closeMore"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <div class="mobile-more-list">
          <button
            type="button"
            class="mobile-more-item"
            :class="{ active: page === 'Insights' }"
            @click="selectPage('Insights')"
          >
            <span class="more-item-icon">📊</span>
            <div class="more-item-text">
              <strong>Your Insights</strong>
              <small>Understand your money at your own pace</small>
            </div>
            <span v-if="page === 'Insights'" class="more-item-check" aria-hidden="true">✓</span>
          </button>
          <button
            type="button"
            class="mobile-more-item"
            :class="{ active: page === 'Pots' }"
            @click="selectPage('Pots')"
          >
            <span class="more-item-icon">▣</span>
            <div class="more-item-text">
              <strong>Pots</strong>
              <small>Savings goals and target amounts</small>
            </div>
            <span v-if="page === 'Pots'" class="more-item-check" aria-hidden="true">✓</span>
          </button>
          <button
            type="button"
            class="mobile-more-item"
            :class="{ active: page === 'Settings' }"
            @click="selectPage('Settings')"
          >
            <span class="more-item-icon">⚙</span>
            <div class="more-item-text">
              <strong>Settings</strong>
              <small>Manage workspace, payday & preferences</small>
            </div>
            <span v-if="page === 'Settings'" class="more-item-check" aria-hidden="true">✓</span>
          </button>
        </div>
      </div>
    </div>

    <div class="sidebar-bottom">
      <div class="local-note" v-if="!collapsed">
        <span class="small-icon">✓</span> A little clarity, every day.
      </div>
      <button
        @click="collapsed = !collapsed"
        :aria-label="collapsed ? 'Expand menu' : 'Minimize menu'"
      >
        <span class="nav-icon">{{ collapsed ? "›" : "‹" }}</span>
        <span class="nav-label">Minimize menu</span>
      </button>
    </div>
  </aside>
</template>
