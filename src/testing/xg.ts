/**
 * Geometric sketch of chance quality.
 *
 * The goal is the line y = 100, centred at x = 50. Each post is 5.4 pitch
 * units off that centre (a 7.32 m goal on a 68 m pitch mapped onto 0–100).
 * Distance is the straight line from the shot to the goal centre. Angle is
 * the angle, in radians, subtended by the two posts.
 *
 * Those two measurements go through a logistic with round coefficients:
 *
 *   z = 2.2 * angle - 0.03 * distance - 2.2
 *   xG = 1 / (1 + e^(-z))
 *
 * A central shot on the six-yard line lands near the top of the range, and
 * a shot from the halfway line lands near the bottom. This is not a
 * StatsBomb model and it does not use their coefficients.
 */
const GOAL_X = 50;
const GOAL_Y = 100;
const GOAL_HALF_WIDTH = 5.4;

const ANGLE_WEIGHT = 2.2;
const DISTANCE_WEIGHT = 0.03;
const LOGIT_SHIFT = -2.2;

export function shotXg(shotX: number, shotY: number): number {
  const distance = Math.hypot(shotX - GOAL_X, shotY - GOAL_Y);
  const angle = goalAngle(shotX, shotY);
  const logit = ANGLE_WEIGHT * angle - DISTANCE_WEIGHT * distance + LOGIT_SHIFT;
  return 1 / (1 + Math.exp(-logit));
}

function goalAngle(shotX: number, shotY: number): number {
  const left = Math.atan2(GOAL_Y - shotY, GOAL_X - GOAL_HALF_WIDTH - shotX);
  const right = Math.atan2(GOAL_Y - shotY, GOAL_X + GOAL_HALF_WIDTH - shotX);
  const turn = Math.abs(left - right);
  return turn > Math.PI ? 2 * Math.PI - turn : turn;
}
