"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CalendarClock,
  Check,
  CreditCard,
  Pause,
  Play,
  QrCode,
  Radio,
  ScanLine,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

/* Panoramic interactive workspace for the centered hero showcase.
   Shows four live operational panes (Reception queue, Pending TrxID, Member pass,
   and 48h WhatsApp renewals) separated cleanly by architectural hairlines. */

type Status = "active" | "due" | "expired" | "paid";
type PaneId = "queue" | "trx" | "pass" | "renew";

interface Row {
  id: number;
  name: string;
  code: string;
  time: string;
  plan: string;
  method: "bKash" | "Nagad" | "Desk";
  trxId?: string;
  status: Status;
  fee: number;
}

const ARRIVALS: Omit<Row, "id" | "time">[] = [
  { name: "Samira Hossain", code: "MM-008", plan: "Monthly", method: "Desk", status: "active", fee: 1500 },
  { name: "Arif Hasan", code: "MM-014", plan: "Monthly", method: "bKash", trxId: "9F3K2L7Q", status: "expired", fee: 1500 },
  { name: "Rafi Karim", code: "MM-021", plan: "Quarterly", method: "Desk", status: "active", fee: 4000 },
  { name: "Tanvir Ahmed", code: "MM-027", plan: "Monthly", method: "Nagad", trxId: "4M8P1W6C", status: "due", fee: 1500 },
  { name: "Nusrat Jahan", code: "MM-031", plan: "Monthly", method: "Desk", status: "active", fee: 1500 },
  { name: "Imran Chowdhury", code: "MM-035", plan: "Quarterly", method: "bKash", trxId: "7T2N5R9X", status: "due", fee: 4000 },
];

const START_MIN = 6 * 60 + 40;
const BASE_CHECKINS = 16;
const BASE_COLLECTED = 4500;
const VISIBLE = 4;
const REDUCE = "(prefers-reduced-motion: reduce)";

const subscribeMotion = (cb: () => void) => {
  const m = matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const fmtTime = (n: number) => {
  const m = START_MIN + n * 3;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const arrive = (n: number): Row => ({ ...ARRIVALS[n % ARRIVALS.length], id: n, time: fmtTime(n) });
const taka = (n: number) => `৳${n.toLocaleString("en-US")}`;
const LABEL: Record<Status, string> = { active: "Active", due: "Ends in 2d", expired: "Expired", paid: "Confirmed" };

const PANES: { id: PaneId; label: string; short: string; meta: string }[] = [
  { id: "queue", label: "Reception queue", short: "Queue", meta: "Live QR scans" },
  { id: "trx", label: "Pending TrxID", short: "TrxIDs", meta: "bKash & Nagad" },
  { id: "pass", label: "Member pass", short: "Member pass", meta: "Phone browser" },
  { id: "renew", label: "48h renewals", short: "Renewals", meta: "WhatsApp ready" },
];

export function HeroDesk() {
  const [pane, setPane] = useState<PaneId>("queue");
  const [rows, setRows] = useState<Row[]>(() => [arrive(3), arrive(2), arrive(1), arrive(0)]);
  const [paid, setPaid] = useState(0);
  const [passSubmitted, setPassSubmitted] = useState(false);
  const [waSent, setWaSent] = useState<Record<string, boolean>>({});

  const still = useSyncExternalStore(subscribeMotion, () => matchMedia(REDUCE).matches, () => false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = choice ?? !still;
  const [held, setHeld] = useState(false);
  const [announce, setAnnounce] = useState("");
  const next = useRef(4);

  const scan = useCallback(() => {
    const n = next.current++;
    if (n >= 16) {
      next.current = 4;
      setRows([arrive(3), arrive(2), arrive(1), arrive(0)]);
      setPaid(0);
      return;
    }
    setRows((r) => [arrive(n), ...r]);
  }, []);

  useEffect(() => {
    if (!playing || held || pane !== "queue") return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") scan();
    }, 3600);
    return () => window.clearInterval(t);
  }, [playing, held, pane, scan]);

  const confirmPayment = (row: Row) => {
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: "paid" } : x)));
    setPaid((p) => p + row.fee);
    setAnnounce(`${row.name} verified (${taka(row.fee)}). Plan extended.`);
  };

  const owes = (r: Row) => r.status === "expired" || r.status === "due";
  const unpaidRows = rows.filter(owes);
  const shown = [...unpaidRows, ...rows.filter((r) => !owes(r))].slice(0, VISIBLE);
  const checkins = BASE_CHECKINS + rows.length;

  const renderPaneIcon = (id: PaneId) => {
    if (id === "queue") return <ScanLine size={16} aria-hidden />;
    if (id === "trx") return <CreditCard size={16} aria-hidden />;
    if (id === "pass") return <Smartphone size={16} aria-hidden />;
    return <CalendarClock size={16} aria-hidden />;
  };

  return (
    <div
      className="lp-desk"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false);
      }}
    >
      <aside className="lp-desk-rail" aria-label="Workspace sections">
        <div className="lp-desk-rail-head">
          <span className="lp-desk-live" data-on={(playing && !held && pane === "queue") || undefined}>
            <Radio size={15} aria-hidden />
            <span>Our Gym</span>
          </span>
          <span className="lp-desk-tz lp-mono">Asia/Dhaka</span>
        </div>

        <div
          className="lp-desk-nav"
          role="tablist"
          aria-label="GymGrid views"
          onKeyDown={(e) => {
            const idx = PANES.findIndex((p) => p.id === pane);
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              e.preventDefault();
              setPane(PANES[(idx + 1) % PANES.length].id);
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              e.preventDefault();
              setPane(PANES[(idx - 1 + PANES.length) % PANES.length].id);
            }
          }}
        >
          {PANES.map((item) => {
            const count =
              item.id === "queue"
                ? checkins
                : item.id === "trx"
                  ? unpaidRows.length
                  : undefined;

            return (
              <button
                key={item.id}
                id={`hero-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={pane === item.id}
                aria-controls={`hero-panel-${item.id}`}
                className="lp-desk-nav-btn"
                onClick={() => setPane(item.id)}
              >
                {renderPaneIcon(item.id)}
                <span className="lp-desk-nav-text">
                  <strong className="lp-desk-nav-full">{item.label}</strong>
                  <strong className="lp-desk-nav-short">{item.short}</strong>
                  <small>{item.meta}</small>
                </span>
                {count != null ? (
                  <span className="lp-desk-nav-count lp-num">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <dl className="lp-desk-rail-summary">
          <div>
            <dt>Collected today</dt>
            <dd className="lp-num" key={`s${paid}`}>{taka(BASE_COLLECTED + paid)}</dd>
          </div>
          <div>
            <dt>Pending TrxIDs</dt>
            <dd className="lp-num" data-warn={unpaidRows.length > 0 || undefined}>
              {unpaidRows.length}
            </dd>
          </div>
        </dl>
      </aside>

      <div className="lp-desk-main">
        <div className="lp-desk-topbar">
          <div className="lp-desk-topbar-title">
            <strong>{PANES.find((p) => p.id === pane)?.label}</strong>
            <span className="lp-desk-topbar-sub">Sample desk activity</span>
          </div>

          <div className="lp-desk-tools">
            <button
              type="button"
              className="lp-desk-tool"
              onClick={scan}
              aria-label="Simulate QR scan"
            >
              <ScanLine size={15} aria-hidden />
              <span>Simulate scan</span>
            </button>
            <button
              type="button"
              className="lp-desk-tool lp-desk-tool--icon"
              onClick={() => setChoice(!playing)}
              aria-label={playing ? "Pause live check-ins" : "Play live check-ins"}
              aria-pressed={!playing}
            >
              {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
            </button>
          </div>
        </div>

        <dl className="lp-desk-stats">
          <div>
            <dt>Checked in today</dt>
            <dd className="lp-num" key={`c${checkins}`}>{checkins}</dd>
          </div>
          <div data-warn={unpaidRows.length > 0 || undefined}>
            <dt>Need verification</dt>
            <dd className="lp-num" key={`u${unpaidRows.length}`}>{unpaidRows.length}</dd>
          </div>
          <div>
            <dt>Collected today</dt>
            <dd className="lp-num" key={`p${paid}`}>{taka(BASE_COLLECTED + paid)}</dd>
          </div>
        </dl>

        {pane === "queue" ? (
          <div id="hero-panel-queue" role="tabpanel" aria-labelledby="hero-tab-queue">
            <ul className="lp-desk-list" aria-label="Recent check-ins">
              {shown.map((r) => (
                <li key={r.id} className="lp-desk-row" data-status={r.status}>
                  <span className="lp-avatar" aria-hidden>
                    {r.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div className="lp-desk-who">
                    <b>{r.name}</b>
                    <span className="lp-desk-meta">
                      <bdi className="lp-mono">{r.code}</bdi>
                      <span>{r.plan}</span>
                      <time>{r.time}</time>
                      {r.trxId && owes(r) ? (
                        <span className="lp-mono">{r.method} {r.trxId}</span>
                      ) : null}
                    </span>
                  </div>
                  {owes(r) ? (
                    <button
                      type="button"
                      className="lp-desk-confirm"
                      onClick={() => confirmPayment(r)}
                    >
                      Verify {taka(r.fee)}
                    </button>
                  ) : (
                    <span className={`lp-badge lp-badge--${r.status === "paid" ? "active" : r.status}`}>
                      {r.status === "paid" ? <Check size={12} aria-hidden /> : null}
                      {LABEL[r.status]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pane === "trx" ? (
          <div id="hero-panel-trx" role="tabpanel" aria-labelledby="hero-tab-trx">
            <ul className="lp-desk-list" aria-label="Pending mobile wallet payments">
              {unpaidRows.length === 0 ? (
                <li className="lp-desk-empty">
                  <Check size={18} aria-hidden />
                  <span>All submitted TrxIDs verified for today. Receipts dispatched.</span>
                </li>
              ) : (
                unpaidRows.slice(0, VISIBLE).map((r) => (
                  <li key={r.id} className="lp-desk-row">
                    <span className="lp-avatar" aria-hidden>
                      {r.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <div className="lp-desk-who">
                      <b>{r.name}</b>
                      <span className="lp-desk-meta">
                        <bdi className="lp-mono">{r.trxId ?? "Cash"}</bdi>
                        <span>{r.method}</span>
                        <span>{r.plan}</span>
                        <span className="lp-num">{taka(r.fee)}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="lp-desk-confirm"
                      onClick={() => confirmPayment(r)}
                    >
                      Confirm &amp; extend
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}

        {pane === "pass" ? (
          <div id="hero-panel-pass" className="lp-hero-pass" role="tabpanel" aria-labelledby="hero-tab-pass">
            <div className="lp-hero-pass-row lp-hero-pass-head">
              <div>
                <span className="lp-hero-pass-kicker">Member mobile pass</span>
                <b>Arif Hasan</b>
                <span className="lp-desk-meta">
                  <bdi className="lp-mono">MM-014</bdi>
                  <span>Monthly plan</span>
                </span>
              </div>
              <span className={`lp-badge ${passSubmitted ? "lp-badge--pending" : "lp-badge--active"}`}>
                {passSubmitted ? "TrxID queued" : "Checked in 06:43"}
              </span>
            </div>

            <div className="lp-hero-pass-row lp-hero-pass-qr">
              <div className="lp-hero-pass-qr-icon">
                <QrCode size={20} aria-hidden />
              </div>
              <div>
                <b>bKash Send Money</b>
                <span>Send {taka(1500)} to 017XX-XXXXXX and enter your TrxID</span>
              </div>
            </div>

            <div className="lp-hero-pass-row lp-hero-pass-trx">
              <div>
                <span className="lp-hero-pass-label">Submitted TrxID</span>
                <code className="lp-mono">9F3K2L7Q</code>
              </div>
              <button
                type="button"
                className="lp-desk-confirm"
                onClick={() => {
                  setPassSubmitted((s) => !s);
                  setAnnounce(
                    !passSubmitted
                      ? "TrxID 9F3K2L7Q submitted for staff confirmation."
                      : "TrxID submission reset.",
                  );
                }}
              >
                <ShieldCheck size={14} aria-hidden />
                <span>{passSubmitted ? "Sent to desk" : "Submit TrxID"}</span>
              </button>
            </div>
          </div>
        ) : null}

        {pane === "renew" ? (
          <div id="hero-panel-renew" role="tabpanel" aria-labelledby="hero-tab-renew">
            <ul className="lp-desk-list" aria-label="48-hour renewal queue">
              {[
                { name: "Tanvir Ahmed", code: "MM-027", note: "Ends in 2 days", fee: 1500 },
                { name: "Imran Chowdhury", code: "MM-035", note: "Ends tomorrow", fee: 4000 },
                { name: "Nusrat Jahan", code: "MM-031", note: "Ends in 2 days", fee: 1500 },
              ].map((m) => (
                <li key={m.code} className="lp-desk-row">
                  <span className="lp-avatar" aria-hidden>
                    {m.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div className="lp-desk-who">
                    <b>{m.name}</b>
                    <span className="lp-desk-meta">
                      <bdi className="lp-mono">{m.code}</bdi>
                      <span>{m.note}</span>
                      <span className="lp-num">{taka(m.fee)}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className={waSent[m.code] ? "lp-desk-tool" : "lp-desk-confirm lp-desk-wa"}
                    onClick={() => {
                      setWaSent((w) => ({ ...w, [m.code]: !w[m.code] }));
                      setAnnounce(`Prepared WhatsApp reminder for ${m.name}.`);
                    }}
                  >
                    <WhatsAppIcon size={14} />
                    <span>{waSent[m.code] ? "WhatsApp opened" : "Send reminder"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="lp-sr" role="status">{announce}</p>
    </div>
  );
}
