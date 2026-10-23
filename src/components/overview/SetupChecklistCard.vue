<script setup lang="ts">
import { computed } from "vue";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";
import type { SetupChecklistItem } from "../../model";

const { setupChecklist, dismissSetup, reopenSetup, backup, page } = useBudget();
const { open } = useModal();

const checklist = computed(() => setupChecklist.value);

function handleItemAction(item: SetupChecklistItem) {
  if (item.targetModal) {
    open(item.targetModal as any);
    return;
  }
  if (item.targetPage) {
    page.value = item.targetPage as any;
  }
}
</script>

<template>
  <!-- Reopen link if dismissed and not all complete -->
  <div
    v-if="checklist.isDismissed && !checklist.isAllComplete"
    class="setup-reopen-bar"
  >
    <span class="muted small">Setup guide is hidden ({{ checklist.completedCount }}/{{ checklist.totalCount }} complete).</span>
    <button
      type="button"
      class="text-link small"
      @click="reopenSetup"
    >
      Reopen setup checklist ↺
    </button>
  </div>

  <!-- Full Setup Checklist Card (if not dismissed or explicitly reopened) -->
  <section
    v-else-if="!checklist.isDismissed && !checklist.isAllComplete"
    class="card setup-checklist-card"
    aria-labelledby="setup-checklist-title"
  >
    <div class="setup-checklist-header">
      <div class="setup-header-left">
        <h2 id="setup-checklist-title" class="setup-checklist-heading">
          <span class="setup-sparkle" aria-hidden="true">🌱</span>
          Get Started with Mika
        </h2>
        <span class="setup-progress-badge">
          {{ checklist.completedCount }} of {{ checklist.totalCount }} complete ({{ checklist.percentComplete }}%)
        </span>
      </div>
      <button
        type="button"
        class="secondary small dismiss-btn"
        @click="dismissSetup"
        title="Hide setup checklist from dashboard"
      >
        Dismiss
      </button>
    </div>

    <!-- Progress bar -->
    <div
      class="setup-progress-bar-bg"
      role="progressbar"
      :aria-valuenow="checklist.percentComplete"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`Setup progress ${checklist.percentComplete}%`"
    >
      <div
        class="setup-progress-bar-fill"
        :style="{ width: `${checklist.percentComplete}%` }"
      />
    </div>

    <!-- Checklist items list -->
    <div class="setup-items-list" role="list">
      <div
        v-for="item in checklist.items"
        :key="item.id"
        class="setup-item-row"
        :class="{ 'is-completed': item.completed }"
        role="listitem"
      >
        <div class="setup-item-icon" aria-hidden="true">
          <span v-if="item.completed" class="item-check">✓</span>
          <span v-else class="item-bullet">○</span>
        </div>
        <div class="setup-item-details">
          <strong class="setup-item-title">{{ item.title }}</strong>
          <span class="setup-item-desc">{{ item.description }}</span>
        </div>
        <div class="setup-item-action">
          <span v-if="item.completed" class="badge badge-teal small">Done</span>
          <button
            v-else
            type="button"
            class="secondary small setup-action-btn"
            @click="handleItemAction(item)"
          >
            {{ item.actionLabel }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.setup-reopen-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--color-surface, #ffffff);
  border-radius: var(--radius-md, 8px);
  border: 1px dashed var(--color-border, #e0e0e0);
  margin-bottom: 1rem;
}

.setup-checklist-card {
  border-left: 4px solid var(--color-teal, #277c78);
  margin-bottom: 1.5rem;
  padding: 1.25rem;
}

.setup-checklist-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.setup-header-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.setup-checklist-heading {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #1e1e1e);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.setup-sparkle {
  font-size: 1.2rem;
}

.setup-progress-badge {
  font-size: 0.8125rem;
  color: var(--color-muted, #666666);
  font-weight: 500;
}

.dismiss-btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.setup-progress-bar-bg {
  height: 6px;
  background: var(--color-border, #e9ecef);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.setup-progress-bar-fill {
  height: 100%;
  background: var(--color-teal, #277c78);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.setup-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.setup-item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-bg-subtle, #f8f9fa);
  transition: background 0.15s ease;
}

.setup-item-row.is-completed {
  opacity: 0.8;
}

.setup-item-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.item-check {
  color: var(--color-teal, #277c78);
}

.item-bullet {
  color: var(--color-muted, #999999);
}

.setup-item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.setup-item-title {
  font-size: 0.875rem;
  color: var(--color-text, #1e1e1e);
}

.setup-item-row.is-completed .setup-item-title {
  text-decoration: line-through;
  color: var(--color-muted, #666666);
}

.setup-item-desc {
  font-size: 0.75rem;
  color: var(--color-muted, #666666);
}

.setup-item-action {
  flex-shrink: 0;
}

.setup-action-btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
}

@media (max-width: 480px) {
  .setup-item-row {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .setup-item-action {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
