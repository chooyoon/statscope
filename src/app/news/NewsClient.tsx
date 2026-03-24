"use client";

import { useState } from "react";

interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  imageUrl: string | null;
}

const KEYWORD_MAP: [RegExp, string][] = [
  [/trade/i, "트레이드"],
  [/injur|IL|injured list|hamstring|knee|elbow|surgery|torn/i, "부상"],
  [/sign|contract|extension|deal|agree|free agent/i, "계약"],
  [/roster|option|DFA|waiv|release|call.?up/i, "로스터"],
  [/spring|camp|breakout/i, "스프링캠프"],
  [/opening day|season preview/i, "시즌 프리뷰"],
  [/prospect|minor|draft|pipeline/i, "유망주"],
  [/power rank|predict|preview/i, "분석/전망"],
  [/recap|walk.?off|comeback|shutout|no.?hit/i, "경기 결과"],
  [/MVP|award|all.?star|hall of fame|HOF/i, "수상/명예"],
];

function detectTags(title: string): string[] {
  const tags: string[] = [];
  for (const [regex, tag] of KEYWORD_MAP) {
    if (regex.test(title)) {
      tags.push(tag);
    }
  }
  return tags;
}

function generateKoreanSummary(title: string): string {
  // MLB team name mapping
  const TEAM_KO: Record<string, string> = {
    'Yankees': '양키스', 'Dodgers': '다저스', 'Mets': '메츠', 'Red Sox': '레드삭스',
    'Cubs': '컵스', 'Braves': '브레이브스', 'Astros': '애스트로스', 'Phillies': '필리스',
    'Padres': '파드리스', 'Giants': '자이언츠', 'Cardinals': '카디널스', 'Guardians': '가디언스',
    'Orioles': '오리올스', 'Twins': '트윈스', 'Rangers': '레인저스', 'Mariners': '매리너스',
    'Rays': '레이스', 'Tigers': '타이거스', 'Royals': '로열스', 'Blue Jays': '블루제이스',
    'Reds': '레즈', 'Pirates': '파이리츠', 'Brewers': '브루어스', 'Diamondbacks': '다이아몬드백스',
    'D-backs': '다이아몬드백스', 'White Sox': '화이트삭스', 'Rockies': '로키스',
    'Marlins': '말린스', 'Nationals': '내셔널스', 'Athletics': '애슬레틱스', 'Angels': '에인절스',
  };

  // Pattern-based translation of common headline structures
  const PATTERNS: [RegExp, string][] = [
    // Trades
    [/(.+?) trades? (.+?) to (.+)/i, '$1, $2를 $3로 트레이드'],
    [/(.+?) acquires? (.+?) from (.+)/i, '$1, $3에서 $2 영입'],
    [/(.+?) dealt to (.+)/i, '$1, $2로 트레이드'],
    // Signings and contracts
    [/(.+?) agrees? to (\d+)[- ]year[,]? \$?([\d.]+[MmBb]?\w*) (?:deal|contract|extension)/i, '$1, $2년 $3 계약 합의'],
    [/(.+?) agrees? to (\d+)[- ]year (?:deal|contract|extension)/i, '$1, $2년 계약 합의'],
    [/(.+?) agrees? to (.+?) deal/i, '$1, $2 계약 합의'],
    [/(.+?) agrees? to terms with (.+)/i, '$1, $2와 계약 합의'],
    [/(.+?) signs? (.+?) to (.+?) deal/i, '$1, $2와 $3 계약 체결'],
    [/(.+?) signs? (.+)/i, '$1, $2 계약 체결'],
    [/(.+?) extends? (.+?) (?:through|for) (.+)/i, '$1, $2와 $3까지 연장 계약'],
    [/(.+?) exercises? (.+?) option on (.+)/i, '$1, $3에 대한 $2 옵션 행사'],
    [/(.+?) declines? (.+?) option on (.+)/i, '$1, $3에 대한 $2 옵션 거절'],
    // Injuries
    [/(.+?) placed on (?:\d+-day )?IL/i, '$1 부상자명단(IL) 등록'],
    [/(.+?) to (?:start|open|begin) (?:season|year) on IL/i, '$1, 시즌 개막 부상자명단(IL) 등록'],
    [/(.+?) out (\d+)[- ]to[- ](\d+) (weeks?|months?)/i, '$1, $2~$3 $4 결장 전망'],
    [/(.+?) out (\d+) (weeks?|months?)/i, '$1, $2 $3 결장 전망'],
    [/(.+?) undergoes? (.+?) surgery/i, '$1, $2 수술 받아'],
    [/(.+?) suffers? (.+?) injury/i, '$1, $2 부상'],
    [/(.+?) diagnosed with (.+)/i, '$1, $2 진단'],
    [/(.+?) to miss (.+)/i, '$1, $2 결장 예정'],
    // Game results
    [/(.+?) (?:beat|defeat|top|edge|down|rout)s? (.+?)[,]? (\d+)[- ](\d+)/i, '$1, $2 상대 $3-$4 승리'],
    [/(.+?) walk.?off (.+?) (?:to beat|against|vs\.?) (.+)/i, '$1, $3 상대 끝내기 $2로 승리'],
    [/(.+?) walk[- ]off (.+)/i, '$1, 끝내기 $2'],
    [/(.+?) shut(?:s)? out (.+)/i, '$1, $2 상대 완봉승'],
    [/(.+?) no[- ]hits? (.+)/i, '$1, $2 상대 노히트노런 달성'],
    [/(.+?) (?:sweep|sweeps) (.+)/i, '$1, $2 상대 스윕 달성'],
    [/(.+?) (?:rally|rallies) (?:past|to beat) (.+)/i, '$1, 역전으로 $2 격파'],
    [/(.+?) (?:opens?|start) season with (.+)/i, '$1, $2으로 시즌 개막'],
    // Awards and records
    [/(.+?) (?:named|wins?|earns?) (.+?) (?:award|MVP)/i, '$1, $2 수상'],
    [/(.+?) (?:sets?|breaks?) (.+?) record/i, '$1, $2 기록 수립'],
    [/(.+?) elected to (.+)/i, '$1, $2 선정'],
    // Roster moves
    [/(.+?) (?:call(?:s|ed)? up|promote(?:s|d)?) (.+)/i, '$1, $2 콜업'],
    [/(.+?) options? (.+?) to (.+)/i, '$1, $2를 $3로 옵션'],
    [/(.+?) DFA(?:'?s|d)? (.+)/i, '$1, $2 지명할당(DFA)'],
    [/(.+?) releases? (.+)/i, '$1, $2 방출'],
    [/(.+?) designates? (.+?) for assignment/i, '$1, $2 지명할당(DFA)'],
    // Rankings and analysis
    [/(.+?) power rankings/i, '$1 파워랭킹'],
    [/(.+?) (?:top )?prospects? (?:rankings?|list)/i, '$1 유망주 랭킹'],
    // Miscellaneous
    [/(.+?) reportedly (.+)/i, '$1, $2 보도'],
    [/(.+?) expected to (.+)/i, '$1, $2 전망'],
    [/(.+?) likely to (.+)/i, '$1, $2 가능성'],
    [/(.+?) could (.+)/i, '$1, $2 가능성'],
  ];

  // Try each pattern
  for (const [regex, replacement] of PATTERNS) {
    if (regex.test(title)) {
      let ko = title.replace(regex, replacement);
      // Replace team names in the result (sort by length descending to match "Red Sox" before "Sox" etc.)
      const sortedTeams = Object.entries(TEAM_KO).sort((a, b) => b[0].length - a[0].length);
      for (const [en, kr] of sortedTeams) {
        ko = ko.replace(new RegExp(en, 'gi'), kr);
      }
      // Translate time units
      ko = ko.replace(/weeks?/gi, '주').replace(/months?/gi, '개월');
      return ko;
    }
  }

  // Fallback: Replace team names and common baseball terms to form a summary
  let ko = title;
  const sortedTeams = Object.entries(TEAM_KO).sort((a, b) => b[0].length - a[0].length);
  for (const [en, kr] of sortedTeams) {
    ko = ko.replace(new RegExp(en, 'gi'), kr);
  }

  // Replace common baseball terms (order matters - longer phrases first)
  const WORD_MAP: [RegExp, string][] = [
    // Multi-word phrases first
    [/\bspring training\b/gi, '스프링 트레이닝'],
    [/\bopening day\b/gi, '개막전'],
    [/\bworld series\b/gi, '월드시리즈'],
    [/\ball[- ]star\b/gi, '올스타'],
    [/\bfree agents?\b/gi, 'FA'],
    [/\bhome runs?\b/gi, '홈런'],
    [/\bgrand slam\b/gi, '그랜드슬램'],
    [/\bwalk[- ]off\b/gi, '끝내기'],
    [/\bno[- ]hit(?:ter)?\b/gi, '노히트노런'],
    [/\binjured list\b/gi, '부상자명단'],
    [/\bstarting lineup\b/gi, '선발라인업'],
    [/\bstarting pitcher\b/gi, '선발투수'],
    [/\brelief pitcher\b/gi, '구원투수'],
    [/\bbatting order\b/gi, '타순'],
    [/\bbatting average\b/gi, '타율'],
    [/\bpower rankings?\b/gi, '파워랭킹'],
    [/\btrade deadline\b/gi, '트레이드 마감'],
    [/\bminor league\b/gi, '마이너리그'],
    [/\bmajor league\b/gi, '메이저리그'],
    [/\bfarm system\b/gi, '팜 시스템'],
    [/\bbullpen\b/gi, '불펜'],
    [/\blineup\b/gi, '라인업'],
    [/\brookie\b/gi, '루키'],
    // Single words
    [/\bagreed?\b/gi, '합의'],
    [/\bsigns?\b/gi, '계약'],
    [/\bsigned\b/gi, '계약'],
    [/\btraded?\b/gi, '트레이드'],
    [/\btrades?\b/gi, '트레이드'],
    [/\binjur(?:ed|y|ies)\b/gi, '부상'],
    [/\broster\b/gi, '로스터'],
    [/\bextension\b/gi, '연장 계약'],
    [/\bshutout\b/gi, '완봉'],
    [/\bprospects?\b/gi, '유망주'],
    [/\bplayoffs?\b/gi, '포스트시즌'],
    [/\bpostseason\b/gi, '포스트시즌'],
    [/\bstrikeouts?\b/gi, '삼진'],
    [/\bpitchers?\b/gi, '투수'],
    [/\bbatters?\b/gi, '타자'],
    [/\bmanager\b/gi, '감독'],
    [/\bcoach\b/gi, '코치'],
    [/\bumpires?\b/gi, '심판'],
    [/\binning(?:s)?\b/gi, '이닝'],
    [/\bdoubleheader\b/gi, '더블헤더'],
    [/\bsweep\b/gi, '스윕'],
    [/\bcomeback\b/gi, '역전'],
    [/\brecap\b/gi, '경기 요약'],
    [/\bhighlights?\b/gi, '하이라이트'],
    [/\bscout(?:ing)?\b/gi, '스카우팅'],
    [/\bdraft\b/gi, '드래프트'],
    [/\bclutch\b/gi, '클러치'],
    [/\bslump\b/gi, '슬럼프'],
    [/\bslider\b/gi, '슬라이더'],
    [/\bfastball\b/gi, '패스트볼'],
    [/\bcurveball\b/gi, '커브볼'],
    [/\bchangeup\b/gi, '체인지업'],
    [/\bsaves?\b/gi, '세이브'],
    [/\bholds?\b/gi, '홀드'],
    [/\bDFA(?:'?d)?\b/g, '지명할당(DFA)'],
    [/\bcall(?:ed)?[- ]?up\b/gi, '콜업'],
    [/\bopt(?:ion)?(?:ed)?\b/gi, '옵션'],
    [/\bwaiv(?:er|ed)\b/gi, '웨이버'],
    [/\breleased?\b/gi, '방출'],
    [/\bacquired?\b/gi, '영입'],
    [/\bbeat\b/gi, '승리'],
    [/\bdefeated?\b/gi, '격파'],
    [/\bwins?\b/gi, '승'],
    [/\bloss(?:es)?\b/gi, '패'],
    [/\bvictory\b/gi, '승리'],
    [/\bweeks?\b/gi, '주'],
    [/\bmonths?\b/gi, '개월'],
    [/\bseason\b/gi, '시즌'],
    [/\bseries\b/gi, '시리즈'],
    [/\bgame\b/gi, '경기'],
    [/\bteam\b/gi, '팀'],
    [/\bplayer\b/gi, '선수'],
    [/\bstar\b/gi, '스타'],
    [/\bveteran\b/gi, '베테랑'],
    [/\bcaptain\b/gi, '주장'],
  ];
  for (const [regex, kr] of WORD_MAP) {
    ko = ko.replace(regex, kr);
  }

  return ko;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function NewsClient({ articles }: { articles: NewsArticle[] }) {
  const [koreanMode, setKoreanMode] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setKoreanMode((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm border"
          style={
            koreanMode
              ? {
                  backgroundColor: "#1e40af",
                  color: "#fff",
                  borderColor: "#1e40af",
                }
              : {
                  backgroundColor: "#fff",
                  color: "#475569",
                  borderColor: "#e2e8f0",
                }
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {koreanMode ? "영어 원문" : "한국어 번역"}
        </button>
      </div>

      {/* Articles Grid */}
      {articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, idx) => {
            const tags = koreanMode ? detectTags(article.title) : [];
            const koreanSummary = koreanMode ? generateKoreanSummary(article.title) : "";
            return (
              <a
                key={idx}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all"
              >
                {article.imageUrl && (
                  <div className="relative w-full h-48 overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors mb-1 leading-snug">
                    {koreanMode && koreanSummary && koreanSummary !== article.title ? koreanSummary : article.title}
                  </h3>

                  {/* Korean keyword tags */}
                  {koreanMode && tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Korean mode: show "no tag" fallback */}
                  {koreanMode && tags.length === 0 && (
                    <div className="mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                        MLB 소식
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {article.author && (
                      <>
                        <span className="truncate max-w-[140px]">
                          {article.author}
                        </span>
                        <span className="text-slate-400">·</span>
                      </>
                    )}
                    {article.pubDate && <span>{timeAgo(article.pubDate)}</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-500 text-lg mb-2">
            뉴스를 불러올 수 없습니다.
          </p>
          <p className="text-slate-400 text-sm">
            잠시 후 다시 시도해 주세요.
          </p>
        </div>
      )}
    </>
  );
}
