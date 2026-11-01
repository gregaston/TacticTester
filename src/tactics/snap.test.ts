import { describe, expect, it } from "vitest";
import { chooseTemplate, createBoard, movePlayer } from "./board";
import { nearestIntersection, separate, snapPoint } from "./snap";

describe("snap", () => {
  it("pulls a nearby point onto a channel and line", () => {
    expect(nearestIntersection({ x: 50, y: 20 })).toEqual({ x: 50, y: 24 });
  });

  it("leaves a point alone when no intersection is close", () => {
    expect(nearestIntersection({ x: 3, y: 3 })).toBeNull();
    expect(snapPoint({ x: 3, y: 3 }, [], false)).toEqual({ x: 3, y: 3 });
  });

  it("pushes overlapping players apart", () => {
    const moved = separate({ x: 50, y: 24 }, [{ x: 50, y: 24 }]);
    expect(Math.hypot(moved.x - 50, moved.y - 24)).toBeGreaterThanOrEqual(7);
  });

  it("snaps a released player on the board", () => {
    const board = createBoard();
    const next = movePlayer(board, "p11", { x: 52, y: 84 });
    const player = next.players.find((item) => item.id === "p11");
    expect(player).toMatchObject({ x: 50, y: 86 });
    expect(next.templateId).toBeNull();
  });

  it("clears the selected player when a formation is chosen", () => {
    const moved = movePlayer(createBoard(), "p11", { x: 52, y: 84 });
    const next = chooseTemplate(moved, "4-3-3");
    expect(next.selectedId).toBeNull();
    expect(next.templateId).toBe("4-3-3");
  });

  it("keeps the raw point when free placement is on", () => {
    const board = { ...createBoard(), freePlacement: true };
    const next = movePlayer(board, "p11", { x: 48, y: 80 });
    const player = next.players.find((item) => item.id === "p11");
    expect(player).toMatchObject({ x: 48, y: 80 });
  });
});
