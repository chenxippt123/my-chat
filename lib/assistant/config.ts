/** Reserved login username for the bot (users cannot register this name). */
export function getAssistantUsername(): string {
  return (process.env.ASSISTANT_USERNAME ?? "assistant").trim() || "assistant";
}

export function isReservedUsername(username: string): boolean {
  return username.toLowerCase() === getAssistantUsername().toLowerCase();
}
