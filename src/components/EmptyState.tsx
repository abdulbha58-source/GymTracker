import { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-[#111] px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-emerald-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-neutral-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
