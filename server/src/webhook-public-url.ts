/**
 * Deployment-only ingress origins for inbound webhooks. They are never a board
 * URL, an auth base URL or a request-header hint: a board can stay private
 * while one public hostname forwards only webhook paths to it.
 */
function parseWebhookPublicBaseUrl(
  value: string | null | undefined,
  envName: string,
): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol === "https:" &&
      url.hostname &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    )
      return url.origin;
  } catch {
    // Never include an operator-supplied URL: it could contain credentials.
  }
  throw new Error(
    `${envName} must be an HTTPS origin without credentials, a path, query, or fragment`,
  );
}

/** Origin for native chat provider webhook callbacks. */
export function parseChatWebhookPublicBaseUrl(
  value: string | null | undefined,
): string | undefined {
  return parseWebhookPublicBaseUrl(value, "PAPERCLIP_CHAT_WEBHOOK_PUBLIC_URL");
}

/** Origin for routine webhook trigger URLs (`/api/routine-triggers/public/<id>/fire`). */
export function parseRoutineWebhookPublicBaseUrl(
  value: string | null | undefined,
): string | undefined {
  return parseWebhookPublicBaseUrl(value, "PAPERCLIP_ROUTINE_WEBHOOK_PUBLIC_URL");
}
