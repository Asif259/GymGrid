"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, MapPin, QrCode, Wallet, MessageCircle } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FAQ } from "./faq";
import { HeroDesk } from "./HeroDesk";
import { MemberPass, OwnerView, StepScreen } from "./mocks";
import { WalkthroughFilm } from "./WalkthroughFilm";

const HERO_LINES = ["Run your gym.", "Lose the register."] as const;

const FIGURES = [
  { n: "৳0", d: "gateway fees. Members pay your own bKash or Nagad number." },
  { n: "৳0", d: "SMS bills. Renewal reminders open in your WhatsApp." },
  { n: "1", d: "printed QR poster instead of cards or turnstiles." },
  { n: "07:04", d: "morning report, every day, Dhaka time." },
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

function SecHead({ label, id, title, children }: { label: string; id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="lp-sec-head">
      <i className="lp-rule" data-rule aria-hidden />
      <p className="lp-label">{label}</p>
      <h2 id={id} className="lp-h2" data-words><Words text={title} /></h2>
      {children}
    </div>
  );
}

export function LandingShell() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const landing = root.current;
    if (!landing || !("IntersectionObserver" in window)) return;

    const preference = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const targets = [...landing.querySelectorAll<HTMLElement>(
      "[data-reveal], [data-words], [data-rule], [data-stagger]",
    )];
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.setAttribute("data-reveal-state", "visible");
        observer.unobserve(target);
      }
    }, { rootMargin: "0px 0px -7% 0px" });

    const syncMotion = () => {
      observer.disconnect();
      for (const target of targets) {
        if (preference.matches && target.getBoundingClientRect().top >= window.innerHeight) {
          target.dataset.revealState = "pending";
          observer.observe(target);
        } else {
          delete target.dataset.revealState;
        }
      }
    };

    syncMotion();
    preference.addEventListener("change", syncMotion);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", syncMotion);
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
          <Link href="/preview" className="lp-nav-preview">Preview</Link>
          <Link href="/admin?entry=login" prefetch={false} className="lp-btn lp-btn--sm lp-btn--ghost">Login</Link>
          <Link href="/onboarding" className="lp-btn lp-btn--sm">Set up your gym</Link>
        </div>
      </header>

      <main id="main-content">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-media">
            <Image src="/images/gymgrid-front-desk.webp" alt="" fill sizes="100vw" preload />
          </div>
          <div className="lp-wrap lp-hero-inner">
            <p className="lp-label" data-hero-fade><MapPin size={15} aria-hidden /> Built for gyms in Bangladesh</p>
            <h1 id="hero-title" className="lp-display">
              <span className="lp-sr">{HERO_LINES.join(" ")}</span>
              <span aria-hidden>
                {HERO_LINES.map((line) => (
                  <span key={line} className="lp-line"><span data-hero-in>{line}</span></span>
                ))}
              </span>
            </h1>
            <p className="lp-lead" data-hero-fade>
              Run QR check-ins, verify bKash and Nagad payments, and see whose membership is due. All from one front desk.
            </p>
            <div className="lp-ctas" data-hero-fade>
              <Link href="/onboarding" className="lp-btn">Set up your gym <ArrowUpRight size={17} aria-hidden /></Link>
              <Link href="/preview" className="lp-btn lp-btn--ghost">See live preview</Link>
            </div>
            <a className="lp-hero-scroll" href="#problem"><ArrowDown size={15} aria-hidden /> Explore GymGrid</a>
          </div>
        </section>

        <div className="lp-capabilities">
          <ul className="lp-wrap">
            <li><QrCode size={18} aria-hidden /> QR check-ins</li>
            <li><Wallet size={18} aria-hidden /> bKash &amp; Nagad</li>
            <li><MessageCircle size={18} aria-hidden /> WhatsApp reminders</li>
          </ul>
        </div>

        <section id="problem" className="lp-sec lp-wrap" aria-labelledby="problem-title">
          <SecHead label="The front desk" id="problem-title" title="Know who checked in and who paid.">
            <p className="lp-lead" data-reveal>Try the desk below. Switch views to see how GymGrid handles attendance, payments, and renewals.</p>
          </SecHead>
          <div className="lp-hero-stage" data-reveal>
            <div className="lp-hero-visual">
              <HeroDesk />
            </div>
          </div>
          <dl className="lp-figs" data-stagger>
            {FIGURES.map((figure) => (
              <div key={figure.d} className="lp-fig">
                <dt>{figure.n}</dt>
                <dd>{figure.d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="lp-how" aria-labelledby="how-title">
          <div className="lp-how-stage lp-wrap">
            <div className="lp-how-copy">
              <div className="lp-sec-head">
                <i className="lp-rule" data-rule aria-hidden />
                <p className="lp-label">How it works</p>
                <h2 id="how-title" className="lp-h2" data-words><Words text="From the door to the receipt." /></h2>
              </div>
              <ol className="lp-steps" data-stagger>
                {STEPS.map((s, i) => (
                  <li key={s.title} className="lp-step" data-active={i === active || undefined}>
                    <h3 className="lp-h3">
                      <button type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
                        {s.title}<ArrowUpRight size={16} aria-hidden />
                      </button>
                    </h3>
                    <p>{s.body}</p>
                    {i === active && <div className="lp-phone lp-phone--inline" aria-hidden><StepScreen step={i} /></div>}
                  </li>
                ))}
              </ol>
            </div>
            <div className="lp-how-visual" data-reveal aria-hidden>
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
          <SecHead label="Walkthrough" id="walkthrough-title" title="Thirty seconds at the front desk.">
            <p className="lp-lead" data-reveal>
              One member scans in at 06:42, clears an expired fee with a bKash TrxID, and gets a PDF receipt without touching paper.
            </p>
          </SecHead>
          <WalkthroughFilm />
        </section>

        <section id="owner" className="lp-sec lp-owner lp-wrap" aria-labelledby="owner-title">
          <SecHead label="Owner view" id="owner-title" title="Money truth, at a glance.">
            <p className="lp-lead" data-reveal>
              Active members, today&rsquo;s attendance, revenue and pending payments sit in one strip. Anyone who trained without paying is listed below it.
            </p>
          </SecHead>
          <div data-reveal><OwnerView /></div>
        </section>

        <section id="member" className="lp-sec lp-wrap" aria-labelledby="member-title">
          <SecHead label="Member pass" id="member-title" title="A pass that lives on their phone." />
          <div className="lp-member-body">
            <div className="lp-phone lp-phone--pass" aria-hidden data-reveal><MemberPass /></div>
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
          <SecHead label="Local fit" id="bd-title" title="Made for how Bangladeshi gyms already run." />
          <div className="lp-fit" data-stagger>
            {FIT.map((f) => (
              <div key={f.h} className="lp-fit-row">
                <h3 className="lp-fit-h">{f.h}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="lp-sec lp-wrap" aria-labelledby="faq-title">
          <SecHead label="FAQ" id="faq-title" title="Questions owners ask.">
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
            <p className="lp-label">Get started</p>
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
