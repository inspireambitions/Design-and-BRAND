"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CURRENT_ROLE_SUGGESTIONS,
  getTargetRolesForIndustry,
  INDUSTRY_OPTIONS,
  INDUSTRY_SKILLS,
} from "@/lib/industry-data";
import { store } from "@/lib/storage";
import type { Profile } from "@/lib/types";
import { apiUrl } from "@/lib/api";

const COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman",
  "Uganda", "Kenya", "India", "Pakistan", "Philippines", "United Kingdom",
  "United States", "Canada", "Australia", "Germany", "Other / not listed",
];

const GCC_COUNTRIES = new Set([
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman",
]);

const HOSPITALITY_LANGUAGES = [
  "English", "Arabic", "Hindi or Urdu", "Tagalog", "French", "Russian", "Mandarin", "Another language",
];

const CORE_SKILLS = [
  "Helping customers", "Working safely", "Using tools or equipment", "Checking details",
  "Working with a team", "Explaining information", "Using phones or computers",
  "Selling or persuading", "Making or repairing things", "Planning work",
  "Keeping records", "Training another person", "Solving problems", "I am not sure yet",
];

// Plain-language versions of skills that are rising across job families. These
// are offered as evidence prompts, not used as a labour-market score.
const FUTURE_READY_SKILLS = [
  "Using AI tools for everyday work",
  "Writing clear instructions for AI",
  "Checking AI answers for mistakes",
  "Protecting private information when using AI",
  "Working with data or spreadsheets",
  "Cyber safety",
  "Learning new tools quickly",
  "Adapting when work changes",
  "Creative thinking",
  "Leading or guiding others",
];

const MOTIVATIONS = [
  { id: "money", label: "Earn more money" },
  { id: "growth", label: "Get promoted or take more responsibility" },
  { id: "stability", label: "Find more stable work" },
  { id: "interest", label: "Do work that interests me" },
  { id: "meaning", label: "Help people or do useful work" },
  { id: "business", label: "Build skills for my own business later" },
  { id: "flexibility", label: "Have more choice over where or when I work" },
  { id: "health", label: "Move away from work I cannot sustain" },
];

const BARRIERS = [
  "Money for training", "Not enough time", "I do not know which career fits",
  "I lack a required licence or certificate", "My education level",
  "Language or confidence", "Transport or driving licence", "Visa or work-permit limits",
  "Family responsibilities", "Something else", "I am not sure",
];

const TOTAL_STEPS = 8;

const empty: Profile = {
  mode: "general",
  directionMode: undefined,
  industry: "",
  currentIndustry: "",
  targetIndustry: "",
  currentRole: "",
  targetRole: "",
  yearsExperience: "",
  existingSkills: [],
  hoursPerWeek: 0,
  timelineMonths: 0,
  budget: "",
  workStyle: "",
  motivations: [],
  location: "",
  targetCountry: "",
  careerBarrier: "",
  careerBarriers: [],
  otherBarrier: "",
  educationLevel: "",
  supportAvailable: "",
  languages: [],
  certificationsHeld: [],
  relocationStatus: "",
  gccExperience: "",
  workAuthorizationStatus: "",
  industryContact: "",
  jobSearchStage: "",
  customerFacingExperience: "",
};

export function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(empty);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customLanguage, setCustomLanguage] = useState("");
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const industry = params.get("industry") ?? "";
    const startFresh = params.get("fresh") === "1";
    const saved = store.loadProfile();
    const hasDeepLink = Boolean(from || to || industry);
    const isHospitality = industry.toLowerCase() === "hospitality";

    if (startFresh) {
      store.clear();
      // `fresh=1` is a one-time instruction. Leaving it in browser history
      // lets a back gesture clear a completed roadmap and reopen question one.
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    if (saved && !startFresh && !hasDeepLink) {
      setSavedProfile(saved);
      setHydrated(true);
      return;
    }

    setP((prev) => ({
      ...prev,
      existingSkills: prev.existingSkills,
      motivations: prev.motivations,
      careerBarriers: prev.careerBarriers,
      languages: prev.languages,
      ...(industry ? {
        industry,
        currentIndustry: industry,
        targetIndustry: industry,
        mode: isHospitality ? "hospitality" as const : "general" as const,
      } : {}),
      ...(from ? { currentRole: from } : {}),
      ...(to ? { targetRole: to, directionMode: "known" as const } : {}),
    }));
    setHydrated(true);
  }, [params]);

  function usePreviousAnswers() {
    if (!savedProfile) return;
    setP({
      ...empty,
      ...savedProfile,
      existingSkills: savedProfile.existingSkills?.slice(0, 5) ?? [],
      motivations: savedProfile.motivations?.slice(0, 3) ?? [],
      careerBarriers: (savedProfile.careerBarriers?.length
        ? savedProfile.careerBarriers
        : savedProfile.careerBarrier ? [savedProfile.careerBarrier] : []).slice(0, 3),
      languages: savedProfile.languages?.slice(0, 4) ?? [],
    });
    setSavedProfile(null);
  }

  function startWithBlankAnswers() {
    store.clear();
    setP(empty);
    setStep(0);
    setSavedProfile(null);
  }

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const toggle = (key: "existingSkills" | "motivations", value: string) => {
    const limit = key === "existingSkills" ? 5 : 3;
    setP((prev) => {
      const selected = prev[key];
      if (selected.includes(value)) {
        return { ...prev, [key]: selected.filter((item) => item !== value) };
      }
      if (key === "existingSkills" && value === "I am not sure yet") {
        return { ...prev, existingSkills: [value] };
      }
      const withoutUnsure = key === "existingSkills"
        ? selected.filter((item) => item !== "I am not sure yet")
        : selected;
      if (withoutUnsure.length >= limit) return prev;
      return { ...prev, [key]: [...withoutUnsure, value] };
    });
  };

  const toggleLimited = (key: "careerBarriers" | "languages", value: string, limit: number) => {
    setP((prev) => {
      const selected = prev[key] ?? [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : selected.length < limit ? [...selected, value] : selected;
      return {
        ...prev,
        [key]: next,
        ...(key === "careerBarriers" ? { careerBarrier: next[0] || "" } : {}),
      };
    });
  };

  const targetCountry = p.targetCountry === "Other / not listed" ? customCountry.trim() : p.targetCountry?.trim();
  const activeIndustry = p.targetIndustry || p.currentIndustry || p.industry || "other";
  const isGccTarget = GCC_COUNTRIES.has(targetCountry || "");
  const isHospitality = activeIndustry === "hospitality" || p.currentIndustry === "hospitality";
  const currentSuggestions = CURRENT_ROLE_SUGGESTIONS[p.currentIndustry || "other"] ?? CURRENT_ROLE_SUGGESTIONS.other;
  const targetSuggestions = getTargetRolesForIndustry(activeIndustry);
  const practicalSkillOptions = [...new Set([
    ...(INDUSTRY_SKILLS[p.currentIndustry || ""] ?? []),
    ...CORE_SKILLS,
    ...p.existingSkills,
  ])].filter((skill) => !FUTURE_READY_SKILLS.includes(skill));
  const futureReadySkillOptions = [...new Set([
    ...FUTURE_READY_SKILLS,
    ...p.existingSkills.filter((skill) => FUTURE_READY_SKILLS.includes(skill)),
  ])];
  const suggestedTargetRole = targetSuggestions.some((item) => item.role === p.targetRole)
    ? p.targetRole
    : "";
  const customTargetRole = suggestedTargetRole ? "" : p.targetRole;

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(targetCountry && targetCountry.length > 1);
      case 1:
        return Boolean(p.currentIndustry && p.currentRole.trim().length > 1 && (p.currentIndustry !== "other" || p.otherIndustry?.trim()));
      case 2:
        return Boolean(p.directionMode && p.targetIndustry && p.targetRole.trim().length > 1);
      case 3:
        return Boolean(p.yearsExperience && p.educationLevel);
      case 4:
        return p.existingSkills.length > 0;
      case 5:
        return p.hoursPerWeek > 0 && p.timelineMonths > 0;
      case 6:
        return Boolean(p.budget && p.supportAvailable);
      case 7:
        return Boolean(
          p.motivations.length > 0 &&
          (p.careerBarriers?.length || p.careerBarrier) &&
          (!p.careerBarriers?.includes("Something else") || (p.otherBarrier?.trim().length ?? 0) > 1) &&
          p.workStyle
        );
      default:
        return false;
    }
  }, [step, targetCountry, p]);

  function updateDirection(mode: NonNullable<Profile["directionMode"]>) {
    setP((prev) => {
      const targetIndustry = mode === "grow" ? prev.currentIndustry : prev.targetIndustry;
      return {
        ...prev,
        directionMode: mode,
        targetIndustry,
        targetRole: mode === prev.directionMode ? prev.targetRole : "",
      };
    });
  }

  async function generate() {
    const careerBarriers = (p.careerBarriers || []).map((barrier) =>
      barrier === "Something else" && p.otherBarrier?.trim()
        ? `Other: ${p.otherBarrier.trim()}`
        : barrier
    );
    const finalProfile: Profile = {
      ...p,
      targetCountry,
      careerBarrier: careerBarriers[0] || p.careerBarrier,
      careerBarriers,
      industry: p.targetIndustry || p.currentIndustry || "other",
      mode: (p.targetIndustry || p.currentIndustry) === "hospitality" ? "hospitality" : "general",
    };
    setGenerating(true);
    setError(null);
    store.saveProfile(finalProfile);
    try {
      const res = await fetch(apiUrl("/api/roadmap"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalProfile),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "We could not build the plan. Please try again.");
      }
      store.saveReport(await res.json());
      store.setUnlocked(false);
      // A completed questionnaire must not remain behind the report as a
      // restart path. The explicit "Start a fresh plan" control owns that job.
      router.replace("/report");
    } catch (cause) {
      setGenerating(false);
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    }
  }

  function next() {
    if (!canAdvance) return;
    if (step === TOTAL_STEPS - 1) return void generate();
    setStep((value) => Math.min(TOTAL_STEPS - 1, value + 1));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-2xl" aria-label="Loading the career questions">
        <div className="h-2 w-full animate-pulseSoft rounded-full bg-paper-deep" />
        <div className="mt-8 h-80 animate-pulseSoft rounded-[1.75rem] bg-paper-deep/60" />
      </div>
    );
  }

  if (savedProfile) {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-[1.75rem] border border-ink/[0.08] bg-paper-soft p-7 shadow-lift sm:p-10" aria-labelledby="saved-plan-title">
        <p className="eyebrow">Saved answers found</p>
        <h1 id="saved-plan-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">How would you like to begin?</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
          This device has answers from {savedProfile.currentRole || "an earlier role"} to {savedProfile.targetRole || "an earlier target"}. Choose whether to reuse them or clear them.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={startWithBlankAnswers} className="rounded-2xl border border-ever/25 bg-signal-wash px-5 py-5 text-left transition-colors hover:bg-signal/15">
            <span className="block font-display text-xl font-semibold text-ink">Start fresh</span>
            <span className="mt-2 block text-sm leading-relaxed text-ink-soft">Clear the saved profile, report, email and unlock status on this device.</span>
          </button>
          <button type="button" onClick={usePreviousAnswers} className="rounded-2xl border border-ink/[0.1] bg-paper px-5 py-5 text-left transition-colors hover:bg-paper-deep">
            <span className="block font-display text-xl font-semibold text-ink">Use previous answers</span>
            <span className="mt-2 block text-sm leading-relaxed text-ink-soft">Review and change the saved answers before building another report.</span>
          </button>
        </div>
      </section>
    );
  }

  if (generating) return <GeneratingScreen from={p.currentRole} to={p.targetRole} />;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-ink-soft">Question {step + 1} of {TOTAL_STEPS}</span>
          <span className="font-mono text-ink-faint">{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
          <div className="h-full rounded-full bg-ever-bright transition-[width] duration-300" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink-faint">Your answers stay on this device until you choose to share your email at the end.</p>
      </div>

      <div key={step} className="animate-rise rounded-[1.75rem] border border-ink/[0.08] bg-paper-soft p-5 shadow-lift sm:p-8">
        {step === 0 && (
          <Step title="Where do you want to work?" hint="Rules, training and pay differ by country. Choose the place you want this plan to fit.">
            <FieldLabel text="Country" htmlFor="target-country" />
            <select id="target-country" value={p.targetCountry || ""} onChange={(event) => set("targetCountry", event.target.value)} className="field-control">
              <option value="">Choose a country</option>
              {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
            {p.targetCountry === "Other / not listed" && (
              <input autoFocus value={customCountry} onChange={(event) => setCustomCountry(event.target.value)} placeholder="Type the country" className="input-lg mt-4" />
            )}
            <p className="help-text">You can choose where you live now or somewhere you hope to move later. This is career guidance, not visa advice.</p>
            {isGccTarget && (
              <div className="mt-6 rounded-2xl border border-ever/15 bg-signal-wash/60 p-5">
                <FieldLabel text="Where are you in this move? (optional)" htmlFor="relocation-status" />
                <select id="relocation-status" value={p.relocationStatus || ""} onChange={(event) => set("relocationStatus", event.target.value)} className="field-control bg-paper-soft">
                  <option value="">Skip this question</option>
                  <option value="already-there">I already live in this country</option>
                  <option value="planning-move">I plan to move there</option>
                  <option value="comparing">I am comparing it with other countries</option>
                  <option value="prefer-not">Prefer not to say</option>
                </select>
                <p className="help-text">We do not ask for nationality or passport details. This only changes which practical checks appear in your roadmap.</p>
              </div>
            )}
          </Step>
        )}

        {step === 1 && (
          <Step title="What work do you do now?" hint="Choose the closest area, then type your job. Unpaid work, family work and informal work still count.">
            <FieldLabel text="Area of work" htmlFor="current-industry" />
            <select id="current-industry" value={p.currentIndustry || ""} onChange={(event) => setP((prev) => ({ ...prev, currentIndustry: event.target.value, currentRole: "", existingSkills: [] }))} className="field-control">
              <option value="">Choose the closest area</option>
              {INDUSTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {p.currentIndustry === "other" && (
              <input value={p.otherIndustry || ""} onChange={(event) => set("otherIndustry", event.target.value)} placeholder="Type your area of work" className="input-lg mt-4" />
            )}
            <FieldLabel text="Your job or main activity" htmlFor="current-role" className="mt-5" />
            <input id="current-role" value={p.currentRole} onChange={(event) => set("currentRole", event.target.value)} placeholder="For example: warehouse assistant" className="input-lg" />
            <ChoiceChips values={currentSuggestions} selected={p.currentRole} onSelect={(value) => set("currentRole", value)} />
          </Step>
        )}

        {step === 2 && (
          <Step title="How clear is your next move?" hint="You do not need to know the perfect career. Choose a route we can test first.">
            <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="How clear is your next move?">
              <OptionCard selected={p.directionMode === "explore"} onClick={() => updateDirection("explore")} label="Show me ideas" sub="I need help choosing" />
              <OptionCard selected={p.directionMode === "known"} onClick={() => updateDirection("known")} label="I have an idea" sub="Test a career I am considering" />
              <OptionCard selected={p.directionMode === "grow"} onClick={() => updateDirection("grow")} label="Help me move up" sub="Grow in my current area" />
            </div>
            {p.directionMode && (
              <div className="mt-6">
                <FieldLabel text={p.directionMode === "grow" ? "Area you want to grow in" : "Area you may want to enter"} htmlFor="target-industry" />
                <select
                  id="target-industry"
                  value={p.targetIndustry || ""}
                  disabled={p.directionMode === "grow"}
                  onChange={(event) => setP((prev) => ({ ...prev, targetIndustry: event.target.value, targetRole: "" }))}
                  className="field-control disabled:opacity-70"
                >
                  <option value="">Choose an area</option>
                  {INDUSTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <FieldLabel text={p.directionMode === "explore" ? "Choose one job to explore first" : "Job you want next"} htmlFor="target-role-choice" className="mt-5" />
                <select
                  id="target-role-choice"
                  value={suggestedTargetRole}
                  onChange={(event) => set("targetRole", event.target.value)}
                  className="field-control"
                >
                  <option value="">Choose a suggested job</option>
                  {targetSuggestions.map((item) => (
                    <option key={item.role} value={item.role}>{item.role}</option>
                  ))}
                </select>
                <div className="my-3 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-ink/10" />
                  <span className="text-sm font-medium text-ink-faint">or</span>
                  <span className="h-px flex-1 bg-ink/10" />
                </div>
                <FieldLabel text="Type another job if it is not listed" htmlFor="target-role" />
                <input id="target-role" value={customTargetRole} onChange={(event) => set("targetRole", event.target.value)} placeholder="For example: solar technician" className="input-lg" />
                {p.directionMode === "explore" && <p className="help-text">This choice is not a promise. The report will show how to test it cheaply before making a big change.</p>}
              </div>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step title="What experience and education do you have?" hint="This helps us start at the right level. There is no bad answer.">
            <FieldLabel text="Time in your current kind of work" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["0-2", "Less than 2 years", "New or early in this work"],
                ["3-5", "3 to 5 years", "Some solid experience"],
                ["6-10", "6 to 10 years", "A lot of practical experience"],
                ["10+", "More than 10 years", "Deep experience"],
              ].map(([value, label, sub]) => <OptionCard key={value} selected={p.yearsExperience === value} onClick={() => set("yearsExperience", value)} label={label} sub={sub} />)}
            </div>
            <FieldLabel text="Highest level completed" htmlFor="education" className="mt-6" />
            <select id="education" value={p.educationLevel || ""} onChange={(event) => set("educationLevel", event.target.value)} className="field-control">
              <option value="">Choose one</option>
              <option value="primary">Primary school</option>
              <option value="secondary">Secondary school</option>
              <option value="certificate">Trade or vocational certificate</option>
              <option value="diploma">Diploma</option>
              <option value="degree">University degree or higher</option>
              <option value="informal">Skills learned outside school</option>
              <option value="prefer-not">Prefer not to say</option>
            </select>
          </Step>
        )}

        {step === 4 && (
          <Step title="Which skills do you already use?" hint="Choose up to five. Skills learned at work, at home or outside a classroom still count.">
            <p className="mb-4 text-sm font-semibold text-ever-deep" aria-live="polite">
              {p.existingSkills.length} of 5 chosen
            </p>
            <h3 className="mb-3 text-sm font-semibold text-ink">Skills from work and daily life</h3>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Skills from work and daily life">
              {practicalSkillOptions.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={p.existingSkills.includes(skill)}
                  disabled={p.existingSkills.length >= 5 && !p.existingSkills.includes(skill)}
                  onClick={() => toggle("existingSkills", skill)}
                  className={`choice-row disabled:cursor-not-allowed disabled:opacity-45 ${p.existingSkills.includes(skill) ? "choice-row-active" : ""}`}
                >
                  <span>{skill}</span><span aria-hidden>{p.existingSkills.includes(skill) ? "Selected" : "+"}</span>
                </button>
              ))}
            </div>
            <h3 className="mb-3 mt-6 text-sm font-semibold text-ink">AI, digital and changing-work skills</h3>
            <p className="mb-3 text-sm leading-relaxed text-ink-faint">
              Choose these only if you have used them in a real task. You do not need to be an expert.
            </p>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="AI, digital and changing-work skills">
              {futureReadySkillOptions.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={p.existingSkills.includes(skill)}
                  disabled={p.existingSkills.length >= 5 && !p.existingSkills.includes(skill)}
                  onClick={() => toggle("existingSkills", skill)}
                  className={`choice-row disabled:cursor-not-allowed disabled:opacity-45 ${p.existingSkills.includes(skill) ? "choice-row-active" : ""}`}
                >
                  <span>{skill}</span><span aria-hidden>{p.existingSkills.includes(skill) ? "Selected" : "+"}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input value={customSkill} onChange={(event) => setCustomSkill(event.target.value)} disabled={p.existingSkills.length >= 5} placeholder="Type another skill" className="input-lg flex-1 disabled:cursor-not-allowed disabled:opacity-50" />
              <button type="button" disabled={p.existingSkills.length >= 5 || !customSkill.trim()} onClick={() => { if (customSkill.trim()) { toggle("existingSkills", customSkill.trim()); setCustomSkill(""); } }} className="btn-ghost min-h-12 disabled:cursor-not-allowed disabled:opacity-45">Add skill</button>
            </div>
            <p className="help-text">Choose the skills you can show with a real example. Five clear strengths make the report easier to use.</p>
            {isHospitality && (
              <div className="mt-7 border-t border-ink/[0.07] pt-6">
                <h3 className="font-display text-xl font-semibold text-ink">Hospitality experience that can help</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-faint">Optional. Languages and guest-facing work can change which hotel, food, retail or aviation roles are realistic.</p>
                <p className="mb-3 mt-5 text-sm font-semibold text-ever-deep" aria-live="polite">Languages you can use at work: {p.languages?.length || 0} of 4 chosen</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Languages you can use at work">
                  {HOSPITALITY_LANGUAGES.map((language) => (
                    <button key={language} type="button" aria-pressed={p.languages?.includes(language)} disabled={(p.languages?.length || 0) >= 4 && !p.languages?.includes(language)} onClick={() => toggleLimited("languages", language, 4)} className={`chip disabled:cursor-not-allowed disabled:opacity-45 ${p.languages?.includes(language) ? "chip-active" : ""}`}>{language}</button>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input value={customLanguage} onChange={(event) => setCustomLanguage(event.target.value)} disabled={(p.languages?.length || 0) >= 4} placeholder="Type another language" className="input-lg flex-1 disabled:opacity-50" />
                  <button type="button" disabled={(p.languages?.length || 0) >= 4 || !customLanguage.trim()} onClick={() => { toggleLimited("languages", customLanguage.trim(), 4); setCustomLanguage(""); }} className="btn-ghost min-h-12 disabled:opacity-45">Add language</button>
                </div>
                <FieldLabel text="Customer or guest-facing experience (optional)" htmlFor="customer-facing" className="mt-5" />
                <select id="customer-facing" value={p.customerFacingExperience || ""} onChange={(event) => set("customerFacingExperience", event.target.value)} className="field-control">
                  <option value="">Skip this question</option>
                  <option value="none">No experience yet</option>
                  <option value="informal">Informal, family or volunteer experience</option>
                  <option value="under-1">Less than one year</option>
                  <option value="1-3">One to three years</option>
                  <option value="3-plus">More than three years</option>
                </select>
              </div>
            )}
          </Step>
        )}

        {step === 5 && (
          <Step title="How much time can you really give this?" hint="Choose a weekly amount you can protect even after a tiring workday.">
            <FieldLabel text="Time each week" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[2, 5, 8, 12, 20].map((hours) => <OptionCard key={hours} selected={p.hoursPerWeek === hours} onClick={() => set("hoursPerWeek", hours)} label={`${hours} hours`} sub={hours <= 5 ? "Small steady steps" : hours <= 12 ? "Part-time pace" : "Fast pace"} />)}
            </div>
            <FieldLabel text="When would you like to be ready?" className="mt-6" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[6, 12, 18, 24].map((months) => <OptionCard key={months} selected={p.timelineMonths === months} onClick={() => set("timelineMonths", months)} label={`${months} months`} sub={months === 6 ? "Fast" : months === 12 ? "Steady" : "Lower pressure"} />)}
            </div>
          </Step>
        )}

        {step === 6 && (
          <Step title="What can you use for training?" hint="We will not tell you to buy an expensive course before you check that employers recognise it.">
            <FieldLabel text="Your training budget" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["free", "Free only", "No paid course"],
                ["low", "A small amount each month", "Low-cost learning"],
                ["500", "One useful short course", "Only after checking recognition"],
                ["flexible", "Flexible if the value is clear", "Compare providers first"],
              ].map(([value, label, sub]) => <OptionCard key={value} selected={p.budget === value} onClick={() => set("budget", value)} label={label} sub={sub} />)}
            </div>
            <FieldLabel text="Support you may have" htmlFor="support" className="mt-6" />
            <select id="support" value={p.supportAvailable || ""} onChange={(event) => set("supportAvailable", event.target.value)} className="field-control">
              <option value="">Choose one</option>
              <option value="employer">My employer may train or move me</option>
              <option value="mentor">A manager, trainer or mentor can guide me</option>
              <option value="family">Family or friends can support me</option>
              <option value="none">I need to do this mostly by myself</option>
              <option value="unsure">I am not sure yet</option>
            </select>
          </Step>
        )}

        {step === 7 && (
          <Step title="What matters most, and what may stop you?" hint="Choose honestly. A useful plan works with the barrier instead of pretending it is not there.">
            <FieldLabel text="What you want most from this change" />
            <p className="mb-3 text-sm text-ink-faint" aria-live="polite">Choose up to three. {p.motivations.length} selected.</p>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Reasons for changing work">
              {MOTIVATIONS.map((item) => (
                <button key={item.id} type="button" aria-pressed={p.motivations.includes(item.id)} disabled={p.motivations.length >= 3 && !p.motivations.includes(item.id)} onClick={() => toggle("motivations", item.id)} className={`choice-row disabled:cursor-not-allowed disabled:opacity-45 ${p.motivations.includes(item.id) ? "choice-row-active" : ""}`}>
                  <span>{item.label}</span><span aria-hidden>{p.motivations.includes(item.id) ? "Selected" : "+"}</span>
                </button>
              ))}
            </div>
            <div className="mt-7 border-t border-ink/[0.07] pt-6">
              <FieldLabel text="What could make this difficult?" />
              <p className="mb-3 text-sm text-ink-faint" aria-live="polite">Choose up to three. The roadmap will put them in a practical order. {p.careerBarriers?.length || 0} selected.</p>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Barriers to your career move">
                {BARRIERS.map((item) => (
                  <button key={item} type="button" aria-pressed={p.careerBarriers?.includes(item)} disabled={(p.careerBarriers?.length || 0) >= 3 && !p.careerBarriers?.includes(item)} onClick={() => toggleLimited("careerBarriers", item, 3)} className={`choice-row disabled:cursor-not-allowed disabled:opacity-45 ${p.careerBarriers?.includes(item) ? "choice-row-active" : ""}`}>
                    <span>{item}</span><span aria-hidden>{p.careerBarriers?.includes(item) ? "Selected" : "+"}</span>
                  </button>
                ))}
              </div>
              {p.careerBarriers?.includes("Something else") && (
                <div className="mt-4">
                  <FieldLabel text="Tell us what the other barrier is" htmlFor="other-barrier" />
                  <textarea id="other-barrier" value={p.otherBarrier || ""} onChange={(event) => set("otherBarrier", event.target.value)} rows={3} maxLength={220} placeholder="Use your own words" className="field-control resize-y" />
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label><span className="field-label">Where are you in your job search? (optional)</span><select value={p.jobSearchStage || ""} onChange={(event) => set("jobSearchStage", event.target.value)} className="field-control"><option value="">Skip this question</option><option value="not-started">I have not started applying</option><option value="no-replies">I apply but get few or no replies</option><option value="no-offers">I get interviews but no offers</option><option value="employed">I am already working in or near this area</option></select></label>
              <label><span className="field-label">Work setting</span><select value={p.workStyle} onChange={(event) => set("workStyle", event.target.value)} className="field-control"><option value="">Choose one</option><option value="onsite">On-site</option><option value="hybrid">A mix of on-site and remote</option><option value="remote">Remote</option><option value="any">No strong preference</option></select></label>
            </div>

            {isGccTarget && (
              <div className="mt-7 rounded-2xl border border-ever/15 bg-signal-wash/60 p-5 sm:p-6">
                <h3 className="font-display text-xl font-semibold text-ink">Gulf market context</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-faint">Optional and private. These answers improve the checks in your report. They do not decide whether you are suitable.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label><span className="field-label">UAE or GCC work experience</span><select value={p.gccExperience || ""} onChange={(event) => set("gccExperience", event.target.value)} className="field-control bg-paper-soft"><option value="">Skip</option><option value="none">None yet</option><option value="under-1">Less than one year</option><option value="1-3">One to three years</option><option value="3-plus">More than three years</option></select></label>
                  <label><span className="field-label">Work-authorisation situation</span><select value={p.workAuthorizationStatus || ""} onChange={(event) => set("workAuthorizationStatus", event.target.value)} className="field-control bg-paper-soft"><option value="">Skip</option><option value="employer-needed">I would need an employer-led work permit</option><option value="already-authorised">I already have permission that may allow this work</option><option value="checking">I need to check</option><option value="prefer-not">Prefer not to say</option></select></label>
                  <label className="sm:col-span-2"><span className="field-label">Do you know anyone in this kind of work?</span><select value={p.industryContact || ""} onChange={(event) => set("industryContact", event.target.value)} className="field-control bg-paper-soft"><option value="">Skip</option><option value="yes-close">Yes, someone I can ask directly</option><option value="yes-distant">Yes, but we are not close</option><option value="no">Not yet</option><option value="unsure">I am not sure</option></select></label>
                </div>
                <p className="help-text">Never type a passport number, visa number or document details here. Use official government services for legal checks.</p>
              </div>
            )}
          </Step>
        )}
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-clay/40 bg-clay-soft/40 px-5 py-4 text-sm text-ink">{error}</p>}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="btn-ghost min-h-12 disabled:pointer-events-none disabled:opacity-0">Back</button>
        <button type="button" onClick={next} disabled={!canAdvance} className="btn-primary min-h-12 text-base disabled:cursor-not-allowed disabled:opacity-40">
          {step === TOTAL_STEPS - 1 ? "Build my plan" : "Continue"}<span aria-hidden>→</span>
        </button>
      </div>
      {!canAdvance && <p className="mt-3 text-right text-sm text-ink-faint">Complete the answers on this page to continue.</p>}
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  function listen() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(`${title}. ${hint}`);
    speech.rate = 0.9;
    window.speechSynthesis.speak(speech);
  }
  return (
    <section aria-labelledby="question-title">
      <p className="eyebrow">Make the result realistic</p>
      <h1 id="question-title" className="mt-3 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-soft">{hint}</p>
      <button type="button" onClick={listen} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/12 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-ever-bright hover:text-ink"><span aria-hidden>▶</span> Listen to this question</button>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function FieldLabel({ text, htmlFor, className = "" }: { text: string; htmlFor?: string; className?: string }) {
  return <label htmlFor={htmlFor} className={`field-label ${className}`}>{text}</label>;
}

function ChoiceChips({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  if (!values.length) return null;
  return <div className="mt-4 flex flex-wrap gap-2">{values.slice(0, 18).map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => onSelect(value)} className={`chip min-h-11 ${selected === value ? "chip-active" : ""}`}>{value}</button>)}</div>;
}

function OptionCard({ selected, onClick, label, sub }: { selected: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-24 min-w-0 w-full rounded-2xl border p-4 text-left transition-all ${selected ? "border-ever-deep bg-ever-night text-paper-soft shadow-lift" : "border-ink/[0.10] bg-paper hover:border-ever/50"}`}>
      <span className="block break-words font-display text-lg font-semibold leading-tight">{label}</span>
      <span className={`mt-1.5 block break-words text-sm leading-snug ${selected ? "text-paper-soft/75" : "text-ink-faint"}`}>{sub}</span>
    </button>
  );
}

function GeneratingScreen({ from, to }: { from: string; to: string }) {
  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center text-center" role="status" aria-live="polite">
      <span className="h-14 w-14 animate-spin rounded-full border-4 border-ever-night/15 border-t-ever-bright" aria-hidden />
      <p className="eyebrow mt-8">Building your practical roadmap</p>
      <h1 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-ink">Checking the route, training and next actions</h1>
      <p className="mt-4 text-ink-soft">{from || "Your current work"} <span aria-hidden>→</span> {to || "your next move"}</p>
      <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-faint">This normally takes a few seconds. We use a built-in planning engine if the AI service is unavailable, so you still receive a complete result.</p>
    </div>
  );
}
