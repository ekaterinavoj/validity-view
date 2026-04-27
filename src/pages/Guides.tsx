import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Search,
  GraduationCap,
  Wrench,
  HeartPulse,
  Users,
  FolderOpen,
  Bell,
  ShieldAlert,
  KeyRound,
  Settings,
  Mail,
  Database,
  UserCog,
  Layers,
  AlertCircle,
  Lightbulb,
  X,
} from "lucide-react";

import imgStatusLegend from "@/assets/guide-status-legend.jpg";
import imgProbationTimeline from "@/assets/guide-probation-timeline.jpg";
import imgBulkImport from "@/assets/guide-bulk-import.jpg";
import imgRolesHierarchy from "@/assets/guide-roles-hierarchy.jpg";
import imgPasswordSecurity from "@/assets/guide-password-security.jpg";
import imgReminders from "@/assets/guide-reminders.jpg";

interface GuideItem {
  q: string;
  a: string | string[];
  image?: { src: string; alt: string; caption?: string };
  /** Volitelné scénáře typu „Když X, udělej Y“. */
  scenarios?: { when: string; then: string[] }[];
}

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  adminOnly?: boolean;
  /** Klíčová slova pro lepší fulltext (mimo q/a). */
  keywords?: string[];
  items: GuideItem[];
}

const sections: GuideSection[] = [
  {
    id: "uvod",
    title: "Začínáme",
    icon: BookOpen,
    description: "Základní orientace v aplikaci pro nové uživatele.",
    keywords: ["úvod", "začátek", "přihlášení", "menu", "navigace", "hesla"],
    items: [
      {
        q: "Co je tato aplikace?",
        a: [
          "Lhůtník je interní aplikace Engel Gematex pro komplexní správu provozních lhůt:",
          "• Školení zaměstnanců (BOZP, odborné, periodické)",
          "• Technické lhůty zařízení (revize, inspekce, kalibrace)",
          "• Pracovně-lékařské prohlídky (PLP) dle vyhlášky 79/2013 Sb.",
          "• Zkušební doby (dle novely zákoníku práce 2026: 4 / 8 měsíců)",
          "• Centrální úložiště dokumentů (osvědčení, posudky, revizní zprávy)",
          "Aplikace automaticky hlídá termíny, generuje upozornění (in-app i e-mailem), vede kompletní historii s verzováním a poskytuje reportingové statistiky.",
        ],
      },
      {
        q: "Jak se přihlásím poprvé?",
        a: [
          "1. Otevřete přihlašovací URL aplikace ve vašem prohlížeči (doporučujeme Chrome, Edge, Firefox v aktuální verzi).",
          "2. Zadejte svůj firemní e-mail (ten, který vám předal administrátor).",
          "3. Zadejte počáteční heslo z uvítacího e-mailu nebo dočasné heslo od administrátora.",
          "4. Po prvním přihlášení budete automaticky vyzváni ke změně hesla – nastavte si silné heslo dle aktuální policy (zobrazí se požadavky).",
          "5. Pokud uvítací e-mail nedorazil, zkontrolujte spam nebo požádejte administrátora o reset hesla.",
        ],
      },
      {
        q: "Jak fungují záložky/dropdowny v hlavním menu?",
        a: [
          "Přehled (Dashboard) – úvodní stránka se souhrny prošlých / dnešních / nadcházejících záznamů a rychlými odkazy.",
          "Přepínač modulů (Školení / Tech. události / PLP) v záhlaví – přepíná podnabídku v levé části panelu.",
          "Dokumenty – centrální úložiště souborů, dostupné všem schváleným uživatelům.",
          "Správa dat (admin/manažer) – Zaměstnanci, Provozovny, Střediska, Přehled typů událostí, Statistiky.",
          "Systém – Návody (všichni); Audit log, Stav systému, Administrace, Migrace DB, Security checklist (admin only).",
          "Profil – ikona vpravo nahoře (osobní údaje, oprávnění, změna hesla, oznámení, odhlášení).",
        ],
      },
    ],
  },

  // ========== NOVÁ SEKCE: STAVY A FILTRY ==========
  {
    id: "stavy-filtry",
    title: "Stavy, barvy a filtry – vysvětlivky",
    icon: AlertCircle,
    description: "Kompletní legenda barevných stavů, archivu, limbo stavů a kdo co řeší.",
    keywords: ["stav", "barva", "zelená", "oranžová", "červená", "limbo", "archiv", "filtr", "vyřízeno"],
    items: [
      {
        q: "Co znamenají barevné stavy v seznamech?",
        a: [
          "🟢 Zelená (Platné) – do termínu zbývá více než 30 dní. Vše v pořádku.",
          "🟠 Oranžová (Vyprší brzy) – termín spadá do nejbližších 30 dní. Je čas plánovat.",
          "🔴 Červená (Po termínu) – termín už vypršel NEBO byl výsledek poslední kontroly negativní (Nevyhovuje). Vyžaduje okamžitou akci.",
          "⚪️ Šedá (Archivováno) – záznam byl archivován (např. ukončený pracovní poměr) a negeneruje další upozornění.",
          "Stav se počítá automaticky každý den 00:30 přes naplánovaný cron (synchronizace databáze a UI).",
        ],
        image: { src: imgStatusLegend, alt: "Tři stavové barvy: zelená, oranžová, červená", caption: "Barevná legenda stavů používaná napříč všemi moduly" },
      },
      {
        q: "Kdy se stav přepne automaticky a kdy ručně?",
        a: [
          "AUTOMATICKY (cron 00:30 + funkce calculate_*_status):",
          "• 🟢 → 🟠 – v okamžiku, kdy do termínu zbývá ≤ 30 dnů.",
          "• 🟠 → 🔴 – v okamžiku, kdy termín vyprší.",
          "• Po nahrání nového záznamu (nová kontrola) → vrátí se na 🟢.",
          "RUČNĚ:",
          "• Označit jako vyřízené – uzavře cyklus a otevře nový (typicky řeší autor nebo manažer).",
          "• Archivace (soft-delete) – přesune do historie, nezobrazuje se v hlavním seznamu (admin/manažer).",
          "• Trvalé smazání – jen administrátor v Historii.",
        ],
      },
      {
        q: "Co je „limbo“ stav a kdy se objeví?",
        a: [
          "LIMBO = záznam, který existuje v DB, ale je dočasně skrytý z hlavních seznamů, protože jeho zaměstnanec není aktivní.",
          "Vzniká automaticky při změně stavu zaměstnance:",
          "• Mateřská / Rodičovská / Nemocenská → PLP a školení do limbo (stop generování upozornění).",
          "• Ukončení pracovního poměru → vše do limbo.",
          "Jak limbo zobrazit: v Historii (PLP / Školení / Lhůty) zaškrtněte přepínač „Zobrazit i archivované“.",
          "Návratem zaměstnance do práce (status = aktivní) se záznamy automaticky obnoví v hlavním seznamu.",
          "Typicky řeší: HR / administrátor.",
        ],
      },
      {
        q: "Rozdíl: archiv × limbo × trvalé smazání",
        a: [
          "ARCHIV (deleted_at je vyplněno) – soft-delete, záznam zůstává v DB, lze obnovit. Skryto z hlavního seznamu, viditelné v Historii.",
          "LIMBO (is_active = false kvůli stavu zaměstnance) – speciální podtyp archivu řízený triggerem. Po návratu zaměstnance se automaticky vrátí.",
          "TRVALÉ SMAZÁNÍ – fyzické smazání řádku z DB. Nelze obnovit. Pouze admin v Historii s potvrzovacím dialogem.",
        ],
      },
      {
        q: "Filtry v hlavních seznamech – přehled",
        a: [
          "Standardní filtry napříč moduly:",
          "• Hledání – fulltext nad jmény, čísly, e-maily, názvy.",
          "• Stav – Vše / Platné / Vyprší brzy / Po termínu / Archivované.",
          "• Středisko (Department) – výběr z číselníku.",
          "• Provozovna (Facility) – výběr z číselníku.",
          "• Typ – školení / kontroly / prohlídky.",
          "• Datum od – do – pro plánovaný termín.",
          "• Odpovědná osoba – jen v technických lhůtách.",
          "Filtry se ukládají do URL → můžete sdílet odkaz s kolegou.",
        ],
      },
    ],
  },

  // ========== NOVÁ SEKCE: ZÁLOŽKY PODLE MODULŮ ==========
  {
    id: "zalozky-prehled",
    title: "Záložky podle modulů – kategorizovaný rejstřík",
    icon: Layers,
    description: "Přehled všech stránek v aplikaci s odkazy na konkrétní návody a typické úlohy.",
    keywords: ["záložky", "menu", "stránky", "rejstřík", "navigace"],
    items: [
      {
        q: "Modul Školení – všechny záložky",
        a: [
          "🏠 Přehled (/) – dashboard se souhrny.",
          "📋 Naplánovaná školení (/trainings) – aktivní seznam k řešení. Filtr stavu, hromadné akce.",
          "🕐 Historie školení (/trainings/history) – verzované snímky, archiv, limbo (s přepínačem). Admin/manažer.",
          "➕ Nové školení (/trainings/new) – formulář pro nový záznam (admin/manažer).",
          "🏷️ Typy školení (/training-types) – číselník (BOZP, odborné…) s periodicitou (admin/manažer).",
          "💤 Pozastavená (/inactive) – záznamy zaměstnanců v limbo stavu (admin/manažer).",
          "📅 Zkušební doby (/probations) – sledování konce ZD (admin/manažer).",
          "Detail viz sekce „Školení“ níže.",
        ],
      },
      {
        q: "Modul Technické lhůty – všechny záložky",
        a: [
          "📋 Naplánované technické lhůty (/deadlines) – revize, inspekce, kontroly.",
          "🕐 Historie technických lhůt (/deadlines/history) – snímky, archiv (admin/manažer).",
          "➕ Nová technická lhůta (/deadlines/new) – plánování kontroly (admin/manažer).",
          "🔧 Zařízení (/deadlines/equipment) – evidence techniky (inv. čísla, sériová, výrobce).",
          "🏷️ Typy technických lhůt (/deadlines/types) – číselník (revize, inspekce, kalibrace…).",
          "👥 Skupiny odpovědných osob (/deadlines/groups) – „BOZP tým“, „Elektrikáři“ apod. (admin/manažer).",
        ],
      },
      {
        q: "Modul PLP (lékařské prohlídky) – všechny záložky",
        a: [
          "📋 PLP – Naplánované prohlídky (/plp) – aktivní seznam.",
          "🕐 PLP – Historie (/plp/history) – snímky, limbo, skrývá ukončené (admin/manažer).",
          "➕ Nová prohlídka (/plp/new) – formulář s kategorií práce a zdravotními riziky (POUZE admin).",
          "🏷️ Typy prohlídek (/plp/types) – vstupní, periodická, mimořádná, výstupní (admin/manažer).",
        ],
      },
      {
        q: "Lidé, data a hierarchie – všechny záložky",
        a: [
          "👤 Zaměstnanci (/employees) – evidence osob, status, kategorie práce (admin/manažer).",
          "🌲 Hierarchie zaměstnanců – tlačítko „Zobrazit hierarchii“ v Zaměstnancích.",
          "🏢 Provozovny (/facilities), Střediska (/departments) – číselníky (admin/manažer).",
          "📚 Přehled typů událostí (/event-types) – sjednocený přehled všech typů napříč moduly (admin/manažer).",
          "📊 Statistiky (/statistics) – grafy (admin/manažer).",
          "📁 Dokumenty (/documents) – centrální úložiště firemních souborů (všichni).",
        ],
      },
      {
        q: "Administrace a systém – všechny záložky",
        a: [
          "🛠️ Administrace (/admin/settings) – jeden hub s 7 záložkami: Onboarding, Uživatelé, Připomínky, Emaily & Šablony, Historie, Audit log (Přehled změn / Pokročilý filtr / RLS diagnostika), Security.",
          "📋 Návody (/guides) – tato stránka (všichni).",
          "🩺 Stav systému (/admin/status) – konektivita, počty záznamů (admin).",
          "🔄 Migrace DB (/admin/migrations) – aplikované verze schématu (admin).",
          "🛡️ Security checklist (/admin/security-checklist) – sdílený hardening checklist (admin).",
          "📜 Poznámka: stará samostatná stránka /audit-log je sloučena do Administrace → tab Audit log.",
        ],
      },
    ],
  },

  {
    id: "skoleni",
    title: "Školení",
    icon: GraduationCap,
    description: "Plánování, evidence a hromadné akce u školení zaměstnanců.",
    keywords: ["školení", "BOZP", "kurz", "trenér", "import", "export", "csv", "hromadný"],
    items: [
      {
        q: "Jak přidat nové školení – krok za krokem?",
        a: [
          "1. Hlavní menu → Události → „Naplánovaná školení“.",
          "2. Klikněte na tlačítko „Nové školení“ vpravo nahoře.",
          "3. Vyberte zaměstnance (povinné) – v rozbalovacím seznamu jsou jen aktivní zaměstnanci.",
          "4. Vyberte Typ školení – periodicita se převezme automaticky z definice typu.",
          "5. Zadejte „Datum posledního absolvování“ pomocí kalendáře nebo ručního vstupu (formát dd.MM.yyyy).",
          "6. Datum příštího školení se vypočte automaticky (lze ručně přepsat – tím vznikne tzv. override).",
          "7. Volitelně doplňte: Trenéra, Firmu, Žadatele, Výsledek, Poznámku.",
          "8. Po uložení můžete v detailu nahrát dokumenty (osvědčení, prezenční listinu) – limit 40 MB / soubor.",
        ],
        scenarios: [
          {
            when: "Když školení vyprší (🔴) a zaměstnanec ho právě absolvoval",
            then: [
              "1. Otevřete řádek (rozbalovací detail) nebo klikněte na ⋮ → „Označit jako vyřízené“.",
              "2. Zadejte datum absolvování + výsledek + nahrajte osvědčení.",
              "3. Systém automaticky vytvoří snímek do Historie a otevře nový cyklus.",
            ],
          },
          {
            when: "Když zaměstnanec odejde nebo školení už nepotřebuje",
            then: [
              "1. ⋮ → „Označit jako vyřízené“ s poznámkou „Ukončen PP“ nebo důvodem.",
              "2. Záznam přestane generovat upozornění.",
              "3. Pro úplné skrytí: smažte zaměstnance (status = ukončen) – školení padne do limbo.",
            ],
          },
        ],
      },
      {
        q: "Jak nastavit Typ školení a jeho periodicitu?",
        a: [
          "Hlavní menu → Správa dat → „Typy školení“.",
          "Při vytvoření zadáte název, provozovnu, periodicitu a volitelně délku v hodinách + popis.",
          "Periodicita se zadává v sjednocené komponentě – lze přepínat dny / měsíce / roky (ukládá se v dnech).",
          "Pozor: změna periodicity Typu automaticky přepočítá data příštího u všech navázaných záznamů, které nemají vlastní override.",
        ],
      },
      {
        q: "Jak hromadně upravit více školení?",
        a: [
          "1. V seznamu zaškrtněte řádky pomocí checkboxu vlevo.",
          "2. Nahoře se objeví modrá lišta „Hromadné akce“.",
          "3. Klikněte na „Upravit“ – otevře se dialog.",
          "4. Změňte pouze pole, která chcete přepsat (ostatní zůstanou nezměněna).",
          "5. Lze měnit: typ, datum poslední, periodu override, výsledek, poznámku, trenéra, firmu, žadatele.",
          "6. Po potvrzení se akce zapíše do audit logu pro každý záznam zvlášť.",
        ],
      },
      {
        q: "Hromadný import školení z Excel/CSV",
        a: [
          "1. „Naplánovaná školení“ → tlačítko „Hromadný import“.",
          "2. Stáhněte šablonu (.xlsx) – obsahuje povinné sloupce s českými hlavičkami.",
          "3. Vyplňte řádky. Sloupec Periodicita akceptuje text („každé 4 roky“, „6 měsíců“) i číslo (dny).",
          "4. Nahrajte soubor – systém validuje hlavičky, e-maily zaměstnanců a typy školení.",
          "5. Při neshodě názvu typu školení se aktivuje fuzzy matching (Levenshtein, normalizace bez diakritiky a roku).",
          "6. Náhled importu zobrazí počet OK řádků, varování a chyb. Můžete pokračovat nebo zrušit.",
        ],
        image: { src: imgBulkImport, alt: "Bulk import workflow", caption: "Šablona → validace → import do databáze" },
      },
      {
        q: "Co znamená „Označit jako vyřízené“?",
        a: [
          "Tlačítko v menu řádku (⋮) u prošlých nebo problémových záznamů.",
          "Otevře dialog, kde zadáte: kdo to vyřídil (jméno nebo profil), poznámku, datum vyřízení.",
          "Záznam přestane generovat upozornění, ale zůstává v evidenci s příznakem „Vyřízeno“.",
          "Použití: zaměstnanec ukončil PP, školení již nebude opakováno, jiné systémové důvody.",
        ],
      },
      {
        q: "Kde najdu Historii školení?",
        a: [
          "Hlavní menu → Události → „Historie školení“.",
          "Obsahuje verzované snímky všech úprav (kdo, kdy, co změnil) díky systému record-versioning.",
          "Filtr „Zobrazit i archivované“ ukáže záznamy ukončených zaměstnanců (limbo stav).",
          "Admin: hromadné Trvalé smazání nebo Obnovit (z archivu).",
        ],
      },
      {
        q: "Export školení do CSV / PDF",
        a: [
          "V horní liště seznamu tlačítko „Export“.",
          "Pokud máte zaškrtnuté konkrétní řádky → exportují se jen ty.",
          "Bez výběru → exportuje se aktuálně filtrovaný seznam.",
          "CSV je plně kompatibilní pro zpětný import (stejné hlavičky, formáty datumů).",
          "Název souboru je sjednocený: lhutnik_skoleni_YYYYMMDD_HHMMSS.csv",
        ],
      },
    ],
  },
  {
    id: "technicke-lhuty",
    title: "Technické lhůty",
    icon: Wrench,
    description: "Revize, inspekce a kontroly technických zařízení.",
    keywords: ["zařízení", "revize", "inspekce", "kalibrace", "stroj", "lhůta"],
    items: [
      {
        q: "Jak přidat nové zařízení?",
        a: [
          "1. Hlavní menu → Správa dat → „Zařízení“ → „Nové zařízení“.",
          "2. Vyplňte: Inventární číslo (povinné, unikátní), Název, Typ zařízení, Provozovnu.",
          "3. Volitelně: Výrobce, Model, Sériové číslo, Datum nákupu, Umístění, Poznámka.",
          "4. Přiřaďte Středisko a Odpovědné osoby (lze více – picker s vyhledáváním).",
          "5. Po uložení je zařízení dostupné v rozbalovači u nových technických událostí.",
        ],
      },
      {
        q: "Jak naplánovat kontrolu / revizi?",
        a: [
          "1. Události → „Naplánované technické lhůty“ → „Nová událost“.",
          "2. Vyberte Zařízení – odpovědné osoby se automaticky předvyplní (lze upravit).",
          "3. Vyberte Typ lhůty (revize, inspekce, kalibrace…). Pole „Provádějící“ je terminologicky sjednocené.",
          "4. Datum poslední kontroly + automatický výpočet příštího termínu.",
          "5. Výsledek (Vyhovuje / S výhradami / Nevyhovuje) – při „Nevyhovuje“ systém vygeneruje varovnou notifikaci adminům.",
        ],
        scenarios: [
          {
            when: "Když revize dopadne „Nevyhovuje“",
            then: [
              "1. Záznam se okamžitě přepne na 🔴 (nezávisle na datu).",
              "2. Adminům přijde in-app notifikace.",
              "3. Doplňte poznámku s důvodem a nahrajte protokol.",
              "4. Po opravě naplánujte mimořádnou kontrolu (Nová událost se stejným typem).",
            ],
          },
          {
            when: "Když zařízení odejde do odpisu",
            then: [
              "1. Správa dat → Zařízení → smažte zařízení (admin/manažer).",
              "2. Všechny aktivní lhůty se přesunou do historie (limbo).",
              "3. Generování upozornění se zastaví.",
            ],
          },
        ],
      },
      {
        q: "Kdo dostane upozornění a kdy?",
        a: [
          "Notifikace dostávají:",
          "• Odpovědné osoby přiřazené k zařízení.",
          "• Odpovědné osoby přiřazené ke konkrétní události (deadline_responsibles).",
          "• Členové cílových skupin v aktivní šabloně připomínky pro modul Technické lhůty.",
          "Manažeři mají RLS oprávnění SELECT i UPDATE u technických událostí svých zařízení.",
        ],
      },
      {
        q: "Co dělá tlačítko „Označit jako vyřízené“?",
        a: [
          "Uzavře aktuální cyklus a uloží snímek do historie.",
          "Záznam se okamžitě otevře pro novou kontrolu (s předvyplněným aktuálním datem) – ušetří klikání.",
          "Idempotency guard zabrání duplicitnímu odeslání souhrnných e-mailů.",
        ],
      },
      {
        q: "Skupiny odpovědných osob",
        a: [
          "Administrace → „Skupiny odpovědných osob“.",
          "Vytvořte skupinu (např. „Elektrikáři“, „BOZP tým“) a přidejte profily.",
          "U události pak místo jednotlivců můžete přiřadit celou skupinu – všichni členové dostanou upozornění.",
          "RLS: běžný uživatel vidí jen skupiny, jejichž je členem; admin vidí vše.",
        ],
      },
    ],
  },
  {
    id: "plp",
    title: "Pracovně-lékařské prohlídky (PLP)",
    icon: HeartPulse,
    description: "Sledování zdravotní způsobilosti dle vyhlášky 79/2013 Sb.",
    keywords: ["PLP", "lékař", "zdravotní", "prohlídka", "kategorie práce", "rizika", "nemocenská"],
    items: [
      {
        q: "Jak přidat novou PLP?",
        a: [
          "1. Hlavní menu → Události → „PLP – Naplánované prohlídky“ → „Nová prohlídka“.",
          "2. Vyberte zaměstnance, Typ prohlídky (vstupní, periodická, mimořádná, výstupní).",
          "3. Datum poslední prohlídky + Datum příští (auto-výpočet).",
          "4. Lékař, Zdravotnické zařízení, Žadatel.",
          "5. Výsledek: Vyhovuje / S výhradami / Nevyhovuje / Dlouhodobá ztráta zdravotní způsobilosti.",
          "6. Sekce „Zdravotní rizika“ – zaškrtněte konkrétní expozice (viz níže).",
          "7. Nahrajte lékařský posudek (PDF, JPG, PNG).",
        ],
        scenarios: [
          {
            when: "Když je zaměstnanec dlouhodobě nemocný (> 8 týdnů)",
            then: [
              "1. Status zaměstnance přepněte na „Nemocenská“ (Správa dat → Zaměstnanci).",
              "2. PLP automaticky padne do limbo (skryto ze seznamu).",
              "3. Po návratu zaměstnance (status = Aktivní) systém vygeneruje notifikaci „Nutná mimořádná prohlídka“ pro adminy.",
              "4. Naplánujte mimořádnou PLP s typem „Mimořádná“ a předejte zaměstnance lékaři.",
            ],
          },
          {
            when: "Když lékař označí „Nevyhovuje“ nebo „Dlouhodobá ztráta“",
            then: [
              "1. Vyplňte výsledek + datum dlouhodobé ztráty (long_term_fitness_loss_date).",
              "2. Adminové dostanou notifikaci.",
              "3. HR řeší pracovněprávní kroky (převedení na jinou pozici, ukončení PP).",
              "4. Záznam zůstane v historii pro audit.",
            ],
          },
        ],
      },
      {
        q: "Kategorie práce dle vyhlášky 79/2013",
        a: [
          "Kategorie 1 – minimální riziko, prohlídka 1× za 6 let (do 50 let) / 4 roky (nad 50 let).",
          "Kategorie 2 – nízké riziko, 1× za 5 let / 3 roky.",
          "Kategorie 2R (riziková) – nově zavedená, vizuálně zvýrazněná žlutě, prohlídka 1× za 2 roky.",
          "Kategorie 3 – významné riziko, 1× za 2 roky.",
          "Kategorie 4 – vysoké riziko, 1× ročně.",
          "Periodicita konkrétního typu prohlídky se ovšem řídí definicí Typu PLP (lze odchýlit pro speciální agendy).",
        ],
      },
      {
        q: "Co jsou Zdravotní rizika a jak je vyplnit?",
        a: [
          "Strukturovaný JSON záznam o expozici v rámci PLP. Sledované oblasti:",
          "• Pracovní poloha (sedavá, vstoje, vynucená)",
          "• Hluk (úroveň v dB)",
          "• Vibrace (lokální, celkové)",
          "• Zraková zátěž (PC, mikroskop, jemná práce)",
          "• UV záření / chemické látky / biologické faktory",
          "• Fyzická zátěž (manipulace s břemeny)",
          "Souhrn rizik se zobrazuje v detailu prohlídky a v exportu CSV/PDF.",
        ],
      },
      {
        q: "Co se stane při změně stavu zaměstnance (nemoc, MD, ukončení)?",
        a: [
          "Trigger v databázi automaticky:",
          "• Nemocenská / Mateřská / Rodičovská → aktivní PLP se přesune do „limbo“ stavu (skryté, ale nesmazané).",
          "• Návrat do práce → PLP se obnoví. Pokud nemocenská trvala > 8 týdnů (56 dní) souvislé, vygeneruje se notifikace „Nutná mimořádná prohlídka“ pro adminy.",
          "• Ukončení PP → PLP se přesune do limbo, viditelné jen v Historii s filtrem „Zobrazit archivované“.",
        ],
      },
      {
        q: "Historie a limbo stavy PLP",
        a: [
          "Události → „PLP – Historie“.",
          "Standardně skrývá záznamy zaměstnanců, kteří nejsou aktivní (limbo).",
          "Přepínač „Zobrazit i archivované“ je odkryje – užitečné pro audit nebo návrat zaměstnance.",
          "Admin: hromadné obnovení nebo trvalé smazání (s potvrzovacím dialogem).",
        ],
      },
    ],
  },
  {
    id: "zamestnanci",
    title: "Zaměstnanci a hierarchie",
    icon: Users,
    description: "Evidence zaměstnanců, organizační struktura, statusy.",
    keywords: ["zaměstnanci", "osoby", "hierarchie", "manažer", "zkušební", "ZD", "nástup"],
    items: [
      {
        q: "Jak přidat nového zaměstnance?",
        a: [
          "1. Správa dat → Zaměstnanci → „Nový zaměstnanec“.",
          "2. Povinné: Jméno, Příjmení, E-mail (unikátní), Pozice, Stav.",
          "3. Volitelné: Osobní číslo, Středisko, Datum narození, Datum nástupu, Manažer (přímý nadřízený), Kategorie práce.",
          "4. Zkušební doba se vyplní automaticky podle pozice (vedoucí 8 měsíců, ostatní 4 měsíce).",
          "5. Po uložení můžete zaměstnance navázat na uživatelský účet v Administraci → Správa uživatelů.",
        ],
        scenarios: [
          {
            when: "Když končí zkušební doba a zaměstnanec měl překážky v práci",
            then: [
              "1. Zaměstnanci → detail osoby → karta „Překážky“.",
              "2. Přidejte období nepřítomnosti (důvod, datum od – do).",
              "3. Funkce sum_probation_obstacle_days() automaticky prodlouží konec ZD.",
              "4. Modul „Zkušební doby“ vás upozorní 14 dní před novým termínem.",
            ],
          },
          {
            when: "Když zaměstnanec nastupuje na vedoucí pozici",
            then: [
              "1. Při vytvoření vyplňte pozici obsahující slova „vedoucí / ředitel / manažer / mistr…“ → systém automaticky nastaví ZD na 8 měsíců.",
              "2. Pokud chcete jiné období, manuálně přepište pole „Délka ZD (měsíce)“ a doplňte důvod.",
            ],
          },
        ],
      },
      {
        q: "Jak funguje organizační hierarchie?",
        a: [
          "Pole „Manažer“ v profilu zaměstnance odkazuje na jiný záznam zaměstnance (FK manager_employee_id).",
          "Tvoří strom – zaměstnanec → manažer → ředitel → …",
          "RLS politika: uživatel s rolí Manažer vidí jen své podřízené (rekurzivně). Admin vidí všechny.",
          "Hierarchii lze vizualizovat ve stránce Zaměstnanci → tlačítko „Zobrazit hierarchii“.",
        ],
        image: { src: imgRolesHierarchy, alt: "Hierarchie rolí", caption: "Administrátor (vrchol) → Manažeři → Uživatelé / podřízení" },
      },
      {
        q: "Zkušební doba (ZD) – jak dlouhá a jak se počítá?",
        a: [
          "Dle novely zákoníku práce 2026:",
          "• Běžní zaměstnanci: 4 měsíce od data nástupu.",
          "• Vedoucí pozice (auto-detekce z názvu pozice nebo manuální nastavení): 8 měsíců.",
          "Datum konce ZD se počítá automaticky: start_date + probation_months (jako interval).",
          "Pokud zaměstnanec onemocní nebo má jinou překážku v práci během ZD, lze v záložce „Překážky“ zadat dny nepřítomnosti – funkce sum_probation_obstacle_days() prodlouží ZD.",
          "Modul Zkušební doby (Události → Zkušební doby) zobrazuje aktuálně končící a varuje 14 dní předem.",
        ],
        image: { src: imgProbationTimeline, alt: "Časová osa zkušební doby", caption: "Nástup → 4 nebo 8 měsíců → konec ZD (s možností prodloužení o překážky)" },
      },
      {
        q: "Statusy zaměstnance a jejich dopady",
        a: [
          "🟢 Aktivní (employed) – běžný stav, generuje upozornění.",
          "🟣 Mateřská / Rodičovská (parental_leave) – PLP a školení do limbo.",
          "🔵 Nemocenská (sick_leave) – PLP a školení do limbo. Při návratu po > 8 týdnech (56 dní) auto-notifikace o mimořádné PLP.",
          "⚫ Ukončen pracovní poměr (terminated) – vyplnit „Datum ukončení“. Vše se přesune do historie.",
          "Každá změna statusu se loguje do audit logu (kdo, kdy, z jakého na jaký).",
        ],
      },
      {
        q: "Věkové milníky a notifikace",
        a: [
          "Při dosažení věku přesně 50 let aplikace odešle jednorázovou in-app notifikaci adminům (related_entity_type = employee_age_milestone).",
          "Důvod: změna periodicity PLP pro kategorii 1 (z 6 na 4 roky).",
          "Funkce calculateAge() v src/lib/dateFormat.ts robustně počítá věk z birth_date.",
        ],
      },
    ],
  },
  {
    id: "dokumenty",
    title: "Dokumenty",
    icon: FolderOpen,
    description: "Centrální úložiště firemních dokumentů a souborů u záznamů.",
    keywords: ["dokumenty", "soubor", "upload", "PDF", "limit", "evidenční číslo"],
    items: [
      {
        q: "Modul Dokumenty – co tam najdu?",
        a: [
          "Hlavní menu → „Dokumenty“. Centrální úložiště firemních souborů organizovaných do virtuálních složek (Accordion).",
          "Typické složky: Akreditace, Směrnice, Šablony, Manuály, Externí dokumenty.",
          "Soubory u jednotlivých školení / PLP / lhůt jsou uložené odděleně v detailu daného záznamu.",
        ],
      },
      {
        q: "Limity nahrávání souborů",
        a: [
          "• Maximální velikost: 40 MB / soubor.",
          "• Akceptované formáty: PDF, DOCX, XLSX, JPG, PNG, ZIP.",
          "• Princip „vždy přidat“ – nový upload nepřepíše existující, ale přidá novou verzi.",
          "• Při překročení limitu systém zobrazí chybu a soubor odmítne (validace na klientu i serveru).",
        ],
      },
      {
        q: "Mohu smazat nahraný soubor?",
        a: [
          "• Vlastní soubor (kde jste uploaded_by) – smí mazat každý.",
          "• Cizí soubor – smí mazat jen Admin nebo Manažer s oprávněním k danému záznamu.",
          "• Smazání je nevratné – soubor zmizí ze storage i z databáze.",
          "• Před smazáním systém zobrazí potvrzovací dialog.",
        ],
      },
      {
        q: "Evidenční čísla dokumentů",
        a: [
          "Při nahrávání dokumentu k záznamu (školení, PLP, lhůta) systém automaticky přidělí jedinečné evidenční číslo (formát: TYP-YYYYMMDD-XXXX).",
          "Číslo se zobrazí v detailu záznamu, v náhledu dokumentu i v exportu CSV/PDF.",
          "Slouží pro účetní/auditní účely a pro zpětné dohledání.",
        ],
      },
      {
        q: "Náhled dokumentů",
        a: [
          "Klik na dokument otevře sjednocený FilePreviewDialog.",
          "Podporuje náhled PDF (vestavěný viewer), obrázků (JPG/PNG) a stažení pro ostatní typy.",
          "Vpravo nahoře tlačítka: Stáhnout, Smazat (oprávněným), Zavřít.",
        ],
      },
    ],
  },
  {
    id: "notifikace",
    title: "Notifikace a připomínky",
    icon: Bell,
    description: "Vnitroaplikační upozornění a e-mailové připomínky.",
    keywords: ["notifikace", "připomínka", "e-mail", "zvonek", "upozornění", "cron"],
    items: [
      {
        q: "Kde najdu svá oznámení?",
        a: [
          "V horní liště ikona zvonečku (NotificationBell) – ukazuje počet nepřečtených.",
          "Klikem se otevře dropdown s posledními oznámeními.",
          "Akce: Označit jako přečtené (jednotlivě / vše), Smazat, Otevřít související záznam.",
        ],
      },
      {
        q: "Typy in-app notifikací",
        a: [
          "• Blížící se termín školení / PLP / lhůty (30, 14, 7, 1 den předem).",
          "• Negativní výsledek kontroly (Nevyhovuje) – pro adminy a odpovědné osoby.",
          "• Návrat z dlouhé nemoci (> 8 týdnů) → mimořádná PLP.",
          "• Konec zkušební doby (14 dní předem).",
          "• Dosažení 50 let (jednorázově) – pro adminy.",
          "• Schválení nového uživatele (pro adminy).",
        ],
      },
      {
        q: "Kdy přicházejí e-mailové připomínky?",
        a: [
          "Standardně 30 dní před vypršením + opakovaně po dohodnutém intervalu (nastaveno v šabloně).",
          "Souhrnné týdenní e-maily se odesílají v pondělí ráno (přeskakují víkendy – sobota/neděle).",
          "Idempotency guard: opakované spuštění cronu během stejného dne nepošle duplicitní e-mail.",
          "Cron-secret zabezpečení edge funkcí (run-deadline-reminders, run-medical-reminders, send-training-reminders).",
        ],
        image: { src: imgReminders, alt: "Tok připomínek", caption: "Naplánovaný termín → e-mail → notifikace na zařízení" },
      },
      {
        q: "Proč jsem nedostal e-mail – troubleshooting",
        a: [
          "1. Zkontrolujte složku Spam / Hromadné.",
          "2. Ověřte, že máte správný e-mail v profilu (Profil → Údaje).",
          "3. Admin musí mít nakonfigurované funkční SMTP (Administrace → E-maily & Šablony).",
          "4. Vy musíte být:",
          "   – v cílovém seznamu šablony (target_user_ids), NEBO",
          "   – odpovědnou osobou u zařízení / události, NEBO",
          "   – manažerem dotčeného zaměstnance.",
          "5. Šablona musí být aktivní (is_active = true).",
          "6. Admin může zkontrolovat odeslání v Administrace → Logy připomínek.",
        ],
      },
      {
        q: "Sumární vs. individuální upozornění",
        a: [
          "Individuální (alert) – jedna událost = jeden e-mail. Pošle se podle remind_days_before u záznamu/typu.",
          "Sumární (summary) – týdenní přehled všech blížících se událostí jedním e-mailem.",
          "Tyto dva kanály jsou nezávislé – uživatel může dostávat jen jeden, druhý nebo oba.",
          "Konfigurace v Administrace → Připomínky → Nastavení modulu (per modul: Školení / Lhůty / PLP).",
        ],
      },
    ],
  },
  {
    id: "profil-bezpecnost",
    title: "Profil a bezpečnost hesla",
    icon: KeyRound,
    description: "Správa vlastního účtu, změna hesla, pravidla bezpečnosti.",
    keywords: ["heslo", "profil", "bezpečnost", "rotace", "session", "odhlášení", "zapomenuté"],
    items: [
      {
        q: "Jak změnit heslo?",
        a: [
          "1. Klik na avatar vpravo nahoře → Profil.",
          "2. Sekce „Změna hesla“.",
          "3. Zadejte současné heslo + nové heslo + potvrzení.",
          "4. Pod polem se zobrazí dynamické požadavky podle aktuální policy nastavené adminem (minimální délka, znaky).",
          "5. Indikátor síly hesla (PasswordStrengthMeter) v reálném čase.",
          "6. Po změně budete odhlášeni a musíte se přihlásit s novým heslem.",
        ],
        image: { src: imgPasswordSecurity, alt: "Bezpečnost hesla", caption: "Štít s ověřením + měřič síly hesla + zámek" },
      },
      {
        q: "Co znamená dialog „Doporučujeme změnit heslo“?",
        a: [
          "PasswordReviewModal se zobrazí v těchto případech:",
          "• Vaše heslo nesplňuje aktuální policy (admin zpřísnil pravidla).",
          "• Heslo je starší než povolený limit (must_review_password = true) – jen pokud admin má aktivovanou rotaci po N dnech.",
          "• Po seedu prvního admina nebo resetu heslem od admina (must_change_password = true).",
          "Akce: „Změnit heslo nyní“ (přesun na /change-password) nebo „Odložit“ (na 7 dní u doporučení; u must_change_password nelze odložit).",
          "Texty a požadavky v dialogu jsou dynamické dle aktuální policy.",
        ],
      },
      {
        q: "Mohu si vypnout připomínání rotace hesla?",
        a: [
          "ANO – přímo v dialogu „Doporučujeme změnit heslo“ máte tři možnosti:",
          "• „Změnit heslo nyní“ – přesun na /change-password.",
          "• „Připomenout za 7 dní“ – modal se znovu objeví AŽ za 7 dní (ukládá se do localStorage prohlížeče s konkrétním datem). Při dalším přihlášení dříve než po 7 dnech se NEOBJEVÍ. Funguje per-prohlížeč.",
          "• „Už mi to nepřipomínat“ – trvalé vypnutí, ukládá se do uživatelských preferencí (synchronizováno přes všechna zařízení).",
          "Zavření dialogu křížkem (×) = pouze pro tuto seanci, při dalším přihlášení se objeví znovu.",
          "Důležité: opt-out platí POUZE pro doporučení rotace. Pokud admin nastaví explicitně must_review_password (např. po incidentu), modal se znovu objeví a nelze ho odložit.",
          "Změnit zpět můžete v Profilu → karta „Bezpečnost a oznámení“.",
        ],
      },
      {
        q: "Co dělat při zapomenutém heslu?",
        a: [
          "1. Na přihlašovací stránce klikněte „Zapomenuté heslo“.",
          "2. Zadejte e-mail – pošle se vám reset link.",
          "3. Pokud e-mail nedorazí (typicky firemní filtry), kontaktujte administrátora.",
          "4. Admin v Administrace → Uživatelé → menu (⋮) → „Reset hesla“ vygeneruje dočasné heslo.",
          "5. Při prvním přihlášení s dočasným heslem budete vyzváni ke změně.",
        ],
      },
      {
        q: "Časový limit relace (auto-odhlášení)",
        a: [
          "Admin nastavuje globální timeout v Administrace → Bezpečnost → Časový limit relace.",
          "5 minut před vypršením se zobrazí varovný dialog s odpočtem.",
          "Klikem na „Pokračovat“ se relace prodlouží.",
          "Při neaktivitě dojde k automatickému odhlášení (useSessionTimeout hook).",
        ],
      },
    ],
  },
  // ─────────── ADMIN ONLY ───────────
  {
    id: "admin-uzivatele",
    title: "Správa uživatelů (Admin)",
    icon: UserCog,
    adminOnly: true,
    description: "Vytváření, deaktivace, role a oprávnění uživatelských účtů.",
    keywords: ["uživatel", "role", "admin", "manažer", "deaktivace", "reset"],
    items: [
      {
        q: "Jak vytvořit nového uživatele?",
        a: [
          "1. Administrace → Uživatelé → tlačítko „Přidat uživatele“.",
          "2. Vyplňte e-mail (unikátní), Jméno, Příjmení, počáteční heslo (nebo nechte vygenerovat).",
          "3. Přidělte roli (Administrátor / Manažer / Uživatel).",
          "4. Volitelně: navažte na záznam zaměstnance (employee_id) – nutné pro RLS u rolí Manažer/Uživatel.",
          "5. Edge funkce admin-create-user vytvoří účet v auth.users i profile + role atomicky.",
          "6. Uživatel obdrží uvítací e-mail (pokud máte funkční SMTP) s instrukcemi.",
        ],
      },
      {
        q: "Role v systému – přesný výčet",
        a: [
          "Administrátor (admin) – plný přístup, hard-delete, hromadné akce na všech modulech, správa uživatelů, SMTP, šablon, audit logu.",
          "Manažer (manager) – vidí svůj tým (rekurzivně podřízené přes employees.manager_employee_id) + zařízení, kde je odpovědnou osobou. Může editovat jejich data.",
          "Uživatel (user) – vidí pouze svá vlastní data (přes profiles.employee_id).",
          "Role Viewer (Prohlížeč) byla v minulosti zrušena. Nepoužívat.",
          "Změna role probíhá atomicky přes RPC set_user_role() – jednou transakcí.",
        ],
      },
      {
        q: "Stav hesla v tabulce uživatelů",
        a: [
          "Sloupec „Stav hesla“ (za sloupcem Role) zobrazuje barevný badge:",
          "🟢 V pořádku – heslo splňuje aktuální policy a není starší než limit.",
          "🟠 Nutno zkontrolovat – uživatel má must_review_password = true (slabé/staré heslo).",
          "Filtr nad tabulkou: „Stav hesla“ s hodnotami Vše / V pořádku / Nutno zkontrolovat.",
          "Sloupec „Poslední změna hesla“ vedle ukazuje datum (password_updated_at).",
          "RPC get_password_review_summary() agreguje statistiky pro horní banner.",
        ],
      },
      {
        q: "Modulová oprávnění (per uživatel)",
        a: [
          "V tabulce uživatelů → menu (⋮) → „Moduly“.",
          "Otevře dialog ModuleAccessManager – zaškrtejte moduly: Školení, Technické lhůty, PLP, Dokumenty, Statistiky.",
          "Tabulka user_module_access funguje jako allowlist – pokud uživatel není v tabulce, má přístup ke všem modulům dle své role.",
          "Hodí se pro omezení přístupu k citlivým modulům i v rámci role Manager/User.",
        ],
      },
      {
        q: "Reset hesla uživatele administrátorem",
        a: [
          "Menu (⋮) v řádku → „Reset hesla“.",
          "Vygeneruje se silné dočasné heslo (zobrazí se jen jednou – uložte si!).",
          "Edge funkce admin-reset-password nastaví nové heslo + flag must_change_password.",
          "Předejte heslo uživateli bezpečným kanálem (osobně, šifrovaný chat).",
          "Při prvním přihlášení uživatel musí heslo změnit (modal nelze odložit).",
        ],
      },
      {
        q: "Deaktivace vs. trvalé smazání",
        a: [
          "Deaktivace – Edge funkce admin-deactivate-user nastaví ban_duration v Supabase Auth na neurčito. Účet zůstává, ale uživatel se nemůže přihlásit. Reverzibilní.",
          "Trvalé smazání – Edge funkce admin-delete-user provede kompletní cascade cleanup: profile, role, module_access, soubory ze storage, audit logy. Nereverzibilní!",
          "Doporučení: vždy nejdřív deaktivovat, smazat až po jistotě (např. GDPR požadavek).",
        ],
      },
      {
        q: "Export uživatelů",
        a: [
          "Tlačítka „Export CSV“ a „Export PDF“ v horní liště.",
          "Sjednocený název souboru přes buildExportFilename() – stejný pro CSV i PDF.",
          "Sloupce v jednotném pořadí (UI ↔ CSV ↔ PDF): Jméno, Email, Pozice, Role, Stav hesla, Poslední změna hesla.",
          "Při výběru řádků se exportují jen vybrané; jinak celý filtrovaný seznam.",
        ],
      },
    ],
  },
  {
    id: "admin-bezpecnost",
    title: "Pravidla bezpečnosti hesel a Security Checklist (Admin)",
    icon: ShieldAlert,
    adminOnly: true,
    description: "Konfigurace policy, expirace, session timeoutu a sdílený hardening checklist.",
    keywords: ["bezpečnost", "heslo", "policy", "rotace", "checklist", "hardening", "RLS", "scan"],
    items: [
      {
        q: "Kde nastavím pravidla pro hesla?",
        a: [
          "Administrace → Bezpečnost → karta „Pravidla pro hesla“.",
          "Pole:",
          "• Minimální délka (výchozí 8, doporučeno 12+).",
          "• Vyžadovat velká písmena (A-Z).",
          "• Vyžadovat malá písmena (a-z).",
          "• Vyžadovat číslice (0-9).",
          "• Vyžadovat speciální znaky (!@#$…).",
          "Uložení zapíše do system_settings.password_policy. Hodnoty hned platí pro všechny nové změny hesel a pro PasswordReviewModal.",
        ],
      },
      {
        q: "Vynucení změny hesla po N dnech",
        a: [
          "1. Administrace → Bezpečnost → Pravidla pro hesla.",
          "2. Najděte přepínač „Vynutit změnu hesla po N dnech“.",
          "3. Zapněte (max_age_enabled = true) a zadejte počet dní (výchozí 90).",
          "4. Uložte. Hook usePasswordPolicy() okamžitě reflektuje změnu.",
          "5. Při dalším přihlášení uživatelé se starým heslem dostanou PasswordReviewModal.",
          "Pokud přepínač vypnete: žádný uživatel nedostane modal kvůli stáří hesla. Modal se objeví jen u účtů s explicitním must_review_password = true (nastaveno adminem nebo migrací).",
        ],
      },
      {
        q: "K čemu slouží Security Hardening Checklist?",
        a: [
          "Hlavní menu → Systém → „Security checklist“ (přímá routa /admin/security-checklist).",
          "Je to KONTROLNÍ SEZNAM mimoaplikačních úkonů, které musíte provést na infrastruktuře:",
          "• HTTPS, HSTS, CSP, X-Frame-Options (reverse-proxy).",
          "• Rate limiting (anti brute-force) – konfigurace nginx.",
          "• Změna výchozího admin hesla, rotace SMTP / DB / JWT secrets.",
          "• TLS pro SMTP, pravidelné zálohy, monitoring přihlášení.",
          "Aplikace tyto věci NEUMÍ vynutit – musíte je nastavit ručně. Checklist slouží jako vodítko a evidence „co jsme už zkontrolovali“.",
          "Stav je SDÍLENÝ mezi všemi administrátory (ukládá se v DB), takže vidíte i to, co zaškrtl kolega.",
        ],
      },
      {
        q: "Jak najít uživatele se slabým heslem?",
        a: [
          "Administrace → Uživatelé → filtr „Stav hesla“ = „Nutno zkontrolovat“.",
          "Banner v horní části panelu zobrazuje souhrnný počet (z RPC get_password_review_summary).",
          "Lze hromadně označit a poslat výzvu k změně hesla.",
        ],
      },
      {
        q: "Časový limit relace (Session timeout)",
        a: [
          "Administrace → Bezpečnost → karta „Časový limit relace“.",
          "Zadejte interval neaktivity v minutách (výchozí 30, doporučeno 15-60).",
          "5 minut před vypršením se uživateli zobrazí varovný dialog s odpočtem.",
          "Klik na „Pokračovat“ resetuje časovač.",
          "Implementace: useSessionTimeout hook + Supabase Auth refresh token.",
        ],
      },
      {
        q: "Bezpečnostní sken RLS",
        a: [
          "Administrace → Bezpečnost → „Spustit sken“ (SecurityScanRunner).",
          "RPC security_scan_rls_coverage() projde všechny tabulky a vrátí:",
          "• rls_enabled (true/false)",
          "• policy_count (počet aktivních politik)",
          "• status (OK / WARNING / CRITICAL)",
          "Sken byste měli spouštět po každé migraci, která přidává nové tabulky.",
        ],
      },
      {
        q: "Audit log vs. Diagnostika přístupů – v čem je rozdíl?",
        a: [
          "V aplikaci jsou DVĚ samostatné věci, často zaměňované:",
          "",
          "1) AUDIT LOG (samostatná stránka /audit-log, dostupná z menu Systém → Audit log):",
          "   • Sleduje KDO co KDY změnil v datech (školení, technické lhůty, PLP, zaměstnanci, role…).",
          "   • Filtrace: uživatel, akce (INSERT/UPDATE/DELETE), tabulka, datum, role.",
          "   • Zaznamenává: user_id, email, role, changed_fields, old_data, new_data, created_at.",
          "   • Plní se automaticky přes DB triggery na citlivých tabulkách.",
          "   • Přístup: admin + manažer (manažer s omezením).",
          "",
          "2) DIAGNOSTIKA PŘÍSTUPŮ (Administrace → tab „Diagnostika přístupů“):",
          "   • Slouží k OVĚŘENÍ, zda RLS politiky správně omezují viditelnost dat.",
          "   • Obsahuje: EmployeeAccessDebug (na koho daný uživatel vidí), MedicalDocsAccessDebug (kdo má přístup k PLP dokumentům), SecurityAuditPanel (sumární přehled rolí a oprávnění).",
          "   • Nejedná se o historii změn – je to nástroj pro ladění oprávnění.",
          "   • Přístup: pouze admin.",
        ],
      },
      {
        q: "Mám záložku Audit i v Administraci. Můžu to zrušit?",
        a: [
          "Tab v Administraci se po úpravě jmenuje „Diagnostika přístupů“ a obsahuje pouze diagnostické nástroje pro RLS – NENÍ to duplikát plného audit logu.",
          "Plný audit log zůstává jako samostatná stránka /audit-log (přístupný adminovi i manažerovi).",
          "Důvod oddělení: audit log je provozní nástroj (sledování změn), zatímco diagnostika je jen pro adminy při řešení problému s oprávněními. Sloučit by znamenalo, že manažeři by viděli i RLS interní informace, které pro ně nejsou užitečné.",
        ],
      },
    ],
  },
  {
    id: "admin-emaily",
    title: "E-maily a šablony (Admin)",
    icon: Mail,
    adminOnly: true,
    description: "Konfigurace SMTP, šablon a sledování doručení.",
    keywords: ["SMTP", "e-mail", "šablona", "M365", "Gmail", "OAuth"],
    items: [
      {
        q: "Jak nakonfigurovat SMTP?",
        a: [
          "Administrace → E-maily & Šablony → karta „SMTP“.",
          "Podporované varianty:",
          "• Standardní SMTP (STARTTLS) – host, port (typicky 587), uživatel, heslo.",
          "• Microsoft 365 (OAuth2) – Tenant ID, Client ID, Client Secret. Bez nutnosti uchovávat heslo.",
          "• Gmail (OAuth2) – stejný princip jako M365.",
          "Tlačítko „Odeslat zkušební e-mail“ ověří funkčnost.",
        ],
      },
      {
        q: "Šablony připomínek",
        a: [
          "Administrace → Připomínky → vyberte modul (Školení / Lhůty / PLP).",
          "Pro každý modul zvlášť: seznam šablon + tlačítko „Nová šablona“.",
          "Pole: Název, Popis, Předmět, Tělo (HTML), Připomenout N dní předem, Opakovat po N dnech, Cílový seznam uživatelů.",
          "Proměnné v těle: {employeeName}, {trainingName}, {nextDate}, {daysRemaining}, {totalCount}, {expiringCount}, {expiredCount}.",
          "is_active = true → šablona se používá při běhu cronu.",
        ],
      },
      {
        q: "Test e-mailu",
        a: [
          "U každé šablony tlačítko „Odeslat zkušební e-mail“.",
          "Zadáte e-mail příjemce ručně.",
          "Pošle se s aktuálními (testovacími) hodnotami proměnných.",
          "Záznam se zapíše do reminder_logs s is_test = true (nezapočítává se do reálných statistik).",
        ],
      },
      {
        q: "Statistiky doručení",
        a: [
          "Administrace → E-maily & Šablony → karta „Statistiky“.",
          "Zobrazuje: počet odeslaných, doručených, chybových e-mailů.",
          "Tabulka reminder_logs (RLS pouze admin) s filtrace per modul / period.",
          "Export do CSV pro audit nebo reporting.",
          "Pole final_status, attempt_number, attempt_errors umožňují rozbor problémů.",
        ],
      },
      {
        q: "Logy běhu cronu",
        a: [
          "Tabulka reminder_runs zaznamenává každý běh edge funkce (run-deadline-reminders / run-medical-reminders / send-training-reminders).",
          "Pole: started_at, ended_at, status, emails_sent, emails_failed, error_message.",
          "Triggered_by: 'cron' (automatický) nebo 'manual' (admin spustil).",
          "Zobrazení v Administrace → Logy připomínek.",
        ],
      },
    ],
  },
  {
    id: "admin-onboarding",
    title: "Onboarding a registrace (Admin)",
    icon: Settings,
    adminOnly: true,
    description: "Režimy registrace a schvalování nových účtů.",
    keywords: ["onboarding", "registrace", "schválení", "pozvánka", "doména"],
    items: [
      {
        q: "Režimy registrace",
        a: [
          "Administrace → Onboarding → „Režim registrace“:",
          "• Uzavřená (closed) – nikdo se nemůže sám registrovat. Pouze admin vytváří účty. DOPORUČENO pro produkci.",
          "• Pouze pozvánky (invite_only) – uživatelé se registrují přes pozvánkový e-mail (user_invites tabulka, expirace 7 dní).",
          "• Otevřená s doménou (domain_allowlist) – registrace povolena pro vybrané e-mailové domény (např. @engelgematex.cz). Funkce is_email_allowed() validuje.",
        ],
      },
      {
        q: "Schvalování čekajících uživatelů",
        a: [
          "Administrace → Onboarding → sekce „Čekající uživatelé“.",
          "Při registraci s approval_status = 'pending' se uživatel nemůže přihlásit dokud admin neschválí.",
          "Akce: Schválit / Zamítnout / Smazat. Po schválení se nastaví approval_status = 'approved' a uživateli odejde notifikace.",
          "Funkce is_user_approved() je volána ve všech RLS politikách.",
        ],
      },
      {
        q: "Inicializace prvního admina",
        a: [
          "Edge funkce seed-initial-admin (admin@system.local / admin123).",
          "Spouští se jednou při čistém deploji (idempotentní – při existujícím adminovi nic neudělá).",
          "Vytvoří účet, profil, roli admin, must_change_password = true.",
          "PRVNÍ KROK po deploji: přihlásit se a změnit heslo!",
        ],
      },
    ],
  },
  {
    id: "admin-system",
    title: "Systém, migrace a databáze (Admin)",
    icon: Database,
    adminOnly: true,
    description: "Stav systému, databázové migrace a údržba.",
    keywords: ["systém", "migrace", "databáze", "záloha", "cron"],
    items: [
      {
        q: "Stav systému",
        a: [
          "Hlavní menu → Systém → „Stav systému“ (/admin/status).",
          "Zobrazuje:",
          "• Stav backendu (Lovable Cloud) – konektivita.",
          "• Počty záznamů per tabulka (zaměstnanci, školení, PLP, lhůty, dokumenty).",
          "• Poslední běh cronu připomínek (datum + počet odeslaných).",
          "• Poslední aplikovaná migrace.",
        ],
      },
      {
        q: "Databázové migrace",
        a: [
          "Hlavní menu → Systém → „Migrace DB“ (/admin/migrations).",
          "Tabulka schema_migrations zaznamenává: version, name, checksum, applied_at.",
          "Migrace se aplikují automaticky při deployi přes systém migrationRegistry.",
          "Manuální spuštění edge funkce apply-migrations je možné, ale typicky není potřeba.",
          "DŮLEŽITÉ: nikdy nepřímo needitujte init-db nebo schema – vždy přes nové migrace.",
        ],
      },
      {
        q: "Statusy a synchronizace",
        a: [
          "Stavy se počítají dynamicky v UI i v DB funkcích calculate_*_status().",
          "Cron job běží denně 00:30 a volá recalculate_all_statuses() – synchronizuje DB hodnoty s aktuálním datem (pro SQL exporty a e-maily).",
          "Bez tohoto cronu by SQL queries pracovaly se starými statusy.",
        ],
      },
      {
        q: "Záloha a obnova dat",
        a: [
          "Lovable Cloud poskytuje denní automatické zálohy.",
          "Pro export aplikačních dat: použijte Export CSV/PDF v jednotlivých modulech.",
          "Hromadný export přes psql / pg_dump je možný jen na úrovni infrastruktury (mimo aplikaci).",
          "Soft-delete (deleted_at): smazané záznamy zůstávají v DB a lze je obnovit z Historie (admin akce).",
        ],
      },
    ],
  },
];

export default function Guides() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    // Admin filter (kept lenient — actual admin gating je řešena ProtectedRoute mimo)
    return true;
  }, [profile]);

  const visibleSections = useMemo(() => {
    return sections.filter((s) => isAdmin || !s.adminOnly);
  }, [isAdmin]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return visibleSections;
    const q = search.toLowerCase();
    return visibleSections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => {
          const ans = Array.isArray(i.a) ? i.a.join(" ") : i.a;
          const scenarioText = (i.scenarios ?? [])
            .map((sc) => `${sc.when} ${sc.then.join(" ")}`)
            .join(" ");
          const keywordText = (s.keywords ?? []).join(" ");
          return (
            i.q.toLowerCase().includes(q) ||
            ans.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q) ||
            keywordText.toLowerCase().includes(q) ||
            scenarioText.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((s) => s.items.length > 0);
  }, [visibleSections, search]);

  const userSections = filteredSections.filter((s) => !s.adminOnly);
  const adminSections = filteredSections.filter((s) => s.adminOnly);

  // Auto-scroll na hash při příchodu z HelpButton (např. /guides#skoleni)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    // Počkáme než se akordeon vyrenderuje
    const t = setTimeout(() => {
      const el = document.getElementById(`section-${hash}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveId(hash);
      }
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // Sledování aktivní sekce při scrollu (sticky index highlight)
  useEffect(() => {
    const handler = () => {
      const all = visibleSections
        .map((s) => {
          const el = document.getElementById(`section-${s.id}`);
          if (!el) return null;
          return { id: s.id, top: el.getBoundingClientRect().top };
        })
        .filter(Boolean) as { id: string; top: number }[];
      const above = all.filter((x) => x.top < 200);
      if (above.length) setActiveId(above[above.length - 1].id);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [visibleSections]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Návody a průvodce</h1>
          <p className="text-muted-foreground">
            Podrobné krok-za-krokem návody. Vyhledávejte, procházejte rejstřík nebo otevřete kapitolu z bočního indexu.
          </p>
        </div>
      </div>

      {/* Vyhledávací pole */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hledat (např. „export“, „hromadný import“, „historie“, „heslo“, „nemocenská“, „limbo“)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch("")}
                aria-label="Vymazat hledání"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {search && (
            <p className="text-xs text-muted-foreground mt-2">
              Nalezeno: <strong>{filteredSections.reduce((acc, s) => acc + s.items.length, 0)}</strong> návodů v{" "}
              <strong>{filteredSections.length}</strong> kapitolách.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Layout s bočním stickym indexem */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sticky boční index */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Rejstřík kapitol
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-220px)] px-3 pb-3">
                  <nav className="space-y-1">
                    {visibleSections.map((s) => {
                      const Icon = s.icon;
                      const isActive = activeId === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => scrollTo(s.id)}
                          className={`w-full flex items-start gap-2 text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="leading-tight">{s.title}</span>
                          {s.adminOnly && (
                            <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1 border-warning text-warning">
                              A
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Hlavní obsah */}
        <main>
          <Tabs defaultValue="user" className="space-y-4">
            <TabsList>
              <TabsTrigger value="user" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Pro uživatele
                <Badge variant="secondary" className="ml-1">{userSections.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Pro administrátory
                <Badge variant="secondary" className="ml-1">{adminSections.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-4">
              {userSections.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Pro hledaný výraz nebyly nalezeny žádné návody.
                  </CardContent>
                </Card>
              ) : (
                userSections.map((s) => <SectionCard key={s.id} section={s} />)
              )}
            </TabsContent>

            <TabsContent value="admin" className="space-y-4">
              {adminSections.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Pro hledaný výraz nebyly nalezeny žádné návody.
                  </CardContent>
                </Card>
              ) : (
                adminSections.map((s) => <SectionCard key={s.id} section={s} />)
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: GuideSection }) {
  const Icon = section.icon;
  return (
    <Card id={`section-${section.id}`} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          {section.title}
          {section.adminOnly && (
            <Badge variant="outline" className="ml-2 text-xs border-warning text-warning">
              Admin
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{section.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {section.items.map((item, idx) => (
            <AccordionItem key={idx} value={`${section.id}-${idx}`}>
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent>
                {Array.isArray(item.a) ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {item.a.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{item.a}</p>
                )}

                {/* Konkrétní scénáře "Když X, udělej Y" */}
                {item.scenarios && item.scenarios.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {item.scenarios.map((sc, i) => (
                      <div key={i} className="rounded-md border bg-primary/5 border-primary/20 p-3">
                        <div className="flex items-start gap-2 text-sm font-medium text-foreground mb-1">
                          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{sc.when}</span>
                        </div>
                        <ul className="space-y-1 text-sm text-muted-foreground pl-6">
                          {sc.then.map((step, j) => (
                            <li key={j}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {item.image && (
                  <figure className="mt-4 rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={item.image.src}
                      alt={item.image.alt}
                      loading="lazy"
                      width={1024}
                      height={512}
                      className="w-full h-auto max-h-64 object-contain bg-background"
                    />
                    {item.image.caption && (
                      <figcaption className="px-3 py-2 text-xs text-muted-foreground italic border-t">
                        {item.image.caption}
                      </figcaption>
                    )}
                  </figure>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
