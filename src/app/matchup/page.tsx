import type { Metadata } from "next";
import MatchupClient from "./MatchupClient";

export const metadata: Metadata = {
  title: "선수 매치업 비교 | StatScope",
  description:
    "두 MLB 선수의 스탯과 세이버매트릭스를 나란히 비교 분석하세요.",
};

export default function MatchupPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3">
          선수 매치업 비교
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          두 선수를 검색하여 성적과 세이버매트릭스를 나란히 비교하세요.
        </p>
      </div>
      <MatchupClient />
    </div>
  );
}
