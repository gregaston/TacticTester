import { useState } from "react";
import { TEMPLATES } from "../tactics/templates";

type TemplateBarProps = {
  activeId: string | null;
  onTemplate: (id: string) => void;
};

export function TemplateBar({ activeId, onTemplate }: TemplateBarProps) {
  const [open, setOpen] = useState(false);
  const active = TEMPLATES.find((template) => template.id === activeId);

  return (
    <div className="toolbar">
      <button
        type="button"
        className="disclosure"
        aria-expanded={open}
        aria-controls="formations"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Formations</span>
        <span>{open ? "Hide" : (active?.name ?? "Custom")}</span>
      </button>
      {open ? (
        <div className="templates" id="formations" role="group" aria-label="Formations">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              aria-pressed={template.id === activeId}
              onClick={() => onTemplate(template.id)}
            >
              {template.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
