import { PITCH_VIEW } from "./view";

const BANDS = 8;
const LIGHT = "#2d7a4c";
const DARK = "#1a5134";

/** Broad mowing stripes, light and dark, running across the pitch. */
export function Grass() {
  const band = PITCH_VIEW.height / BANDS;
  return (
    <g className="grass" aria-hidden="true">
      {Array.from({ length: BANDS }, (_, index) => (
        <rect
          key={index}
          x="0"
          y={index * band}
          width={PITCH_VIEW.width}
          height={band + 0.08}
          fill={index % 2 === 0 ? DARK : LIGHT}
        />
      ))}
    </g>
  );
}
