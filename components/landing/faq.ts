// Shared by the landing FAQ list and the FAQPage JSON-LD in app/page.tsx, so the two never drift.
export const FAQ = [
  { q: "Do we need turnstile hardware or RFID cards?", a: "No. Print the Desk QR poster on regular paper and put it at reception. Members scan it with their phone camera and the desk screen updates straight away." },
  { q: "How does bKash and Nagad verification work?", a: "Members send their fee to your gym number with Send Money and enter the TrxID in their mobile pass. It lands in your Pending Verification queue. You confirm once, their expiry date moves forward and a receipt is issued." },
  { q: "Will we pay gateway or SMS fees?", a: "Members pay straight into your own bKash or Nagad number, so no payment gateway takes a cut. Renewal reminders open in your WhatsApp, so there is no SMS bill either." },
  { q: "Do members have to install an app?", a: "No. The member pass runs in any mobile browser and can be added to the home screen in a few taps." },
  { q: "Who can see our member list?", a: "Only your gym's owner and staff accounts. Each member sees their own pass, payments, plans and receipts, nothing else." },
  { q: "What happens when I click Set up your gym?", a: "You sign in with your email, name your gym and add your branding. Then you can add members, set up plans and print the Desk QR poster." },
] as const;
