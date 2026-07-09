import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { ParameterHistoryItem } from "../types";
import { X } from "lucide-react";

interface ParameterHistoryChartProps {
  objectId: string;
  paramKey: string;
  paramLabel: string;
  history: ParameterHistoryItem[];
  onClose: () => void;
}

export default function ParameterHistoryChart({
  objectId,
  paramKey,
  paramLabel,
  history,
  onClose,
}: ParameterHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // Group unique dates
  const uniqueDates = Array.from(new Set(history.map(item => item.date))).sort();

  useEffect(() => {
    if (!containerRef.current || uniqueDates.length === 0) return;

    let chart = echarts.getInstanceByDom(containerRef.current);
    if (!chart) {
      chart = echarts.init(containerRef.current, "dark", {
        renderer: "canvas",
      });
    }
    chartInstanceRef.current = chart;

    // Prepare data lists
    const rNominal: any[] = [];
    const rLowerData: any[] = [];
    const rUpperData: any[] = [];

    uniqueDates.forEach((date, idx) => {
      const rItem = history.find(h => h.date === date && h.filter === "r");

      if (rItem) {
        const p = rItem.parameters[paramKey];
        if (p) {
          rNominal.push([idx, p.val]);
          const low = p.val - p.minus;
          const high = p.val + p.plus;
          rLowerData.push([idx, low]);
          rUpperData.push([idx, high - low]);
        } else {
          rNominal.push([idx, null]);
          rLowerData.push([idx, null]);
          rUpperData.push([idx, null]);
        }
      } else {
        rNominal.push([idx, null]);
        rLowerData.push([idx, null]);
        rUpperData.push([idx, null]);
      }
    });

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      title: {
        text: `MCMC Convergence: ${paramLabel}`,
        left: "center",
        textStyle: {
          color: "#e5e7eb",
          fontSize: 13,
          fontFamily: "Inter",
          fontWeight: "bold",
        },
      },
      legend: {
        data: ["Model fit"],
        bottom: 0,
        textStyle: { color: "#9ca3af", fontSize: 10 },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0b0c10",
        borderColor: "rgba(245, 158, 11, 0.2)",
        textStyle: { color: "#e5e7eb", fontFamily: "JetBrains Mono", fontSize: 11 },
        formatter: (params: any) => {
          const dataIndex = params[0].dataIndex;
          const date = uniqueDates[dataIndex];
          
          let html = `<div style="font-weight: bold; margin-bottom: 6px; color: #f59e0b;">Date: ${date}</div>`;
          
          const rItem = history.find(h => h.date === date && h.filter === "r");
          
          if (rItem) {
            const p = rItem.parameters[paramKey];
            if (p) {
              html += `
                <div>
                  <span style="display:inline-block;border-radius:50%;width:8px;height:8px;background:#ef4444;margin-right:6px;"></span>
                  Value: <b>${p.val.toFixed(4)}</b><br/>
                  <span style="margin-left:14px;color:#9ca3af;font-size:10px;">
                    +${p.plus.toFixed(4)} / -${p.minus.toFixed(4)} (+${p.pct_plus.toFixed(1)}% / -${p.pct_minus.toFixed(1)}%)
                  </span>
                </div>
              `;
            }
          }
          
          return html;
        },
      },
      grid: {
        left: 60,
        right: 40,
        bottom: 75,
        top: 50,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: uniqueDates,
        axisLine: { lineStyle: { color: "#1e293b" } },
        axisLabel: {
          color: "#9ca3af",
          fontSize: 9,
          fontFamily: "JetBrains Mono",
          rotate: 15,
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { lineStyle: { color: "#1e293b" } },
        splitLine: { lineStyle: { color: "#111827", type: "dashed" } },
        axisLabel: {
          color: "#9ca3af",
          fontFamily: "JetBrains Mono",
          formatter: (v: number) => v.toFixed(3),
        },
      },
      series: [
        {
          name: "Lower Bound",
          type: "line",
          data: rLowerData,
          lineStyle: { opacity: 0 },
          itemStyle: { opacity: 0 },
          symbol: "none",
          stack: "confidence-band",
          connectNulls: true,
          tooltip: { show: false },
        },
        {
          name: "Upper Bound",
          type: "line",
          data: rUpperData,
          lineStyle: { opacity: 0 },
          itemStyle: { opacity: 0 },
          symbol: "none",
          areaStyle: {
            color: "rgba(239, 68, 68, 0.2)",
          },
          stack: "confidence-band",
          connectNulls: true,
          tooltip: { show: false },
        },
        {
          name: "Model fit",
          type: "line",
          data: rNominal,
          lineStyle: { color: "#ef4444", width: 2 },
          itemStyle: { color: "#ef4444" },
          symbol: "circle",
          symbolSize: 5,
          connectNulls: true,
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => {
      chart?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [uniqueDates, paramLabel, paramKey, history]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      {/* Panel Chassis */}
      <div className="relative w-full max-w-2xl bg-[#0b0c10] border border-white/10 rounded-2xl shadow-2xl flex flex-col p-5 z-10">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-200">
              Parameter Convergence History
            </h4>
            <span className="text-[10px] font-mono text-slate-500">
              Target ID: {objectId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full h-80 bg-black/30 rounded-xl p-2 relative flex flex-col justify-center items-center">
          {uniqueDates.length === 0 ? (
            <span className="text-xs text-slate-500 font-mono">No history data available for this parameter</span>
          ) : (
            <div className="w-full h-full" ref={containerRef} />
          )}
        </div>
      </div>
    </div>
  );
}
