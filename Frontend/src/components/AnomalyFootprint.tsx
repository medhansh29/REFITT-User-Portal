import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { InferredParameters } from '../types';

interface AnomalyFootprintProps {
  parameters: InferredParameters;
}

const LABEL_MAPPING: Record<string, string> = {
  zams_zscore: 'Prog. Mass',
  k_energy_zscore: 'Kinetic Energy',
  mloss_rate_zscore: 'Mass Loss',
  ni56_zscore: 'Ni56 Yield',
  t_exp_zscore: 'Exp. Time',
  A_v_zscore: 'Dust',
  logZ_zscore: 'Metallicity',
};

export default function AnomalyFootprint({ parameters }: AnomalyFootprintProps) {
  const chartOption = useMemo(() => {
    const keys = [
      'logZ_zscore',
      'A_v_zscore',
      't_exp_zscore',
      'ni56_zscore',
      'mloss_rate_zscore',
      'k_energy_zscore',
      'zams_zscore',
    ] as const;

    // 1. Pre-calculate dynamic limits to set up smart thresholds
    const zScores = keys.map(key => {
      const v = parameters[key];
      return v !== undefined && v !== null ? v : 0;
    });
    const maxVal = Math.max(...zScores.map(Math.abs));
    const axisLimit = Math.max(3, Math.ceil(maxVal + 0.5));

    const categoryData: string[] = [];
    const seriesData: any[] = [];

    keys.forEach((key) => {
      categoryData.push(LABEL_MAPPING[key]);
      
      const rawVal = parameters[key];
      const val = rawVal !== undefined && rawVal !== null ? rawVal : 0;
      
      // 2. Prevent dynamic label clashing
      // If a negative bar extends past 70% of the calculated axis limit, 
      // flip its value label inside the bar to completely bypass text boundary crashes.
      const isExtremeNegative = val < 0 && Math.abs(val) > (axisLimit * 0.7);
      
      let labelPosition: 'left' | 'right' | 'insideRight' = val >= 0 ? 'right' : 'left';
      if (isExtremeNegative) {
        labelPosition = 'insideRight';
      }

      seriesData.push({
        value: val,
        itemStyle: {
          color: val >= 0 ? '#f59e0b' : '#f43f5e', // Amber for positive, Rose for negative
          borderRadius: val >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]
        },
        label: {
          show: true,
          position: labelPosition,
          // Add padding when inside the bar so it sits cleanly away from the edge
          distance: labelPosition === 'insideRight' ? 8 : 5, 
          formatter: () => `${val > 0 ? '+' : ''}${val.toFixed(2)}σ`,
          color: labelPosition === 'insideRight' ? '#ffffff' : (val >= 0 ? '#fdb122' : '#fb7185'),
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: labelPosition === 'insideRight' ? 'bold' : 'normal'
        }
      });
    });

    return {
      grid: {
        left: '85px', // Significantly reduced from 120px to reclaim your real estate
        right: '45px',
        bottom: '25px',
        top: '20px',
        containLabel: false
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: {
          color: '#fff',
          fontSize: 11,
          fontFamily: 'monospace',
        },
        formatter: (params: any) => {
          return `<div class="font-bold">${params.name}: <span style="color: ${params.value >= 0 ? '#f59e0b' : '#f43f5e'}">${params.value > 0 ? '+' : ''}${params.value.toFixed(2)}σ</span></div>`;
        },
      },
      xAxis: {
        type: 'value',
        min: -axisLimit,
        max: axisLimit,
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.04)',
          },
        },
        axisLabel: {
          color: '#6b7280',
          fontFamily: 'monospace',
          fontSize: 9,
          formatter: (value: number) => `${value > 0 ? '+' : ''}${value}`,
        },
        axisLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'category',
        data: categoryData,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 10,
          fontFamily: 'sans-serif',
          fontWeight: 500,
          margin: 10, // Tighter margin alongside layout push
        },
        axisLine: {
          show: false, // Turned off default Y-Axis line to keep background clean
        },
        axisTick: {
          show: false,
        },
      },
      series: [
        {
          name: 'Z-Score',
          type: 'bar',
          barWidth: '50%',
          data: seriesData,
          markLine: {
            symbol: 'none',
            silent: true,
            label: { show: false },
            data: [
              { xAxis: 0 }
            ],
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.35)', // Sharp, visible baseline at exactly 0
              width: 1.5,
              type: 'solid'
            }
          }
        },
      ],
    };
  }, [parameters]);

  return (
    <div className="w-full h-full relative">
      <ReactECharts
        option={chartOption}
        style={{ height: '100%', width: '100%' }}
        theme="dark"
        opts={{ renderer: 'svg' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}