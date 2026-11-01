import "./role-sheet.css";

export type RoleChoice = { id: string; name: string; summary: string };
export type DutyChoice = "defend" | "support" | "attack";

export type RoleSheetProps = {
  positionName: string;
  roles: RoleChoice[];
  roleId: string | null;
  duty: DutyChoice;
  arrival: string | null;
  onRole: (id: string) => void;
  onDuty: (duty: DutyChoice) => void;
};

const DUTIES: { value: DutyChoice; label: string }[] = [
  { value: "defend", label: "Defend" },
  { value: "support", label: "Support" },
  { value: "attack", label: "Attack" },
];

export function RoleSheet({
  positionName,
  roles,
  roleId,
  duty,
  arrival,
  onRole,
  onDuty,
}: RoleSheetProps) {
  return (
    <section className="role-sheet" aria-label="Player role">
      <p className="kicker">Player role</p>
      <h2>{positionName}</h2>
      {arrival ? <p className="role-arrival">{arrival}</p> : null}
      <div className="role-duties" role="group" aria-label="Duty">
        {DUTIES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={duty === item.value}
            onClick={() => onDuty(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {roles.length === 0 ? (
        <p className="role-empty">Place a player, then choose a role.</p>
      ) : (
        <ul className="role-list">
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                aria-pressed={role.id === roleId}
                onClick={() => onRole(role.id)}
              >
                <span className="role-name">{role.name}</span>
                <span className="role-summary">{role.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
