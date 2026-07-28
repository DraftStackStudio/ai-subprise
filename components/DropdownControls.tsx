"use client";

export type DropdownOption = {
  description?: string;
  disabled?: boolean;
  label: string;
  tag?: string;
  value: string;
};

export type DropdownControlProps = {
  ariaLabel?: string;
  className?: string;
  id: string;
  isOpen: boolean;
  onChange: (value: string) => void;
  onClose?: () => void;
  onOpenChange: (id: string | null) => void;
  options: DropdownOption[];
  placeholder?: string;
  selectedLabel?: string;
  value: string;
};

export function DropdownControl({
  ariaLabel,
  className = "",
  id,
  isOpen,
  onChange,
  onClose,
  onOpenChange,
  options,
  placeholder,
  selectedLabel,
  value,
}: DropdownControlProps) {
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedLabel ?? selectedOption?.label ?? placeholder ?? "Select";

  return (
    <div
      className={`custom-select ${isOpen ? "is-open" : ""} ${className}`}
      id={id}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onOpenChange(null);
          onClose?.();
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={selectedOption ? "custom-select-trigger" : "custom-select-trigger is-placeholder"}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(isOpen ? null : id);
        }}
        type="button"
      >
        <span className="dropdown-option-label">
          {selectedOption?.tag ? <span className={`tag-dot ${selectedOption.tag}`} /> : null}
          <span>{displayLabel}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen ? (
        <div className="custom-select-options">
          {options.map((option) => (
            <button
              className={option.value === value ? "custom-select-option is-selected" : "custom-select-option"}
              disabled={option.disabled}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                if (option.disabled) return;
                onChange(option.value);
                onOpenChange(null);
                onClose?.();
              }}
              type="button"
            >
              <span className="dropdown-option-label">
                {option.tag ? <span className={`tag-dot ${option.tag}`} /> : null}
                <span className="dropdown-option-text">
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type MultiSelectDropdownControlProps = {
  ariaLabel?: string;
  className?: string;
  compactSummary?: boolean;
  id: string;
  isOpen: boolean;
  onChange: (values: string[]) => void;
  onOpenChange: (id: string | null) => void;
  options: DropdownOption[];
  placeholder?: string;
  toggleSelection?: (currentValues: string[], toggledValue: string) => string[];
  values: string[];
};

export function MultiSelectDropdownControl({
  ariaLabel,
  className = "",
  compactSummary = false,
  id,
  isOpen,
  onChange,
  onOpenChange,
  options,
  placeholder = "Select",
  toggleSelection,
  values,
}: MultiSelectDropdownControlProps) {
  const selectedLabels = options
    .filter((option) => values.includes(option.value) && option.value)
    .map((option) => option.label);
  const displayLabel = selectedLabels.length > 0
    ? compactSummary
      ? selectedLabels[0]
      : selectedLabels.join(", ")
    : placeholder;

  return (
    <div
      className={`custom-select multi-select ${isOpen ? "is-open" : ""} ${className}`}
      id={id}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onOpenChange(null);
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={selectedLabels.length > 0 ? "custom-select-trigger" : "custom-select-trigger is-placeholder"}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(isOpen ? null : id);
        }}
        type="button"
      >
        <span>{displayLabel || placeholder}</span>
        {compactSummary && selectedLabels.length > 1 ? (
          <small className="multi-select-count-badge">+{selectedLabels.length - 1}</small>
        ) : selectedLabels.length > 0 && !compactSummary ? (
          <small>{selectedLabels.length} selected</small>
        ) : null}
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen ? (
        <div className="custom-select-options">
          {options.map((option) => {
            const isChecked = values.includes(option.value);
            return (
              <button
                className={isChecked ? "custom-select-option multi-select-option is-selected" : "custom-select-option multi-select-option"}
                disabled={option.disabled}
                key={option.value || "no-account-linked"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (option.disabled) return;

                  if (!option.value) {
                    onChange([]);
                    return;
                  }

                  onChange(toggleSelection
                    ? toggleSelection(values, option.value)
                    : isChecked
                      ? values.filter((currentValue) => currentValue !== option.value)
                      : [...values, option.value]);
                }}
                type="button"
              >
                <input checked={isChecked} readOnly type="checkbox" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
