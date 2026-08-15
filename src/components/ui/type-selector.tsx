"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

export type OptionItem = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
};

type TypeSelectorProps = {
  name: string;
  label: string;
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
};

export function TypeSelector({
  name,
  label,
  options,
  value,
  onChange,
  required = false,
  error,
}: TypeSelectorProps) {
  const id = useId();

  return (
    <div className="grid gap-2">
      <label id={`${id}-label`} className="text-sm font-semibold text-[var(--brand-deep)]">
        {label}
        {required ? <span className="ml-0.5 text-[var(--brand-royal)]">*</span> : null}
      </label>
      <input type="hidden" name={name} value={value} required={required} />
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        className={`grid gap-2 ${options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-semibold transition-all ${
                isSelected
                  ? "border-[var(--brand-royal)] bg-[rgb(27_75_224_/_0.08)] text-[var(--brand-navy)] shadow-xs ring-1 ring-[var(--brand-royal)]"
                  : "border-[var(--color-border-strong)] bg-white text-[var(--color-muted-foreground)] hover:border-[var(--brand-blue)] hover:text-[var(--brand-deep)]"
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                  isSelected
                    ? "border-[var(--brand-royal)] bg-[var(--brand-royal)] text-white"
                    : "border-[var(--color-border-strong)] bg-white"
                }`}
              >
                {isSelected ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-[var(--color-destructive)]">{error}</p> : null}
    </div>
  );
}
