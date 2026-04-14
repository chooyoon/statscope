/**
 * MLB Park Factors (runs, 5-year rolling average)
 *
 * A park factor of 1.00 is league average.
 * > 1.00 = hitter-friendly (more runs than average)
 * < 1.00 = pitcher-friendly (fewer runs than average)
 *
 * Mapped by home team ID since each franchise has a fixed home venue.
 * Source: publicly available multi-year park factor aggregates.
 */

export interface ParkFactor {
  factor: number;
  venue: string;
  type: "hitter" | "neutral" | "pitcher";
}

const parkFactors: Record<number, ParkFactor> = {
  // AL East
  110: { factor: 1.04, venue: "Camden Yards", type: "hitter" },           // BAL
  111: { factor: 1.08, venue: "Fenway Park", type: "hitter" },            // BOS
  147: { factor: 1.06, venue: "Yankee Stadium", type: "hitter" },         // NYY
  139: { factor: 0.95, venue: "Tropicana Field", type: "pitcher" },       // TB
  141: { factor: 1.04, venue: "Rogers Centre", type: "hitter" },          // TOR

  // AL Central
  145: { factor: 1.07, venue: "Guaranteed Rate Field", type: "hitter" },  // CWS
  114: { factor: 0.98, venue: "Progressive Field", type: "neutral" },     // CLE
  116: { factor: 0.97, venue: "Comerica Park", type: "pitcher" },         // DET
  118: { factor: 0.99, venue: "Kauffman Stadium", type: "neutral" },      // KC
  142: { factor: 1.01, venue: "Target Field", type: "neutral" },          // MIN

  // AL West
  117: { factor: 1.02, venue: "Minute Maid Park", type: "neutral" },      // HOU
  108: { factor: 0.97, venue: "Angel Stadium", type: "pitcher" },         // LAA
  133: { factor: 1.00, venue: "Sutter Health Park", type: "neutral" },    // OAK (Sacramento)
  136: { factor: 0.96, venue: "T-Mobile Park", type: "pitcher" },         // SEA
  140: { factor: 1.00, venue: "Globe Life Field", type: "neutral" },      // TEX

  // NL East
  144: { factor: 1.00, venue: "Truist Park", type: "neutral" },           // ATL
  146: { factor: 0.92, venue: "loanDepot park", type: "pitcher" },        // MIA
  121: { factor: 0.95, venue: "Citi Field", type: "pitcher" },            // NYM
  143: { factor: 1.06, venue: "Citizens Bank Park", type: "hitter" },     // PHI
  120: { factor: 1.00, venue: "Nationals Park", type: "neutral" },        // WSH

  // NL Central
  112: { factor: 1.05, venue: "Wrigley Field", type: "hitter" },          // CHC
  113: { factor: 1.10, venue: "Great American Ball Park", type: "hitter" }, // CIN
  158: { factor: 1.03, venue: "American Family Field", type: "hitter" },  // MIL
  134: { factor: 0.94, venue: "PNC Park", type: "pitcher" },              // PIT
  138: { factor: 0.98, venue: "Busch Stadium", type: "neutral" },         // STL

  // NL West
  109: { factor: 1.05, venue: "Chase Field", type: "hitter" },            // ARI
  115: { factor: 1.35, venue: "Coors Field", type: "hitter" },            // COL
  119: { factor: 0.98, venue: "Dodger Stadium", type: "neutral" },        // LAD
  135: { factor: 0.94, venue: "Petco Park", type: "pitcher" },            // SD
  137: { factor: 0.93, venue: "Oracle Park", type: "pitcher" },           // SF
};

/**
 * Get park factor for the home team's venue.
 * Returns 1.0 (neutral) if team not found.
 */
export function getParkFactor(homeTeamId: number): ParkFactor {
  return parkFactors[homeTeamId] ?? { factor: 1.0, venue: "Unknown", type: "neutral" };
}
