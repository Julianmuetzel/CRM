# Momentum Day Trading System (MDS)

Eine ausführbare, testbare Implementierung der Small-Cap-Momentum-Strategie, wie
sie von Ross Cameron / Warrior Trading (YouTube: `@DaytradeWarrior`) öffentlich
gelehrt wird.

## Was das hier ist — und was nicht

**Ist:** ein vollständiges System aus Scanner, Setup-Erkennung, Positionsgrößen-
und Risikosteuerung, realistischem Ausführungs- und Kostenmodell, Backtest-Engine,
Handelstagebuch und Monte-Carlo-Analyse. Jede Regel ist ein benannter Parameter,
jede Kernannahme ist durch einen Test abgesichert.

**Ist nicht:** ein Weg, die in Marketing-Material gezeigten Ergebnisse zu
reproduzieren. Drei Dinge, die man vorher wissen sollte:

1. Warrior Trading und Ross Cameron persönlich haben 2022 **3 Mio. USD** an die
   US-Handelsaufsicht FTC gezahlt — wegen unbelegter Gewinnversprechen und der
   Darstellung, seine Ergebnisse seien für Kunden reproduzierbar.
   ([FTC-Pressemitteilung](https://www.ftc.gov/news-events/news/press-releases/2022/04/federal-trade-commission-cracks-down-warrior-trading-misleading-consumers-false-investment-promises),
   [Fallakte](https://www.ftc.gov/legal-library/browse/cases-proceedings/2023198-warrior-trading-inc-ftc-v))
2. Die akademische Datenlage zu Daytrading ist eindeutig negativ. In der
   brasilianischen Studie von Chague & De-Losso verloren **97 %** derjenigen,
   die länger als 300 Handelstage durchhielten, Geld. Barber & Odean fanden für
   Taiwan **unter 1 %** dauerhaft profitable Daytrader.
3. Dieses Repository enthält **keine Anlageberatung**. Es ist ein Messinstrument.
   Es soll dir zeigen, was die Strategie *bei dir*, mit *deinen* Kosten, auf
   *deinen* Daten tut.

## Der wichtigste Befund aus dem Bau dieses Systems

Der **Micro Pullback** — das meistgelehrte und höchstfrequente Setup der
Strategie — hat einen Median-Stop von rund **5 Cent**. Bei einer typischen
Retail-Kostenstruktur (Kommission + ECN-Gebühr + Slippage) kostet der Round Trip
etwa **2,6 Cent pro Aktie**, also rund die Hälfte des Risikos.

Das System lehnt diese Trades dann konsequent ab. Im Demo-Lauf:

| Kostenstruktur | Trades gesamt | davon Micro Pullback |
|---|---|---|
| Retail | 57 | **0** |
| Mittelweg | 133 | 11 |
| Direct Access (Profi) | 191 | **31** — bestes Setup, 0,765R Erwartungswert |

**Das Kern-Setup der Strategie existiert bei Retail-Kosten nicht.** Es ist keine
Chartmuster-Frage, sondern eine Frage der Ausführungsinfrastruktur: Sub-Cent-
Kommissionen, Direct Market Access, Hotkeys, Sub-Sekunden-Ausführung. Wer die
Muster ohne diese Infrastruktur kopiert, handelt eine andere Strategie.

Dieser Befund ist als Test festgeschrieben:
`tests/test_engine_and_metrics.py::test_execution_quality_decides_whether_the_core_setup_exists`

## Schnellstart

```bash
python -m venv .venv && ./.venv/bin/pip install -r requirements.txt

./.venv/bin/python -m mds feasibility          # Break-even-Trefferquote
./.venv/bin/python -m mds demo --days 60       # kompletter Lauf (synthetisch!)
./.venv/bin/python -m pytest tests/ -q         # 23 Tests
```

Mit echten Daten:

```bash
./.venv/bin/python -m mds scan --snapshot data/snapshot.csv
./.venv/bin/python -m mds backtest --bars data/bars.csv --snapshot data/snapshot.csv \
    --symbol ABCD --out out/trades.csv
./.venv/bin/python -m mds journal    --trades out/trades.csv
./.venv/bin/python -m mds montecarlo --trades out/trades.csv
```

> **Warnung zu `demo`:** Die Bars sind generiert, nicht beobachtet. Der Lauf
> beweist, dass die Mechanik funktioniert — er beweist **nichts** über Rentabilität.
> Jede Kennzahl daraus ist ein Artefakt des Generators.

## Aufbau

| Modul | Aufgabe |
|---|---|
| `mds/config.py` | Jede Regel als benannter Parameter (`config/strategy.yaml`) |
| `mds/universe.py` | „Stocks in play"-Scanner: Gap, Float, RVOL, Katalysator, Preisband |
| `mds/indicators.py` | VWAP (session-verankert), EMA 9/20, ATR, intraday-korrektes RVOL |
| `mds/patterns.py` | Micro Pullback, Bull Flag, Flat Top, Opening Range, VWAP Reclaim |
| `mds/risk.py` | Positionsgröße aus dem Stop, Tagesverlustgrenze, Größenreduktion nach Verlusten |
| `mds/execution.py` | Kommissionen, Regulierungsgebühren, volatilitätsskalierte Slippage, Gap-Fills |
| `mds/engine.py` | Bar-für-Bar-Backtest, Teilverkäufe, Breakeven-Stop, EMA-Trailing |
| `mds/metrics.py` | Erwartungswert, Break-even-Trefferquote, Monte Carlo, Kosten-Sensitivität |
| `mds/journal.py` | Auswertung nach Setup, Uhrzeit, Wochentag, Exit-Grund, Stop-Qualität |

## Regeln, die die Ergebnisse ehrlich halten

Diese Entscheidungen kosten Performance im Backtest. Das ist der Punkt.

- **Kein Blick in die Zukunft.** Ein Detektor sieht nur Bars bis einschließlich
  des bewerteten. Er „kauft" nicht, sondern veröffentlicht ein *Trigger-Level*;
  gefüllt wird nur, wenn ein *späterer* Bar tatsächlich durchhandelt.
- **Gaps gehen gegen dich.** Springt ein Bar über den Trigger, wird zur
  Eröffnung gefüllt, nicht zum Wunschpreis. Für Stops gilt dasselbe.
- **Stop vor Ziel.** Enthält eine Bar-Range beides, wird der Stop als zuerst
  getroffen angenommen. Ohne Tickdaten ist das die einzig vertretbare Annahme.
- **Jede Ausführung kostet.** Kommission, ECN-Gebühr, SEC-/TAF-Gebühren und
  Slippage, die mit der ATR skaliert.
- **Eine Position gleichzeitig.** Parallele Positionen würden die Risikozahlen
  schönen.

## Kalibrierung gegen die Originalquelle

Die Parameterwerte stammen aus der öffentlich dokumentierten Fassung der
Strategie, nicht aus den Videos selbst — YouTube war in der Umgebung, in der
dieses System gebaut wurde, netzwerkseitig gesperrt. Um sie gegen das zu
justieren, was tatsächlich gesagt wird:

```bash
./.venv/bin/python scripts/fetch_transcripts.py --channel @DaytradeWarrior --limit 25
```

Das lädt nur Untertitel, kein Video. Danach werden die Werte in
`config/strategy.yaml` nachgezogen — Code muss dafür nicht angefasst werden.

## Was fehlt

Ehrlich benannt, damit niemand mehr Vertrauen hat als gerechtfertigt:

- **Kein Level-2 / kein Orderbuch.** Slippage ist modelliert, nicht simuliert.
- **Keine Handelsunterbrechungen (Halts).** Low-Float-Momentum-Namen werden
  regelmäßig ausgesetzt; ein Halt trifft genau die Position, die man hält.
- **Keine Leerverkäufe.** Nur Long-Setups.
- **Keine Steuern, keine Pattern-Day-Trader-Regel.**
- **Kein Live-Handel.** Es gibt bewusst keine Broker-Anbindung.
