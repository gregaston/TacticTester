import raw from "./shape-library.json";
import type { ShapeLibrary } from "../compare/types";

export function loadShapeLibrary(): ShapeLibrary {
  return raw as ShapeLibrary;
}
