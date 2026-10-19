# Die Strategie im Detail

Zerlegung der Small-Cap-Momentum-Strategie in ihre Bestandteile, mit der
jeweiligen Umsetzung im Code und einer ehrlichen Einordnung, was daran
übertragbar ist und was nicht.

**Quellenlage:** YouTube ist im Build-Container selbst gesperrt (verifiziert:
`403` über Proxy *und* direkt), lässt sich aber über den Higgsfield-MCP-Server
analysieren, der die URL auf eigener Infrastruktur abruft. Zwei Analysen
wurden tatsächlich durchgeführt — eine Trade-Recap (vollständig, siehe
Abschnitt 1a) und ein 2015er-Strategie-Webinar (fehlgeschlagen: zu lang für
eine verlässliche Szenenanalyse; Higgsfields eigene Tool-Beschreibung warnt
genau davor). Die quantitativen Parameter in `config/strategy.yaml` stammen
weiterhin aus der öffentlich dokumentierten Fassung der Strategie, nicht aus
den Videos — dafür bräuchte es kurze, setup-fokussierte Clips statt Recaps
oder langer Webinare. `scripts/fetch_transcripts.py` bleibt der zweite,
unabhängige Weg (Untertitel statt Szenenanalyse), sobald `youtube.com` in der
Umgebung freigegeben ist.

### 1a. Was sich tatsächlich verifizieren ließ

Eine Szenenanalyse von [„Frustrating Red Day -$2,900 on \$EVH"](https://www.youtube.com/watch?v=zgJizLa4zqI)
(Trade-Recap, nicht Strategie-Erklärung) bestätigt gelebte Praxis, liefert
aber keine neuen Zahlenwerte für die Konfiguration:

> „The first place where I took a trade was right here on this **false
> breakout**. I jumped in it for **the break of 20**. I was in at 15 and 20
> and then **stopped out at 97, so lost 1200 bucks**. The next entry I jumped
> in trying to **scalp the break over \$8**... then it rips up to 58."

Drei Dinge daran sind bemerkenswert:

1. **Ausbruch über runde Marken, mehrere Teileinstiege.** Deckt sich mit
   `flat_top_breakout` / `micro_pullback` — kein neuer Parameter, aber eine
   Bestätigung der Grundannahme.
2. **Echte Verluste durch Fehlausbrüche.** 1.200 $ Verlust auf einen einzigen
   False Breakout — exakt das Szenario, vor dem `risk.py`s
   Tagesverlustgrenze schützen soll.
3. **Der Opener ist eine Verlustserie, nicht ein Erfolgsmoment:** „Thursday
   flat... Friday no trades... Monday no trades... Tuesday red 400... today
   red 2900." Das ist eine unabhängige, reale Bestätigung von Abschnitt 4,
   Punkt 3 (Sequenz-Verteilung) — Verlustserien sind der Normalfall, keine
   Ausnahme, auch beim Strategie-Urheber selbst.

---

## 1. Der Trichter

Die Strategie ist kein Chartmuster. Sie ist ein Trichter mit vier Stufen, und
die Reihenfolge ist entscheidend. Das Muster ist die *letzte* Stufe, nicht die
erste — das ist der Teil, den die meisten Selbstlernenden umdrehen.

```
  ~8.000 US-Aktien
        │
        ▼  Stufe 1: Universum       →  mds/universe.py
  Preis 1,50–20 $ · Gap ≥ 10 % · Float ≤ 20 Mio. · RVOL ≥ 5× · Katalysator
        │
        ▼  ~2–5 Symbole pro Tag
        │
        ▼  Stufe 2: Struktur        →  mds/patterns.py (_trending_up)
  Kurs über VWAP · Kurs über 9 EMA · Zeitfenster 09:30–11:30 ET
        │
        ▼  Stufe 3: Setup           →  mds/patterns.py
  Micro Pullback · Bull Flag · Flat Top · Opening Range · VWAP Reclaim
        │
        ▼  Stufe 4: Ausführbarkeit  →  mds/risk.py, mds/execution.py
  Stop eng genug für 2:1 · Kosten < 15 % des Risikos · Tageslimits offen
        │
        ▼  Trade
```

### Stufe 1 — Warum genau diese Filter

| Filter | Wert | Wozu |
|---|---|---|
| Preis | 1,50–20 $ | Darunter: Spreads und Delisting-Risiko. Darüber: prozentuale Bewegungen zu klein für Cent-Stops. |
| Float | ≤ 20 Mio., ideal ≤ 10 Mio. | Wenige frei handelbare Aktien → Nachfrage trifft auf dünnes Angebot → Bewegung. Der Float ist **keine Richtungsprognose, sondern eine Spannweiten-Prognose.** |
| Gap | ≥ 10 % | Belegt Ungleichgewicht über Nacht. |
| RVOL | ≥ 5× | Der wichtigste Einzelfilter: heute passiert etwas, was sonst nicht passiert. |
| Katalysator | erforderlich | Ohne Nachricht ist das Volumen oft ein einmaliger Block, keine Beteiligung. |

Das RVOL im Code ist **tageszeit-bewusst** (`indicators.relative_volume`): Es
vergleicht das kumulierte Volumen um 09:35 mit dem durchschnittlichen
kumulierten Volumen *um 09:35* der letzten 50 Tage. Ein Vergleich gegen ein
Tagesmittel wäre bedeutungslos.

`universe.scan()` gibt maximal 4 Symbole zurück, sortiert nach Score
(35 % Float, 35 % RVOL, 20 % Gap, 10 % Katalysator). Fokus schlägt Breite — man
kann nicht acht schnelle Aktien gleichzeitig lesen.

---

## 2. Die Setups

Alle fünf sind Long-Setups in einem intakten Aufwärtstrend. Keines ist ein
Umkehr-Trade.

### 2.1 Micro Pullback — das Kernstück

Eine Pause von 1–3 Bars mitten in einer starken Bewegung, die kaum etwas
zurückgibt.

- **Einstieg:** Buy-Stop einen Cent über dem Hoch der Pause
- **Stop:** unter dem Tief der Pause, minus ATR-Puffer
- **Bedingungen:** Kurs über VWAP und 9 EMA · Retracement ≤ 50 % des
  vorangegangenen Impulses · **Pause leiser als der Impuls**

Der letzte Punkt ist die eigentliche Definition: Handelt der Rücksetzer *mehr*
Volumen als das Bein, das ihn erzeugt hat, ist das Distribution, keine Pause.

> **Beim Bau gefunden:** Zuerst hatte ich die Volumenbestätigung auf den
> *Signal-Bar* gelegt und 1,5× Durchschnittsvolumen verlangt. Damit feuerte das
> Setup **null** Mal — logisch, denn eine Pause hat per Definition *fallendes*
> Volumen. Die Bestätigung gehört auf den **Ausbruchs-Bar**. Festgeschrieben in
> `patterns.volume_confirms_breakout`.

### 2.2 Bull Flag

Impulsbein (≥ 3 %), dann geordnete Konsolidierung über 2–6 Bars bei
**fallendem** Volumen. Einstieg über dem Hoch der Flagge, Stop unter ihrem Tief.
Handelt die Flagge mehr als die Stange, ist es keine Flagge.

### 2.3 Flat Top Breakout

Mehrfache Zurückweisung auf einem Preis — ein Regal ruhenden Angebots. Der Trade
ist der Moment, in dem dieses Angebot absorbiert wird.

> **Beim Bau gefunden:** Das Widerstandsfenster enthielt ursprünglich den
> aktuellen Bar. Damit gilt `level ≥ high[i] ≥ close[i]` immer — die Prüfung
> „Kurs ist schon ausgebrochen" war **toter Code** und konnte nie auslösen. Das
> Fenster umfasst jetzt nur *vorherige* Bars. Test:
> `test_flat_top_needs_price_coiled_under_the_level_not_through_it`.

### 2.4 Opening Range Breakout

Bruch der Spanne der ersten 5 Minuten. Feuert bewusst **einmal** pro Session.

Im Demo-Lauf ist das mit Abstand das schwächste Setup (−0,59R). Vorsicht bei der
Interpretation: Das ist synthetische Datenlage, kein Marktbefund. Es war
allerdings genau die Kennzahl, die einen Simulationsfehler aufdeckte — siehe
Abschnitt 5.

### 2.5 VWAP Reclaim

Der Kurs verliert VWAP und holt ihn zurück. Zweite-Chance-Einstieg: Der
gescheiterte Ausbruch nach unten fängt die Shorts, die den VWAP-Verlust
verkauft haben.

---

## 3. Risiko — der Teil, der tatsächlich entscheidet

### 3.1 Größe folgt aus dem Stop

Nie umgekehrt. `risk.size_position()`:

```
Stückzahl = min( Risikobudget / (Einstieg − Stop),
                 Eigenkapital-Obergrenze,
                 2 % des Bar-Volumens )        ← man ist nicht der Markt
```

Ein enger Stop *verdient* Größe. Ein weiter Stop verliert sie. Der Trader wählt
nie eine Stückzahl.

### 3.2 Die Grenzen, die die Maschine durchsetzt

| Regel | Standard | Warum maschinell |
|---|---|---|
| Risiko pro Trade | 1 % / max. 500 $ | — |
| **Tagesverlustgrenze** | 1.000 $ | Willenskraft ist im schlechtesten Moment am schwächsten |
| Gewinn-Rückgabe | 30 % vom Tageshoch | Ein grüner Tag, der rot endet, ist ein Disziplinproblem |
| Größe nach Verlust | halbieren, kumulativ | Verhindert das Zurückholen-Wollen |
| Max. Verluste in Folge | 3 | Serien sind meist Marktregime, nicht Pech |
| Max. Trades/Tag | 6 | — |
| Kein Einstieg nach | 11:30 ET | Die Bewegung ist vorbei |

### 3.3 Die Mathematik, die man vorher kennen sollte

Break-even-Trefferquote = `(1 + Kosten in R) / (1 + CRV)`

| CRV | Kosten 0,00R | 0,05R | 0,10R | 0,20R |
|---|---|---|---|---|
| 1,5:1 | 40,0 % | 42,0 % | 44,0 % | 48,0 % |
| **2:1** | **33,3 %** | 35,0 % | **36,7 %** | 40,0 % |
| 3:1 | 25,0 % | 26,2 % | 27,5 % | 30,0 % |

Bei 2:1 müssen ein Drittel der Trades gewinnen, nur um nicht zu verlieren. Jeder
Cent Slippage hebt diese Schwelle.

---

## 4. Was sich nicht kopieren lässt

Die Muster sind real, öffentlich und sauber definierbar — dieses Repository ist
der Beweis. Übertragbar ist trotzdem nur ein Teil.

**1. Die Ausführungsinfrastruktur.** Siehe README: Bei Retail-Kosten feuert das
Kern-Setup null Mal. Der Micro Pullback lebt oder stirbt an Sub-Cent-
Kommissionen und Sub-Sekunden-Fills.

**2. Die Kapitalbasis.** 1 % Risiko auf 30.000 $ sind 300 $ pro Trade. Bei
5 Cent Stop sind das 6.000 Aktien — mehr, als viele dieser Bücher aufnehmen. Der
Liquiditätsdeckel im Code (2 % des Bar-Volumens) macht sichtbar, dass die
Strategie **nicht beliebig skaliert**.

**3. Die Sequenz-Verteilung.** Eine einzelne Equity-Kurve ist kein Beleg.
`mds/metrics.py::monte_carlo` würfelt dieselben Trades neu und zeigt die
Bandbreite an Verläufen, die *derselbe* Edge erzeugen kann. Ein beeindruckender
Verlauf kann Reihenfolgeglück sein.

**4. Die Anreizstruktur.** Wer Ausbildung verkauft, hat eine Einnahmequelle, die
unabhängig vom Handelsergebnis ist. Genau das war Gegenstand der
FTC-Beanstandung 2022. Das entwertet die Muster nicht — aber es erklärt, warum
gezeigte Ergebnisse nicht die Basisrate sind.

---

## 5. Fehler, die beim Bau gefunden wurden

Dokumentiert, weil sie zeigen, wie leicht ein Backtest lügt.

| # | Fehler | Auswirkung | Test |
|---|---|---|---|
| 1 | Volumenbestätigung auf dem Signal-Bar statt auf dem Ausbruchs-Bar | Micro Pullback feuerte **nie** | `test_micro_pullback_fires_on_a_short_quiet_pause` |
| 2 | Signale nach engstem Stop sortiert, Aufrufer nahm nur das erste | Bevorzugte genau die Signale, die Filter später verwarfen → Bar verschenkt | `test_detect_ranks_by_configured_preference_not_tightest_stop` |
| 3 | Flat-Top-Fenster enthielt den aktuellen Bar | „Schon ausgebrochen"-Prüfung war toter Code | `test_flat_top_needs_price_coiled_under_the_level_not_through_it` |
| 4 | Fester Leg-Fahrplan im Datengenerator | Opening Range lag *jeden* Tag im selben Impuls → ORB kaufte systematisch das Hoch, MFE über **alle 17 Trades** ≤ 0,56R | — (Generator randomisiert) |
| 5 | Kein Mindest-Stop-Abstand | 5.060 Aktien, 170 $ Kosten, 1 $ Gewinn | `test_stops_that_are_too_tight_are_refused` |
| 6 | `Stats` mit 15 statt 16 Feldern konstruiert | Absturz bei leerem Handelsbuch | `test_summarize_handles_an_empty_book` |

Fehler 4 ist der lehrreichste: Er erzeugte ein perfekt konsistentes,
vollständig falsches Ergebnis. Kein Backtest hätte gewarnt — nur die Frage,
warum 0 von 17 Trades gewinnen, führte darauf.

---

## 6. Reihenfolge für den Einsatz

1. `python -m mds feasibility` — die Schwelle kennen.
2. Echte 1-Minuten-Daten für 100+ Sessions gescannter Symbole besorgen.
   **Ohne diesen Schritt sind alle Zahlen bedeutungslos.**
3. `python -m mds backtest --out out/trades.csv`
4. `python -m mds journal` — welche Setups und Uhrzeiten tragen tatsächlich?
5. `python -m mds montecarlo` — die Bandbreite, nicht die eine Kurve.
6. Kosten-Sensitivität lesen: Stirbt der Edge bei 2 Cent zusätzlicher Slippage,
   existiert er im Live-Handel nicht.
7. Erst dann, und nur mit Beträgen, deren Verlust verkraftbar ist: Papierhandel
   über mehrere Monate — mit denselben Tageslimits.
