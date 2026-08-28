import { Card, Stat, toneOf } from '../components/Card'
import { CumulativePnlChart, DailyPnlChart, DirectionDonut } from '../components/charts'
import {

  fmtDayLabel,
  fmtDuration,
  fmtNumber,
  fmtPrice,
  fmtSignedCurrency,
  fmtTime,
} from '../lib/format'
import type { Metrics } from '../lib/metrics'
import type { Trade } from '../types'

/**
 * 12-column bed. It divides by 4, 3 and 2, so every row width the dashboard
 * needs is expressible; at md the wider rows fold to two-up rather than
 * squeezing four cards into a tablet width.
 */
const SPAN_4_ACROSS = 'md:col-span-6 lg:col-span-3'
const SPAN_3_ACROSS = 'md:col-span-6 lg:col-span-4'
const SPAN_2_ACROSS = 'md:col-span-6'

export function Dashboard({ metrics }: { metrics: Metrics }) {
  const {
    mostActiveDay,
    mostProfitableDay,
    leastProfitableDay,
    bestTrade,
    worstTrade,
    days,
  } = metrics

  const directionData = [
    { name: 'Long' as const, value: metrics.longCount, pct: metrics.longPct },
    { name: 'Short' as const, value: metrics.shortCount, pct: metrics.shortPct },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      {/* Row 1 — headline edge metrics */}
      <Card title="Win Rate" className={SPAN_4_ACROSS}>
        <Stat
          value={metrics.totalTrades === 0 ? '—' : `${metrics.winRate.toFixed(1)}%`}
          tone={
            metrics.totalTrades === 0
              ? 'neutral'
              : metrics.winRate > 50
                ? 'positive'
                : metrics.winRate < 50
                  ? 'negative'
                  : 'neutral'
          }
          sub={
            metrics.totalTrades === 0
              ? 'No trades logged'
              : `${metrics.winCount}W / ${metrics.lossCount}L of ${metrics.totalTrades}`
          }
        />
      </Card>

      <Card title="Average R:R" className={SPAN_4_ACROSS}>
        <Stat
          value={metrics.avgRR === null ? '—' : `1 : ${metrics.avgRR.toFixed(2)}`}
          tone={
            metrics.avgRR === null
              ? 'neutral'
              : metrics.avgRR > 1
                ? 'positive'
                : metrics.avgRR < 1
                  ? 'negative'
                  : 'neutral'
          }
          sub={
            metrics.avgRR === null
              ? 'No losing trades to compare'
              : 'Average winner against average loser'
          }
        />
      </Card>

      <Card title="Avg Winning Trade" className={SPAN_4_ACROSS}>
        <Stat
          value={metrics.winCount === 0 ? '—' : fmtSignedCurrency(metrics.avgWin)}
          tone={metrics.winCount === 0 ? 'neutral' : 'positive'}
          sub={metrics.winCount === 0 ? 'No winning trades yet' : 'Mean P&L across winners'}
        />
      </Card>

      <Card title="Avg Losing Trade" className={SPAN_4_ACROSS}>
        <Stat
          value={metrics.lossCount === 0 ? '—' : fmtSignedCurrency(metrics.avgLoss)}
          tone={metrics.lossCount === 0 ? 'neutral' : 'negative'}
          sub={metrics.lossCount === 0 ? 'No losing trades yet' : 'Mean P&L across losers'}
        />
      </Card>

      {/* Row 2 — standout days */}
      <Card title="Most Active Day" className={SPAN_3_ACROSS}>
        <Stat
          value={mostActiveDay ? `${mostActiveDay.tradeCount} trades` : '—'}
          sub={mostActiveDay ? fmtDayLabel(mostActiveDay.date) : 'No trades logged'}
        />
      </Card>

      <Card title="Most Profitable Day" className={SPAN_3_ACROSS}>
        <Stat
          value={mostProfitableDay ? fmtSignedCurrency(mostProfitableDay.netPnl) : '—'}
          tone={mostProfitableDay ? toneOf(mostProfitableDay.netPnl) : 'neutral'}
          sub={
            mostProfitableDay
              ? `${fmtDayLabel(mostProfitableDay.date)} · ${mostProfitableDay.tradeCount} trades`
              : 'No trades logged'
          }
        />
      </Card>

      <Card title="Least Profitable Day" className={SPAN_3_ACROSS}>
        <Stat
          value={leastProfitableDay ? fmtSignedCurrency(leastProfitableDay.netPnl) : '—'}
          tone={leastProfitableDay ? toneOf(leastProfitableDay.netPnl) : 'neutral'}
          sub={
            leastProfitableDay
              ? `${fmtDayLabel(leastProfitableDay.date)} · ${leastProfitableDay.tradeCount} trades`
              : 'No trades logged'
          }
        />
      </Card>

      {/* Row 3 — volume */}
      <Card title="Total Number of Trades" className={SPAN_3_ACROSS}>
        <Stat value={fmtNumber(metrics.totalTrades)} sub={`Across ${days.length} sessions`} />
      </Card>

      <Card title="Total Number of Lots Traded" className={SPAN_3_ACROSS}>
        <Stat
          value={fmtNumber(metrics.totalLots)}
          sub={`${(metrics.totalLots / Math.max(metrics.totalTrades, 1)).toFixed(1)} avg per trade`}
        />
      </Card>

      <Card title="Average Trade Duration" className={SPAN_3_ACROSS}>
        <Stat
          value={metrics.avgTradeDuration > 0 ? fmtDuration(metrics.avgTradeDuration) : '—'}
          sub={
            metrics.avgTradeDuration > 0 ? 'Entry to exit, all trades' : 'No holding time recorded'
          }
        />
      </Card>

      {/* Row 4 — holding time + direction mix */}
      <Card title="Average Win Duration" className={SPAN_3_ACROSS}>
        <Stat
          value={metrics.avgWinDuration > 0 ? fmtDuration(metrics.avgWinDuration) : '—'}
          sub={metrics.avgWinDuration > 0 ? 'Held on winning trades' : 'No holding time recorded'}
        />
      </Card>

      <Card title="Average Loss Duration" className={SPAN_3_ACROSS}>
        <Stat
          value={metrics.avgLossDuration > 0 ? fmtDuration(metrics.avgLossDuration) : '—'}
          sub={metrics.avgLossDuration > 0 ? 'Held on losing trades' : 'No holding time recorded'}
        />
      </Card>

      <Card title="Trade Direction %" className={SPAN_3_ACROSS}>
        <DirectionDonut data={directionData} />
      </Card>

      {/* Row 5 — extremes */}
      <Card title="Best Trade" className={SPAN_2_ACROSS}>
        <TradeStat trade={bestTrade} tone="positive" />
      </Card>

      <Card title="Worst Trade" className={SPAN_2_ACROSS}>
        <TradeStat trade={worstTrade} tone="negative" />
      </Card>

      {/* Row 6 — the two large charts */}
      <Card
        title="Daily Net Cumulative P&L"
        meta={fmtSignedCurrency(metrics.netPnl)}
        className={SPAN_2_ACROSS}
      >
        <div className="h-64 w-full">
          <CumulativePnlChart data={metrics.cumulative} />
        </div>
      </Card>

      <Card title="Net Daily P&L" meta={`${days.length} sessions`} className={SPAN_2_ACROSS}>
        <div className="h-64 w-full">
          <DailyPnlChart data={days} />
        </div>
      </Card>
    </div>
  )
}

function TradeStat({ trade, tone }: { trade: Trade | null; tone: 'positive' | 'negative' }) {
  if (!trade) return <Stat value="—" sub="No trades logged" />

  return (
    <Stat
      value={fmtSignedCurrency(trade.pnl)}
      tone={tone}
      sub={
        <>
          {trade.symbol} · {trade.direction} · {trade.lots}{' '}
          {trade.lots === 1 ? 'lot' : 'lots'}
          <br />
          Exit {fmtPrice(trade.exitPrice)} at {fmtTime(trade.exitTime)} ·{' '}
          {fmtDuration(trade.durationMin)} held
        </>
      }
    />
  )
}

