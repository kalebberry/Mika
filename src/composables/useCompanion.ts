import { ref, computed, watch } from "vue";
import { companionMessage } from "../companion.ts";
import {
  isWebGPUSupported,
  fetchInBrowserAdvice,
  DEFAULT_WEB_MODEL,
  AVAILABLE_WEB_MODELS,
  type WebLLMAdvice,
} from "../webllm.ts";
import { useBudget } from "./useBudget.ts";
import { useToast } from "./useToast.ts";

const COMPANION_KEY = "budget-companion-mika-visible";
const GREETINGS_KEY = "budget-companion-mika-greetings";
const REDUCE_ANIMATIONS_KEY = "budget-companion-mika-reduce-animations";
const WEB_MODEL_KEY = "budget-companion-webllm-model";

let savedVisibility = true;
try {
  if (typeof localStorage !== "undefined") {
    savedVisibility = localStorage.getItem(COMPANION_KEY) !== "false";
  }
} catch {}

const showCompanion = ref(savedVisibility);

watch(showCompanion, (visible) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(COMPANION_KEY, String(visible));
    }
  } catch {
    const { toast } = useToast();
    toast("Your companion preference could not be saved in this browser.");
  }
});

let savedGreetings = true;
try {
  if (typeof localStorage !== "undefined") {
    savedGreetings = localStorage.getItem(GREETINGS_KEY) !== "false";
  }
} catch {}

const enableGreetings = ref(savedGreetings);

watch(enableGreetings, (enabled) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(GREETINGS_KEY, String(enabled));
    }
  } catch {}
});

let savedReduceAnimations = false;
try {
  if (typeof localStorage !== "undefined") {
    savedReduceAnimations = localStorage.getItem(REDUCE_ANIMATIONS_KEY) === "true";
  }
} catch {}

const reduceAnimations = ref(savedReduceAnimations);

watch(reduceAnimations, (reduced) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REDUCE_ANIMATIONS_KEY, String(reduced));
    }
  } catch {}
});

let savedWebModel = DEFAULT_WEB_MODEL;
try {
  if (typeof localStorage !== "undefined") {
    savedWebModel = localStorage.getItem(WEB_MODEL_KEY) || DEFAULT_WEB_MODEL;
  }
} catch {}

const selectedWebModel = ref(savedWebModel);

watch(selectedWebModel, (m) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEB_MODEL_KEY, m);
    }
  } catch {}
});

const webGpuAvailable = ref(false);
const aiAdvice = ref<WebLLMAdvice | null>(null);
const isAiLoading = ref(false);
const aiProgressText = ref("");
const aiProgressPercent = ref(0);
const aiError = ref("");

export function useCompanion() {
  const { state } = useBudget();
  const { toast } = useToast();

  const mika = computed(() => companionMessage(state.value));
  const activeCompanion = computed(() => aiAdvice.value || mika.value);

  async function checkWebGpu() {
    try {
      webGpuAvailable.value = await isWebGPUSupported();
    } catch {
      webGpuAvailable.value = false;
    }
  }

  async function askMika() {
    if (isAiLoading.value) return;
    isAiLoading.value = true;
    aiError.value = "";
    aiProgressPercent.value = 0;
    aiProgressText.value = "Preparing Mika...";

    try {
      const hasGpu = await isWebGPUSupported();
      if (!hasGpu) {
        webGpuAvailable.value = false;
        aiError.value =
          'WebGPU is unavailable. Check that "Graphics acceleration" is enabled in browser settings, or continue with Mika’s built-in guidance.';
        toast("WebGPU is not active in this browser.");
        return;
      }
      webGpuAvailable.value = true;
      aiProgressText.value = "Loading on-device model...";
      const advice = await fetchInBrowserAdvice(
        state.value,
        selectedWebModel.value,
        (progress, text) => {
          aiProgressPercent.value = Math.round(progress * 100);
          aiProgressText.value =
            text || `Loading on-device model (${Math.round(progress * 100)}%)...`;
        },
      );
      aiAdvice.value = advice;
      toast(`Mika: Advice generated on-device (${advice.modelUsed})!`);
    } catch (err: any) {
      console.error("Mika AI Error:", err);
      aiError.value =
        err?.message ||
        "Could not generate AI advice. Mika is using standard guidance.";
      toast("Could not generate AI advice. Using standard companion guidance.");
    } finally {
      isAiLoading.value = false;
      aiProgressPercent.value = 0;
      aiProgressText.value = "";
    }
  }

  function resetToStandardAdvice() {
    aiAdvice.value = null;
    aiError.value = "";
    toast("Returned to standard companion tip.");
  }

  return {
    showCompanion,
    enableGreetings,
    reduceAnimations,
    selectedWebModel,
    webGpuAvailable,
    aiAdvice,
    isAiLoading,
    aiProgressText,
    aiProgressPercent,
    aiError,
    mika,
    activeCompanion,
    availableWebModels: AVAILABLE_WEB_MODELS,
    checkWebGpu,
    askMika,
    resetToStandardAdvice,
  };
}
