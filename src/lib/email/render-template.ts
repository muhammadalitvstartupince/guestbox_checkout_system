/** Replaces `{{token}}` placeholders with values from `vars`. Unknown tokens render as empty string. */
export function renderEmailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}
