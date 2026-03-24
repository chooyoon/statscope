/**
 * MLB 시즌 감지 — 정규시즌 데이터 있는 연도를 반환
 * 스프링 트레이닝 기간(~3월)에는 이전 시즌으로 폴백
 */

const MLB_API = "https://statsapi.mlb.com/api/v1";

let _activeSeason: number | null = null;

export async function getActiveSeason(): Promise<number> {
  if (_activeSeason !== null) return _activeSeason;

  const currentYear = new Date().getFullYear();

  // Check if current season has started by testing a known player
  try {
    const res = await fetch(
      `${MLB_API}/people/592450?hydrate=stats(group=[hitting],type=[season],season=${currentYear})`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      const splits = data.people?.[0]?.stats?.[0]?.splits;
      if (splits && splits.length > 0 && splits[0].stat?.gamesPlayed > 0) {
        _activeSeason = currentYear;
        return currentYear;
      }
    }
  } catch {}

  // Fallback to previous season
  _activeSeason = currentYear - 1;
  return currentYear - 1;
}
