import type { HeatBlob } from "../tactics/heat";
import { PITCH_VIEW, toView } from "./view";

export function Heatmap({ blobs }: { blobs: HeatBlob[] }) {
  return (
    <g className="heat" aria-hidden="true">
      <defs>
        <radialGradient id="pitch-heat" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe7a3" stopOpacity="1" />
          <stop offset="42%" stopColor="#f2b436" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#e39b2b" stopOpacity="0" />
        </radialGradient>
      </defs>
      {blobs.map((blob, index) => {
        const { x, y } = toView(blob);
        const radius = (blob.r / 100) * PITCH_VIEW.width;
        return (
          <circle
            key={`${index}-${blob.x.toFixed(2)}-${blob.y.toFixed(2)}`}
            cx={x}
            cy={y}
            r={radius}
            fill="url(#pitch-heat)"
            opacity={blob.opacity}
          />
        );
      })}
    </g>
  );
}
