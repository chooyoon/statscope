import { type NextRequest } from "next/server";
import { fetchPlayerSearch } from "@/lib/sports/mlb/api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return Response.json({ people: [] });
  }

  try {
    const data = await fetchPlayerSearch(q.trim());
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "선수 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
