import Link from "next/link";

function UserSearchIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-3.3 2.7-5.5 6-5.5 1 0 1.9.2 2.7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="m21 20-1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c.5 4.5 3 7 7.5 7.5C15 10 12.5 12.5 12 17c-.5-4.5-3-7-7.5-7.5C9 9 11.5 6.5 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StepDots() {
  const steps = [
    { n: 1, label: "자기 진단", active: true },
    { n: 2, label: "친구에게 부탁", active: false },
    { n: 3, label: "친구 결과 공개", active: false },
  ];

  return (
    <div className="mb-7 flex items-center gap-1.5">
      {steps.map((step, index) => (
        <div key={step.n} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm font-bold"
              style={
                step.active
                  ? { background: "#2A3A5C", color: "#fff" }
                  : { background: "#E0DAC9", color: "#9A9585" }
              }
            >
              {step.n}
            </div>
            <span
              className="whitespace-nowrap text-[9px] font-bold"
              style={{ color: step.active ? "#2A3A5C" : "#9A9585" }}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="h-0.5 w-6" style={{ background: "#C3BCA6" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function KoreanTakoEntryPage() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-7 text-center"
      style={{ background: "#FBF8F0" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "#2A3A5C",
          color: "#F3EFE0",
          boxShadow: "0 6px 18px rgba(42,58,92,0.28)",
        }}
      >
        <UserSearchIcon />
      </div>

      <h1 className="mb-1.5 mt-[18px] text-lg font-bold leading-relaxed text-[#2A3A5C]">
        먼저 나를 알아보는 것부터
      </h1>
      <p className="mb-1 text-[12.5px] leading-[1.9] text-[#6B6858]">
        친구들이 보는 내 모습을 알아보려면
        <br />
        먼저 자기 진단이 필요해요.
      </p>
      <p className="mb-6 text-[12.5px] leading-[1.9] text-[#6B6858]">
        나의 사용설명서가 완성되면
        <br />
        친구에게 진단을 부탁할 수 있어요.
      </p>

      <StepDots />

      <Link
        href="/ko/diagnosis"
        className="flex w-full max-w-[360px] items-center justify-center gap-2 rounded-3xl py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: "#2A3A5C" }}
      >
        <SparklesIcon />
        자기 진단 시작하기
      </Link>
      <p className="mt-3 text-[10.5px] text-[#9A9585]">
        약 3분 · 50문항
      </p>
    </main>
  );
}
