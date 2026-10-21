<script setup lang="ts">
import { useBudget, navItems } from "../../composables/useBudget";

const { page, collapsed } = useBudget();
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
        :class="{ active: page === label }"
        @click="page = label"
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
    </nav>
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
