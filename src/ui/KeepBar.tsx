import { useEffect, useId, useRef, useState } from "react";
import "./keep-bar.css";

export type KeepBarProps = {
  status: string | null;
  onSave: () => void;
  onShare: () => void;
};

function DiskIcon() {
  return (
    <svg className="disk-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        d="M5 3h11l4 4v14H5V3z"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M8 3.5V9h8V3.5" />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M8 21v-6h8v6" />
    </svg>
  );
}

export function KeepBar({ status, onSave, onShare }: KeepBarProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="keep-menu" ref={root}>
      <button
        type="button"
        className="disk"
        aria-label="Save"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <DiskIcon />
      </button>
      {open ? (
        <div className="keep-drop" id={menuId} role="menu" aria-label="Save">
          <button type="button" role="menuitem" onClick={onSave}>
            Save
          </button>
          <button type="button" role="menuitem" onClick={onShare}>
            Copy link
          </button>
          <p className="keep-status" role="status">
            {status ?? "Save on this device, or copy a link to the tactic."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
