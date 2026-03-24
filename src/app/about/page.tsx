import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "StatScope 소개 | MLB 심층 분석 플랫폼",
  description: "StatScope는 세이버매트릭스 기반 MLB 심층 분석 플랫폼입니다.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-3">
          <span className="text-blue-600">Stat</span>
          <span className="text-slate-800">Scope</span>
        </h1>
        <p className="text-lg text-slate-600">데이터로 야구를 읽다</p>
      </div>

      <div className="space-y-10 text-sm text-slate-600 leading-7">
        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">StatScope는?</h2>
          <p className="mb-3">
            StatScope는 <strong>세이버매트릭스 기반 MLB 심층 분석 플랫폼</strong>입니다.
            단순한 스코어보드를 넘어, 선발투수 매치업 분석, 팀 전력 비교,
            승률 예측 모델, 선수 폼 지수 등 데이터에 기반한 전문적인 야구 분석을 제공합니다.
          </p>
          <p>
            기존에 영어권에서만 접할 수 있었던 고급 야구 분석을
            한국어로 쉽고 직관적으로 제공하는 것이 StatScope의 목표입니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">주요 기능</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "실시간 경기 정보", desc: "오늘의 MLB 경기 일정, 실시간 스코어, 선발 투수 정보" },
              { title: "경기 심층 분석", desc: "양팀 로스터 세이버매트릭스 비교, 선발투수 매치업, AI 분석" },
              { title: "승률 예측 모델", desc: "선발 ERA/WHIP, 팀 최근 폼, 홈 어드밴티지 기반 자체 예측" },
              { title: "선수 상대 전적", desc: "투수-타자 간 통산 상대 전적, 강점/약점 자동 분석" },
              { title: "팀 순위", desc: "아메리칸리그/내셔널리그 6개 디비전 실시간 순위" },
              { title: "불펜 전력 분석", desc: "양팀 구원투수 ERA, 삼진률, 마무리/셋업 역할 분석" },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <h3 className="text-sm font-bold text-blue-600 mb-1">{title}</h3>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">분석 지표</h2>
          <p className="mb-4">StatScope에서 사용하는 주요 세이버매트릭스 지표:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "wOBA", desc: "가중 출루율" },
              { key: "wRC+", desc: "가중 득점 생산+" },
              { key: "FIP", desc: "수비 무관 평균자책점" },
              { key: "BABIP", desc: "인플레이 타율" },
              { key: "ISO", desc: "순수 장타력" },
              { key: "K% / BB%", desc: "삼진율 / 볼넷율" },
            ].map(({ key, desc }) => (
              <div key={key} className="text-center rounded-lg bg-blue-50 border border-blue-100 px-3 py-3">
                <p className="text-sm font-bold text-blue-700">{key}</p>
                <p className="text-[11px] text-blue-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">데이터 업데이트</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-slate-500">항목</th>
                  <th className="text-center py-2 text-slate-500">갱신 주기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["경기 일정 / 스코어", "2분"],
                  ["팀 순위", "15분"],
                  ["선수 시즌 스탯", "1시간"],
                  ["1군 로스터 (부상/콜업)", "1시간"],
                  ["뉴스", "30분"],
                ].map(([item, cycle]) => (
                  <tr key={item}>
                    <td className="py-2 text-slate-700 font-medium">{item}</td>
                    <td className="py-2 text-center text-slate-500">{cycle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-4">문의</h2>
          <p className="mb-2">서비스 관련 문의, 피드백, 제휴 제안은 아래로 연락해주세요.</p>
          <p className="font-medium text-blue-600">statscope.help@gmail.com</p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              개인정보처리방침
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
