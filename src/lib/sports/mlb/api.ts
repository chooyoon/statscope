const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

interface FetchOptions {
  revalidate: number;
}

async function mlbFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
  options: FetchOptions = { revalidate: 3600 }
): Promise<T> {
  const url = new URL(`${MLB_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    next: { revalidate: options.revalidate },
  });

  if (!response.ok) {
    throw new Error(
      `MLB API error: ${response.status} ${response.statusText} for ${endpoint}`
    );
  }

  return response.json() as Promise<T>;
}

// --- Standings ---

export interface StandingsResponse {
  records: StandingsRecord[];
}

export interface StandingsRecord {
  standingsType: string;
  league: { id: number; name: string };
  division: { id: number; name: string };
  teamRecords: TeamRecord[];
}

export interface TeamRecord {
  team: {
    id: number;
    name: string;
    abbreviation?: string;
    teamName?: string;
  };
  season: string;
  wins: number;
  losses: number;
  winningPercentage: string;
  gamesBack: string;
  streak: { streakCode: string };
  records: {
    splitRecords: { type: string; wins: number; losses: number }[];
  };
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
  divisionRank: string;
  leagueRecord: { wins: number; losses: number; pct: string };
}

export async function fetchStandings(
  season: number
): Promise<StandingsResponse> {
  return mlbFetch<StandingsResponse>(
    "/standings",
    {
      leagueId: "103,104",
      season,
      standingsTypes: "regularSeason",
      hydrate: "team",
    },
    { revalidate: 900 }
  );
}

// --- Teams ---

export interface TeamsResponse {
  teams: MLBTeam[];
}

export interface MLBTeam {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  league: { id: number; name: string };
  division: { id: number; name: string };
  venue: { id: number; name: string };
}

export async function fetchTeams(): Promise<TeamsResponse> {
  return mlbFetch<TeamsResponse>(
    "/teams",
    { sportId: 1 },
    { revalidate: 86400 }
  );
}

// --- Player Stats (Season) ---

export interface PlayerResponse {
  people: MLBPlayer[];
}

export interface MLBPlayer {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryNumber?: string;
  primaryPosition: { abbreviation: string; name: string };
  currentTeam?: { id: number; name: string };
  batSide?: { code: string };
  pitchHand?: { code: string };
  currentAge?: number;
  stats?: MLBStatGroup[];
}

export interface MLBStatGroup {
  type: { displayName: string };
  group: { displayName: string };
  splits: MLBStatSplit[];
}

export interface MLBStatSplit {
  season?: string;
  stat: Record<string, number | string>;
  team?: { id: number; name: string };
  player?: { id: number; fullName: string };
}

export async function fetchPlayerStats(
  playerId: number,
  season: number,
  group: "hitting" | "pitching"
): Promise<PlayerResponse> {
  return mlbFetch<PlayerResponse>(
    `/people/${playerId}`,
    {
      hydrate: `stats(group=[${group}],type=[season],season=${season})`,
    },
    { revalidate: 3600 }
  );
}

// --- Player Year-by-Year ---

export async function fetchPlayerYearByYear(
  playerId: number,
  group: "hitting" | "pitching"
): Promise<PlayerResponse> {
  return mlbFetch<PlayerResponse>(
    `/people/${playerId}`,
    {
      hydrate: `stats(group=[${group}],type=[yearByYear])`,
    },
    { revalidate: 3600 }
  );
}

// --- Player vs Team ---

export async function fetchPlayerVsTeam(
  playerId: number,
  season: number,
  group: "hitting" | "pitching"
): Promise<PlayerResponse> {
  return mlbFetch<PlayerResponse>(
    `/people/${playerId}`,
    {
      hydrate: `stats(group=[${group}],type=[vsTeam],season=${season})`,
    },
    { revalidate: 3600 }
  );
}

// --- Player vs Player Total ---

export async function fetchPlayerVsPlayerTotal(
  playerId: number,
  opposingPlayerId: number,
  group: "hitting" | "pitching"
): Promise<PlayerResponse> {
  return mlbFetch<PlayerResponse>(
    `/people/${playerId}`,
    {
      hydrate: `stats(group=[${group}],type=[vsPlayerTotal],opposingPlayerId=${opposingPlayerId})`,
    },
    { revalidate: 3600 }
  );
}

// --- Schedule ---

export interface ScheduleResponse {
  dates: ScheduleDate[];
}

export interface ScheduleDate {
  date: string;
  games: ScheduleGame[];
}

export interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
    statusCode: string;
  };
  teams: {
    home: {
      team: MLBTeam;
      score?: number;
      probablePitcher?: MLBPlayer;
      leagueRecord: { wins: number; losses: number; pct: string };
    };
    away: {
      team: MLBTeam;
      score?: number;
      probablePitcher?: MLBPlayer;
      leagueRecord: { wins: number; losses: number; pct: string };
    };
  };
  linescore?: {
    innings: {
      num: number;
      home: { runs?: number };
      away: { runs?: number };
    }[];
    currentInning?: number;
    inningHalf?: string;
  };
  venue: { id: number; name: string };
}

export async function fetchSchedule(
  date: string
): Promise<ScheduleResponse> {
  // Use shorter cache for today's games (live scores), longer for past/future
  const today = new Date().toISOString().slice(0, 10);
  const revalidate = date === today ? 30 : 900;
  return mlbFetch<ScheduleResponse>(
    "/schedule",
    {
      sportId: 1,
      date,
      hydrate: "probablePitcher,linescore,team",
      gameType: "R,S,E,F,D,L,W",
    },
    { revalidate }
  );
}

// --- Game Boxscore ---

export interface BoxscoreResponse {
  teams: {
    home: BoxscoreTeam;
    away: BoxscoreTeam;
  };
}

export interface BoxscoreTeam {
  team: MLBTeam;
  players: Record<string, BoxscorePlayer>;
  batters: number[];
  pitchers: number[];
  battingOrder: number[];
  teamStats: {
    batting: Record<string, number | string>;
    pitching: Record<string, number | string>;
    fielding: Record<string, number | string>;
  };
}

export interface BoxscorePlayer {
  person: MLBPlayer;
  jerseyNumber: string;
  position: { abbreviation: string };
  stats: {
    batting: Record<string, number | string>;
    pitching: Record<string, number | string>;
    fielding: Record<string, number | string>;
  };
}

export async function fetchGameBoxscore(
  gamePk: number
): Promise<BoxscoreResponse> {
  return mlbFetch<BoxscoreResponse>(
    `/game/${gamePk}/boxscore`,
    { hydrate: "person" },
    { revalidate: 60 }
  );
}

// --- Game Linescore ---

export interface LinescoreResponse {
  innings: {
    num: number;
    home: { runs?: number; hits?: number; errors?: number };
    away: { runs?: number; hits?: number; errors?: number };
  }[];
  teams: {
    home: { runs: number; hits: number; errors: number };
    away: { runs: number; hits: number; errors: number };
  };
  currentInning?: number;
  currentInningOrdinal?: string;
  inningHalf?: string;
}

export async function fetchGameLinescore(
  gamePk: number
): Promise<LinescoreResponse> {
  return mlbFetch<LinescoreResponse>(
    `/game/${gamePk}/linescore`,
    {},
    { revalidate: 30 }
  );
}

// --- Player Search ---

export interface PlayerSearchResponse {
  people: MLBPlayer[];
}

export async function fetchPlayerSearch(
  name: string
): Promise<PlayerSearchResponse> {
  return mlbFetch<PlayerSearchResponse>(
    "/people/search",
    {
      names: name,
      sportId: 1,
    },
    { revalidate: 86400 }
  );
}
