import { Banknote, BatteryFull, CalendarCheck, Check, Clock, Download, Signal, Users, Wifi } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

/* Product visuals built in code from the real UI language (DESIGN.md): the KPI ledger strip,
   status badges, the member pass. Every number is sample data and the frames say so. */

type Tone = "blue" | "green" | "amber" | "red";

function Badge({ tone, children }: { tone: "active" | "due" | "expired" | "pending"; children: string }) {
  return (
    <span className={`lp-badge lp-badge--${tone}`}>
      {children}
    </span>
  );
}

const KPIS: { label: string; value: string; note: string; tone: Tone; Icon: typeof Users }[] = [
  { label: "Active members", value: "42", note: "4 due this week", tone: "blue", Icon: Users },
  { label: "Today's attendance", value: "18", note: "143 in 7 days", tone: "green", Icon: CalendarCheck },
  { label: "Month revenue", value: "৳68,500", note: "৳4,500 today", tone: "amber", Icon: Banknote },
  { label: "Pending payments", value: "৳3,000", note: "2 waiting", tone: "red", Icon: Clock },
];

export function Ledger() {
  return (
    <div className="lp-ledger">
      {KPIS.map(({ label, value, note, tone, Icon }) => (
        <div key={label} className="lp-kpi">
          <div className="lp-kpi-top">
            <span>{label}</span>
            <span className={`lp-chip-icon lp-chip-icon--${tone}`}>
              <Icon size={16} aria-hidden />
            </span>
          </div>
          <strong className="lp-num">{value}</strong>
          <small className="lp-num">{note}</small>
        </div>
      ))}
    </div>
  );
}

function Person({ initials, name, meta, children }: { initials: string; name: string; meta: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="lp-person">
      <span className="lp-avatar" aria-hidden>{initials}</span>
      <div>
        <b>{name}</b>
        <span>{meta}</span>
      </div>
      {children}
    </div>
  );
}

export function UnpaidAlert({ compact = false }: { compact?: boolean }) {
  return (
    <div className="lp-panel lp-panel--alert">
      <h3>Trained without paying today</h3>
      <Person initials="AH" name="Arif Hasan" meta={<><bdi className="lp-mono">MM-014</bdi> · checked in 06:42 · expired 3 days ago</>}>
        <span className="lp-btn-mini">Take payment</span>
      </Person>
      {!compact && (
        <Person initials="TA" name="Tanvir Ahmed" meta={<><bdi className="lp-mono">MM-027</bdi> · checked in 07:15 · never paid</>}>
          <span className="lp-btn-mini">Take payment</span>
        </Person>
      )}
    </div>
  );
}

function Pending() {
  return (
    <div className="lp-panel">
      <h3>Pending approvals</h3>
      <Person initials="NJ" name="Nusrat Jahan" meta={<>bKash · <bdi className="lp-mono">9F3K2L7Q</bdi> · ৳1,500</>}>
        <span className="lp-btn-mini lp-btn-mini--solid">Confirm</span>
      </Person>
    </div>
  );
}

function Renewals() {
  return (
    <div className="lp-panel">
      <h3>Expiring in 2 days</h3>
      <Person initials="SH" name="Samira Hossain" meta={<>Ends Friday · ৳1,500 plan</>}>
        <span className="lp-btn-mini lp-btn-mini--wa"><WhatsAppIcon size={14} /> WhatsApp</span>
      </Person>
      <Person initials="RK" name="Rafi Karim" meta={<>Ends Friday · ৳2,500 plan</>}>
        <span className="lp-btn-mini lp-btn-mini--wa"><WhatsAppIcon size={14} /> WhatsApp</span>
      </Person>
    </div>
  );
}

export function OwnerView() {
  return (
    <div className="lp-frame lp-frame--wide" aria-hidden>
      <div className="lp-frame-bar">
        <b>Today</b>
        <span className="lp-sample">Sample data</span>
      </div>
      <Ledger />
      <div className="lp-owner-grid">
        <div className="lp-stack">
          <UnpaidAlert />
          <Pending />
        </div>
        <Renewals />
      </div>
    </div>
  );
}

/* One phone screen per step of the check-in and payment flow. */
/** Phone status bar and app header shared by every showcase screen. */
function Chrome({ step }: { step: number }) {
  return (
    <>
      <div className="lp-statusbar" aria-hidden>
        <span className="lp-num">9:41</span>
        <span><Signal size={12} /><Wifi size={12} /><BatteryFull size={14} /></span>
      </div>
      <div className="lp-apphead">
        <span translate="no">GymGrid</span>
        <span className="lp-stepchip lp-num">Step {step + 1} of 5</span>
      </div>
    </>
  );
}

export function StepScreen({ step }: { step: number }) {
  switch (step) {
    case 0:
      return (
        <div className="lp-screen lp-screen--scan">
          <Chrome step={step} />
          <div className="lp-scan-body">
            <div className="lp-viewfinder">
              <svg viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden>
                <rect width="21" height="21" fill="var(--lp-surface)" />
                {QR.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--lp-ink)" />)}
                {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
                  <g key={`f${x}${y}`}>
                    <rect x={x} y={y} width="7" height="7" fill="var(--lp-ink)" />
                    <rect x={x + 1} y={y + 1} width="5" height="5" fill="var(--lp-surface)" />
                    <rect x={x + 2} y={y + 2} width="3" height="3" fill="var(--lp-ink)" />
                  </g>
                ))}
              </svg>
              <i className="lp-scanline" />
              <i className="lp-corner lp-corner--tl" /><i className="lp-corner lp-corner--tr" />
              <i className="lp-corner lp-corner--bl" /><i className="lp-corner lp-corner--br" />
            </div>
            <p>Point the camera at the desk poster</p>
          </div>
        </div>
      );
    case 1:
      return (
        <div className="lp-screen">
          <Chrome step={step} />
          <div className="lp-center-body">
            <span className="lp-bigcheck"><Check size={34} aria-hidden /></span>
            <b className="lp-screen-title">Checked in · <span className="lp-num">06:42</span></b>
            <div className="lp-person lp-person--stack lp-person--wide">
              <span className="lp-avatar" aria-hidden>AH</span>
              <div><b>Arif Hasan</b><span><bdi className="lp-mono">MM-014</bdi> · Monthly plan</span></div>
              <Badge tone="active">Active</Badge>
            </div>
            <div className="lp-meter" aria-hidden><i style={{ inlineSize: "62%" }} /></div>
            <small>Plan active until <span className="lp-num">14 Dec</span></small>
          </div>
        </div>
      );
    case 2:
      return (
        <div className="lp-screen">
          <Chrome step={step} />
          <b className="lp-screen-title">Renew your plan</b>
          <div className="lp-plancard"><span>Monthly plan</span><b className="lp-num">৳1,500</b></div>
          <div className="lp-wallets"><span data-on>bKash</span><span>Nagad</span></div>
          <small>Send Money to <bdi className="lp-mono">01712-345678</bdi>, then paste the TrxID.</small>
          <div className="lp-field"><bdi className="lp-mono">9F3K2L7Q</bdi></div>
          <span className="lp-btn-block">Submit for verification</span>
        </div>
      );
    case 3:
      return (
        <div className="lp-screen">
          <Chrome step={step} />
          <b className="lp-screen-title">Pending verification</b>
          <div className="lp-person lp-person--stack lp-person--wide">
            <span className="lp-avatar" aria-hidden>AH</span>
            <div><b>Arif Hasan</b><span><bdi className="lp-mono">MM-014</bdi> · Monthly plan</span></div>
            <Badge tone="pending">Pending</Badge>
          </div>
          <dl className="lp-receipt">
            <div><dt>Wallet</dt><dd>bKash</dd></div>
            <div><dt>TrxID</dt><dd><bdi className="lp-mono">9F3K2L7Q</bdi></dd></div>
            <div><dt>Amount</dt><dd className="lp-num">৳1,500</dd></div>
          </dl>
          <small>Check the TrxID in your own bKash app, then confirm.</small>
          <span className="lp-btn-block">Confirm payment</span>
        </div>
      );
    default:
      return (
        <div className="lp-screen">
          <Chrome step={step} />
          <div className="lp-receipt-head">
            <span className="lp-bigcheck lp-bigcheck--sm"><Check size={22} aria-hidden /></span>
            <div><b className="lp-screen-title">Paid</b><small>Receipt <bdi className="lp-mono">R-0042</bdi></small></div>
          </div>
          <dl className="lp-receipt">
            <div><dt>Member</dt><dd>Arif Hasan</dd></div>
            <div><dt>Paid with</dt><dd>bKash</dd></div>
            <div><dt>TrxID</dt><dd><bdi className="lp-mono">9F3K2L7Q</bdi></dd></div>
            <div><dt>Amount</dt><dd className="lp-num">৳1,500</dd></div>
            <div><dt>New expiry</dt><dd className="lp-num">14 Jan</dd></div>
          </dl>
          <span className="lp-btn-block lp-btn-block--ghost"><Download size={16} aria-hidden /> Download PDF</span>
        </div>
      );
  }
}

export function MemberPass() {
  const bars = [40, 70, 55, 85, 0, 60, 100];
  return (
    <div className="lp-screen lp-screen--pass">
      <div className="lp-pass">
        <div className="lp-pass-top">
          <span>Member pass</span>
          <Badge tone="active">Active</Badge>
        </div>
        <bdi className="lp-mono lp-pass-code">MM-014</bdi>
        <b>Arif Hasan</b>
        <small>Monthly plan · ends <span className="lp-num">14 Dec</span></small>
        <div className="lp-pulse" aria-hidden>
          {bars.map((h, i) => <i key={i} data-today={i === 6 || undefined} style={{ blockSize: `${Math.max(h, 8)}%` }} />)}
        </div>
        <small>Last 7 days</small>
      </div>
      <span className="lp-btn-block">Check in</span>
      <span className="lp-btn-block lp-btn-block--ghost">Renew or pay</span>
    </div>
  );
}

/* Deterministic QR-like pattern so server and client render the same markup. */
const QR: [number, number][] = (() => {
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out: [number, number][] = [];
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 21; x++) {
      if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
      if (r() > 0.5) out.push([x, y]);
    }
  return out;
})();

