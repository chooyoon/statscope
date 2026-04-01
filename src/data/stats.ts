/**
 * English labels for MLB stat keys.
 */
export const statLabels: Record<string, string> = {
  // Hitting
  avg: 'AVG',
  obp: 'OBP',
  slg: 'SLG',
  ops: 'OPS',
  homeRuns: 'HR',
  rbi: 'RBI',
  runs: 'Runs',
  hits: 'Hits',
  doubles: '2B',
  triples: '3B',
  stolenBases: 'SB',
  caughtStealing: 'CS',
  walks: 'BB',
  strikeOuts: 'SO',
  atBats: 'AB',
  plateAppearances: 'PA',
  totalBases: 'TB',
  baseOnBalls: 'BB',
  intentionalWalks: 'IBB',
  hitByPitch: 'HBP',
  sacFlies: 'SF',
  sacBunts: 'SAC',
  gidp: 'GIDP',
  groundOuts: 'GO',
  airOuts: 'AO',
  babip: 'BABIP',
  iso: 'ISO',
  wrcPlus: 'wRC+',
  war: 'WAR',
  woba: 'wOBA',
  wraa: 'wRAA',
  offWar: 'oWAR',
  defWar: 'dWAR',
  gamesPlayed: 'G',

  // Pitching
  era: 'ERA',
  whip: 'WHIP',
  wins: 'W',
  losses: 'L',
  saves: 'SV',
  holds: 'HLD',
  inningsPitched: 'IP',
  earnedRuns: 'ER',
  strikeOutsPitching: 'K',
  walksPitching: 'BB',
  hitsPitching: 'H',
  homeRunsPitching: 'HR',
  fip: 'FIP',
  xFip: 'xFIP',
  kPer9: 'K/9',
  bbPer9: 'BB/9',
  hPer9: 'H/9',
  hrPer9: 'HR/9',
  kPerBb: 'K/BB',
  winPct: 'WIN%',
  qualityStarts: 'QS',
  gamesStarted: 'GS',
  completeGames: 'CG',
  shutouts: 'SHO',
  blownSaves: 'BS',
  pitchCount: 'PC',
  strikes: 'STR',
  balls: 'B',
  groundBallPct: 'GB%',
  flyBallPct: 'FB%',
  warPitching: 'pWAR',

  // Fielding
  errors: 'E',
  fieldingPct: 'FPCT',
  assists: 'A',
  putOuts: 'PO',
  drs: 'DRS',
  outs: 'OUT',
};

/**
 * Korean labels (kept for language toggle).
 */
export const statLabelsKo: Record<string, string> = {
  avg: '타율', obp: '출루율', slg: '장타율', ops: 'OPS',
  homeRuns: '홈런', rbi: '타점', runs: '득점', hits: '안타',
  doubles: '2루타', triples: '3루타', stolenBases: '도루',
  strikeOuts: '삼진', atBats: '타수', plateAppearances: '타석',
  baseOnBalls: '볼넷', gamesPlayed: '경기',
  era: 'ERA', whip: 'WHIP', wins: '승', losses: '패',
  saves: '세이브', inningsPitched: '이닝', gamesStarted: '선발',
};

/**
 * Key hitting stats in display order.
 */
export const hittingStatKeys = [
  'avg', 'obp', 'slg', 'ops', 'homeRuns', 'rbi', 'runs', 'hits',
  'stolenBases', 'walks', 'strikeOuts', 'war', 'wrcPlus', 'woba', 'babip', 'iso',
] as const;

/**
 * Key pitching stats in display order.
 */
export const pitchingStatKeys = [
  'era', 'whip', 'fip', 'wins', 'losses', 'saves', 'holds',
  'inningsPitched', 'strikeOutsPitching', 'walksPitching', 'homeRunsPitching',
  'kPer9', 'bbPer9', 'kPerBb', 'winPct', 'qualityStarts', 'warPitching', 'xFip',
] as const;

export type HittingStatKey = (typeof hittingStatKeys)[number];
export type PitchingStatKey = (typeof pitchingStatKeys)[number];

/**
 * Get the English label for a stat key, falling back to the key itself.
 */
export function getStatLabel(key: string): string {
  return statLabels[key] ?? key;
}
