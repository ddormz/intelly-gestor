"use client";

import { useState, type ChangeEvent } from "react";
import { Field } from "./primitives";

export const MAX_CLP_INPUT = Number.MAX_SAFE_INTEGER;

export function parseClpInput(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0 || value > MAX_CLP_INPUT) {
      throw new RangeError("El monto CLP está fuera del rango permitido.");
    }
    return Math.round(value);
  }
  const digits = String(value).replace(/\D/g, "");
  if (!digits) {
    throw new RangeError("Ingresa un monto CLP entero positivo.");
  }
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
  return `$ ${amount.toLocaleString("es-CL")}`;
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
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setDisplayValue("");
      setNormalizedValue("");
      return;
    }
    const amount = parseInt(digits, 10);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setDisplayValue("");
      setNormalizedValue("");
      return;
    }
    setDisplayValue(`$ ${amount.toLocaleString("es-CL")}`);
    setNormalizedValue(String(amount));
  }

  return <Field label={label} error={error}>
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder="$ 0"
      className="field font-semibold"
      aria-label={label}
    />
    <input type="hidden" name={name} value={normalizedValue} required={required} />
  </Field>;
}
