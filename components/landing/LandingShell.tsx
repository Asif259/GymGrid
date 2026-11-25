"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { FAQ } from "./faq";

gsap.registerPlugin(ScrollTrigger);

const CHAPTERS = [
  {
    n: "01",
    title: "Members scan in at the desk",
    body: "Print the Desk QR poster on plain paper. Members scan it with their phone camera, and the desk screen flags anyone whose plan is due or expired.",
    row: { name: "Samira Hossain", meta: "Checked in · 06:42", status: "active" },
  },
  {
    n: "02",
    title: "bKash and Nagad land in one queue",
    body: "Members send the fee to your gym number and type the TrxID into their pass. You match it to your wallet and confirm once. The expiry date and receipt update together.",
    row: { name: "Arif Hasan", meta: "bKash · TrxID 9F3K2L7Q · ৳1,500", status: "pending" },
  },
  {
    n: "03",
    title: "Renewals show up two days early",
    body: "Plans ending in 48 hours appear on the desk with a WhatsApp reminder already written. It opens in your own WhatsApp, so sending it costs nothing.",
    row: { name: "Nusrat Jahan", meta: "Expires in 2 days", status: "due" },
  },
  {
    n: "04",
    title: "Workout and diet plans go to their phone",
    body: "Build a plan once and assign it to a member or a whole group. It stays in their pass between sessions.",
    row: { name: "Tanvir Ahmed", meta: "Push / Pull / Legs · shared", status: "active" },
  },
] as const;

const FEATURES = [
  { k: "Catch unpaid walk-ins at the door", v: "Every scan appears on the desk screen with the member's plan status, so an expired plan is flagged before they reach the floor." },
  { k: "Confirm every payment in one place", v: "Each bKash and Nagad TrxID waits in Pending Verification. Tap confirm and the member's expiry date and PDF receipt are done." },
  { k: "Renew members before they lapse", v: "Anyone whose plan ends in two days is listed with a WhatsApp link to send them a reminder." },
  { k: "Start the day knowing who is due", v: "An 8 AM email lists yesterday's check ins, payments received and today's renewals." },
];

const SURFACES = [
  { href: "/admin", tag: "Owner and front desk", title: "Admin", body: "Members, plans, payments and receipts in one place." },
  { href: "/member", tag: "Member mobile pass", title: "Member", body: "Opens in the phone's browser and pins to the home screen like an app." },
  { href: "/desk", tag: "Live reception screen", title: "Desk", body: "Every scan, as it happens, with the member's plan status." },
];

const TICKER = ["Replace the paper register", "bKash and Nagad TrxID", "WhatsApp reminders", "Printed QR poster", "PDF receipts", "8 AM owner report", "Asia/Dhaka time"];

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
            html.classList.remove("lp-motion");
            return;
          }

          lenis = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: { offset: -72 } });
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);

          // Hero: eyebrow, headline words, lead, CTAs, then the phone and its chips.
          const hero = gsap.timeline({ defaults: { ease: "power4.out" } });
          hero
            .fromTo(".lp-hero [data-enter='eyebrow']", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7 })
            .fromTo(".lp-hero .lp-word", { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.05 }, "-=0.45")
            .set(".lp-hero h1", { autoAlpha: 1 }, 0)
            .fromTo(".lp-sweep", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.inOut" }, "-=0.5")
            .fromTo(".lp-hero [data-enter='copy']", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08 }, "-=0.7")
            .fromTo(".lp-phone", { y: 48, autoAlpha: 0, rotate: 2 }, { y: 0, autoAlpha: 1, rotate: 0, duration: 1.1, ease: "expo.out" }, 0.35)
            .fromTo(".lp-chip", { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, stagger: 0.15, ease: "power3.out" }, "-=0.5");

          // Section headings: words rise out of a mask once.
          gsap.utils.toArray<HTMLElement>("[data-words]").forEach((el) =>
            gsap.fromTo(el.querySelectorAll(".lp-word"), { yPercent: 110 }, {
              yPercent: 0, duration: 0.95, ease: "power4.out", stagger: 0.04,
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
            gsap.fromTo(el, { y: 32, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((group) =>
            gsap.fromTo(group.children, { y: 36, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.08,
              scrollTrigger: { trigger: group, start: "top 82%", once: true },
            }),
          );
          gsap.utils.toArray<HTMLElement>("[data-speed]").forEach((el) =>
            gsap.to(el, {
              yPercent: -Number(el.dataset.speed), ease: "none",
              scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1.2 },
            }),
          );

          if (desktop) {
            // Pinned story: one chapter per viewport of scroll, snapping to each chapter.
            const last = CHAPTERS.length - 1;
            gsap.timeline({
              scrollTrigger: {
                trigger: ".lp-story",
                start: "top top",
                end: () => `+=${window.innerHeight * last}`,
                pin: ".lp-story-stage",
                anticipatePin: 1,
                scrub: 0.8,
                snap: { snapTo: 1 / last, duration: { min: 0.2, max: 0.5 }, ease: "power2.inOut" },
                invalidateOnRefresh: true,
                onUpdate: (s) => setActive(Math.round(s.progress * last)),
              },
            }).fromTo(".lp-progress-bar", { scaleY: 0 }, { scaleY: 1, ease: "none" });
          } else {
            gsap.fromTo(".lp-step", { y: 28, autoAlpha: 0 }, {
              y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.1,
              scrollTrigger: { trigger: ".lp-steps", start: "top 82%", once: true },
            });
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

    // Fonts and images shift layout after first paint; re-measure triggers once.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);

    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
      ctx.revert();
      html.classList.remove("lp-motion");
    };
  }, []);

  const chapter = CHAPTERS[active];

  return (
    <div ref={root} className="lp">
      <a href="#main-content" className="lp-skip">Skip to content</a>

      <header className="lp-nav">
        <Link href="/" className="lp-brand">Our Gym</Link>
        <nav aria-label="Primary" className="lp-nav-links">
          <a href="#story">How it works</a>
          <a href="#surfaces">Screens</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link href="/onboarding" className="lp-btn lp-btn--sm">Set up your gym</Link>
      </header>

      <main id="main-content">
        <section className="lp-hero lp-wrap" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow" data-enter="eyebrow">For gym owners and front-desk staff in Bangladesh</p>
            <h1 id="hero-title" className="lp-display" data-enter="title">
              <Words text="Replace the" />{" "}
              <span className="lp-mark"><Words text="paper register" /><span className="lp-sweep" aria-hidden /></span>{" "}
              <Words text="at your front desk." />
            </h1>
            <p className="lp-lead" data-enter="copy">
              Members check in by scanning a printed QR. Their bKash and Nagad payments arrive with the TrxID, ready for you to confirm. Plans ending in two days come with a WhatsApp reminder ready to send.
            </p>
            <div className="lp-cta-block" data-enter="copy">
              <div className="lp-ctas">
                <Link href="/onboarding" className="lp-btn">Set up your gym <span className="lp-arrow" aria-hidden>→</span></Link>
                <Link href="/preview" className="lp-btn lp-btn--ghost">See the live preview</Link>
              </div>
              <p className="lp-micro">Runs in the browser on any phone or laptop. Members install nothing.</p>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-phone">
              <Image src="/images/screens/preview-phone.png" alt="Gym dashboard on a phone: 42 active members, 18 check ins today, ৳68,500 this month" width={390} height={844} priority />
            </div>
            <div className="lp-chip lp-chip--a" data-speed="40">
              <span className="lp-dot lp-dot--pending" /> TrxID received · ৳1,500
            </div>
            <div className="lp-chip lp-chip--b" data-speed="80">
              <span className="lp-dot lp-dot--active" /> Checked in · 06:42
            </div>
          </div>
        </section>

        <section id="story" className="lp-story" aria-labelledby="story-title">
          <div className="lp-story-stage lp-wrap">
            <div className="lp-story-copy">
              <p className="lp-eyebrow">How it works</p>
              <h2 id="story-title" className="lp-h2 lp-story-title" data-words><Words text="One morning at the desk." /></h2>
              <ol className="lp-steps">
                {CHAPTERS.map((c, i) => (
                  <li key={c.n} className="lp-step" data-active={i === active || undefined}>
                    <span className="lp-num">{c.n}</span>
                    <div>
                      <h3 className="lp-h3">{c.title}</h3>
                      <p>{c.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lp-story-panel" aria-hidden>
              <div className="lp-progress"><span className="lp-progress-bar" /></div>
              <div className="lp-queue">
                <div className="lp-queue-head">
                  <span>Desk · Today</span>
                  <span className="lp-num">{chapter.n} / 04</span>
                </div>
                {CHAPTERS.map((c, i) => (
                  <div key={c.n} className="lp-queue-row" data-on={i === active || undefined}>
                    <div>
                      <strong>{c.row.name}</strong>
                      <span>{c.row.meta}</span>
                    </div>
                    <span className={`lp-status lp-status--${c.row.status}`}>{c.row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-features lp-wrap" aria-labelledby="features-title">
          <h2 id="features-title" className="lp-h2" data-words><Words text="Built around bKash, WhatsApp and a front desk." /></h2>
          <div className="lp-grid" data-stagger>
            {FEATURES.map((f, i) => (
              <article key={f.k} className="lp-card">
                <span className="lp-num lp-card-n">0{i + 1}</span>
                <h3 className="lp-h3">{f.k}</h3>
                <p>{f.v}</p>
              </article>
            ))}
          </div>
          <div className="lp-inline-cta" data-reveal>
            <p>Your desk can run this way by tomorrow morning.</p>
            <Link href="/onboarding" className="lp-btn">Set up your gym <span className="lp-arrow" aria-hidden>→</span></Link>
          </div>
        </section>

        <div className="lp-ticker" aria-hidden>
          <div className="lp-ticker-track">
            {[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>

        <section id="surfaces" className="lp-surfaces" aria-labelledby="surfaces-title">
          <div className="lp-wrap">
            <h2 id="surfaces-title" className="lp-h2" data-words><Words text="Three screens. One gym." /></h2>
            <div className="lp-shot" data-reveal>
              <div data-speed="6">
                <Image src="/images/screens/preview-desktop.png" alt="Admin dashboard with members, payments and attendance" width={1440} height={900} sizes="(min-width: 72rem) 72rem, 100vw" />
              </div>
            </div>
            <div className="lp-grid lp-grid--3" data-stagger>
              {SURFACES.map((s) => (
                <Link key={s.href} href={s.href} className="lp-card lp-card--link">
                  <span className="lp-eyebrow">{s.tag}</span>
                  <h3 className="lp-h3">{s.title} <span className="lp-arrow" aria-hidden>→</span></h3>
                  <p>{s.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="lp-faq lp-wrap" aria-labelledby="faq-title">
          <div className="lp-faq-head">
            <h2 id="faq-title" className="lp-h2" data-words><Words text="Questions owners ask" /></h2>
            <p className="lp-lead" data-reveal>Something else? Open the <Link href="/preview" className="lp-link">live preview</Link> and click around. No account needed.</p>
          </div>
          <div data-stagger>
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
                <Link href="/onboarding" className="lp-btn lp-btn--light">Set up your gym <span className="lp-arrow" aria-hidden>→</span></Link>
                <Link href="/desk-qr" className="lp-btn lp-btn--ghost-light">Print the desk QR</Link>
              </div>
              <p className="lp-micro">Sign in with your email. Add members when you are ready.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot lp-wrap">
        <span>Our Gym · Member operations for Bangladesh gyms</span>
        <nav aria-label="Footer">
          <Link href="/admin">Admin</Link>
          <Link href="/member">Member</Link>
          <Link href="/desk">Desk</Link>
          <Link href="/desk-qr">Desk QR</Link>
          <Link href="/checkin">Check in</Link>
        </nav>
      </footer>
    </div>
  );
}
