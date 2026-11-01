import { PITCH_VIEW } from "./view";

export function Markings() {
  const { width, height } = PITCH_VIEW;
  const penaltyX = (width - 40.32) / 2;
  const sixX = (width - 18.32) / 2;
  return (
    <g className="markings">
      <rect x="0" y="0" width={width} height={height} />
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} />
      <circle cx={width / 2} cy={height / 2} r="9.15" />
      <circle cx={width / 2} cy={height / 2} r="0.4" />
      <rect x={penaltyX} y="0" width="40.32" height="16.5" />
      <rect x={penaltyX} y={height - 16.5} width="40.32" height="16.5" />
      <rect x={sixX} y="0" width="18.32" height="5.5" />
      <rect x={sixX} y={height - 5.5} width="18.32" height="5.5" />
      <circle cx={width / 2} cy="11" r="0.4" />
      <circle cx={width / 2} cy={height - 11} r="0.4" />
    </g>
  );
}
