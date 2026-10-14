"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

/** Pairs a RichTextEditor with an optional mobile-only variant, toggled by
 *  a checkbox — the mobile editor only mounts (and only submits its field)
 *  when the admin opts in, so leaving it off cleanly falls back to reusing
 *  the main content on mobile too. */
export function ResponsiveRichTextEditor({
  name,
  mobileName,
  label,
  defaultValue,
  mobileDefaultValue,
  errors,
}: {
  name: string;
  mobileName: string;
  label: string;
  defaultValue?: string;
  mobileDefaultValue?: string;
  errors?: string[];
}) {
  const [customizeMobile, setCustomizeMobile] = useState(!!mobileDefaultValue);

  return (
    <div className="space-y-3">
      <RichTextEditor name={name} label={label} defaultValue={defaultValue} errors={errors} />

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={customizeMobile}
          onChange={(e) => setCustomizeMobile(e.target.checked)}
        />
        Arrange differently on mobile (optional)
      </label>

      {customizeMobile && (
        <RichTextEditor name={mobileName} label={`${label} — Mobile`} defaultValue={mobileDefaultValue} />
      )}
    </div>
  );
}
