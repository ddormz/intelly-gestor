"use client";

import { useState, type ChangeEvent } from "react";
import { Field } from "./primitives";

export const MAX_CLP_INPUT = Number.MAX_SAFE_INTEGER;

function normalizedDigits(value: string): string {
  return value.replace(/[$\s\u00a0]/g, "");
}

export function parseClpInput(value: string | number): number {
  const raw = typeof value === "number" ? String(value) : normalizedDigits(value.trim());
  if (!raw || /[^0-9.]/.test(raw) || raw.includes("-")) {
    throw new RangeError("Ingresa un monto CLP entero positivo.");
  }
  if (raw.includes(".") && !/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    throw new RangeError("Los montos CLP no aceptan decimales.");
  }
  const digits = raw.replace(/\./g, "");
  const amount = Number(digits);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_CLP_INPUT) {
    throw new RangeError("El monto CLP está fuera del rango permitido.");
  }
  return amount;
}

export function formatClpInput(value: string | number | bigint | undefined): string {
  if (value === undefined || value === "") return "";
  const amount = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(amount);
}

type MoneyInputProps = {
  name: string;
  label: string;
  defaultValue?: string | number | bigint;
  error?: string;
  required?: boolean;
};

export function MoneyInput({ name, label, defaultValue, error, required = false }: MoneyInputProps) {
  const initialValue = defaultValue === undefined ? "" : formatClpInput(defaultValue);
  const initialNormalized = defaultValue === undefined ? "" : String(Number(defaultValue));
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [normalizedValue, setNormalizedValue] = useState(initialNormalized);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (!raw.trim()) {
      setDisplayValue("");
      setNormalizedValue("");
      return;
    }
    try {
      const parsed = parseClpInput(raw);
      setDisplayValue(formatClpInput(parsed));
      setNormalizedValue(String(parsed));
    } catch {
      setDisplayValue(raw);
      setNormalizedValue("");
    }
  }

  return <Field label={label} error={error}>
    <input type="text" inputMode="numeric" value={displayValue} onChange={handleChange} className="field" aria-label={label} />
    <input type="hidden" name={name} value={normalizedValue} required={required} />
  </Field>;
}
