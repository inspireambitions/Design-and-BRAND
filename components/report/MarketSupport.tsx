"use client";

import { useMemo, useState } from "react";
import type { RoadmapReport } from "@/lib/types";
import { getUaeMarketReality, UAE_MARKET_CHECKED, UAE_MARKET_SOURCES } from "@/lib/uae-market-data";

const OFFER_ITEMS = [
  ["Basic salary", "The fixed amount before allowances or overtime"],
  ["Housing", "Allowance, staff accommodation, location and any deductions"],
  ["Transport", "Company transport, allowance or your real travel cost"],
  ["Meals", "Provided on shift, allowance, or your own cost"],
  ["Medical insurance", "Who is covered, start date and important limits"],
  ["Visa and recruitment costs", "The employer should handle legitimate recruitment expenses"],
  ["Flights", "Joining or annual ticket, eligibility and conditions"],
  ["Hours and overtime", "Normal hours, shifts, rest days and how overtime is handled"],
  ["Probation and notice", "Length, notice rules and what the contract says"],
  ["Role stability", "Contract length, employer history and why the vacancy exists"],
] as const;

type OfferStatus = "ask" | "clear" | "missing";

const BARRIER_ACTIONS: Record<string, string> = {
  "Money for training": "Begin with free interest tests and employer-supported routes. Pay only after checking recognition.",
  "Not enough time": "Protect two small weekly sessions first. Extend the timeline before cutting required practice.",
  "I do not know which career fits": "Compare this route with two alternatives through adverts and short worker conversations.",
  "I lack a required licence or certificate": "Confirm the exact official requirement and accepted provider before enrolling.",
  "My education level": "Separate legal or employer requirements from preferences, then build practical evidence for the rest.",
  "Language or confidence": "Practise the words used in real adverts and one short work example aloud each week.",
  "Transport or driving licence": "Check whether the target job truly requires driving; compare reachable employers and transport costs.",
  "Visa or work-permit limits": "Use official sources to confirm the correct work-authorisation route before accepting or paying anyone.",
  "Family responsibilities": "Choose a pace and work setting that still works during a difficult week, not only a perfect week.",
  "I am not sure": "Use the first week to identify the real constraint before buying training or leaving work.",
};

const NEXT_STATUS: Record<OfferStatus, OfferStatus> = {
  ask: "clear",
  clear: "missing",
  missing: "ask",
};

const STATUS_LABEL: Record<OfferStatus, string> = {
  ask: "Need to ask",
  clear: "Clear in offer",
  missing: "Missing or unclear",
};

export function UaeMarketRealitySection({ report }: { report: RoadmapReport }) {
  if (report.snapshot.location !== "United Arab Emirates") return null;
  const reality = getUaeMarketReality(report.snapshot.targetIndustry);

  return (
    <section aria-labelledby="uae-market-title" className="scroll-mt-28 overflow-hidden rounded-3xl border border-ink/[0.08] bg-paper-soft">
      <div className="bg-ever-night px-6 py-7 text-paper-soft sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="uae-market-title" className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">UAE market reality</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-soft/70">A dated starting point for {report.snapshot.to}. Confirm the exact role, employer and emirate before acting.</p>
          </div>
          <span className="rounded-full border border-paper-soft/15 px-3 py-1.5 text-xs font-semibold text-signal-tint">Checked {UAE_MARKET_CHECKED}</span>
        </div>
      </div>
      <div className="grid gap-px bg-ink/[0.07] md:grid-cols-3">
        <MarketFact label="Demand direction" value={reality.demandDirection} />
        <MarketFact label="Competition" value={reality.competition} />
        <MarketFact label="Confidence" value={reality.confidence} />
      </div>
      <div className="px-6 py-7 sm:px-8">
        <h3 className="font-display text-lg font-semibold text-ink">Requirements that often appear</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {reality.typicalRequirements.map((requirement) => (
            <li key={requirement} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ever-bright" aria-hidden />
              {requirement}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink/[0.07] pt-5 text-sm">
          {UAE_MARKET_SOURCES.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-ever-bright underline decoration-ever/30 underline-offset-4 hover:decoration-ever-bright">{source.label}</a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BarrierPriorityPlan({ report }: { report: RoadmapReport }) {
  const barriers = report.snapshot.careerBarriers || [];
  if (!barriers.length) return null;
  return (
    <section aria-labelledby="barrier-plan-title" className="overflow-hidden rounded-3xl border border-ink/[0.08] bg-paper-soft">
      <div className="px-6 py-6 sm:px-8">
        <h2 id="barrier-plan-title" className="font-display text-2xl font-semibold text-ink">Put the barriers in this order</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">Work on the first barrier before the next. Trying to solve money, time and paperwork at once often stops progress.</p>
      </div>
      <ol className="divide-y divide-ink/[0.07]">
        {barriers.slice(0, 3).map((barrier, index) => (
          <li key={barrier} className="grid gap-3 px-6 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-8">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ever-night font-mono text-sm font-semibold text-signal-tint">{index + 1}</span>
            <div><h3 className="font-semibold text-ink">{barrier}</h3><p className="mt-1 text-sm leading-relaxed text-ink-soft">{BARRIER_ACTIONS[barrier] || "Name the smallest action you can complete this week, then ask a trusted person to check it."}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function GccContextPlan({ report }: { report: RoadmapReport }) {
  const s = report.snapshot;
  const gcc = ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman"].includes(s.location || "");
  if (!gcc || !(s.relocationStatus || s.gccExperience || s.workAuthorizationStatus || s.industryContact)) return null;

  const actions = [
    s.relocationStatus === "planning-move" ? "Do not resign, travel or pay an agent because of an unverified promise. Check the written offer and work route first." : null,
    s.gccExperience === "none" ? "Use results from your existing work. Do not pretend to have GCC experience; show how quickly you learn local standards." : null,
    s.workAuthorizationStatus === "employer-needed" ? "Ask the employer which official work-permit process applies. Keep visa and recruitment payments out of informal conversations." : null,
    s.workAuthorizationStatus === "checking" ? "Confirm your work-authorisation situation through official government channels before accepting a start date." : null,
    s.industryContact === "no" ? "Start the seven-day referral plan below with five focused conversations." : null,
    s.industryContact === "yes-close" ? "Ask your contact to compare one current advert with your CV. Ask for truth about the requirements, not a job promise." : null,
  ].filter(Boolean) as string[];

  if (!actions.length) actions.push("Use the country-specific market, offer and safety checks in this report before making a large commitment.");

  return (
    <aside className="rounded-3xl bg-ever-night px-6 py-7 text-paper-soft sm:px-8">
      <h2 className="font-display text-2xl font-semibold">Your Gulf-market checks</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => <li key={action} className="flex items-start gap-3 text-[15px] leading-relaxed text-paper-soft/80"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-signal-tint" aria-hidden />{action}</li>)}
      </ul>
      <p className="mt-5 text-xs leading-relaxed text-paper-soft/55">These checks use only the optional situation answers you chose. Nationality and passport details are not used to judge career fit.</p>
    </aside>
  );
}

export function ApplicationDiagnostic({ report }: { report: RoadmapReport }) {
  const stage = report.snapshot.jobSearchStage;
  if (!stage) return null;

  const diagnosis = stage === "no-replies"
    ? {
        title: "Applications but few replies",
        intro: "The first problem is probably before the interview. Check targeting and proof before sending more applications.",
        checks: ["Role level matches your evidence", "CV names the job and repeated advert keywords", "Top half shows two relevant results", "A contact or recruiter has checked one application"],
      }
    : stage === "no-offers"
      ? {
          title: "Interviews but no offers",
          intro: "Your applications are opening doors. The next test is how clearly you prove results, readiness and local requirements.",
          checks: ["Practise five answers aloud", "Use one result for every claimed strength", "Ask what concern stopped the offer", "Check salary, notice and work-authorisation expectations"],
        }
      : stage === "employed"
        ? {
            title: "Already close to the target work",
            intro: "Use your access. Internal evidence, shadowing and a manager conversation may beat starting again outside.",
            checks: ["Ask what promotion evidence is missing", "Volunteer for one relevant safe task", "Record a measurable result", "Set a date for the next manager review"],
          }
        : {
            title: "Before your first application",
            intro: "Do not begin with volume. Build one clear role target, one checked CV and one useful introduction.",
            checks: ["Save 10 suitable adverts", "Mark the repeated requirements", "Prepare two proof examples", "Ask one working person to review your target"],
          };

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-ever/20 bg-signal-wash/55">
      <div className="px-6 py-5 sm:px-7">
        <h3 className="font-display text-xl font-semibold text-ink">Application diagnostic: {diagnosis.title}</h3>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{diagnosis.intro}</p>
      </div>
      <ul className="grid gap-px bg-ever/10 sm:grid-cols-2">
        {diagnosis.checks.map((check) => <li key={check} className="bg-paper-soft px-6 py-4 text-sm font-medium text-ink">{check}</li>)}
      </ul>
    </div>
  );
}

export function UaeOfferScorecard({ report }: { report: RoadmapReport }) {
  const [statuses, setStatuses] = useState<Record<string, OfferStatus>>({});
  const isUae = report.snapshot.location === "United Arab Emirates";
  const complete = useMemo(() => Object.values(statuses).filter((status) => status === "clear").length, [statuses]);
  if (!isUae) return null;

  return (
    <section aria-labelledby="offer-scorecard-title" className="overflow-hidden rounded-3xl border border-ink/[0.08] bg-paper-soft">
      <div className="flex flex-col gap-3 bg-signal-wash px-6 py-7 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <h2 id="offer-scorecard-title" className="font-display text-2xl font-semibold tracking-tight text-ink">UAE offer scorecard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">Tap each status as you read an offer. A high salary can still be a weak offer when essential costs or conditions are unclear.</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-ever-deep">{complete} of {OFFER_ITEMS.length} clear</p>
      </div>
      <ul className="divide-y divide-ink/[0.07]">
        {OFFER_ITEMS.map(([label, note]) => {
          const status = statuses[label] || "ask";
          return (
            <li key={label} className="grid gap-3 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-8">
              <div>
                <p className="font-semibold text-ink">{label}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-faint">{note}</p>
              </div>
              <button type="button" onClick={() => setStatuses((current) => ({ ...current, [label]: NEXT_STATUS[status] }))} aria-label={`${label}: ${STATUS_LABEL[status]}. Tap to change.`} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 ${status === "clear" ? "border-ever-deep bg-ever-night text-paper-soft" : status === "missing" ? "border-clay/40 bg-clay-soft/40 text-clay" : "border-ink/15 bg-paper text-ink-soft"}`}>{STATUS_LABEL[status]}</button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-ink/[0.07] px-6 py-5 text-sm leading-relaxed text-ink-faint sm:px-8">This helps you prepare questions. It is not legal advice. Verify the written offer and contract through official channels.</p>
    </section>
  );
}

export function UaeSafetyCard({ report }: { report: RoadmapReport }) {
  if (report.snapshot.location !== "United Arab Emirates") return null;
  return (
    <aside aria-labelledby="uae-safety-title" className="overflow-hidden rounded-3xl border border-clay/25 bg-paper-soft">
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:px-8">
        <div>
          <h2 id="uae-safety-title" className="font-display text-2xl font-semibold text-ink">Before you trust a UAE job offer</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">Keep these checks free for everyone. Never send passport, bank or visa details through this assessment.</p>
        </div>
        <ul className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li><strong className="text-ink">Verify the offer:</strong> a genuine private-sector offer should be checkable through MoHRE.</li>
          <li><strong className="text-ink">Do not pay recruitment fees:</strong> the official UAE guidance says the employer is responsible for recruitment expenses.</li>
          <li><strong className="text-ink">Do not work on a tourist or visit visa:</strong> confirm the proper work authorisation first.</li>
          <li><strong className="text-ink">Check the employer:</strong> confirm that the company exists and that the contract matches the offer.</li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-clay/20 bg-clay-soft/20 px-6 py-4 text-sm sm:px-8">
        <a href="https://u.ae/en/information-and-services/visa-and-emirates-id/tips-to-avoid-labour-and-visa-fraud" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-clay underline decoration-clay/30 underline-offset-4">Official fraud-safety guidance</a>
        <a href="https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/job-offers-and-work-permits-and-contracts/expatriates-employment-in-private-sector" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-clay underline decoration-clay/30 underline-offset-4">Official job-offer and contract guide</a>
      </div>
    </aside>
  );
}

function MarketFact({ label, value }: { label: string; value: string }) {
  return <div className="bg-paper-soft px-6 py-5"><p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</p><p className="mt-2 text-[15px] font-medium leading-relaxed text-ink">{value}</p></div>;
}
