"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

export type ComboBoxOption = { value: string; label: string };

export function resolveComboBoxSelection(value: string, options: ComboBoxOption[]): string {
  return options.some((option) => option.value === value) ? value : "";
}

export function resolveComboBoxValue(displayValue: string, selectedLabel: string | undefined, selectedValue: string): string {
  return displayValue === selectedLabel ? selectedValue : "";
}

type ComboBoxProps = {
  name: string;
  label: string;
  options: ComboBoxOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export function ComboBox({ name, label, options, value, onChange, required = false }: ComboBoxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-options`;
  const selectedValue = resolveComboBoxSelection(value, options);
  const selected = options.find((option) => option.value === selectedValue);
  const [text, setText] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastValue = useRef(value);
  const lastLabel = useRef(selected?.label);

  useEffect(() => {
    if (selectedValue !== value) {
      onChange(selectedValue);
      setText(selected?.label ?? "");
    } else if (value !== lastValue.current || selected?.label !== lastLabel.current) {
      setText(selected?.label ?? "");
    }
    lastValue.current = selectedValue;
    lastLabel.current = selected?.label;
  }, [onChange, selected?.label, selectedValue, value]);

  const filtered = options.filter((option) => option.label.toLocaleLowerCase().includes(text.toLocaleLowerCase()));

  function choose(option: ComboBoxOption) {
    lastValue.current = option.value;
    lastLabel.current = option.label;
    onChange(option.value);
    setText(option.label);
    setOpen(false);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = resolveComboBoxValue(event.target.value, selected?.label, value);
    lastValue.current = nextValue;
    lastLabel.current = nextValue ? selected?.label : undefined;
    setText(event.target.value);
    setOpen(true);
    setActiveIndex(0);
    onChange(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setText(selected?.label ?? "");
    }
  }

  return <div className="combo-box relative grid gap-1.5">
    <label htmlFor={inputId} className="text-sm font-semibold text-[var(--brand-deep)]">{label}</label>
    <input
      id={inputId}
      role="combobox"
      type="text"
      value={text}
      onChange={handleChange}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onKeyDown={handleKeyDown}
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
      className="field"
      autoComplete="off"
    />
    <input type="hidden" name={name} value={selectedValue} required={required} />
    {open ? <ul id={listboxId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white p-1 shadow-lg">
      {filtered.length ? filtered.map((option, index) => <li
        id={`${listboxId}-${index}`}
        key={option.value}
        role="option"
        aria-selected={option.value === value}
        className={`cursor-pointer rounded-md px-3 py-2 text-sm ${index === activeIndex ? "bg-[var(--color-background-soft)] text-[var(--brand-navy)]" : ""}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(option)}
      >{option.label}</li>) : <li className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]">Sin resultados</li>}
    </ul> : null}
  </div>;
}
