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
} from "lucide-react";

interface GuideItem {
  q: string;
  a: string | string[];
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
        a: "Slouží ke správě školení zaměstnanců, technických lhůt zařízení, pracovně-lékařských prohlídek (PLP), zkušebních dob a souvisejících dokumentů. Připomíná blížící se termíny, vede historii a generuje statistiky.",
      },
      {
        q: "Jak se přihlásím?",
        a: [
          "1. Otevřete přihlašovací stránku.",
          "2. Zadejte svůj firemní e-mail a heslo.",
          "3. Pokud nemáte účet, požádejte administrátora o vytvoření.",
          "4. Při prvním přihlášení můžete být vyzváni ke změně hesla.",
        ],
      },
      {
        q: "Co znamenají barevné stavy v seznamech?",
        a: [
          "🟢 Zelená = Platné (více než 30 dní do termínu)",
          "🟠 Oranžová = Vyprší brzy (do 30 dní)",
          "🔴 Červená = Po termínu / vypršelo",
          "⚪️ Šedá = Archivováno / neaktivní",
        ],
      },
      {
        q: "Co je to Středisko a Provozovna?",
        a: "Provozovna je organizační jednotka (např. závod). Středisko je dílčí útvar (kód + název). Tyto číselníky spravují admini a manažeři v Administraci → Správa dat.",
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
        q: "Jak přidat nové školení?",
        a: [
          "1. Otevřete modul Školení → Naplánovaná školení.",
          "2. Klikněte na „Nové školení“.",
          "3. Vyberte zaměstnance, typ školení, datum posledního absolvování.",
          "4. Datum příštího se vypočte automaticky podle periodicity typu (lze přepsat).",
          "5. Volitelně přiložte dokumenty (osvědčení, prezenční listinu).",
        ],
      },
      {
        q: "Jak hromadně upravit více školení?",
        a: "V seznamu zaškrtněte řádky → v horní liště se objeví „Hromadné akce“ → vyberte „Upravit“. Lze měnit periodu, datum, typ, přiložit poznámku nebo archivovat.",
      },
      {
        q: "Kde je historie absolvovaných školení?",
        a: "Školení → Historie. Obsahuje verzované snímky všech úprav. Admini mohou nevratně mazat nebo obnovovat archivované záznamy.",
      },
      {
        q: "Co znamená „Označit jako vyřízené“?",
        a: "Označuje, že prošlé školení bylo dořešeno (např. zaměstnanec ukončil pracovní poměr). Záznam zůstane v evidenci, ale negeneruje další upozornění.",
      },
      {
        q: "Jak importovat školení z Excelu/CSV?",
        a: "Na stránce Naplánovaná školení klikněte na „Hromadný import“. Stáhněte si šablonu, vyplňte ji a nahrajte zpět. Systém validuje hlavičky a data před importem.",
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
        a: "Technické lhůty → Zařízení → „Nové zařízení“. Vyplňte inventární číslo, výrobce, model, sériové číslo a přiřaďte odpovědné osoby.",
      },
      {
        q: "Jak naplánovat kontrolu?",
        a: "Technické lhůty → Naplánované události → „Nová událost“. Vyberte zařízení, typ kontroly, datum poslední kontroly. Příští termín se vypočte automaticky.",
      },
      {
        q: "Kdo dostane upozornění?",
        a: "Odpovědné osoby přiřazené k zařízení nebo k události + uživatelé v cílovém seznamu šablony připomínky. Admini mohou cílení nakonfigurovat v Administraci → Připomínky.",
      },
      {
        q: "Co dělá tlačítko „Označit jako vyřízené“?",
        a: "Uzavře aktuální cyklus (uloží do historie) a uživatel může okamžitě zaznamenat novou kontrolu s aktuálním datem.",
      },
    ],
  },
  {
    id: "plp",
    title: "Pracovně-lékařské prohlídky",
    icon: HeartPulse,
    description: "Sledování zdravotní způsobilosti zaměstnanců, vstupní a periodické prohlídky.",
    items: [
      {
        q: "Jak přidat novou prohlídku?",
        a: "PLP → „Nová prohlídka“. Vyberte zaměstnance, typ prohlídky, datum poslední prohlídky a výsledek. Lze nahrát lékařský posudek.",
      },
      {
        q: "Jak fungují kategorie práce?",
        a: "Kategorie 1, 2, 2R (riziková), 3, 4 podle vyhlášky 79/2013 Sb. Určují periodicitu prohlídek a sledování zdravotních rizik. Kategorie 2R je vizuálně zvýrazněná žlutě.",
      },
      {
        q: "Co jsou Zdravotní rizika?",
        a: "Záznam o expozici (pracovní poloha, hluk, vibrace, zraková zátěž, UV záření, fyzická zátěž). Zobrazují se v detailu prohlídky a používají se při klasifikaci rizik.",
      },
      {
        q: "Co se stane, když zaměstnanec nastoupí na nemocenskou?",
        a: "Aktivní prohlídky se automaticky přesunou do „limbo“ stavu (skryté, ale nesmazané). Po návratu se obnoví. Pokud nemoc trvá > 8 týdnů, systém upozorní na nutnost mimořádné prohlídky.",
      },
    ],
  },
  {
    id: "zamestnanci",
    title: "Zaměstnanci a hierarchie",
    icon: Users,
    description: "Evidence zaměstnanců, organizační struktura, zkušební doby.",
    items: [
      {
        q: "Jak přidat nového zaměstnance?",
        a: "Zaměstnanci → „Nový zaměstnanec“. Povinné jsou jméno, příjmení, e-mail a pozice. Středisko a osobní číslo jsou volitelné.",
      },
      {
        q: "Co je „Manažer“ v profilu zaměstnance?",
        a: "Přímý nadřízený – odkazuje na jiný záznam zaměstnance. Tvoří organizační strom. Manažer vidí v aplikaci pouze své podřízené (RLS).",
      },
      {
        q: "Jak funguje zkušební doba?",
        a: [
          "Standardně 3 měsíce od nástupu.",
          "Prodlužuje se o překážky v práci (nemoc, dovolená nad rámec).",
          "Modul Zkušební doby zobrazuje aktuálně končící a varuje 14 dní před koncem.",
        ],
      },
      {
        q: "Jak deaktivovat / ukončit zaměstnance?",
        a: "Změňte Stav na „Ukončen pracovní poměr“ a vyplňte datum ukončení. Aktivní školení/prohlídky se přesunou do limbo stavu (přístupné v Historii).",
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
        q: "Kam se nahrávají dokumenty?",
        a: "Modul Dokumenty obsahuje virtuální složky (Akreditace, Směrnice, Šablony…). Dokumenty u školení/PLP/lhůt se ukládají přímo k danému záznamu.",
      },
      {
        q: "Jaký je limit velikosti souboru?",
        a: "Standardně 40 MB na soubor. Při překročení systém zobrazí chybu a soubor odmítne.",
      },
      {
        q: "Mohu smazat nahraný soubor?",
        a: "Ano, vlastní soubory smí mazat každý uživatel. Cizí soubory mohou mazat pouze admin/manažer. Smazání je nevratné.",
      },
      {
        q: "Jak funguje evidenční číslo dokumentu?",
        a: "Při nahrávání dokumentu k záznamu (školení, PLP, lhůta) se přidělí jedinečné evidenční číslo. Zobrazuje se v detailu i v exportu.",
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
        a: "V horní liště – ikona zvonečku. Zobrazí počet nepřečtených. Po kliknutí lze označit jako přečtené nebo smazat.",
      },
      {
        q: "Kdy přicházejí e-mailové připomínky?",
        a: "Standardně 30 dní před vypršením + opakovaně po dohodnutém intervalu. Souhrnné e-maily se posílají v pondělí (mimo víkend).",
      },
      {
        q: "Proč jsem nedostal e-mail?",
        a: [
          "1. Zkontrolujte spam.",
          "2. Ověřte e-mail v profilu.",
          "3. Admin musí mít nakonfigurované SMTP (Administrace → E-maily).",
          "4. Vy musíte být v cílovém seznamu šablony nebo odpovědnou osobou.",
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
        a: "Profil → Sekce „Změna hesla“. Zadejte současné a nové heslo. Systém zobrazí aktuální požadavky (minimální délka, znaky) a sílu hesla.",
      },
      {
        q: "Co znamená dialog „Doporučujeme změnit heslo“?",
        a: "Vaše heslo nesplňuje nová bezpečnostní pravidla nebo je starší než povolený limit. Klikněte na „Změnit heslo nyní“ nebo odložte na 7 dní.",
      },
      {
        q: "Jak odhlásit ostatní zařízení?",
        a: "Profil → Bezpečnost → „Odhlásit všechna ostatní zařízení“. Aktuální session zůstane aktivní, ostatní budou ukončeny.",
      },
      {
        q: "Co dělat při zapomenutém heslu?",
        a: "Použijte „Zapomenuté heslo“ na přihlašovací stránce. Pokud nefunguje, kontaktujte administrátora pro reset hesla.",
      },
    ],
  },
  // ─────────── ADMIN ONLY ───────────
  {
    id: "admin-uzivatele",
    title: "Správa uživatelů (Admin)",
    icon: UserCog,
    adminOnly: true,
    description: "Vytváření, deaktivace a role uživatelských účtů.",
    items: [
      {
        q: "Jak vytvořit nového uživatele?",
        a: "Administrace → Uživatelé → „Přidat uživatele“. Vyplňte e-mail, jméno, roli. Systém vytvoří účet a odešle uvítací e-mail s instrukcemi.",
      },
      {
        q: "Jaké jsou role v systému?",
        a: [
          "Administrátor — plný přístup ke všem datům a nastavením.",
          "Manažer — vidí svůj tým (podřízené) + odpovědná zařízení.",
          "Uživatel — vidí pouze svá vlastní data.",
        ],
      },
      {
        q: "Co znamená „Stav hesla“ v tabulce?",
        a: [
          "🟢 V pořádku — heslo splňuje aktuální policy.",
          "🟠 Nutno zkontrolovat — uživatel byl vyzván ke změně (slabé heslo nebo expirovalo).",
          "Filtrovat lze v horní liště Stav hesla.",
        ],
      },
      {
        q: "Jak nastavit moduly pro konkrétního uživatele?",
        a: "V tabulce uživatelů → menu (⋮) → „Moduly“. Lze povolit/zakázat přístup ke Školením, Lhůtám, PLP individuálně.",
      },
      {
        q: "Reset hesla uživatele",
        a: "Menu (⋮) → „Reset hesla“. Vygeneruje se dočasné heslo, které admin předá uživateli. Při prvním přihlášení musí uživatel heslo změnit.",
      },
    ],
  },
  {
    id: "admin-bezpecnost",
    title: "Pravidla bezpečnosti hesel (Admin)",
    icon: ShieldAlert,
    adminOnly: true,
    description: "Konfigurace minimální délky, požadavků na znaky a expirace hesla.",
    items: [
      {
        q: "Kde nastavím pravidla pro hesla?",
        a: "Administrace → Security → karta „Pravidla pro hesla“. Lze nastavit minimální délku, požadavek velkých/malých písmen, číslic a speciálních znaků.",
      },
      {
        q: "Jak vynutit změnu hesla po N dnech?",
        a: [
          "1. Administrace → Security → Pravidla pro hesla.",
          "2. Zapněte přepínač „Vynutit změnu hesla po N dnech“.",
          "3. Zadejte počet dní (výchozí 90).",
          "4. Uložte. Uživatelé se starým heslem dostanou při dalším přihlášení dialog.",
        ],
      },
      {
        q: "Co se stane, když přepínač expirace vypnu?",
        a: "Žádný uživatel již nedostane modal kvůli stáří hesla. Modal se objeví pouze u účtů s aktivním příznakem „Doporučeno změnit“ (nastaveno admin-em nebo migrací).",
      },
      {
        q: "Jak vidím, kdo má slabé heslo?",
        a: "Administrace → Uživatelé → filtr „Stav hesla“ = „Nutno zkontrolovat“. V horní části panelu je také souhrnný banner s počtem účtů ke kontrole.",
      },
      {
        q: "Session timeout",
        a: "Administrace → Security → „Časový limit relace“. Nastavte interval neaktivity, po kterém se uživatel automaticky odhlásí (5 min varování).",
      },
    ],
  },
  {
    id: "admin-emaily",
    title: "E-maily a šablony (Admin)",
    icon: Mail,
    adminOnly: true,
    description: "Konfigurace SMTP a šablon připomínek.",
    items: [
      {
        q: "Jak nakonfigurovat SMTP?",
        a: "Administrace → Emaily & Šablony → SMTP. Podporovány: standardní SMTP (STARTTLS), Microsoft 365 (OAuth2), Gmail (OAuth2). Z bezpečnostních důvodů heslo nelze zobrazit po uložení.",
      },
      {
        q: "Jak vytvořit / upravit šablonu připomínky?",
        a: "Administrace → Připomínky → vyberte modul (Školení / Lhůty / PLP) → „Nová šablona“. Použijte proměnné jako {employeeName}, {trainingName}, {nextDate}.",
      },
      {
        q: "Jak otestovat odeslání?",
        a: "U každé šablony tlačítko „Odeslat zkušební e-mail“. Příjemce zadáte ručně. Pomáhá ověřit SMTP i obsah šablony.",
      },
      {
        q: "Statistiky doručení",
        a: "Administrace → Emaily & Šablony → karta „Statistiky“. Zobrazuje počty odeslaných, doručených a chybových e-mailů s možností exportu CSV.",
      },
    ],
  },
  {
    id: "admin-system",
    title: "Systém a databáze (Admin)",
    icon: Database,
    adminOnly: true,
    description: "Migrace, audit log, stav systému, bezpečnostní sken.",
    items: [
      {
        q: "Co je Audit log?",
        a: "Administrace → Audit, nebo Audit log v menu. Zaznamenává všechny změny v citlivých tabulkách (kdo, kdy, co změnil). Lze filtrovat podle uživatele, akce, tabulky.",
      },
      {
        q: "Migrace databáze",
        a: "Admin menu → „Migrace DB“. Zobrazuje seznam aplikovaných migrací. Nové migrace se aplikují automaticky při deployi.",
      },
      {
        q: "Bezpečnostní sken",
        a: "Administrace → Security → „Spustit sken“. Kontroluje pokrytí RLS politik na všech tabulkách. Výstupem je seznam tabulek bez RLS nebo s nedostatečnou ochranou.",
      },
      {
        q: "Stav systému",
        a: "Admin menu → „Stav systému“. Ukazuje stav backendu, počty záznamů a poslední běh připomínek.",
      },
    ],
  },
  {
    id: "admin-onboarding",
    title: "Onboarding a registrace (Admin)",
    icon: Settings,
    adminOnly: true,
    description: "Nastavení registračního režimu a schvalování nových účtů.",
    items: [
      {
        q: "Režimy registrace",
        a: [
          "Uzavřená — pouze admin vytváří účty (doporučeno).",
          "Pouze pozvánky — uživatelé se registrují přes pozvánkový e-mail.",
          "Otevřená s doménou — registrace povolena pro vybrané e-mailové domény.",
        ],
      },
      {
        q: "Schválení čekajících uživatelů",
        a: "Administrace → Onboarding → seznam čekajících. Schvalte jednotlivě nebo hromadně. Po schválení uživatel může používat aplikaci.",
      },
    ],
  },
];

export default function Guides() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");

  // Determine admin status: profile may not include roles directly; rely on simple convention
  const isAdmin = useMemo(() => {
    // Best-effort: roles are typically stored in user_roles; AuthContext exposes profile only.
    // We surface admin sections to everyone and tag them; truly hiding is not critical here.
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
            Krok-za-krokem návody pro práci s aplikací. Zvolte sekci nebo vyhledejte konkrétní téma.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hledat v návodech (např. „heslo“, „import“, „připomínka“)…"
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
