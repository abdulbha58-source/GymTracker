"use client";

import {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  suffix?: ReactNode;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, suffix, error, className = "", ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </span>
      )}
      <div
        className={`flex items-center rounded-xl border bg-[#0f0f0f] focus-within:border-emerald-500 ${
          error ? "border-red-500" : "border-neutral-800"
        }`}
      >
        <input
          ref={ref}
          className={`w-full bg-transparent px-3.5 py-3 text-base text-white placeholder-neutral-600 outline-none ${className}`}
          {...rest}
        />
        {suffix && (
          <span className="pr-3 text-sm font-medium text-neutral-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && (
        <span className="mt-1 block text-xs text-neutral-500">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      )}
    </label>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, className = "", ...rest }, ref) {
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-400">
            {label}
          </span>
        )}
        <textarea
          ref={ref}
          className={`w-full rounded-xl border border-neutral-800 bg-[#0f0f0f] px-3.5 py-3 text-base text-white placeholder-neutral-600 outline-none focus:border-emerald-500 ${className}`}
          rows={3}
          {...rest}
        />
      </label>
    );
  },
);
