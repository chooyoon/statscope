import { type NextRequest } from "next/server";

const KEYWORD_MAP: [RegExp, string][] = [
  [/trade/i, "트레이드"],
  [/injur|IL|injured list|hamstring|knee|elbow|surgery|torn/i, "부상 소식"],
  [/sign|contract|extension|deal|agree|free agent/i, "계약 관련"],
  [/roster|option|DFA|waiv|release|call.?up/i, "로스터 변동"],
  [/spring|camp|breakout/i, "스프링캠프"],
  [/opening day|season preview/i, "시즌 프리뷰"],
  [/prospect|minor|draft|pipeline/i, "유망주 소식"],
  [/power rank|predict|preview/i, "분석/전망"],
  [/recap|walk.?off|comeback|shutout|no.?hit/i, "경기 결과"],
  [/MVP|award|all.?star|hall of fame|HOF/i, "수상/명예"],
];

function translateTitle(title: string): { tags: string[]; summary: string } {
  const tags: string[] = [];
  for (const [regex, tag] of KEYWORD_MAP) {
    if (regex.test(title)) {
      tags.push(tag);
    }
  }

  const summary = tags.length > 0
    ? tags.join(", ")
    : "MLB 소식";

  return { tags, summary };
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");

  if (!title) {
    return Response.json(
      { error: "title 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const result = translateTitle(title);

  return Response.json({
    original: title,
    tags: result.tags,
    summary: result.summary,
  });
}
