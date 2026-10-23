<script setup lang="ts">
import { ref, computed } from "vue";
import { useBudget } from "../../composables/useBudget";

const { backupReminder, backup } = useBudget();
const isDismissedSession = ref(false);

const reminder = computed(() => backupReminder.value);
const isVisible = computed(
  () => reminder.value.shouldRemind && !isDismissedSession.value,
);

function handleBackup() {
  backup();
  isDismissedSession.value = true;
}

function handleDismiss() {
  isDismissedSession.value = true;
}
</script>

<template>
  <aside
    v-if="isVisible"
    class="backup-reminder-banner"
    role="status"
    aria-label="Backup reminder"
  >
    <div class="reminder-content">
      <span class="reminder-icon" aria-hidden="true">💾</span>
      <div class="reminder-text">
        <strong>Protect your budget data</strong>
        <p>{{ reminder.message }} Your data is stored locally in this browser. Keep a current backup safe.</p>
      </div>
    </div>
    <div class="reminder-actions">
      <button
        type="button"
        class="primary small"
        @click="handleBackup"
      >
        Download backup
      </button>
      <button
        type="button"
        class="secondary small dismiss-btn"
        @click="handleDismiss"
        title="Remind me later"
      >
        Dismiss
      </button>
    </div>
  </aside>
</template>

<style scoped>
.backup-reminder-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  background: var(--color-bg-subtle, #f0f7f6);
  border: 1px solid var(--color-teal, #277c78);
  border-radius: var(--radius-md, 8px);
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.reminder-content {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex: 1;
  min-width: 240px;
}

.reminder-icon {
  font-size: 1.35rem;
  flex-shrink: 0;
}

.reminder-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.reminder-text strong {
  font-size: 0.875rem;
  color: var(--color-text, #1e1e1e);
}

.reminder-text p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-muted, #555555);
}

.reminder-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .backup-reminder-banner {
    flex-direction: column;
    align-items: flex-start;
  }
  .reminder-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
