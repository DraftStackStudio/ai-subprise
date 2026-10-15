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

export function formatBillingMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return "Select month";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || month < 1 || month > 12) return "Select month";
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function DateFieldControl({
  ariaLabel,
  className = "",
  disabled = false,
  onClose,
  onChange,
  onOpen,
  picker = "date",
  value,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onClose?: () => void;
  onChange: (value: string) => void;
  onOpen?: () => void;
  picker?: "date" | "month";
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;

    onOpen?.();
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
      aria-disabled={disabled}
      className={`modal-date-display-control${className ? ` ${className}` : ""}`}
      onClick={openDatePicker}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDatePicker();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <span>{picker === "month" ? formatBillingMonth(value) : formatBillingDate(value)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      </svg>
      <input
        aria-hidden="true"
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        onInput={(event) => {
          onChange(event.currentTarget.value);
          onClose?.();
        }}
        ref={inputRef}
        tabIndex={-1}
        type={picker}
        value={value}
      />
    </span>
  );
}
