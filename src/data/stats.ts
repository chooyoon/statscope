/**
 * Korean labels for MLB stat keys.
 */
export const statLabelsKo: Record<string, string> = {
  // Hitting
  avg: '타율',
  obp: '출루율',
  slg: '장타율',
  ops: 'OPS',
  homeRuns: '홈런',
  rbi: '타점',
  runs: '득점',
  hits: '안타',
  doubles: '2루타',
  triples: '3루타',
  stolenBases: '도루',
  caughtStealing: '도루실패',
  walks: '볼넷',
  strikeOuts: '삼진',
  atBats: '타수',
  plateAppearances: '타석',
  totalBases: '루타',
  baseOnBalls: '볼넷',
  intentionalWalks: '고의사구',
  hitByPitch: '몸에 맞는 공',
  sacFlies: '희생플라이',
  sacBunts: '희생번트',
  gidp: '병살타',
  groundOuts: '땅볼아웃',
  airOuts: '뜬공아웃',
  babip: 'BABIP',
  iso: 'ISO',
  wrcPlus: 'wRC+',
  war: 'WAR',
  woba: 'wOBA',
  wraa: 'wRAA',
  offWar: '공격 WAR',
  defWar: '수비 WAR',
  gamesPlayed: '출장경기',

  // Pitching
  era: '평균자책점',
  whip: 'WHIP',
  wins: '승',
  losses: '패',
  saves: '세이브',
  holds: '홀드',
  inningsPitched: '투구이닝',
  earnedRuns: '자책점',
  strikeOutsPitching: '탈삼진',
  walksPitching: '볼넷허용',
  hitsPitching: '피안타',
  homeRunsPitching: '피홈런',
  fip: 'FIP',
  xFip: 'xFIP',
  kPer9: 'K/9',
  bbPer9: 'BB/9',
  hPer9: 'H/9',
  hrPer9: 'HR/9',
  kPerBb: 'K/BB',
  winPct: '승률',
  qualityStarts: '퀄리티스타트',
  gamesStarted: '선발경기',
  completeGames: '완투',
  shutouts: '완봉',
  blownSaves: '블론세이브',
  pitchCount: '투구수',
  strikes: '스트라이크',
  balls: '볼',
  groundBallPct: '땅볼비율',
  flyBallPct: '뜬공비율',
  warPitching: '투수 WAR',

  // Fielding
  errors: '실책',
  fieldingPct: '수비율',
  assists: '어시스트',
  putOuts: '자살',
  drs: 'DRS',
  outs: '아웃',
};

/**
 * Key hitting stats in display order.
 */
export const hittingStatKeys = [
  'avg',
  'obp',
  'slg',
  'ops',
  'homeRuns',
  'rbi',
  'runs',
  'hits',
  'stolenBases',
  'walks',
  'strikeOuts',
  'war',
  'wrcPlus',
  'woba',
  'babip',
  'iso',
] as const;

/**
 * Key pitching stats in display order.
 */
export const pitchingStatKeys = [
  'era',
  'whip',
  'fip',
  'wins',
  'losses',
  'saves',
  'holds',
  'inningsPitched',
  'strikeOutsPitching',
  'walksPitching',
  'homeRunsPitching',
  'kPer9',
  'bbPer9',
  'kPerBb',
  'winPct',
  'qualityStarts',
  'warPitching',
  'xFip',
] as const;

export type HittingStatKey = (typeof hittingStatKeys)[number];
export type PitchingStatKey = (typeof pitchingStatKeys)[number];

/**
 * Get the Korean label for a stat key, falling back to the key itself.
 */
export function getStatLabel(key: string): string {
  return statLabelsKo[key] ?? key;
}
