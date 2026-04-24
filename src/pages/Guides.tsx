import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  CalendarClock,
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
}

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  adminOnly?: boolean;
  items: GuideItem[];
}

const sections: GuideSection[] = [
  {
    id: "uvod",
    title: "Začínáme",
    icon: BookOpen,
    description: "Základní orientace v aplikaci pro nové uživatele.",
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
        q: "Co znamenají barevné stavy v seznamech?",
        a: [
          "🟢 Zelená (Platné) – do termínu zbývá více než 30 dní, vše v pořádku.",
          "🟠 Oranžová (Vyprší brzy) – termín spadá do nejbližších 30 dní, je čas plánovat.",
          "🔴 Červená (Po termínu) – termín již vypršel NEBO byl výsledek poslední kontroly negativní (Nevyhovuje). Vyžaduje okamžitou akci.",
          "⚪️ Šedá (Archivováno) – záznam byl archivován (např. ukončený pracovní poměr) a negeneruje další upozornění.",
          "Stav se počítá automaticky každý den 00:30 přes naplánovaný cron (synchronizace databáze a UI).",
        ],
        image: { src: imgStatusLegend, alt: "Tři stavové barvy: zelená, oranžová, červená", caption: "Barevná legenda stavů používaná napříč všemi moduly" },
      },
      {
        q: "Co je to Provozovna a Středisko?",
        a: [
          "Provozovna (Facility) – organizační jednotka nejvyšší úrovně, např. konkrétní závod nebo lokalita. Spravuje admin v Administrace → Správa dat → Provozovny.",
          "Středisko (Department) – dílčí útvar v rámci provozovny (kód + název, např. „VYR-01 - Výroba“). Zaměstnanci a zařízení se přiřazují ke středisku. Středisko je nepovinné pole.",
          "V seznamech se středisko zobrazuje jednotně ve formátu „Kód - Název“.",
        ],
      },
      {
        q: "Jak funguje vyhledávání a filtry v seznamech?",
        a: [
          "Každý hlavní seznam (Školení, PLP, Lhůty, Zaměstnanci) má v horní části:",
          "• Globální vyhledávací pole – prohledává jména, názvy, e-maily, čísla.",
          "• Pokročilé filtry – stav, středisko, typ, datum od-do, odpovědná osoba.",
          "• Filtry zůstávají uložené v URL – odkaz lze sdílet kolegovi.",
          "• Tlačítko „Vyčistit filtry“ je vždy vpravo nahoře.",
        ],
      },
      {
        q: "Jak fungují záložky/dropdowny v hlavním menu?",
        a: [
          "Správa dat – provozní číselníky (Zaměstnanci, Provozovny, Střediska, Zařízení).",
          "Události – samotné záznamy (Naplánované akce, Historie pro Školení / Lhůty / PLP).",
          "Statistiky – přehledy a grafy (admin/manažer).",
          "Systém – Návody (všichni), Audit log, Stav systému, Migrace, Administrace (admin only).",
          "Profil – ikona vpravo nahoře (změna hesla, odhlášení, oznámení).",
        ],
      },
    ],
  },
  {
    id: "skoleni",
    title: "Školení",
    icon: GraduationCap,
    description: "Plánování, evidence a hromadné akce u školení zaměstnanců.",
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
    title: "Pravidla bezpečnosti hesel (Admin)",
    icon: ShieldAlert,
    adminOnly: true,
    description: "Konfigurace policy, expirace a session timeoutu.",
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
        q: "Audit log – sledování změn",
        a: [
          "Administrace → Audit log (nebo přímá routa /audit-log).",
          "Filtrace: uživatel, akce (INSERT/UPDATE/DELETE), tabulka, datum od-do, role.",
          "Zaznamenává: kdo (user_id, email, role), kdy (created_at), co změnil (changed_fields, old_data, new_data).",
          "RPC get_filtered_audit_logs() s paginací – podporuje export.",
          "Citlivé tabulky se logují automaticky přes triggery.",
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
    items: [
      {
        q: "Jak nakonfigurovat SMTP?",
        a: [
          "Administrace → E-maily & Šablony → karta „SMTP“.",
          "Podporované varianty:",
          "• Standardní SMTP (STARTTLS) – host, port (typicky 587), uživatel, heslo.",
          "• Microsoft 365 (OAuth2) – Tenant ID, Client ID, Client Secret. Bez nutnosti uchovávat heslo.",
          "• Gmail (OAuth2) – stejný princip jako M365.",
          "Po uložení se heslo / secret nezobrazí (z bezpečnostních důvodů). Změna hesla = nové uložení.",
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
    items: [
      {
        q: "Stav systému",
        a: [
          "Hlavní menu → Systém → „Stav systému“ (/system-status).",
          "Zobrazuje:",
          "• Stav backendu (Lovable Cloud / Supabase) – konektivita.",
          "• Počty záznamů per tabulka (zaměstnanci, školení, PLP, lhůty, dokumenty).",
          "• Poslední běh cronu připomínek (datum + počet odeslaných).",
          "• Poslední aplikovaná migrace.",
        ],
      },
      {
        q: "Databázové migrace",
        a: [
          "Hlavní menu → Systém → „Migrace DB“ (/database-migrations).",
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
          "Lovable Cloud / Supabase poskytuje denní automatické zálohy.",
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

  const isAdmin = useMemo(() => {
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
          return (
            i.q.toLowerCase().includes(q) ||
            ans.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((s) => s.items.length > 0);
  }, [visibleSections, search]);

  const userSections = filteredSections.filter((s) => !s.adminOnly);
  const adminSections = filteredSections.filter((s) => s.adminOnly);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Návody a průvodce</h1>
          <p className="text-muted-foreground">
            Podrobné krok-za-krokem návody. Vyhledejte nebo procházejte sekce.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hledat v návodech (např. „heslo“, „import“, „připomínka“, „zkušební doba“)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}

function SectionCard({ section }: { section: GuideSection }) {
  const Icon = section.icon;
  return (
    <Card>
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
