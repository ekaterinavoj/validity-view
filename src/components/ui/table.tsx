import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Table — globální wrapper s podporou sticky horizontálního scrollbaru.
 * 
 * Automaticky obaluje tabulku do scrollovatelného kontejneru a navíc
 * zobrazí přilepený horizontální posuvník dole ve viewportu, pokud je
 * tabulka mimo zobrazenou oblast (uživatel nemusí skrolovat na konec
 * tabulky a zpět). Aktivuje se jen při skutečném horizontálním přetečení.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const proxyRef = React.useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = React.useState(false);
    const [showSticky, setShowSticky] = React.useState(false);
    const [scrollWidth, setScrollWidth] = React.useState(0);
    const [containerRect, setContainerRect] = React.useState<DOMRect | null>(null);
    const isSyncing = React.useRef(false);

    const update = React.useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      const overflowing = el.scrollWidth > el.clientWidth + 1;
      setIsOverflowing(overflowing);
      setScrollWidth(el.scrollWidth);
      const rect = el.getBoundingClientRect();
      setContainerRect(rect);
      const viewportH = window.innerHeight;
      // Sticky bar: jen pokud je tabulka v dohledu, ale její spodek je pod viewportem
      setShowSticky(overflowing && rect.bottom > viewportH - 8 && rect.top < viewportH - 40);
    }, []);

    React.useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      const inner = el.querySelector("table");
      if (inner) ro.observe(inner);
      const handler = () => update();
      window.addEventListener("scroll", handler, { passive: true });
      window.addEventListener("resize", handler, { passive: true });
      return () => {
        ro.disconnect();
        window.removeEventListener("scroll", handler);
        window.removeEventListener("resize", handler);
      };
    }, [update]);

    const onContentScroll = React.useCallback(() => {
      if (isSyncing.current) return;
      const c = containerRef.current;
      const p = proxyRef.current;
      if (!c || !p) return;
      isSyncing.current = true;
      p.scrollLeft = c.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    }, []);

    const onProxyScroll = React.useCallback(() => {
      if (isSyncing.current) return;
      const c = containerRef.current;
      const p = proxyRef.current;
      if (!c || !p) return;
      isSyncing.current = true;
      c.scrollLeft = p.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    }, []);

    return (
      <>
        <div
          ref={containerRef}
          className="relative w-full overflow-auto"
          onScroll={onContentScroll}
        >
          <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
        </div>
        {showSticky && containerRect && (
          <div
            className="fixed z-40 pointer-events-none"
            style={{
              left: `${containerRect.left}px`,
              width: `${containerRect.width}px`,
              bottom: 0,
            }}
            aria-hidden="true"
          >
            <div
              ref={proxyRef}
              className="overflow-x-auto pointer-events-auto bg-background/95 backdrop-blur-sm border-t border-border shadow-lg"
              style={{ height: 14 }}
              onScroll={onProxyScroll}
            >
              <div style={{ width: scrollWidth, height: 1 }} />
            </div>
          </div>
        )}
      </>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
