"use client";

import { useRef } from "react";

export function formatBillingDate(value: string) {
  if (!value) return "Select date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Select date";
  return date
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/[.,]\s*$/, "");
}

export default function DateFieldControl({
  ariaLabel,
  className = "",
  onChange,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const input = inputRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  }

  return (
    <span
      aria-label={ariaLabel}
      className={`modal-date-display-control${className ? ` ${className}` : ""}`}
      onClick={(event) => {
        if (event.target !== inputRef.current) openDatePicker();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDatePicker();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span>{formatBillingDate(value)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      </svg>
      <input
        aria-hidden="true"
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />
    </span>
  );
}
