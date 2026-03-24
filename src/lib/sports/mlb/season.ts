/**
 * MLB 시즌 감지
 *
 * 우선순위:
 * 1. 현재 연도 정규시즌 데이터 있으면 → 현재 연도
 * 2. 없으면 → 전년도 (스프링 트레이닝 기간)
 *
 * 경기별 박스스코어(시범경기 포함)는 시즌 관계없이 항상 표시됨.
 * 이 함수는 "선수 시즌 누적 스탯" 조회 시 사용하는 시즌을 결정함.
 */

const MLB_API = "https://statsapi.mlb.com/api/v1";

let _activeSeason: number | null = null;

export async function getActiveSeason(): Promise<number> {
  if (_activeSeason !== null) return _activeSeason;

  const currentYear = new Date().getFullYear();

  // Check if current season has regular season data
  try {
    const res = await fetch(
      `${MLB_API}/people/592450?hydrate=stats(group=[hitting],type=[season],season=${currentYear})`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      const splits = data.people?.[0]?.stats?.[0]?.splits;
      if (splits && splits.length > 0 && (splits[0].stat?.gamesPlayed ?? 0) > 0) {
        _activeSeason = currentYear;
        return currentYear;
      }
    }
  } catch {}

  // Fallback: previous season
  _activeSeason = currentYear - 1;
  return currentYear - 1;
}

/**
 * 현재 시즌 연도 (캘린더 기준, 폴백 없음)
 * 경기 일정/스케줄 조회 등에 사용
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}
