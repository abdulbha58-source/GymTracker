"use client";

import { ReactNode } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  stepOptions?: number[];
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  suffix?: ReactNode;
  ariaLabel?: string;
  big?: boolean;
};

export default function NumberStepper({
  value,
  onChange,
  step = 2.5,
  min = 0,
  max = 1000,
  stepOptions,
  placeholder,
  inputMode = "decimal",
  suffix,
  ariaLabel,
  big = false,
}: Props) {
  function setNumeric(next: number) {
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(min, Math.min(max, next));
    // Avoid 32.5000001 style floats
    const clean = Math.round(clamped * 100) / 100;
    onChange(String(clean));
  }
  function bump(direction: 1 | -1) {
    const cur = value === "" ? 0 : Number(value);
    const base = Number.isFinite(cur) ? cur : 0;
    setNumeric(base + step * direction);
  }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }
  const options = stepOptions && stepOptions.length > 0 ? stepOptions : [step];

  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => bump(-1)}
        className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-[#1a1a1a] text-2xl font-bold text-white hover:bg-[#222] active:bg-emerald-500/20"
        aria-label="Decrease"
      >
        −
      </button>
      <div
        className={`flex flex-1 items-center rounded-xl border border-neutral-800 bg-[#0f0f0f] focus-within:border-emerald-500 ${
          big ? "h-12" : ""
        }`}
      >
        <input
          inputMode={inputMode}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`w-full bg-transparent px-3 text-center text-lg font-semibold text-white placeholder-neutral-600 outline-none ${
            big ? "h-12" : ""
          }`}
        />
        {suffix && (
          <span className="pr-3 text-sm font-medium text-neutral-400">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-[#1a1a1a] text-2xl font-bold text-white hover:bg-[#222] active:bg-emerald-500/20"
        aria-label="Increase"
      >
        +
      </button>
      {options.length > 1 && (
        <div className="ml-1 hidden gap-1 sm:flex">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const cur = value === "" ? 0 : Number(value);
                setNumeric((Number.isFinite(cur) ? cur : 0) + opt);
              }}
              className="tap rounded-lg border border-neutral-800 bg-[#0f0f0f] px-2 text-xs text-neutral-300 hover:bg-[#1a1a1a]"
              aria-label={`Add ${opt}`}
            >
              +{opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
