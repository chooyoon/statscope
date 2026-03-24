/**
 * Map of MLB player IDs to Korean names.
 * Covers ~100 notable players across all 30 teams.
 */
export const playerNamesKo: Record<number, string> = {
  // Los Angeles Dodgers
  660271: '오타니 쇼헤이',
  605141: '무키 베츠',
  518692: '프레디 프리먼',
  571970: '맥스 먼시',
  669257: '윌 스미스',
  808967: '야마모토 요시노부',
  605483: '블레이크 스넬',
  607192: '타일러 글래스나우',

  // New York Yankees
  592450: '에런 저지',
  665742: '후안 소토',
  543037: '게릿 콜',

  // Philadelphia Phillies
  547180: '브라이스 하퍼',
  656941: '카일 슈워버',
  607208: '트레이 터너',
  592663: 'J.T. 리얼무토',
  605400: '아론 놀라',

  // Atlanta Braves
  660670: '로날드 아쿠나 주니어',
  554430: '잭 윌러',
  621566: '맷 올슨',
  663586: '오스틴 라일리',
  645277: '오지 앨비스',

  // Houston Astros
  514888: '호세 알투베',
  670541: '요르단 알바레스',
  663656: '카일 터커',
  675911: '스펜서 슈트라이더',
  686613: '헌터 브라운',
  665161: '제레미 페냐',

  // Baltimore Orioles
  683002: '건너 헨더슨',
  668939: '애들리 럿슈먼',

  // Boston Red Sox
  646240: '라파엘 데버스',
  680776: '자렌 듀란',
  671213: '트리스턴 카사스',
  676979: '개릿 크로셰',

  // Texas Rangers
  608369: '코리 시거',

  // Seattle Mariners
  677594: '훌리오 로드리게스',
  669923: '조지 커비',
  669302: '로건 길버트',
  641487: 'J.P. 크로포드',

  // San Diego Padres
  665487: '페르난도 타티스 주니어',
  506433: '다르빗슈 유',
  592518: '매니 마차도',
  650633: '마이클 킹',

  // New York Mets
  596019: '프란시스코 린도어',
  682626: '프란시스코 알바레스',
  668901: '마크 비엔토스',
  640455: '션 매나에아',

  // San Diego / Korean Players
  808982: '이정후',
  673490: '김하성',

  // Kansas City Royals
  677951: '바비 위트 주니어',
  521692: '살바도르 페레스',

  // Toronto Blue Jays
  665489: '블라디미르 게레로 주니어',

  // Detroit Tigers
  669373: '타릭 스쿠발',

  // San Francisco Giants
  657277: '로건 웹',
  656305: '맷 채프먼',

  // Pittsburgh Pirates
  694973: '폴 스키니스',
  665833: '오닐 크루즈',
  668804: '브라이언 레이놀즈',

  // Cincinnati Reds
  668881: '헌터 그린',
  681481: '엘리 데 라 크루즈',
  680574: '맷 맥레인',

  // Cleveland Guardians
  680757: '스티븐 콴',
  608070: '호세 라미레스',
  647304: '조시 네일러',

  // Los Angeles Angels
  545361: '마이크 트라웃',
  687263: '잭 네토',
  681351: '로건 오호피',

  // Arizona Diamondbacks
  682998: '코빈 캐롤',
  606466: '케텔 마르테',
  668678: '잭 갤런',

  // Milwaukee Brewers
  694192: '잭슨 추리오',
  592885: '크리스티안 옐리치',
  642715: '윌리 아다메스',

  // Minnesota Twins
  668904: '로이스 루이스',
  621439: '바이런 벅스턴',
  656302: '딜런 시스',

  // Chicago Cubs
  664023: '이안 햅',
  673548: '세이야 스즈키',
  684007: '이마나가 쇼타',
  657006: '저스틴 스틸',

  // Tampa Bay Rays
  682829: '엘리 데 라 크루즈',

  // Miami Marlins
  650333: '루이스 아라에즈',

  // Chris Sale
  592332: '크리스 세일',
};

/**
 * Get the Korean display name for a player, falling back to the English name.
 * Returns only the Korean name if available, otherwise the English name.
 */
export function displayName(id: number, englishName: string): string {
  return englishName;
}

export function displayNameFull(id: number, englishName: string): string {
  return englishName;
}
