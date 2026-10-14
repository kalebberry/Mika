<script setup lang="ts">
import { useBudget, navItems } from "../../composables/useBudget";

const { page, collapsed } = useBudget();
</script>

<template>
  <aside class="sidebar">
    <a class="brand" href="#" @click.prevent="page = 'Overview'">
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
        <span class="nav-icon">{{ icon }}</span>
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
