import "./role-sheet.css";

export type RoleChoice = { id: string; name: string; summary: string };

export type RoleSheetProps = {
  positionName: string;
  roles: RoleChoice[];
  roleId: string | null;
  arrival: string | null;
  refused?: string | null;
  onRole: (id: string) => void;
};

export function RoleSheet({ positionName, roles, roleId, arrival, refused, onRole }: RoleSheetProps) {
  return (
    <section className="role-sheet" aria-label="Player role">
      <p className="kicker">Player role</p>
      <h2>{positionName}</h2>
      {refused ? <p className="role-arrival">{refused}</p> : null}
      {arrival ? <p className="role-arrival">{arrival}</p> : null}
      {roles.length === 0 ? (
        <p className="role-empty">Place a player, then choose a role.</p>
      ) : (
        <ul className="role-list">
          {roles.map((role) => (
            <li key={role.id}>
              <button type="button" aria-pressed={role.id === roleId} onClick={() => onRole(role.id)}>
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
