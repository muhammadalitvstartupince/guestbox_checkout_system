function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWholeDollars(cents: number) {
  return `$${Math.round(cents / 100)}`;
}

/** One-time reconstruction of the old headline/originalPriceCents-driven
 *  hero block as HTML, so a checkout page created before the hero editor
 *  existed opens with its current on-page look already in the editor
 *  instead of a blank field. Only used to seed the editor's default value —
 *  once the admin saves, `heroHtml` takes over and this is never read for
 *  that page again. */
export function buildLegacyHeroHtml(
  page: {
    title: string;
    headline: string | null;
    originalPriceCents: number | null;
    basePriceCents: number;
    recurringPriceCents: number | null;
    billingInterval: "monthly" | "annually" | "none";
  },
  accentColor: string,
): string {
  const headline = escapeHtml(page.headline ?? page.title);
  const parts: string[] = [
    `<h1 style="text-align:center;color:${accentColor};font-weight:bold;">${headline}</h1>`,
  ];

  if (page.originalPriceCents != null) {
    parts.push(
      `<p style="text-align:center;font-weight:bold;">Waived Setup Fee: Normally ` +
        `<span style="text-decoration:line-through;opacity:0.8;">${formatWholeDollars(page.originalPriceCents)}</span></p>`,
    );
  }

  parts.push(
    `<p style="text-align:center;color:${accentColor};font-weight:bold;">ONLY ${formatWholeDollars(page.basePriceCents)} today</p>`,
  );

  if (page.recurringPriceCents) {
    const intervalLabel = page.billingInterval === "annually" ? "YEAR" : "MONTH";
    parts.push(`<p style="text-align:center;">${formatWholeDollars(page.recurringPriceCents)} /${intervalLabel}</p>`);
  }

  return parts.join("");
}
