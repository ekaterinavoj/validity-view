
# Plán implementace

## Přehled
Tento plán pokrývá 4 hlavní oblasti:
1. **Tlačítko pro odeslání testovacího emailu** v nastavení SMTP
2. **Ověření zobrazení SMTP formuláře** v Administrace → Emaily
3. **Sjednocení nahrávání dokumentů** - přidání náhledu a stažení k existujícím dokumentům v editačních formulářích
4. **Rozšíření seznamu existujících dokumentů** - zobrazení ikon pro náhled (👁) a stažení (⬇) vedle mazání (🗑)

---

## 1. Tlačítko pro testovací SMTP email

### Popis
Přidat do sekce "SMTP Server" v Administrace → Emaily tlačítko "Odeslat testovací email", které:
- Otevře dialog s polem pro zadání emailové adresy
- Odešle testovací email přes aktuálně nakonfigurovaný SMTP server
- Zobrazí výsledek (úspěch/chyba) s detaily

### Změny
**Nová komponenta:** `src/components/SendTestSmtpEmail.tsx`
- Dialog s inputem pro email příjemce
- Volá Edge funkci `send-test-email` pro odeslání
- Zobrazuje stav odesílání a výsledek

**Úprava:** `src/pages/AdminSettings.tsx`
- Import nové komponenty
- Přidání tlačítka pod status indikátorem SMTP konfigurace (řádky 890-916)

**Úprava:** `supabase/functions/send-test-email/index.ts`
- Aktualizace pro správnou podporu SMTP bez hesla (pro servery bez autorizace)
- Lepší error handling a diagnostické zprávy

---

## 2. Ověření SMTP formuláře

Formulář je již správně implementován s těmito poli:
- SMTP Host, Port
- Autorizace (toggle) + username/password
- Email odesílatele (From) + jméno odesílatele
- Režim zabezpečení (STARTTLS/SMTPS/None)
- Ignorovat TLS chyby

Po přidání testovacího tlačítka bude možné ověřit funkčnost.

---

## 3. Sjednocení nahrávání dokumentů ve školení

### Aktuální stav
- **Technické lhůty (EditDeadline.tsx):** Existující dokumenty zobrazeny jednoduše s možností stažení kliknutím na název a mazání ikonou
- **Školení (EditTraining.tsx):** Používá komponentu `TrainingDocumentsList`, která má již náhled (👁), stažení (⬇) a mazání (🗑)

### Změny

**Úprava:** `src/pages/EditDeadline.tsx`
Nahradit inline zobrazení existujících dokumentů (řádky 522-558) novou komponentou `DeadlineDocumentsList`, která bude fungovat stejně jako `TrainingDocumentsList`:
- Zobrazení badge s typem dokumentu
- Ikony: náhled (Eye), stažení (Download), mazání (Trash2)
- Dialog pro náhled PDF/obrázků

**Nová komponenta:** `src/components/DeadlineDocumentsList.tsx`
Vytvořit komponentu ekvivalentní k `TrainingDocumentsList` ale pro technické lhůty:
- Načtení dokumentů z `deadline_documents`
- Náhled pomocí `FilePreviewDialog`
- Stažení a mazání s potvrzovacím dialogem
- Stejný vizuální styl jako `TrainingDocumentsList`

---

## 4. Vizuální změny v seznamu dokumentů

Dle obrázků uživatele - aktuální stav v `TrainingDocumentsList` již obsahuje 3 ikony:
- 👁 Náhled (Eye)
- ⬇ Stažení (Download)  
- 🗑 Mazání (Trash2)

Toto rozvržení bude použito i v nové `DeadlineDocumentsList`.

---

## Technické detaily

### Nové soubory
```
src/components/SendTestSmtpEmail.tsx
src/components/DeadlineDocumentsList.tsx
```

### Upravované soubory
```
src/pages/AdminSettings.tsx
src/pages/EditDeadline.tsx
supabase/functions/send-test-email/index.ts
```

### Struktura SendTestSmtpEmail.tsx
```text
- Dialog s formulářem
- Input pro email příjemce
- Tlačítko "Odeslat testovací email"
- Stav: idle → sending → success/error
- Zobrazení diagnostických informací (server, port, výsledek)
```

### Struktura DeadlineDocumentsList.tsx
```text
- Props: deadlineId, canDelete
- Načtení dokumentů pomocí getDeadlineDocuments()
- Seznam karet s:
  - Ikona typu souboru (PDF/jiný)
  - Název souboru + badge typu + velikost + datum
  - Akční tlačítka: Eye, Download, Trash2
- FilePreviewDialog pro náhled
- AlertDialog pro potvrzení mazání
```

---

## Očekávaný výsledek

Po implementaci:
1. V Administrace → Emaily bude pod SMTP konfigurací tlačítko "Odeslat testovací email"
2. Kliknutí otevře dialog, kde zadáte email a odešlete test
3. Při editaci technické události budou existující dokumenty zobrazeny se stejnými ikonami jako u školení (👁 ⬇ 🗑)
4. Oba moduly budou mít konzistentní UX pro správu dokumentů
