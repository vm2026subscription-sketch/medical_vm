import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  ListOrdered,
  Sparkles,
  Trophy,
  ShieldCheck,
  Database,
  IndianRupee,
} from "lucide-react";
import { Btn, BtnLink, CollegeCard, Num, Panel, Pill, Section, TextInput } from "@/components/kit";
import { fetchColleges } from "@/lib/api";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const { items, total } = await fetchColleges({ limit: "4" });
      return { previewColleges: items, total, apiDown: false as const };
    } catch {
      // Don't blank the whole homepage over one missing section — just show it without
      // the live college preview and total count.
      return {
        previewColleges: [] as Awaited<ReturnType<typeof fetchColleges>>["items"],
        total: 0,
        apiDown: true as const,
      };
    }
  },
  head: () => ({
    meta: [
      { title: "MedPath by Vidyarthi Mitra — Enter your NEET rank, see the colleges you can get" },
      {
        name: "description",
        content:
          "Enter your NEET-UG rank and see MBBS, BDS and AYUSH colleges within reach, with cutoffs, fees and an AI seat predictor.",
      },
      {
        property: "og:title",
        content: "MedPath by Vidyarthi Mitra — From your NEET rank to the right seat",
      },
      {
        property: "og:description",
        content:
          "Rank-based college predictor, cutoff data and 1-to-1 counselling for NEET-UG admissions.",
      },
    ],
  }),
  component: Home,
});

const steps = [
  {
    icon: ClipboardList,
    title: "Registration",
    text: "Register on MCC / your state portal and pay the counselling fee.",
  },
  {
    icon: ListOrdered,
    title: "Choice filling",
    text: "Order colleges by preference — order matters more than count.",
  },
  {
    icon: Sparkles,
    title: "Seat allotment",
    text: "Rounds run AIQ → State → Mop-up. Track each round's closing rank.",
  },
  {
    icon: Trophy,
    title: "Reporting",
    text: "Report to the allotted college with documents before the deadline.",
  },
];

function Home() {
  const { previewColleges, total, apiDown } = Route.useLoaderData();
  const { rank, setRank } = useApp();
  const [value, setValue] = useState(rank ? String(rank) : "");
  const navigate = useNavigate();

  const submit = () => {
    const n = Number(value.replace(/[^0-9]/g, ""));
    if (n > 0) setRank(n);
    navigate({ to: "/ai-match" });
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-050 to-paper">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.1fr_.9fr] md:items-center md:px-6 md:py-20">
          <div>
            <Pill tone="teal" dot>
              NEET-UG counselling
            </Pill>
            <h1 className="mt-4 text-[32px] leading-[1.08] md:text-[52px]">
              Enter your rank. See the colleges you can actually get.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              From your NEET rank to the right seat — cutoffs, fees, bonds and seat probability for
              MBBS, BDS and AYUSH colleges, in one calm place.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <TextInput
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Your All India Rank e.g. 54120"
                className="num h-13 rounded-[14px] text-[15px] sm:max-w-xs"
              />
              <Btn size="lg" onClick={submit} className="w-full sm:w-auto">
                Predict my college <ArrowRight className="size-4" strokeWidth={1.6} />
              </Btn>
            </div>
            <p className="mt-2.5 text-[12px] text-muted-2">
              No login needed to browse ·{" "}
              {apiDown ? (
                "colleges"
              ) : (
                <>
                  <Num>{total}</Num> colleges
                </>
              )}{" "}
              · Published cutoff history
            </p>
          </div>

          <Panel className="p-5 shadow-sh-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px]">Your snapshot</h3>
              <Pill tone="violet" dot>
                Rank preferences
              </Pill>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {[{ k: "Your rank", v: rank ? rank.toLocaleString("en-IN") : "—" }].map((s) => (
                <div key={s.k} className="rounded-[12px] border border-line-2 bg-paper p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-2">{s.k}</dt>
                  <dd>
                    <Num className="text-[22px] font-semibold">{s.v}</Num>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-muted">
              Run a seat match with your category, course and budget to see results from published
              cutoff data.
            </p>
            <BtnLink to="/ai-match" variant="violet" className="mt-4 w-full">
              <Sparkles className="size-4" strokeWidth={1.6} /> Open AI seat match
            </BtnLink>
          </Panel>
        </div>
      </section>

      {/* Colleges within reach */}
      <Section
        title="Explore colleges"
        sub="Browse published college profiles, fees and available cutoff records."
        action={
          <BtnLink to="/colleges" variant="link">
            See all <ArrowRight className="size-4" strokeWidth={1.6} />
          </BtnLink>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {apiDown ? (
            <p className="col-span-full text-[13.5px] text-muted-2">
              Couldn't load live colleges right now — make sure the backend API is running.
            </p>
          ) : (
            previewColleges.slice(0, 4).map((c) => <CollegeCard key={c.id} college={c} />)
          )}
        </div>
      </Section>

      {/* Process */}
      <Section
        title="The counselling process, decoded"
        sub="Four stages, repeated each round. Miss a date and you miss a round."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Panel key={s.title} className="p-5">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-[12px] bg-teal-050 text-teal-700">
                  <s.icon className="size-[18px]" strokeWidth={1.6} />
                </span>
                <Num className="text-[12px] font-semibold text-muted-2">0{i + 1}</Num>
              </div>
              <h3 className="mt-3 text-[16px]">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.text}</p>
            </Panel>
          ))}
        </div>
      </Section>

      {/* Expert promo */}
      <Section
        title="Healthcare has more than one path"
        sub="Explore courses after Class 12 in nursing, pharmacy, rehabilitation, allied health and more."
        action={
          <BtnLink to="/courses" variant="primary">
            Explore all courses
          </BtnLink>
        }
      />
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-teal-700 via-ink-3 to-ink p-6 shadow-sh-3 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <Pill tone="gold" dot>
                1-to-1 · 40 minutes
              </Pill>
              <h2 className="mt-3 text-[26px] text-white md:text-[34px]">
                Still unsure? Talk to an expert.
              </h2>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-teal-100">
                A counsellor walks through your rank, budget and home-state options, then hands you
                a choice-filling order you can actually submit.
              </p>
            </div>
            <div className="shrink-0">
              <BtnLink to="/counselling/book" variant="gold" size="lg" className="w-full md:w-auto">
                Book a counsellor
              </BtnLink>
              <p className="mt-2 text-center text-[12px] text-teal-100">
                <Num>₹999</Num> · Google Meet · free reschedule
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <Section
        title="What MedPath aggregates"
        sub="One place for the numbers scattered across MCC, state authorities and college brochures."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Database,
              t: "Published cutoff history",
              d: "Explore category and quota-wise closing ranks for the years and rounds available in the catalog.",
            },
            {
              icon: IndianRupee,
              t: "Real cost of a seat",
              d: "State merit fee, private/NRI fee, hostel and mess, plus service bond years and penalty amounts.",
            },
            {
              icon: ShieldCheck,
              t: "Verified approvals",
              d: "NMC, DCI, NCISM and NCH approval status with affiliating university for every listed college.",
            },
          ].map((x) => (
            <Panel key={x.t} className="p-5">
              <span className="flex size-10 items-center justify-center rounded-[12px] bg-teal-050 text-teal-700">
                <x.icon className="size-[18px]" strokeWidth={1.6} />
              </span>
              <h3 className="mt-3 text-[17px]">{x.t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{x.d}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </>
  );
}
