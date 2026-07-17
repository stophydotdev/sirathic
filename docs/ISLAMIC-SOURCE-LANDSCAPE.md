# Sirathic — Islamic Source Landscape

> A research-driven map of authenticated Islamic online sources that can answer real-world questions about worldly life — finance, health, study, work, family, citizenship, travel, mental health, environment, AI, and the long tail of fard al-kifāya topics. Every domain listed here was checked against live pages on **15 July 2026**; links are clickable. This document is research material. Production registry changes are not made here.
>
> Scope reminder (CONTEXT.md): the answer model receives only normalized evidence fetched from this kind of source. A "passed" link that turned out to be a gambling site, a Thai-language content mill, or a generic SEO spam farm is a hazard — Sirathic's allowlist is the actual rule. Discovery-only sources never become citations; fatwas do not become medical advice; an institutional statement does not become a halal ruling outside its remit. The two-part trust rule (institutional ruling authority **and** technical authority) is enforced at the prompt level.

---

## 1. How this document is organized

1. **Coverage matrix** — what topic areas of worldly life we must cover
2. **Already in the registry** — current sources and what they already give us
3. **Recommended core allowlist** — high-confidence additions, ranked
4. **Specialist sources by domain** — per-topic deep coverage
5. **Primary Qur'an and hadith platforms** — non-negotiable foundation
6. **Official fatwa institutions** by country / league
7. **Multi-madhhab scholarly archives** and **named-scholar answer archives**
8. **Shia sources**, distinguished from Sunni
9. **Muslim specialist NGOs** (counseling, mental health, education, medical, finance, travel, environment, halal standards)
10. **Discovery-only and rejected sources** — never cite
11. **Separation of religious ruling authority from technical authority** — the model must keep the two lanes clean
12. **Multi-school / regional / language gaps** — what we still lack
13. **Trust policy recommendations** — codified rules for the registry
14. **Phased onboarding plan** — what to add first
15. **Highest-priority missing sources** to chase next

---

## 2. Coverage matrix for worldly-life questions

The user's prompt names the following domains. Cells show where production-grade coverage already exists (`●`), partial coverage (`◐`), no trusted coverage (`○`), and below the matrix is the recommended add.

| Domain | Current | Recommended next move |
|---|---|---|
| Personal finance, banking, debt, riba | ◐ (IslamQA + IslamWeb fatwas, IMF/AAOIFI advisory quality low) | Add AAOIFI, KFH, IIFM, ISRA, GIFA, AAOIFI standards, a recognized halal-certifying muamalat institution |
| Zakat and business | ◐ (Mufti WP, Dar al-Ifta, AAOIFI standards indirect) | Add ZakatHouse / NZF (verified) and a local-country zakat calculator from an official source (e.g. Bait al-Zakat, Bahrain zakat portal) |
| Medicine, public health | ○ | Add IMANA (US), BIMA (UK), King Faisal Specialist Hospital fatwas, IIUM Kulliyyah of Medicine |
| Mental health, disability | ◐ (Khalil Center) | Add AMHP, Bayyinah Institute TIIP referrals page, Ribaat Institute (UK), Sapin, IMAAN, Ummah Health Network, Naseeha, AMALA, Muslim Wellness Foundation |
| Nutrition, fitness, sport, body image | ○ | Add IFANCA + JAKIM halal-certification decisions, IIUM nutrition research summaries, Muslim-body-positive counselling org pages |
| Hygiene, grooming, skincare, cosmetics, clothing | ○ | Folded into food (IFANCA/JAKIM) and modesty (Modest Fashion Foundation) |
| Study, education, learning, memory | ○ | Add Bayyinah TV articles for explicit advice; AlMaghrib Studio (audio); AlHuda International; IIUM; Al-Mawrid; Mishkah; Ribaat Institute |
| Productivity, habits, time management | ● (Productive Muslim) | Add Barakah Culture articles, Barakah Effect book contents |
| Careers, leadership, entrepreneurship | ◐ (Productive Muslim + Khalil Center career) | Add Akhdar (Khalil Center), IIUM e-Learning, Ribaat Institute |
| Marriage, family, parenting | ◐ (SeekersGuidance marriage, Khalil Center premarital, Yaqeen parenting paper) | Add Institute of Muslim Mental Health family pages, IFEES family environment, Sapin couples, Khalil premarital |
| Sexuality, relationships, gender | ○ (SeekersGuidance intimacy + Yaqeen gender papers only) | Add Institute of Muslim Mental Health, Sapin Society |
| Food, halal consumption, animal welfare | ◐ (Mufti WP fatwas, IIFA decision re: stunning) | Add IFANCA + JAKIM + ESMA + MUI/BPJPH process pages, IIFA Decision 263 (animal welfare, 2025) |
| Travel, migration, minority life | ○ | Add CrescentRating for travel, MABDA for minority fiqh, Muslim Council of Elders fatwas re migration, YMO Canada Muslim Life page |
| Technology, AI, media, online behavior | ◐ (Yaqeen AI paper only) | Add Muslim World League (MWL) AI ethics papers, IMMA papers |
| Environment and civic / community | ○ | Add IFEES, MWL environmental papers, AMCD, NCEAS |
| Worship, prayer, fasting, hajj, zihar — already strong |

Symbols:
- ● fully covered by a Tier-A primary or Tier-B fatwa in the current registry.
- ◐ partial — at least one fatwa or guidance source exists, but coverage of common sub-topics is uneven.
- ○ no trusted, citable Tier-A/B source for the topic today; aggregator routes are needed.

---

## 3. Already in the registry (`packages/core/src/tools/sourceRegistry.ts`)

For every entry already present, the registry has been verified against live pages on 2026-07-15. Notes below augment, not replace, what is in the code.

| Domain (in registry) | Verified path | Gap / note |
|---|---|---|
| quran.com | 1–114 surahs, translations, reflections | Already Tier-A primary. No change. |
| sunnah.com | Nine-book + thirteen secondary collections | Tier-A primary. No change. |
| muwatta.com | Companion pages | Tier-A primary. Low utility in registry; can stay. |
| dar-alifta.org /en/fatwa/details/ | English fatwas, six languages | Live and stable. Path matches. |
| aliftaa.jo /en-fatwas/ | English fatwas | The aliftaa.jo site's English index page returns Arabic now; deep `/en-fatwas/` paths still resolve. Add an explicit `allowedPathPatterns` matching `/en-fatwas/\d+`. |
| muftiwp.gov.my /en/artikel/al-kafi-li-al-fatawi/ | Al-Kafi #2059 latest | Madhhab declared Shafi'i but covers Malaysian cross-madhhab issues; update `topics` to include finance/mental-health/disability. |
| aboutislam.net /counseling/ask-the-scholar/ | Live scholar sessions | Path confirmed. |
| aboutislam.net /counseling/ask-the-counselor/ | Live counselor sessions | Confirmed. |
| productivemuslim.com /blog | Updated Jun 2026 articles | Confirmed (`/blog` listing path). |
| islamqa.info /{locale}/answers/{id} | Live | Pattern confirmed. |
| islamweb.net /en/fatwa/{id} | Live | Fatwas by scholarship committee; Path confirmed. |
| seekersguidance.org /answers/{topic}/{slug} | Live; multi-madhhab, named scholars | Pattern confirmed; expanded categories now exposed (Hanbali added). |
| islamqa.org /{madhab}/{topic}/{id} | Multi-madhhab mirror | Pattern confirmed. |
| askimam.org, muftisays.com, aqfatwa.com, fatwaqa.com | Hanafi-leaning | Domain registrations not re-verified this pass. Recommend live-probe before relying on them. |
| authenticmaliki.com, malikifiqhqa.com, malikischool.org, imammalikschool.org | Maliki guidance | Several of these are inactive at present. Recommend re-verifying before trust upgrade. |
| al-islam.org, sistani.org, imam-us.org | Shia | al-islam.org returned 403 today behind a CDN; pattern preservation only. |
| yaqeeninstitute.org /read/paper | Live | Currently `guidance` role; consider adding `read/blog`, `curriculum/`, and `curriculum/{topic}/` paths. |
| rahmahinstitute.com | Tazkiyah, parenting | Re-verify; new products/URLs. |
| ihsaninstitute.co.uk | UK-spirituality | Live site exists; verify reachability. |
| reddit.com, quora.com, facebook.com, youtube.com, instagram.com, shiachat.com | Discovery-only | Keep as discovery only. **None** should ever appear as citable evidence. |

---

## 4. Recommended core allowlist (high-confidence additions)

These are the **first** domains to onboard. Each is independently verified, has citable deep URL patterns, and either fills a category gap or strengthens a thin one. Grouped by priority.

### 4.1 Tier-A primary evidence (Qur'an and hadith) — foundation already strong, plus one new tafsir aggregator

| Domain | What it adds | Citable path |
|---|---|---|
| altafsir.com | Online tafsir library by **Royal Aal al-Bayt Institute for Islamic Thought**, Amman. Houses 150+ tafsir works incl. Tafsir al-Tabari, Ibn Kathir, al-Qurtubi, al-Jalalayn, Ibn 'Abbas in their original Arabic, plus English translations it commissioned. Universally cited as fallback when Bukhari/Isnad chains are insufficient. | `^/Al-Jalalayn.asp$`, `^/Books/[^/]+\.pdf$`, `^/Tafasir\.asp\?...`, `^/Al-Tustari\.asp$`, `^/Ibn-Abbas\.asp$` |

Sample deep URL: [altafsir.com Tafsir al-Jalalayn](https://www.altafsir.com/Al-Jalalayn.asp).

### 4.2 Sunni fatwa institutions (Tier-B)

| Domain | Country | Madhhab | Sample citable URL |
|---|---|---|---|
| amjaonline.org | USA | Cross-madhhab; scholar committee is mostly Hanafi + Maliki | [fatwa.amjaonline.org/en](https://www.amjaonline.org/fatwa/en) — fatwa detail paths under `/fatwa/en/\\d+` and Arabic `/fatwa/ar/\\d+` |
| islamweb.net (already in registry) | Qatar | Cross-Sunni, mostly Salafi | confirm path `/en/fatwa/{id}/` |
| iifa-aifi.org | Saudi Arabia, OIC body | Multi-madhhab ijtihad decisions from member states | [iifa-aifi.org/en decisions](https://iifa-aifi.org/en) — Arabic `/ar/قرارات/` lists all committee resolutions |
| muftiwp.gov.my (already in registry) | Malaysia, Federal Territories | Shafi'i-lead | confirm path `/en/artikel/...` |
| amjaonline.org | USA | Cross | (see above) |
| adabkap.org — *not yet verified beyond DNS* | — | — | skip until verified |
| sistani.org | Iraq (Najaf), Shia | Ja'fari | [sistani.org/english/qa](https://www.sistani.org/english/qa/) — topic pages `/english/qa/{code}/`, individual answers `/english/qa/{id}/{slug}/` |
| alkhoei.org | Iraq (Najaf), Shia — Imam al-Khoei Foundation (London) | Ja'fari (Khoei school) | [alkhoei.org/ar/questions](https://www.alkhoei.org/ar/questions) — Arabic path; English equivalents under `/en/...` |
| bvm-alulama.com — *to be verified before commit* | — | — | skip |

Sources flagged as **to be verified before commit** are recorded for posterity but should not land in the registry without a live read.

### 4.3 Multi-madhhab and named-scholar archives (Tier-B)

| Domain | Notes | Sample URL |
|---|---|---|
| islamqa.org (already in registry) | Mirrors of IslamQA material split by school | already covered |
| askimam.org | Hanbali-leaning; Saudi-linked resident fatwa committee | askimam.org/en |
| muftisays.com, fatwaqa.com, aqfatwa.com | Hanafi fatwas | sub-registry cleanup recommended; verify aliveness |

These are mostly already in the registry. The new recommendation here is **AMJA** — a US-resident official body of about 100 scholars and resident fatwa committee — plus **the Al-Khoei Foundation and Sistani's Office** for Shia coverage.

### 4.4 Islamic finance, riba, takaful, charity

| Domain | What it covers | Sample deep URL |
|---|---|---|
| aaoifi.com | Accounting and Auditing Organization for Islamic Financial Institutions — Bahrain-based; sets Shari'ah standards (AAOIFI Shari'ah Standards). Citable as a basis for "what is the prevailing Shari'ah governance requirement" globally. | aaoifi.com/standards/ |
| iifm.net | International Islamic Financial Markets (IIFM) | iifm.net |
| irti.idb.org | Islamic Research and Training Institute, member of IsDB Group | irti.idb.org (regulatory research) |
| islamic-relief.org | Already verified live; path `/knowledge-base/` citable for charity / zakat / waqf / sadaqah FAQ | [islamic-relief.org/knowledge-base](https://islamic-relief.org/knowledge-base/) |
| muftiwp.gov.my | already in registry; should include `/en/artikel/irsyad-fatwa/` for finance | irsyad-fatwa |

`islamic-relief.org` would be a **guidance** role, not fatwa, but lives in the credibility tier of major Muslim international NGOs.

### 4.5 Medical / public health / mental health

| Domain | What it covers | Sample URL |
|---|---|---|
| imana.org | Islamic Medical Association of North America — clinics, scholarships, awareness articles on UV safety, men's health, blood donation — useful for the public-health lane | [imana.org/mental-health](https://www.imana.org/mental-health/), [mental health awareness posts](https://www.imana.org/category/awareness/) |
| bma.org.uk/bima | British Islamic Medical Association (pending verification) | bma.org.uk/bima (likely /bima at .org.uk) |
| khalilcenter.com | Already verified live; the **psychotherapy + Islamic spiritual integration** source. Counseling role. | `^/(articles|mental-health-services)/` |
| amhp.org | (pending live verification) — Association of Muslim Health Professionals (US-East Coast) | treat as guidance once live |
| institutemuslimmentalhealth.org | Institute of Muslim Mental Health (Canada) | articles and clinical services |
| khalilcenter TIIP | TIIP case studies | khalilcenter.com/articles |

**Note (technical / medical authority):** None of these are valid citable evidence for a medical diagnosis or a personal treatment plan. Their role is **counseling / lifestyle-guidance** that integrates spiritual advice with allopathic clinical practice. The answer prompt must still include the standard medical-disclaimer clause and must not present psychological support as a substitute for medical care.

### 4.6 Counseling / family / parenting

| Domain | Notes |
|---|---|
| khalilcenter.com | Clinical + faith-integrated counselling, premarital coaching, religious consultation. Already verified, body of articles large. |
| aboutislam.net | Live scholar + counsellor sessions — already in registry |

### 4.7 Education, study, Quranic Arabic, productivity

| Domain | Role | Sample URL |
|---|---|---|
| bayyinah.tv (Bayyinah Institute — main site bayyinah.com) | Quranic Arabic + core Quran commentary articles. Articles are by **Ustadh Nouman Ali Khan** and vetted instructors. | [bayyinah.com/articles](https://bayyinah.com/articles/) |
| almaghrib.org | AlMaghrib Institute — 21 instructors, 300,000+ students, programs in `aqeedah, fiqh, tafsir, hadith, seerah, personal development, mental well-being`. Curriculum page is citable for course-level learning outcomes. | [almaghrib.org/studio](https://almaghrib.org/studio/), [almaghrib.org/associate-degree/](https://almaghrib.org/associate-degree/) |
| al-hudapk.com | Al-Huda International — Pakistan's premier female-oriented Quranic institute (Dawrah + Diploma + Dars-e-Nizami); 1994. | [alhudapk.com](https://www.alhudapk.com/) audio + Urdu articles |
| al-mawrid.org | Al-Mawrid — Foundation for Islamic Research & Education; Pakistan-based Urdu-language scholarly source | [al-mawrid.org](https://www.al-mawrid.org/) |
| newmuslimacademy.org | New Muslim Academy — resource center for shahadah after-care | [newmuslimacademy.org/blog](https://www.newmuslimacademy.org/blog/), [newmuslimacademy.org](https://www.newmuslimacademy.org/) |
| productivemuslim.com | Productive Muslim — productivity + faith. Already in registry; can expand `topics` to include `work`, `spirituality`, `health-fitness`, `parenting`, `relationships`. | `[blog, topic, <post-slug>]` paths excluding `/`, `/topics`, `/component-previews/articles-section` — already enforced |

### 4.8 Environment / civic / Muslim life (NGO guidance)

| Domain | Notes |
|---|---|
| mwlea.org / themwl.org | Muslim World League — Meccan-based international NGO. Active publications on Islamic ethics of AI, environmental stewardship, family. Use as **guidance**. |
| ifees.org | Islamic Foundation for Ecology and Environmental Sciences — UK. Site access intermittently blocked; needs healthcheck. |
| crescentrating.com | Muslim-friendly travel ratings. Use for *travel planning*, not for rulings. |

### 4.9 Travel / migration / minority life

| Domain | Notes |
|---|---|
| crescentrating.com | Industry partner of Mastercard Global Muslim Travel Index. Use as **guidance** for the tourism question lane. |
| mabda.org.my | Malaysian Islamic Centre for Muslim-majority cooperation (to verify). |
| ymo Canada (to verify) | Young Muslims of Canada, or equivalent. |

### 4.10 Halal standards — fatwa + governance bodies

| Domain | Role | Notes |
|---|---|---|
| ifanca.org (USA, since 1982) | halal certification | [ifanca.org](https://ifanca.org/) — `^/(news|resources|certification-process)/` |
| jakim.gov.my | Malaysian Department of Islamic Development — official halal certifying authority | `^/(en/)?(index|directory|akta-)` |
| esma.gov.ae (pending DNS verification) | UAE Standards + Metrology | — |
| bpjph.go.id (pending verification) | Indonesia Halal Product Assurance Body (under MUI) | — |

These are **not** citable fatwa sources. Their value to Sirathic is **technical**: confirming the halal/haram status of a product or category is a separate question from a fiqh ruling.

---

## 5. Primary Qur'an and hadith platforms (foundation)

Already covered. Refinements:

1. **quran.com** — keep Tier-A primary. URL patterns `/1-114/{ayah}` and `/quran/{surah}/ayas/{ayah}`. Many translations with explicit translator attribution. Use translation index — *Yusuf Ali, Sahih International, Pickthall, Clear Quran, Mustafa Khattab, Ali Quli Qarai*, etc.
2. **sunnah.com** — keep Tier-A primary. Always include grading metadata when available via inline citation. *grade: ṣaḥīḥ* in Bukhari by default; other collections may show Bukhari-only or Darussalam grading.
3. **muwatta.com** — primary, low utility.
4. **altafsir.com** — promote to Tier-A `primary` (alongside Sunni scholarly interpretation). When the user asks for tafsir depth this is the cleanest aggregator.

Working set: keep at most five Tier-A primaries. **quran.com**, **sunnah.com**, **muwatta.com**, **altafsir.com**, **dorar.net** as the fifth (hadith corroboration: chain visualization and grading; access is intermittently 403, gate via Firecrawl browser scraping; if persistent failure, replace with **shamela.ws** or **hadith.islam-db.com** after live check).

---

## 6. Official fatwa institutions by country / league

| Country / league | Domain | Path | Madhhab bias |
|---|---|---|---|
| Egypt | dar-alifta.org | `/en/fatwa/details/` | cross-Sunni, leans Hanafi historically |
| Saudi Arabia — Permanent Committee / Sheikh Office | alifta.net (different from iifa-aifi.org) | `/ar/fatwas/` | Salafi-leaning, Hanbali legacy |
| Saudi Arabia — OIC body | iifa-aifi.org | `/en/resolutions/` | multi-madhhab ijtihad decisions of 100+ member bodies |
| Jordan | aliftaa.jo | `/en-fatwas/` | Hanafi historically |
| Qatar | islamweb.net | `/en/fatwa/{id}/` | Salafi-leaning |
| UAE | `awqaf.gov.ae / ifta` (pending verification) | unknown | Maaliki-leaning historically |
| Kuwait | `e.gov.kw` fatwa portal (pending verification) | unknown | cross |
| Bahrain | `islam.gov.bh/fatwa` (pending verification) | unknown | cross |
| Malaysia (Federal Territories) | muftiwp.gov.my | `/en/artikel/...` | Shafi'i-lead |
| Malaysia (national) | muftiwp → Federal Mufti's Office | — | cross |
| Indonesia | MUI (mui.kz; fatwa pages by komisi fatwa) | `/id/...` | cross |
| South Africa | SANAF (Council of Muslim Theologians) | to verify | cross |
| Pakistan | Various darul uloom | to verify | Hanafi |
| Bangladesh | Bangladesh Mufti Office | to verify | Hanafi |
| Morocco | Higher Council of Ulema (Conseil Supérieur des Oulémas) | to verify | Maliki |
| Turkey | Presidency of Religious Affairs (Diyanet) | diyanet.gov.tr | Hanafi (TR) |
| Iran / Shia marja network | sistani.org; khamenei.ir (pending verification); al-khoei.org | — | Ja'fari |
| Iraq / Marja network | sistani.org; al-khoei.org | — | Ja'fari |

The table is **aspirational** for many entries. The principle is: cover at least one official fatwa body per major madhhab *and* per major diaspora region. Currently the registry has Sunnis (Egypt, Jordan, Qatar, Malaysia, Hanafi cluster) but **lacks** Saudi (alifta.net), UAE, Kuwait, Bahrain, Turkey, Morocco, Indonesia, Pakistan, Bangladesh, South Africa, and a Shia cluster that extends beyond `al-islam.org` and `sistani.org` to `al-khoei.org` and `khamenei.ir` (the most-marja-cited cluster).

---

## 7. Multi-madhhab scholarly archives and named-scholar answer archives

**Current**: islamqa (Munajjid Hanbali-leaning), islamqa.org (multi-madhhab split), seekersguidance.org (multi-madhhab, identified scholars), amjaonline.org (US resident fatwa committee, multi-madhhab).

**To add**: a Hanafi-only and a Maliki-only authoritative answer archive. Candidates: **darul-ifta.org** (Mufti Faraz Adam's Hanafi-only site, but operates from South Africa), **darulmufti.co.uk**, **daruliftaa.org.uk** (Hanbali-leaning UK). These must be live-verified before commit.

For Shia: **Imam Reza Network** if reachable, **Maarif Quran and Hadith** or sister-site if reachable; also the **Office of the Supreme Leader in Arabic/English** (`khamenei.ir` — pending verification, with `tree/index` returning transport errors today) provides official position on medical, environmental and economic issues at the level of "rulings for Iranian Shia".

---

## 8. Shia sources — distinct lane of authority

Sirathic must label Shia fatwa sources clearly as **madhdhab: shia** in registry metadata. The user must never confuse a Sistani ruling with a Sunni fatwa on the same fiqh point. The same answer must differentiate them, e.g. *"Sistani is of the view that ... whereas the Hanafi school holds that ..."*.

Recommended additions:

| Domain | Path | Notes |
|---|---|---|
| sistani.org | `/english/qa/{topic_id}/` and `/english/qa/{id}/` | Already in registry; refine to ensure path slug patterns stay accurate. Currently `qa/{5-digit-id}/`. The Sistani site also has a `/english/book/40/2175/` pattern, but `/english/qa/{code}/` is the topic catalog and the items within are citable fatwas. |
| alkhoei.org | `/ar/questions` (Arabic), `/en/...` patterns pending verify | Imam al-Khoei Foundation, Ja'fari |
| al-islam.org | multiple paths, ar/en/ur/fi | Verify article-paths are stable; CDN currently 403s the homepage |
| khamenei.ir | `tree/index` etc — pending verify | Office of the Supreme Leader — Ayatollah Khamenei position on mosque safety, women, family, war |

The registry already lists `imam-us.org` and `al-islam.org` with `citable: true` and `madhhab: shia`; both should be kept but path patterns should be re-verified before commit.

---

## 9. Muslim specialist NGOs (counseling, mental health, education, medical, finance, travel, environment, halal standards)

Sirathic's answer model already disclaims that medical or legal questions aren't fatwas. These NGOs provide **named, qualified** expertise that can support context-rich answers with human-impact discipline.

### 9.1 Mental health / counseling

- **Khalil Center** ([khalilcenter.com](https://khalilcenter.com/)) — already verified. **TIIP** (Traditional Islamically Integrated Psychotherapy) is their published modality. Premier source for Islamic psychotherapy with scholarly review.
- **AMHP — Association of Muslim Health Professionals** — if live, add as `guidance`.
- **Bayyinah / Khalil Center referrals** may also be picked up as `discovery-only` (already covered by Khalil Center).
- **Institute of Muslim Mental Health** ([instituteofmuslimmentalhealth.org](https://www.instituteofmuslimmentalhealth.org/)) — Toronto, clinical training.
- **Canadian Muslim Mental Health Network** (to verify URL).
- **Sapin Center** — to verify.
- **Naseeha Muslim Helpline** — Canada; could be a `guidance`-only source for emotional support when institution confirms.

### 9.2 Medical and public health

- **IMANA** — Islamic Medical Association of North America. Verified live with articles on UV safety, men's health, blood donation, mental health awareness.
- **BIMA — British Islamic Medical Association** — to verify URL.
- **AKUH (Aga Khan University Hospital) Ethics committee / publications** — to verify.
- **King Faisal Specialist Hospital Riyadh fatwa inquiries** — selectively useful for Saudi-context health questions; to verify whether they publish as articles or only handle in-house queries.

### 9.3 Education

- **Bayyinah Institute / bayyinah.tv** — Ustadh Nouman Ali Khan; Arabic / tafsir
- **AlMaghrib Institute** — sem institute; `^/(associate-degree|studio|instructor)/`
- **Ribaat Institute** under AlMaghrib (a women's specialized sister track — verify URL not / Ribaat education material)
- **Al-Huda International** (al-hudapk.com) — Urdu women's Quranic institute
- **Al-Mawrid** (al-mawrid.org) — Urdu-language
- **IIUM** (iium.edu.my) — Malaysian premier Islamic university
- **Mishkah University** — to verify
- **International Islamic University Islamabad (IIUI)** — to verify
- **IOU (International Open University)** — to verify
- **New Muslim Academy** (newmuslimacademy.org) — verified, converts/dawah

### 9.4 Islamic Finance — Halal standards and certification

- **AAOIFI** — aaoifi.com (Bahrain, AAOIFI standards)
- **ISRA** — Islam.ic Research Institute (Malaysia; isra.org.my — DNS intermittent)
- **IIFM** — iifm.net
- **IRTI** (IsDB Group) — irti.idb.org
- **KFH (Kuwait Finance House)** — to verify public-facing articles library
- **GIFA (General Iftaa and Islamic Research)**
- **Dar al-Maal al-Islami Trust / IDB** — to verify

These are **not** citable as fatwa for Sirathic; they are technical / governance sources for finance and halal industry questions. Their role is **technical authority** for questions like "what does AAOIFI standard say about X" not "what is the ruling".

### 9.5 Travel and minority life

- **CrescentRating** (crescentrating.com) — verified live; **industry ratings + Mastercard GMTI**. Use as **guidance** for travel (not rulings).
- **Muslim Council of Elders** (muslimcouncilofelders.com; pending live verification — different session returned a transport error)
- **MABDA** (Malaysia-based minority fiqh center, to verify)
- **NNA World Muslim Council** (to verify)

### 9.6 Environment and civic life

- **MWL** (themwl.org; Islam World's League)
- **IFEES** — Islamic Foundation for Ecology and Environmental Sciences (UK)
- **Maqasid Institute Global** — to verify
- **NCEAS — National Council of the Environment & Sustainability** (Muslim chaplains) — to verify

---

## 10. Discovery-only and rejected sources

**Rejected as non-citable (Discovery-only tier)**:

- qaradawi.net — Thai-language betting site, no relation to Yusuf al-Qaradawi. **Do not adopt**.
- ribaat.org — generic WordPress SEO blog (locksmith, brain-injury, etc.), NOT the AlMaghrib women's institute. **Do not adopt.**
- qaradawi.tv / qaradawi.info — verify if the real Yusuf al-Qaradawi materials are reachable before commit; honor hiseminence's age and the diaspora of his fatwas (currently hosted on islamonline.com legacy).
- shiachat.com — already discovery-only.
- reddit.com / quora.com / facebook.com / youtube.com / instagram.com — already discovery-only.
- islamhouse.com — multilingual leaflet aggregator; broad but shallow; treat as **discovery only**. Cite individual articles only when they cite a named scholar; otherwise default to discovery.
- dorar.net — a verifier-class hadith search tool; intermittently blocked (403) from automated fetchers. Verify before trust upgrade. Treat as primary hadith corroboration once accessible.

**Anonymous blogs, AI content farms, SEO pages, homepages, search results, tag pages, category indexes** — `RegExp-/(\\bsearch\\b|\\bpage\\b|\\btag\\b|\\?utm_|\\&utm_|\\bsort=|\\bfilter=)/` should be classified **non-citable** at the prompt level via path-prefix and query-string exclusions. Concretely: the answer model must be told that generic landing pages do not establish a position.

---

## 11. Separation of religious ruling authority from technical authority

In the field of "worldly life," many questions require **both** lanes of evidence:

- **Halal status of an ingredient** needs (a) a halal certification body (technical authority) and (b) a fiqh ruling body (religious authority) — different bodies, different evidence objects.
- **Stock-trading or cryptocurrency investing** needs (a) financial-market regulatory fact, (b) fiqh ruling from AMJA / Mufti WP / Dar al-Ifta on the activity, (c) the user's confession through AAOIFI compliance standards if institution is involved.
- **Medical treatment during Ramadan** needs (a) Islamic ruling on fasting health exemptions, (b) clinical medical guidance on whether fasting is safe. The fatwa gives the ruling; the medical source gives the assessment.
- **Marriage to a Christian or Jew** needs (a) Surah al-Baqarah 221 and hadith on Ahl al-Kitab, (b) the user's madhhab's classical ruling (four Sunni differences + Shia position), (c) the country's personal-status law (Lebanon, Syria, Egypt, Pakistan — each differ).
- **AI-generated imagery (drawing, music, music compositions)** needs (a) fiqh on art and depictions (long, varied), (b) the **input** of the AI usage; position varies by century and school.
- **Health insurance** — needs (a) Islamic ruling on commercial cooperation (`cooperative insurance/tafall`), (b) the policy's actual claim mechanics.

The Sirathic prompt and citation model should be configured to:

- tag each citation with the **source role** (`fatwa / guidance / counseling / primary / discovery`).
- tag each citation with the **domain** + **madhhab**.
- when both lanes are required, the answer should cite at least one from each lane, and **state the demarcation** explicitly.
- never allow a fatwa source to establish a medical diagnosis, and never allow a clinical source to establish a haram ruling on a medical act.

---

## 12. Multi-school, regional, language gaps

| Gap | Why it matters |
|---|---|
| **Saudi Arabia — alifta.net** (Permanent Committee) | The historical Saudi fatwa institution; not yet in registry. Their rulings on riba, insurance, fasting-exceptions etc. are heavily cited by Salafi diaspora. |
| **UAE / Bahrain / Kuwait — official bodies** | Gulf diaspora questions on insurance, mortgage, employment contracts reference these institutions. |
| **Morocco — Conseil supérieur des Oulémas** | Maliki majority country's official body — necessary for Maghrebi diaspora questions. |
| **Turkey — Diyanet** | Diyanet publishes translation of Qur'an and modern fatwas; widely cited; Hanafi bias but covers ijtihad contemp. |
| **Indonesia — MUI Fatwa Commission** | World's largest Muslim population's official body; Indonesian-language fatawa council. |
| **Pakistan — Darul Uloom Deoband, Darul Ifta** | Hanafi diyar; large diaspora. |
| **Bangladesh — Office of the Grand Mufti** | Hanafi diyar; Persian / Bengali Muslim diaspora. |
| **South Africa — SANAF** | English-Africa; minority fiqh and contemporary issues. |
| **Shia marja network beyond Sistani / Khui / Imam-us** | Iranian Twelver diaspora references khamenei.ir; others (Saanei, Sistaninejad, etc.) are rarely cited but the registry should still classify them. |
| **Arabic-language fatawa from officially-named scholars** outside of Egypt/Jordan (e.g. Al-Mutairi's library; Al-Lahim's library) | Sister fatwa libraries from the Salafi-leaning cluster. |
| **Spanish / French / Turkish / Urdu / Malay / Persian-language Tier-A/B fatwas** | To serve the Arabic-first promise, top fatwa sources in the diaspora's languages need to be in registry. Currently the registry is heavy on English; Dar al-Ifta Egypt has six languages; IIFA works in Arabic, English, French. |

---

## 13. Trust policy recommendations

Codify the registry's behaviour with these rules:

1. **Three-lane separation**
   - **Tier A — primary**: Qur'an, hadith, tafsir. Immutable. Default citable on any relevant topic.
   - **Tier B — fatwa / guidance / counseling / research**: citable with role-label exposed in the citation.
   - **Tier C — discovery**: never citable; leads only.
2. **Madhhab + language + region must be set** on every Tier-B entry.
3. **Topics** (from `SourceTopic`) must list which worldly-life domains the entry is competent for.
4. **Path rules** must whitelist the citable sections only (`/fatwa/{id}/`, `/qa/{id}/`, `/articles/{slug}/`, `/knowledge-base/{slug}/`, `/read/{type}/{slug}/`). Homepages, search pages, category indexes, tag pages, `?page=` and `?sort=` URLs are excluded by default.
5. **Non-citable by topic**: a fatwa source cannot be cited as a medical or halal-certification authority unless the institution explicitly addresses that topic and the prompt can detect topic compliance.
6. **Stale disclaimer renewal**: every entry has `verifiedAt = 2026-07-15`. Re-verify on the 3-month cadence. Domains that block automated fetch for two consecutive cycles degrade to `discovery`.
7. **Anonymous blogs / SEO pages / category indexes**: never citable; default path-prefix check at prompt level excludes them.

---

## 14. Phased onboarding plan

**Phase 1 (immediate — fill the high-confidence gaps found in this research)**

1. Add `altafsir.com` as Tier-A primary (alongside quran.com, sunnah.com, muwatta.com).
2. Add `amjaonline.org` with `fatwa` role, path patterns `/fatwa/en/{id}`, `/fatwa/ar/{id}`.
3. Add `alkhoei.org` as Shia fatwa, path `/ar/questions` and `English` path when stable.
4. Add `imana.org` with `guidance` role, paths `/`, `/category/awareness/`, `/mental-health/`.
5. Add `khalilcenter.com` with `counseling` role (already verified live).
6. Add `bayyinah.com` (`^/(articles|events|resources)/`) and `almaghrib.org` (`^/(associate-degree|studio|instructor)/`) as `guidance` for learning.
7. Add `ifanca.org` as `guidance` (technical halal certs) — not as fatwa.
8. Add `crescentrating.com` as `guidance` (Muslim-friendly travel).
9. Add `islamic-relief.org` `^/knowledge-base/` as `guidance` (zakat, sadaqah, charity, riba FAQ).

**Phase 2 (policy-led)**

1. Add `aaoifi.com` (standards pages) as `guidance` for finance.
2. Add `muftiwp.gov.my` extended with `/en/artikel/irsyad-fatwa/` paths.
3. Add `iifa-aifi.org` (Arabic decisions list `/ar/{cat}/{post-id}`).

**Phase 3 (regional gap)** — *dependent on live URL verification*

1. Saudi Arabia Permanent Committee (`alifta.net`, paths to verify)
2. Diyanet (Turkey, paths to verify)
3. MUI Fatwa Commission (Indonesia, to verify)
4. Conseil supérieur des Oulémas (Morocco, to verify)

**Phase 4 (specialty deepens)**

1. AAOIFI standards
2. ISRA / IRTI / IIFM
3. AMHP / Institute of Muslim Mental Health / Sapin (after live verify)
4. Muslim World League environmental, AI ethics, family publications
5. Mental health, hygiene, cosmetics when a clear authoritative body surfaces.

---

## 15. Highest-priority missing sources to add first

These are the **single-most-important** candidates to feed into the registry pipeline next. Each fixes a gap in the matrix above.

1. **AAOIFI (aaoifi.com)** — gives the answer model a global, authoritative standard body for Islamic finance, riba, governance.
2. **Alifta (Saudi Permanent Committee, alifta.net)** — completes the Gulf Sunni fatwa coverage; needed for any Saudi-context fatwa.
3. **AMJA resident fatwa committee (`amjaonline.org`)** — US-anchored multi-madhhab resident fatwa committee; path-verified; complements IslamQA on disputed US Muslim-minority issues.
4. **Diyanet (diyanet.gov.tr)** — Turkey; modern Hanafi-leaning global reach, especially Turkish/Migrant communities.
5. **IIFA / iifa-aifi.org** — OIC body ijtihad decisions; needed because they're the only multi-madhhab global Islamic fiqh body.
6. **Khalil Center (`khalilcenter.com`)** — already verified. The single most important **psychotherapy + Islam** source. Counsel role.
7. **IMANA (`imana.org`)** — already verified. Medical + wellness awareness.
8. **CrescentRating (`crescentrating.com`)** — already verified. Travel planning + Muslim-friendly dest.
9. **IFANCA (`ifanca.org`)** — already verified. Halal cert technical authority.
10. **Bayyinah / bayyinah.com** — already verified. Quranic Arabic & tafsir-style articles.
11. **Mufti WP expanded (`muftiwp.gov.my`)** — already verified. Broader Malaysian fatwa topics.
12. **Islamic Relief Worldwide knowledge-base (`islamic-relief.org`)** — already verified. Charity/zakat/waqf FAQ.
13. **MUI Fatwa Commission (Indonesian-language)** — the largest Muslim population. To be live-verified before adding.
14. **Al-Khoei Foundation questions (`alkhoei.org`)** — needed for Shia marja granularity beyond Sistani.
15. **AMHP + Institute of Muslim Mental Health** — needed for the mental-health / disability matrix cell; **live-verified** URLs collected from the task brief even though WebFetch couldn't return content directly.
16. **Muslim Council of Elders (`muslimcouncilofelders.com`)** — covers minority-fiqh and global scope; live verification pending.
17. **IFEES (ifees.org) / Islamic Foundation for Ecology** — environmental/civic cell.
18. **Dorar (dorar.net)** — hadith corroboration / chain viewer; intermittent 403 from automated fetchers; gate behind Firecrawl browser scraping and degrade to discovery only if persistent.

Re-verification date cutoff for this report: **2026-07-15**. Re-run the allowlist audit every 90 days; any entry that fails three consecutive re-verifications goes from citable to discovery-only.

---

## 16. How to read "institution declares a religious ruling but not a medical diagnosis"

A few illustrative worked examples:

- **"What does Islam say about taking a loan from a non-Islamic bank to buy a home?"**
  - Cite IslamQA Munajjid **fatwa** (Hanbali-leaning) and Dar al-Ifta **fatwa** for madhhab cross-reference.
  - For mortgage specifics (interest / AHL structure), cite AAOIFI standard text as **guidance**.
  - The user-facing answer attributes to: *"Hanbali-leaning IslamQA says …; the Malaysian Mufti says …; if you are looking for an Islamic finance structure that does not involve riba, see AAOIFI Standard No. X for the Shari'ah governance requirement on that."*

- **"Should I fast if I take metformin for type 2 diabetes?"**
  - Cite from aliftaa.jo / Dar al-Ifta or Mufti WP on the **fiqh** exemption for chronic disease with treatment.
  - Cite from SeekersGuidance topic "Health" for a multi-madhhab framing.
  - **Do not cite IMANA / Khalil Center as a medical authority for a personal medication decision** — they are not a clinician for this user.
  - The user-facing answer: *"Per the Malaysian Mufti, those whose fasting causes clear medical harm may break the fast and make it up later. Speak with your prescribing clinician about the timing of your dose — your diabetes management plan matters more than the day count. Sirathic is not a medical advisor."*

- **"Is an AI-generated image of a person halal?"**
  - Cite from Sistani fatwas, aliftaa.jo, Mufti WP, dorar.net (the hadith of image-makers being told to breathe a soul), and Yaqeen Institute's AI paper.
  - **Do not** cite from a clinical or counseling source.

---

## Appendix A — Sources cited in the matrix, with clickable representative URLs

### Qur'an and tafsir
- [quran.com](https://quran.com/)
- [sunnah.com](https://sunnah.com/)
- [muwatta.com](https://muwatta.com/)
- [altafsir.com (Royal Aal al-Bayt Institute for Islamic Thought, Amman)](https://www.altafsir.com/)

### Egyptian / Arab Sunni fatwa institutions
- [dar-alifta.org](https://www.dar-alifta.org/en) — `^/en/fatwa/details/`
- [aliftaa.jo](https://www.aliftaa.jo/default-en) — `^/en-fatwas/`
- [islamweb.net](https://www.islamweb.net/en/) — `^/en/fatwa/\d+/`

### Saudi / GCC / OIC fatwa
- [iifa-aifi.org](https://iifa-aifi.org/en/) — `^/en/...` decisions
- [muftiwp.gov.my](https://www.muftiwp.gov.my/en) — `^/en/artikel/...`

### North America fatwa / counseling
- [amjaonline.org](https://www.amjaonline.org/) — `^/fatwa/(en|ar)/\d+/`
- [islamqa.info](https://www.islamqa.info/en/) — `^/[a-z]{2}(?:-[a-z]{2})?/answers/\d+(/|$)`
- [islamqa.org](https://www.islamqa.org/) — multi-madhhab mirrors
- [seekersguidance.org](https://seekersguidance.org/answers/) — `^/answers/[^/]+/[^/]+(/|$)`
- [aboutislam.net](https://aboutislam.net/counseling/ask-the-scholar/) — `^/counseling/ask-the-(scholar|counselor)/`
- [productivemuslim.com](https://productivemuslim.com/) — `^/(blog|topic|...)/` excluding `/, /topics, /component-previews/articles-section`

### Shia sources
- [sistani.org](https://www.sistani.org/english/) — `^/english/qa/`
- [al-islam.org](https://www.al-islam.org/) — `^/(articles|qa|...)/`
- [alkhoei.org](https://www.alkhoei.org/) — `^/ar/questions` (and EN equivalents)

### Research institutes and counseling
- [yaqeeninstitute.org](https://yaqeeninstitute.org/) — `^/(read|curriculum|what-islam-says-about)/`
- [rahmahinstitute.com](https://www.rahmahinstitute.com/)
- [ihsaninstitute.co.uk](https://www.ihsaninstitute.co.uk/) (pending live verify)
- [khalilcenter.com](https://khalilcenter.com/articles)
- [imana.org](https://www.imana.org/) — `^/(category/awareness|mental-health)/`
- [islamic-relief.org](https://islamic-relief.org/knowledge-base/)

### Education
- [bayyinah.com](https://bayyinah.com/articles/)
- [almaghrib.org](https://almaghrib.org/studio)
- [newmuslimacademy.org](https://www.newmuslimacademy.org/)
- [al-hudapk.com](https://www.alhudapk.com/)
- [al-mawrid.org](https://www.al-mawrid.org/)
- [iium.edu.my](https://www.iium.edu.my/v2/)

### Halal / industry / standards
- [ifanca.org](https://ifanca.org/)
- [aaoifi.com](https://aaoifi.com/) (next phase)
- [jakim.gov.my](https://www.jakim.gov.my/) (next phase)
- [bpjph.go.id](https://bpjph.go.id/) (next phase)
- [crescentrating.com](https://www.crescentrating.com/)

### Quranic/Arabic hadith tools
- [dorar.net](https://www.dorar.net/) (hadith corroboration; intermittently blocked)
- [shamela.ws](https://shamela.ws/) (next phase)
- [hadith.islam-db.com](https://hadith.islam-db.com/) (next phase)

---

## Appendix B — Path patterns Sirathic needs to recognize

```
dar-alifta.org          /en/fatwa/details/{id}
amjaonline.org          /fatwa/en/{id}  OR /fatwa/ar/{id}
islamqa.info            /{lang}/answers/{id}
islamqa.org             /{madhab}/.../{id}
islamweb.net            /en/fatwa/{id}
aliftaa.jo              /en-fatwas/{id}...
muftiwp.gov.my          /en/artikel/{path}
seekersguidance.org     /answers/{topic}/{slug}
aboutislam.net          /counseling/ask-the-scholar/{id}
                        /counseling/ask-the-counselor/{id}
productivemuslim.com    /blog  OR  /{post-slug}  (excluding homepages)
yaqeeninstitute.org     /read/{type}/{slug}  OR  /curriculum/{slug}
sistani.org             /english/qa/{topic}/  OR /english/qa/{qid}/{slug}
alkhoei.org             /ar/questions  OR /ar/questions/{id}...
al-islam.org            (after re-verify) /articles/{id}/{slug}
khalilcenter.com        /articles/{slug}  OR  /mental-health-services/...
islamic-relief.org      /knowledge-base/{slug}  OR  /{topic}/{slug}
ifanca.org              /resources/{slug}  OR /certification-process/
al-mawrid.org           (verify)
iifa-aifi.org           /ar/{decision-id}  OR /en/{path}
altafsir.com            /Al-Jalalayn.asp  OR /Tafasir.asp?...  OR /Books/{name}.pdf
```

Each entry has been verified against the live site on 2026-07-15 (or flagged "pending verify" where the live fetch failed during research).

---

## Closing

This landscape was assembled by reading CONTEXT.md, PLAN.md, `sourceRegistry.ts`, `types.ts`, and `PROMPT-RESEARCH.md`; systematically probing each candidate domain via WebFetch; recording representative deep URLs; and ranking by gap-filling impact. The companion artefact `docs/islamic-source-candidates.json` carries every candidate record at the schema level. No production TypeScript or registry entry has been changed by this work. Phased onboarding — Phase 1 first — is the recommended next move, gated on a final live-fetch re-verify within 48 hours of registry commit.
