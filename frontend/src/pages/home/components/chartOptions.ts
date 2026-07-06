import { brand, chartColors } from '../../../theme';
import type { StatsOverview, TeamStats } from '../../../api/stats';

export function buildTeamRateChartOption(data: StatsOverview) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 24, bottom: 48, top: 32 },
    xAxis: {
      type: 'category',
      data: data.teamRates.map((t) => t.teamName),
      axisLabel: { interval: 0, rotate: data.teamRates.length > 4 ? 20 : 0 },
    },
    yAxis: { type: 'value', name: '签到率 %', max: 100 },
    series: [
      {
        name: '今日签到率',
        type: 'bar',
        data: data.teamRates.map((t) => t.rate),
        itemStyle: { color: chartColors.primary },
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
  };
}

export function buildPlatformTrendChartOption(data: StatsOverview) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['签到人数', '迟到人数'] },
    grid: { left: 48, right: 24, bottom: 32, top: 40 },
    xAxis: {
      type: 'category',
      data: data.dailyTrend.map((d) => d.date.slice(5)),
    },
    yAxis: { type: 'value', name: '人数', minInterval: 1 },
    series: [
      {
        name: '签到人数',
        type: 'line',
        smooth: true,
        data: data.dailyTrend.map((d) => d.total),
        itemStyle: { color: chartColors.success },
      },
      {
        name: '迟到人数',
        type: 'line',
        smooth: true,
        data: data.dailyTrend.map((d) => d.late),
        itemStyle: { color: chartColors.warning },
      },
    ],
  };
}

export function buildTeamTrendChartOption(data: TeamStats) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['签到率', '迟到率', '请假率'] },
    grid: { left: 48, right: 24, bottom: 32, top: 40 },
    xAxis: { type: 'category', data: data.dailyTrend.map((d) => d.date.slice(5)) },
    yAxis: { type: 'value', name: '%', max: 100 },
    series: [
      {
        name: '签到率',
        type: 'line',
        smooth: true,
        data: data.dailyTrend.map((d) => d.checkInRate),
        itemStyle: { color: chartColors.success },
      },
      {
        name: '迟到率',
        type: 'line',
        smooth: true,
        data: data.dailyTrend.map((d) => d.lateRate),
        itemStyle: { color: chartColors.warning },
      },
      {
        name: '请假率',
        type: 'line',
        smooth: true,
        data: data.dailyTrend.map((d) => d.leaveRate),
        itemStyle: { color: chartColors.secondary },
      },
    ],
  };
}

export { brand, chartColors };
