import { useState } from "react";
import { templatesByBackLine } from "../tactics/templates";

type TemplateBarProps = {
  activeId: string | null;
  onTemplate: (id: string) => void;
};

export function TemplateBar({ activeId, onTemplate }: TemplateBarProps) {
  const [open, setOpen] = useState(false);
  const groups = templatesByBackLine();

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
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="template-groups" id="formations">
          {groups.map((group) => (
            <section key={group.label} className="template-group" aria-label={group.label}>
              <p className="kicker">{group.label}</p>
              <div className="templates" role="group">
                {group.templates.map((template) => (
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
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
