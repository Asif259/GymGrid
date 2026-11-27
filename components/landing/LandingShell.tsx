"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ArrowUpRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FAQ } from "./faq";
import { HeroDesk } from "./HeroDesk";
import { MemberPass, OwnerView, Register, StepScreen } from "./mocks";
import { WalkthroughFilm } from "./WalkthroughFilm";

gsap.registerPlugin(ScrollTrigger);

const HERO_LINES = ["The front desk,", "without the", "paper register."] as const;

const FIGURES = [
  { n: "৳0", d: "gateway fees. Members pay your own bKash or Nagad number." },
  { n: "৳0", d: "SMS bills. Renewal reminders open in your WhatsApp." },
  { n: "1", d: "printed QR poster instead of cards or turnstiles." },
  { n: "07:04", d: "morning report, every day, Dhaka time." },
] as const;

const STATEMENT =
  "Someone signs in at 6:42. Whether they paid this month is a guess. A plan ended on Tuesday, and nobody noticed until the cash count on Friday.";

const FAILURES = [
  "Sign-ins and payments live in different places.",
  "Expiry dates are found by flipping pages.",
  "A bKash message says ৳1,500, but not who sent it.",
] as const;

const STEPS = [
  { title: "Scan the desk QR", body: "A printed poster at the door. Members scan it with their phone camera. No card, no turnstile." },
  { title: "Check-in is marked", body: "The desk screen shows the scan with the member's plan status the moment it happens." },
  { title: "Pay with a TrxID", body: "Members send the fee by bKash or Nagad to your number and type the TrxID into their pass." },
  { title: "Staff verify it", body: "The TrxID waits in a queue. Check it in your own wallet, then confirm once." },
  { title: "Receipt is issued", body: "The expiry date moves forward and a PDF receipt is ready for the member to download." },
] as const;

const FIT = [
  { h: "bKash and Nagad, straight to you", p: "Members pay your own wallet with Send Money. No payment gateway sits in between, so nothing is deducted." },
  { h: "WhatsApp, one tap", p: "Renewals due in two days list a ready message. It opens in your WhatsApp, so there is no SMS bill." },
  { h: "Built for Dhaka", p: "Amounts in ৳, times in Asia/Dhaka, and Bengali text renders cleanly." },
] as const;

/** Word-masked heading. Screen readers get the plain sentence. */
function Words({ text }: { text: string }) {
  return (
    <>
      <span className="lp-sr">{text}</span>
      <span aria-hidden>
        {text.split(" ").map((w, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            <span className="lp-wmask"><span className="lp-word">{w}</span></span>
          </Fragment>
        ))}
      </span>
    </>
  );
}

/** Section scaffold: drawn hairline, mono index, heading. */
function SecHead({ index, label, id, title, children }: { index: string; label: string; id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="lp-sec-head">
      <i className="lp-rule" data-rule aria-hidden />
      <p className="lp-label"><b>{index}</b>{label}</p>
      <h2 id={id} className="lp-h2" data-words><Words text={title} /></h2>
      {children}
    </div>
  );
}

export function LandingShell() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const mm = gsap.matchMedia();
    let lenis: Lenis | undefined;
    const tick = (t: number) => lenis?.raf(t * 1000);

    const ctx = gsap.context(() => {
      mm.add(
        { motion: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 64rem)" },
        ({ conditions }) => {
          const { motion, desktop } = conditions as { motion: boolean; desktop: boolean };
          if (!motion) {
            html.classList.remove("js", "lp-motion");
            return;
          }

          // Re-add on every run: Strict Mode's effect cleanup strips these, and the pre-paint script only runs once.
          html.classList.add("js", "lp-motion");

          lenis = new Lenis({ lerp: 0.085, smoothWheel: true, anchors: { offset: -72 } });
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);

          // Hero intro: masked lines rise, then the meta row, then the product stage.
          gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.1 })
            .fromTo("[data-hero-in]", { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.3, stagger: 0.09 })
            .fromTo("[data-hero-fade]", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08 }, "-=0.95")
            .fromTo(".lp-hero-stage", { y: 64, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.4 }, "-=0.85");

          if (!desktop) {
            // Mobile: the sticky phone follows whichever step is mid-viewport.
            gsap.utils.toArray<HTMLElement>(".lp-step").forEach((el, i) =>
              ScrollTrigger.create({
                trigger: el, start: "top 68%", end: "bottom 68%",
                onToggle: (s) => s.isActive && setActive(i),
              }),
            );
          }

          if (desktop) {
            // Register and measure the #how pin first (refreshPriority: 1) so every
            // ScrollTrigger below #how accounts for its pin-spacer height.
            const last = STEPS.length - 1;
            gsap.timeline({
              scrollTrigger: {
                trigger: ".lp-how",
                start: "top top",
                end: () => `+=${window.innerHeight * last * 0.9}`,
                pin: ".lp-how-stage",
                anticipatePin: 1,
                scrub: 0.6,
                snap: { snapTo: 1 / last, duration: { min: 0.2, max: 0.5 }, ease: "power2.inOut" },
                invalidateOnRefresh: true,
                refreshPriority: 1,
                onUpdate: (s) => setActive(Math.round(s.progress * last)),
              },
            }).fromTo(".lp-progress-bar", { scaleY: 0 }, { scaleY: 1, ease: "none" });

            // The hero stage opens from inset to full width as it scrolls into view.
            gsap.fromTo(".lp-hero-stage", { clipPath: "inset(0% 5% 0% 5% round 20px)" }, {
              clipPath: "inset(0% 0% 0% 0% round 20px)", ease: "none",
              scrollTrigger: { trigger: ".lp-hero-stage", start: "top 92%", end: "top 20%", scrub: 0.6 },
            });

            // Product samples drift slightly against the scroll.
            gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) =>
              gsap.fromTo(el, { y: 48 }, {
                y: -48, ease: "none",
                scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8, invalidateOnRefresh: true },
              }),
            );
          }

          gsap.utils.toArray<HTMLElement>("[data-rule]").forEach((el) =>
            gsap.fromTo(el, { scaleX: 0 }, {
              scaleX: 1, duration: 1.4, ease: "expo.out",
              scrollTrigger: { trigger: el, start: "top 90%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-words]").forEach((el) =>
            gsap.fromTo(el.querySelectorAll(".lp-word"), { yPercent: 115 }, {
              yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.06,
              scrollTrigger: { trigger: el, start: "top 86%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
            gsap.fromTo(el, { y: 24, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 1, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((el) =>
            gsap.fromTo(el.children, { y: 24, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 1, ease: "power3.out", stagger: 0.08,
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            }),
          );

          // The problem statement lights up word by word as it passes.
          gsap.fromTo(".lp-statement .lp-hl", { opacity: 0.16 }, {
            opacity: 1, ease: "none", stagger: 0.1,
            scrollTrigger: { trigger: ".lp-statement", start: "top 82%", end: "bottom 45%", scrub: 0.5 },
          });

          // Owner view: the alert rows slide in once the dashboard is on screen.
          gsap.fromTo("[data-owner-rows] .lp-panel", { y: 36, autoAlpha: 0 }, {
            y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", stagger: 0.14,
            scrollTrigger: { trigger: ".lp-frame--wide", start: "top 70%", once: true },
          });

          ScrollTrigger.sort();

          return () => {
            gsap.ticker.remove(tick);
            gsap.ticker.lagSmoothing(500, 33);
            lenis?.destroy();
            lenis = undefined;
          };
        },
      );
    }, root);

    // Fonts and images move layout after first paint; re-measure triggers once.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);

    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
      ctx.revert();
      html.classList.remove("js", "lp-motion");
    };
  }, []);

  return (
    <div ref={root} className="lp">
      <a href="#main-content" className="lp-skip">Skip to content</a>

      <header className="lp-nav">
        <Link href="/" className="lp-brand">
          <Image src="/images/gymgrid-mark.png" alt="" width={24} height={24} />
          <span translate="no">GymGrid</span>
        </Link>
        <nav aria-label="Primary" className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#owner">Owner view</a>
          <a href="#member">Member pass</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lp-nav-end">
          <ThemeToggle />
          <Link href="/onboarding" className="lp-btn lp-btn--sm">Set up your gym</Link>
        </div>
      </header>

      <main id="main-content">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-wrap">
            <h1 id="hero-title" className="lp-display">
              <span className="lp-sr">{HERO_LINES.join(" ")}</span>
              <span aria-hidden>
                {HERO_LINES.map((l) => (
                  <span key={l} className="lp-line"><span data-hero-in>{l}</span></span>
                ))}
              </span>
            </h1>
            <div className="lp-hero-row">
              <p className="lp-label" data-hero-fade><b>GymGrid</b>Front desk software for Bangladeshi gyms</p>
              <p className="lp-lead" data-hero-fade>
                QR check-ins, bKash and Nagad renewals, and expiring memberships in one live view. Nobody trains unpaid and no expiry slips by.
              </p>
              <div className="lp-ctas" data-hero-fade>
                <Link href="/onboarding" className="lp-btn">Set up your gym <ArrowUpRight size={16} aria-hidden /></Link>
                <Link href="/preview" className="lp-btn lp-btn--ghost">See live preview</Link>
              </div>
            </div>
            <div className="lp-hero-stage">
              <div className="lp-hero-visual" data-slot="hero" data-kind="product">
                <HeroDesk />
              </div>
            </div>
            <dl className="lp-figs" data-stagger>
              {FIGURES.map((f) => (
                <div key={f.d} className="lp-fig">
                  <dt>{f.n}</dt>
                  <dd>{f.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="problem" className="lp-sec lp-wrap" aria-labelledby="problem-title">
          <SecHead index="01" label="The problem" id="problem-title" title="The register can’t tell you who paid." />
          <div className="lp-problem-body">
            <p className="lp-statement">
              {STATEMENT.split(" ").map((w, i) => (
                <Fragment key={i}>{i > 0 && " "}<span className="lp-hl">{w}</span></Fragment>
              ))}
            </p>
            <div className="lp-problem-aside" data-reveal>
              <Register />
              <ul className="lp-plain">
                {FAILURES.map((f, i) => (
                  <li key={f}><span>{String(i + 1).padStart(2, "0")}</span>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="how" className="lp-how" aria-labelledby="how-title">
          <div className="lp-how-stage lp-wrap">
            <div className="lp-how-copy">
              <div className="lp-sec-head">
                <i className="lp-rule" data-rule aria-hidden />
                <p className="lp-label"><b>02</b>How it works</p>
                <h2 id="how-title" className="lp-h2" data-words><Words text="From the door to the receipt." /></h2>
              </div>
              <ol className="lp-steps">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="lp-step" data-active={i === active || undefined}>
                    <h3 className="lp-h3">{s.title}</h3>
                    <p>{s.body}</p>
                    <div className="lp-phone lp-phone--inline" aria-hidden><StepScreen step={i} /></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lp-how-visual" aria-hidden>
              <div className="lp-progress"><span className="lp-progress-bar" /></div>
              <div className="lp-phone">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="lp-stepscreen" data-on={i === active || undefined}>
                    <StepScreen step={i} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="walkthrough" className="lp-sec lp-wrap" aria-labelledby="walkthrough-title">
          <SecHead index="03" label="Walkthrough" id="walkthrough-title" title="Thirty seconds at the front desk.">
            <p className="lp-lead" data-reveal>
              One member scans in at 06:42, clears an expired fee with a bKash TrxID, and gets a PDF receipt without touching paper.
            </p>
          </SecHead>
          <WalkthroughFilm />
        </section>

        <section id="owner" className="lp-sec lp-owner lp-wrap" aria-labelledby="owner-title">
          <SecHead index="04" label="Owner view" id="owner-title" title="Money truth, at a glance.">
            <p className="lp-lead" data-reveal>
              Active members, today&rsquo;s attendance, revenue and pending payments sit in one strip. Anyone who trained without paying is listed below it.
            </p>
          </SecHead>
          <div data-parallax><OwnerView /></div>
        </section>

        <section id="member" className="lp-sec lp-wrap" aria-labelledby="member-title">
          <SecHead index="05" label="Member pass" id="member-title" title="A pass that lives on their phone." />
          <div className="lp-member-body">
            <div className="lp-phone lp-phone--pass" aria-hidden data-parallax><MemberPass /></div>
            <div className="lp-member-copy" data-stagger>
              <p className="lp-lead">
                Members open GymGrid in their browser, check in, pay a renewal with a TrxID, and download receipts. They also see their workout and diet plans and their visit streak.
              </p>
              <p className="lp-lead">It adds to the home screen like an app. Nothing to download from a store.</p>
              <Link href="/member" className="lp-btn lp-btn--ghost">Open the member pass <ArrowUpRight size={16} aria-hidden /></Link>
            </div>
          </div>
        </section>

        <section id="bangladesh" className="lp-sec lp-wrap" aria-labelledby="bd-title">
          <SecHead index="06" label="Local fit" id="bd-title" title="Made for how Bangladeshi gyms already run." />
          <div className="lp-fit" data-stagger>
            {FIT.map((f, i) => (
              <div key={f.h} className="lp-fit-row">
                <p className="lp-label"><b>{String(i + 1).padStart(2, "0")}</b></p>
                <h3 className="lp-fit-h">{f.h}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="lp-sec lp-wrap" aria-labelledby="faq-title">
          <SecHead index="07" label="FAQ" id="faq-title" title="Questions owners ask.">
            <p className="lp-lead" data-reveal>Something else? Open the <Link href="/preview" className="lp-link">live preview</Link> and click around. No account needed.</p>
          </SecHead>
          <div className="lp-faq-list" data-reveal>
            {FAQ.map((f) => (
              <details key={f.q} className="lp-qa">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-close" aria-labelledby="close-title">
          <div className="lp-wrap lp-close-inner">
            <p className="lp-label"><b>08</b>Get started</p>
            <h2 id="close-title" className="lp-display" data-words><Words text="Open tomorrow without the register." /></h2>
            <div className="lp-close-row" data-reveal>
              <p className="lp-micro">Sign in with your email. Add members when you are ready.</p>
              <div className="lp-ctas">
                <Link href="/onboarding" className="lp-btn lp-btn--invert">Set up your gym <ArrowUpRight size={16} aria-hidden /></Link>
                <Link href="/desk-qr" className="lp-btn lp-btn--ghost-invert">Print the desk QR</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="lp-wrap lp-foot">
        <nav aria-label="Footer">
          <Link href="/admin">Admin</Link>
          <Link href="/member">Member</Link>
          <Link href="/desk">Desk</Link>
          <Link href="/desk-qr">Desk QR</Link>
          <Link href="/checkin">Check in</Link>
        </nav>
        <SiteFooter />
      </div>
    </div>
  );
}
