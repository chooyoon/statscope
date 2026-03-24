export interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  logo: string;
  league: string;
  division: string;
  wins: number;
  losses: number;
  winPct: number;
}

export interface Player {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryNumber?: string;
  position: string;
  team: {
    id: number;
    name: string;
  };
  bats?: string;
  throws?: string;
  age?: number;
  imageUrl?: string;
}

export interface Standing {
  team: Team;
  rank: number;
  gamesBack: string;
  streak: string;
  lastTen: string;
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
  homeRecord: string;
  awayRecord: string;
  divisionRecord: string;
}

export interface GameSummary {
  id: number;
  status: "scheduled" | "live" | "final" | "postponed" | "suspended";
  startTime: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  inning?: number;
  inningHalf?: "top" | "bottom";
  probableHomePitcher?: Player;
  probableAwayPitcher?: Player;
  linescore?: LinescoreEntry[];
  venue?: string;
}

export interface LinescoreEntry {
  inning: number;
  homeRuns: number | null;
  awayRuns: number | null;
}

export interface PlayerStats {
  playerId: number;
  season: number;
  group: "hitting" | "pitching";
  stats: Record<string, number | string>;
  advanced?: Record<string, number>;
}

export interface MatchupStats {
  playerId: number;
  opponentId: number;
  opponentType: "team" | "player";
  group: "hitting" | "pitching";
  stats: Record<string, number | string>;
  sampleSize: number;
}

export interface Prediction {
  gameId: number;
  homeWinProbability: number;
  awayWinProbability: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  confidence: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  weight: number;
  homeValue: number;
  awayValue: number;
  description: string;
}

export interface SportDataProvider {
  sport: Sport;

  getStandings(season: number): Promise<Standing[]>;
  getTeams(): Promise<Team[]>;
  getPlayerStats(
    playerId: number,
    season: number,
    group: string
  ): Promise<PlayerStats>;
  getPlayerYearByYear(
    playerId: number,
    group: string
  ): Promise<PlayerStats[]>;
  getPlayerVsTeam(
    playerId: number,
    season: number,
    group: string
  ): Promise<MatchupStats[]>;
  getPlayerVsPlayer(
    playerId: number,
    opposingPlayerId: number,
    group: string
  ): Promise<MatchupStats>;
  getSchedule(date: string): Promise<GameSummary[]>;
  getBoxscore(gameId: number): Promise<Record<string, unknown>>;
  getLinescore(gameId: number): Promise<LinescoreEntry[]>;
  searchPlayers(query: string): Promise<Player[]>;
  getPrediction(gameId: number): Promise<Prediction>;
}
