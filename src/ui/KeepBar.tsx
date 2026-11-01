import "./keep-bar.css";

export type KeepBarProps = {
  status: string | null;
  onSave: () => void;
  onShare: () => void;
};

export function KeepBar({ status, onSave, onShare }: KeepBarProps) {
  return (
    <section className="keep-bar" aria-label="Keep">
      <p className="kicker">Keep</p>
      <div className="keep-actions">
        <button type="button" onClick={onSave}>
          Save
        </button>
        <button type="button" onClick={onShare}>
          Copy link
        </button>
      </div>
      {status ? (
        <p className="keep-status" role="status">
          {status}
        </p>
      ) : (
        <p className="keep-status">Save on this device, or copy a link to the tactic.</p>
      )}
    </section>
  );
}
