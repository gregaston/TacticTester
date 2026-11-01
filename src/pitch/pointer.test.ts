import { describe, expect, it } from "vitest";
import { clientToPitch } from "./pointer";

describe("clientToPitch", () => {
  it("maps the top of the pitch to the opponent goal", () => {
    const rect = { left: 0, top: 0, width: 200, height: 400 };
    expect(clientToPitch(0, 0, rect)).toEqual({ x: 0, y: 100 });
    expect(clientToPitch(200, 400, rect)).toEqual({ x: 100, y: 0 });
    expect(clientToPitch(100, 200, rect)).toEqual({ x: 50, y: 50 });
  });
});
