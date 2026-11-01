import { PITCH_VIEW, toView } from "./view";

export function BlockGuides({ engagementY, defensiveY }: { engagementY: number; defensiveY: number }) {
  const engagement = toView({ x: 0, y: engagementY });
  const defensive = toView({ x: 0, y: defensiveY });
  return (
    <g className="block-guides" pointerEvents="none" aria-hidden="true">
      <line className="guide-engage" pointerEvents="none" x1="0" x2={PITCH_VIEW.width} y1={engagement.y} y2={engagement.y} />
      <line className="guide-defence" pointerEvents="none" x1="0" x2={PITCH_VIEW.width} y1={defensive.y} y2={defensive.y} />
    </g>
  );
}
