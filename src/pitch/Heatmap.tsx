import { useMemo } from "react";
import { HEAT_COLS, HEAT_ROWS, heatColor } from "../tactics/heat";
import { PITCH_VIEW } from "./view";

export function Heatmap({ field }: { field: Float32Array }) {
  const href = useMemo(() => paint(field), [field]);
  if (!href) return null;
  return (
    <image
      className="heat"
      href={href}
      x="0"
      y="0"
      width={PITCH_VIEW.width}
      height={PITCH_VIEW.height}
      preserveAspectRatio="none"
    />
  );
}

function paint(field: Float32Array): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = HEAT_COLS;
  canvas.height = HEAT_ROWS;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(HEAT_COLS, HEAT_ROWS);
  const pixels = image.data;
  for (let i = 0; i < field.length; i += 1) {
    const color = heatColor(field[i]);
    const offset = i * 4;
    pixels[offset] = color.r;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.b;
    pixels[offset + 3] = color.a;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}
