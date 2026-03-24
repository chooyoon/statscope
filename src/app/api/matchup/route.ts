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
      { error: "playerId와 opposingId가 필요합니다." },
      { status: 400 }
    );
  }

  const pid = parseInt(playerId, 10);
  const oid = parseInt(opposingId, 10);

  if (isNaN(pid) || isNaN(oid)) {
    return Response.json(
      { error: "유효하지 않은 선수 ID입니다." },
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
      { error: "상대 전적 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
