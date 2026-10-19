/**
 * Mika Expression & Artwork Resolution Module
 *
 * Provides static portrait resolution for Mika's visual-novel dialogue
 * with support for future animation spritesheets and expression states.
 */

export type MikaExpression =
  | "calm"
  | "celebrating"
  | "concerned"
  | "focused"
  | "playful"
  | "welcome";

/**
 * Authoritative dialogue portrait assets for Phase 4C.
 * Primary asset is placed at /images/mika/dialogue/calm.png
 */
export const mikaDialoguePortraits: Record<MikaExpression, string> = {
  calm: "/images/mika/dialogue/calm.png",
  celebrating: "/images/mika/dialogue/celebrating.png",
  concerned: "/images/mika/dialogue/concerned.png",
  focused: "/images/mika/dialogue/focused.png",
  playful: "/images/mika/dialogue/calm.png", // Fallback to calm until custom playful portrait is added
  welcome: "/images/mika/dialogue/calm.png",
};

/**
 * Resolves portrait path safely with graceful fallback to calm.png
 */
export function getMikaPortrait(expression?: string | null): string {
  if (!expression) return mikaDialoguePortraits.calm;
  const normalized = expression.trim().toLowerCase() as MikaExpression;
  return mikaDialoguePortraits[normalized] || mikaDialoguePortraits.calm;
}

/**
 * Architecture hook for future animations (mouth flapping, blinking, emotion shifts)
 * Static in Phase 4C MVP per scope restrictions.
 */
export interface MikaAnimationConfig {
  isAnimated: boolean;
  spriteSheet?: string;
  frameCount?: number;
  fps?: number;
}

export function getMikaAnimationConfig(_expression?: string): MikaAnimationConfig {
  return {
    isAnimated: false, // Phase 4C MVP uses static portraits only
  };
}
