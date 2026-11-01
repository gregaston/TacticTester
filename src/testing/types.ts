export type TestSetup = {
  passLength: number; // yards
  passRisk: number; // 0-1
  width: number; // 0-100 pitch, average distance from the centre
  pressHeight: number; // 0-100, higher is closer to the opponent goal
  shotVolume: number; // relative, about 1
  shotX: number; // 0-100, 50 is central
  shotY: number; // 0-100, 100 is the opponent goal line
};

export type StyleFingerprint = {
  id: string;
  team: string;
  season: string;
  passLength: number;
  xgPerShot: number;
  shotsPerMatch: number;
  ppda: number;
  pressHeight: number;
};

export type TestReport = {
  passLength: number;
  xgPerShot: number;
  shotsPerMatch: number;
  pressHeight: number;
  nearestId: string | null;
  lines: string[];
};
