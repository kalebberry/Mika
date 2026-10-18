import { ref } from "vue";

export interface ToastAction {
  label: string;
  run: () => void;
}

const notice = ref("");
const toastAction = ref<ToastAction | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export function useToast() {
  function toast(message: string, action?: ToastAction) {
    notice.value = message;
    toastAction.value = action || null;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (notice.value === message) {
        notice.value = "";
        toastAction.value = null;
      }
    }, 5500);
  }

  function dismissToast() {
    notice.value = "";
    toastAction.value = null;
    if (timer) clearTimeout(timer);
  }

  function triggerAction() {
    if (toastAction.value) {
      const fn = toastAction.value.run;
      dismissToast();
      fn();
    }
  }

  return {
    notice,
    toastAction,
    toast,
    dismissToast,
    triggerAction,
  };
}

