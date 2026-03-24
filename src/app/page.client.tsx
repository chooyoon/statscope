"use client";

// 시간대 안전한 날짜 포맷 (toISOString 사용하지 않음)
function pad(n: number) { return n.toString().padStart(2, "0"); }

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateKo(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${y}년 ${m}월 ${d}일 (${weekdays[date.getDay()]})`;
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toDateStr(date);
}

function todayString(): string {
  return toDateStr(new Date());
}

export default function DateNavigator({ date }: { date: string }) {
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);
  const today = todayString();
  const isToday = date === today;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => { window.location.href = `/?date=${prevDate}`; }}
        className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label="이전 날짜"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <h2 className="min-w-[200px] text-center text-lg font-semibold text-slate-800">
        {formatDateKo(date)}
      </h2>

      <button
        onClick={() => { window.location.href = `/?date=${nextDate}`; }}
        className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label="다음 날짜"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {!isToday && (
        <button
          onClick={() => { window.location.href = "/"; }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          오늘
        </button>
      )}
    </div>
  );
}
