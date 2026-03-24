import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | StatScope",
  description: "StatScope의 개인정보처리방침입니다.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-800 mb-8">개인정보처리방침</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-7">
        <p className="text-slate-500">최종 수정일: {new Date().getFullYear()}년 3월</p>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">1. 수집하는 개인정보</h2>
          <p>StatScope는 서비스 제공을 위해 최소한의 정보만을 수집합니다.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Google 로그인 시:</strong> 이름, 이메일 주소, 프로필 사진 (Google 계정에서 제공하는 공개 정보)</li>
            <li><strong>자동 수집:</strong> 방문 기록, 브라우저 종류, 접속 시간 (Google Analytics/AdSense를 통한 쿠키 기반)</li>
            <li><strong>사용자 설정:</strong> 관심 팀, 관심 선수 등 서비스 내 설정 정보</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">2. 개인정보의 이용 목적</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>맞춤형 콘텐츠 제공 (관심 팀/선수 기반)</li>
            <li>서비스 이용 통계 분석 및 개선</li>
            <li>광고 제공 (Google AdSense)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">3. 개인정보의 보관 및 파기</h2>
          <p>사용자가 계정을 삭제하거나 서비스 탈퇴를 요청할 경우, 관련 개인정보를 즉시 파기합니다. 자동 수집된 로그 데이터는 최대 1년간 보관 후 삭제합니다.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">4. 개인정보의 제3자 제공</h2>
          <p>StatScope는 사용자의 개인정보를 제3자에게 판매하거나 공유하지 않습니다. 다만, 다음의 경우 예외로 합니다.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>법령에 의해 요구되는 경우</li>
            <li>Google AdSense, Google Analytics 등 서비스 운영에 필수적인 외부 서비스 제공업체 (해당 업체의 개인정보처리방침이 별도로 적용됩니다)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">5. 쿠키(Cookie) 사용</h2>
          <p>StatScope는 사용자 경험 개선 및 광고 제공을 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 비활성화할 수 있으나, 일부 서비스 이용이 제한될 수 있습니다.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>필수 쿠키:</strong> 로그인 상태 유지</li>
            <li><strong>분석 쿠키:</strong> Google Analytics (방문 통계)</li>
            <li><strong>광고 쿠키:</strong> Google AdSense (맞춤 광고)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">6. 이용자의 권리</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>개인정보 열람, 수정, 삭제를 요청할 수 있습니다.</li>
            <li>Google 계정 연동 해제를 통해 언제든지 서비스를 탈퇴할 수 있습니다.</li>
            <li>관련 문의는 아래 연락처로 보내주세요.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">7. 데이터 출처</h2>
          <p>StatScope에서 제공하는 MLB 경기 데이터, 선수 통계, 팀 순위 등의 정보는 공개적으로 이용 가능한 MLB 데이터를 기반으로 자체 분석 및 가공하여 제공합니다. StatScope는 MLB(Major League Baseball)와 공식적인 제휴 관계가 아닙니다.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">8. 연락처</h2>
          <p>개인정보 관련 문의사항은 아래로 연락해주세요.</p>
          <p className="font-medium text-slate-700">이메일: statscope.help@gmail.com</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">9. 방침 변경</h2>
          <p>본 개인정보처리방침은 관련 법률 및 서비스 변경에 따라 수정될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.</p>
        </section>
      </div>
    </div>
  );
}
