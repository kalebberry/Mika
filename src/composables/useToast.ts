import { ref } from "vue";

const notice = ref("");
let timer: ReturnType<typeof setTimeout> | null = null;

export function useToast() {
  function toast(message: string) {
    notice.value = message;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (notice.value === message) {
        notice.value = "";
      }
    }, 4500);
  }

  function dismissToast() {
    notice.value = "";
    if (timer) clearTimeout(timer);
  }

  return {
    notice,
    toast,
    dismissToast,
  };
}
