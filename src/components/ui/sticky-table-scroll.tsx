import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * StickyTableScroll
 * 
 * Obal okolo libovolné tabulky/widgetu se horizontálním přetečením.
 * Když tabulka přesahuje šířku viewportu, zobrazí se přilepený horizontální
 * scrollbar zarovnaný k spodnímu okraji okna prohlížeče. Uživatel tak může
 * tabulkou vodorovně posouvat i během prohlížení dlouhých seznamů (100+ řádků)
 * bez nutnosti skrolovat celou stránku dolů ke spodnímu nativnímu scrollbaru.
 * 
 * Použití:
 *   <StickyTableScroll>
 *     <Table> ... </Table>
 *   </StickyTableScroll>
 * 
 * - Nativní scrollbar je skryt (overflow-x: auto se simuluje přes plovoucí proxy).
 * - Aktivuje se jen tehdy, když je obsah skutečně širší než kontejner.
 * - Zachovává klávesovou navigaci a touch scroll (proxy ↔ obsah jsou synchronizovány).
 * - Při scrollu mimo viewport se scrollbar skryje (není potřeba, vidíme nativní).
 */
interface StickyTableScrollProps {
  children: React.ReactNode;
  className?: string;
  /** Maximální výška obsahu (default neomezeno). Když nastaveno, přidá vertikální overflow. */
  maxHeight?: string;
}

export function StickyTableScroll({ children, className, maxHeight }: StickyTableScrollProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<HTMLDivElement>(null);
  const proxyInnerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const isSyncing = useRef(false);

  // Kontrola, zda obsah přesahuje šířku
  const checkOverflow = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    setIsOverflowing(overflowing);
    setContentWidth(el.scrollWidth);
  }, []);

  // Kontrola, zda je nativní scrollbar viditelný ve viewportu
  // Pokud ne, ukážeme plovoucí proxy bar dole
  const checkVisibility = useCallback(() => {
    const el = contentRef.current;
    if (!el || !isOverflowing) {
      setShowStickyBar(false);
      return;
    }
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Nativní scrollbar tabulky je dole. Pokud jeho spodní hrana je pod viewportem
    // (tj. uživatel ho nevidí), zobrazíme plovoucí proxy.
    const isBottomBelowViewport = rect.bottom > viewportHeight - 16;
    const isTopAboveViewport = rect.top < viewportHeight;
    setShowStickyBar(isBottomBelowViewport && isTopAboveViewport);
  }, [isOverflowing]);

  // ResizeObserver — reaguje na změnu velikosti obsahu/kontejneru
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    checkOverflow();
    const ro = new ResizeObserver(() => {
      checkOverflow();
      checkVisibility();
    });
    ro.observe(el);
    // Také obsah uvnitř (table)
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [checkOverflow, checkVisibility]);

  // Listener na scroll/resize celého okna pro show/hide proxy baru
  useEffect(() => {
    checkVisibility();
    const handler = () => checkVisibility();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [checkVisibility]);

  // Synchronizace scroll pozice mezi obsahem a proxy
  const handleContentScroll = useCallback(() => {
    if (isSyncing.current) return;
    const content = contentRef.current;
    const proxy = proxyRef.current;
    if (!content || !proxy) return;
    isSyncing.current = true;
    proxy.scrollLeft = content.scrollLeft;
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  const handleProxyScroll = useCallback(() => {
    if (isSyncing.current) return;
    const content = contentRef.current;
    const proxy = proxyRef.current;
    if (!content || !proxy) return;
    isSyncing.current = true;
    content.scrollLeft = proxy.scrollLeft;
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  return (
    <>
      <div
        ref={contentRef}
        className={cn("overflow-x-auto", className)}
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        onScroll={handleContentScroll}
      >
        {children}
      </div>

      {/* Plovoucí horizontální scrollbar přilepený ke spodku viewportu */}
      {showStickyBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="mx-auto pointer-events-auto bg-background/95 backdrop-blur-sm border-t border-border shadow-lg"
            style={{
              maxWidth: contentRef.current?.clientWidth
                ? `${contentRef.current.getBoundingClientRect().width}px`
                : "100%",
              marginLeft: contentRef.current
                ? `${contentRef.current.getBoundingClientRect().left}px`
                : 0,
              marginRight: 0,
            }}
          >
            <div
              ref={proxyRef}
              className="overflow-x-auto"
              style={{ height: 14 }}
              onScroll={handleProxyScroll}
            >
              <div
                ref={proxyInnerRef}
                style={{ width: contentWidth, height: 1 }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
