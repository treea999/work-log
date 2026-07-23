"use client";

import { useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";

type ModalSize = "sm" | "lg";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: ModalSize;
}

export default function Modal({ isOpen, onClose, title, children, size }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const widthClass = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-lg";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.32)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="bg-[var(--canvas)] rounded-[var(--radius-lg)] w-full shadow-[var(--shadow-hairline),var(--shadow-level-3)] overflow-hidden flex flex-col max-h-[85vh]"
        style={{ width: widthClass }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-[var(--hairline)] bg-[var(--canvas)] rounded-t-[var(--radius-lg)]">
          <h2 className="text-base font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-xs)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
}
