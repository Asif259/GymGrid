import { cn } from "@/lib/utils";

interface SiteFooterProps {
  brandName?: string;
  className?: string;
}

/**
 * Shared minimal application footer keeping the gym copyright visually separate
 * from the developer credit.
 */
export function SiteFooter({ brandName = "GymGrid", className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "mt-auto border-t border-border/70 py-4 text-xs text-muted-foreground print:hidden",
        className,
      )}
    >
      <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-start">
        <p className="text-muted-foreground/90">
          © <span suppressHydrationWarning>{year}</span>{" "}
          <span translate="no">{brandName}</span>
        </p>
        <p className="border-t border-border/50 pt-2 text-muted-foreground/80 sm:border-t-0 sm:border-s sm:ps-4 sm:pt-0">
          Designed &amp; built by{" "}
          <a
            href="https://ashrafulasif.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
          >
            Ashraful Asif
          </a>
        </p>
      </div>
    </footer>
  );
}
