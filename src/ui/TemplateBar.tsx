import { TEMPLATES } from "../tactics/templates";

type TemplateBarProps = {
  activeId: string | null;
  freePlacement: boolean;
  onTemplate: (id: string) => void;
  onFreePlacement: (free: boolean) => void;
};

export function TemplateBar({
  activeId,
  freePlacement,
  onTemplate,
  onFreePlacement,
}: TemplateBarProps) {
  return (
    <div className="toolbar">
      <div className="templates" role="group" aria-label="Formations">
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
      <label className="free">
        <input
          type="checkbox"
          checked={freePlacement}
          onChange={(event) => onFreePlacement(event.target.checked)}
        />
        Free placement
      </label>
    </div>
  );
}
