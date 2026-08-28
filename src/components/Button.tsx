"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
};

const base =
  "tap inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60";

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-base",
};

const variants: Record<Variant, string> = {
  primary: "bg-emerald-500 text-black hover:bg-emerald-400",
  secondary:
    "border border-neutral-700 bg-[#1a1a1a] text-neutral-100 hover:bg-[#222]",
  danger: "bg-red-500 text-white hover:bg-red-400",
  ghost: "text-neutral-300 hover:bg-neutral-900 hover:text-white",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", full, className = "", ...rest },
  ref,
) {
  const cls = [
    base,
    sizes[size],
    variants[variant],
    full ? "w-full" : "",
    className,
  ].join(" ");
  return <button ref={ref} className={cls} {...rest} />;
});

export default Button;
