/** Returns true if we should ask for a 1–5 rating this invocation */
export function shouldPromptSatisfaction(invocationCount: number, everyN: number): boolean {
  if (everyN <= 0) return false;
  return invocationCount > 0 && invocationCount % everyN === 0;
}
