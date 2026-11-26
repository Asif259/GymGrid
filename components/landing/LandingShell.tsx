"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FAQ } from "./faq";
import { HeroDesk } from "./HeroDesk";
import { MemberPass, OwnerView, Register, StepScreen } from "./mocks";

gsap.registerPlugin(ScrollTrigger);

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

const SLIDE = "No gateway fees. No SMS costs. No app store.";

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

          lenis = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: { offset: -72 } });
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);

          // Hero: the headline paints at once (it is the LCP); only the desk demo rises in.
          gsap.fromTo(".lp-hero-visual", { y: 48, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "expo.out", delay: 0.15 });

          gsap.utils.toArray<HTMLElement>("[data-words]").forEach((el) =>
            gsap.fromTo(el.querySelectorAll(".lp-word"), { yPercent: 115 }, {
              yPercent: 0, duration: 1, ease: "power4.out", stagger: 0.05,
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
            gsap.fromTo(el, { y: 28, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 86%", once: true },
            }),
          );

          // Owner view: the alert rows slide in once the dashboard is on screen.
          gsap.fromTo("[data-owner-rows] .lp-panel", { y: 36, autoAlpha: 0 }, {
            y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", stagger: 0.14,
            scrollTrigger: { trigger: ".lp-frame--wide", start: "top 70%", once: true },
          });

          // The one type moment: the three "no" lines slide across as the section passes.
          gsap.fromTo(".lp-slide-track", { xPercent: 8 }, {
            xPercent: -42, ease: "none",
            scrollTrigger: { trigger: ".lp-slide", start: "top bottom", end: "bottom top", scrub: 1 },
          });

          if (desktop) {
            // Pinned stage: one step per viewport of scroll; the phone screen follows the active step.
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
                onUpdate: (s) => setActive(Math.round(s.progress * last)),
              },
            }).fromTo(".lp-progress-bar", { scaleY: 0 }, { scaleY: 1, ease: "none" });
          }

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
          <Image src="/images/gymgrid-mark.png" alt="" width={28} height={28} />
          <span translate="no">GymGrid</span>
        </Link>
        <nav aria-label="Primary" className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#owner">Owner view</a>
          <a href="#member">Member pass</a>
          <a href="#faq">FAQ</a>
        </nav>
        <ThemeToggle />
        <Link href="/onboarding" className="lp-btn lp-btn--sm">Set up your gym</Link>
      </header>

      <main id="main-content">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-wrap lp-hero-inner">
            <div className="lp-hero-copy">
              <h1 id="hero-title" className="lp-display">
                Replace your front desk paper register
              </h1>
              <p className="lp-lead">
                Track QR check-ins, bKash renewals, and expiring memberships live.
              </p>
              <div className="lp-ctas">
                <Link href="/onboarding" className="lp-btn">
                  Set up your gym
                </Link>
                <Link href="/preview" className="lp-btn lp-btn--ghost">
                  See live preview
                </Link>
              </div>
            </div>
            <div className="lp-hero-visual" data-slot="hero" data-kind="product">
              <HeroDesk />
            </div>
          </div>
        </section>

        <section id="problem" className="lp-problem lp-wrap" aria-labelledby="problem-title">
          <div className="lp-problem-copy">
            <h2 id="problem-title" className="lp-h2" data-words><Words text="The register can’t tell you who paid." /></h2>
            <ul className="lp-plain" data-reveal>
              <li>Someone signs in at 6:42. Whether they paid this month is a guess.</li>
              <li>A plan ended on Tuesday. Nobody noticed until the owner counted cash on Friday.</li>
              <li>A bKash message says ৳1,500, but not which member it belongs to.</li>
            </ul>
          </div>
          <div data-reveal><Register /></div>
        </section>

        <section id="how" className="lp-how" aria-labelledby="how-title">
          <div className="lp-how-stage lp-wrap">
            <div className="lp-how-copy">
              <h2 id="how-title" className="lp-h2" data-words><Words text="From the door to the receipt." /></h2>
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

        <section id="owner" className="lp-owner lp-wrap" aria-labelledby="owner-title">
          <h2 id="owner-title" className="lp-h2" data-words><Words text="Money truth, at a glance." /></h2>
          <p className="lp-lead" data-reveal>
            Active members, today&rsquo;s attendance, revenue and pending payments sit in one strip. Anyone who trained without paying is listed below it.
          </p>
          <OwnerView />
        </section>

        <section id="member" className="lp-member lp-wrap" aria-labelledby="member-title">
          <div className="lp-phone lp-phone--pass" aria-hidden data-reveal><MemberPass /></div>
          <div className="lp-member-copy">
            <h2 id="member-title" className="lp-h2" data-words><Words text="A pass that lives on their phone." /></h2>
            <p className="lp-lead" data-reveal>
              Members open GymGrid in their browser, check in, pay a renewal with a TrxID, and download receipts. They also see their workout and diet plans and their visit streak.
            </p>
            <p className="lp-lead" data-reveal>It adds to the home screen like an app. Nothing to download from a store.</p>
          </div>
        </section>

        <section id="bangladesh" className="lp-bd" aria-labelledby="bd-title">
          <div className="lp-wrap">
            <h2 id="bd-title" className="lp-h2" data-words><Words text="Made for how Bangladeshi gyms already run." /></h2>
          </div>
          <div className="lp-slide" aria-hidden>
            <div className="lp-slide-track">{SLIDE}</div>
          </div>
          <p className="lp-sr">{SLIDE}</p>
          <div className="lp-wrap">
            <div className="lp-fit">
              {FIT.map((f) => (
                <div key={f.h} className="lp-fit-row" data-reveal>
                  <h3 className="lp-fit-h">{f.h}</h3>
                  <p>{f.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="lp-faq lp-wrap" aria-labelledby="faq-title">
          <div className="lp-faq-head">
            <h2 id="faq-title" className="lp-h2" data-words><Words text="Questions owners ask" /></h2>
            <p className="lp-lead" data-reveal>Something else? Open the <Link href="/preview" className="lp-link">live preview</Link> and click around. No account needed.</p>
          </div>
          <div>
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
            <h2 id="close-title" className="lp-display" data-words><Words text="Open the doors tomorrow without the register." /></h2>
            <div className="lp-cta-block" data-reveal>
              <div className="lp-ctas">
                <Link href="/onboarding" className="lp-btn lp-btn--onnavy">Set up your gym</Link>
                <Link href="/desk-qr" className="lp-btn lp-btn--ghost-light">Print the desk QR</Link>
              </div>
              <p className="lp-micro">Sign in with your email. Add members when you are ready.</p>
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
