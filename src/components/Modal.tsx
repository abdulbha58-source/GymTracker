"use client";

import { ReactNode, useEffect } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-2 pb-2 pt-4 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl border border-neutral-800 bg-[#141414] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.7 4.7a1 1 0 011.4 0L10 8.6l3.9-3.9a1 1 0 111.4 1.4L11.4 10l3.9 3.9a1 1 0 11-1.4 1.4L10 11.4l-3.9 3.9a1 1 0 11-1.4-1.4L8.6 10 4.7 6.1a1 1 0 010-1.4z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="border-t border-neutral-800 bg-[#0f0f0f] px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
