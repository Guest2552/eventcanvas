/** Opens the AI co-planner from anywhere, optionally sending a prompt. */
export const ASSISTANT_EVENT = "eventcanvas:assistant";

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT, { detail: { prompt } }));
}
