import { type NextRequest } from "next/server";
import { fetchPlayerVsPlayerTotal } from "@/lib/sports/mlb/api";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const opposingId = request.nextUrl.searchParams.get("opposingId");
  const group = request.nextUrl.searchParams.get("group") as
    | "hitting"
    | "pitching"
    | null;

  if (!playerId || !opposingId) {
    return Response.json(
      { error: "playerId and opposingId are required." },
      { status: 400 }
    );
  }

  const pid = parseInt(playerId, 10);
  const oid = parseInt(opposingId, 10);

  if (isNaN(pid) || isNaN(oid)) {
    return Response.json(
      { error: "Invalid player ID." },
      { status: 400 }
    );
  }

  const statGroup = group === "pitching" ? "pitching" : "hitting";

  try {
    const data = await fetchPlayerVsPlayerTotal(pid, oid, statGroup);
    const splits = data.people?.[0]?.stats?.[0]?.splits ?? [];
    const stat = splits.length > 0 ? splits[0].stat : null;

    return Response.json({
      playerId: pid,
      opposingPlayerId: oid,
      group: statGroup,
      stat,
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch head-to-head matchup data." },
      { status: 500 }
    );
  }
}
