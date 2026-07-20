import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { LightCurve, SupernovaSummary, Observation, BandData } from "../types";
import { Sliders, ToggleLeft, Layers, Grid3X3, Watch, Flame, Eye, X, CheckSquare } from "lucide-react";

interface LightCurveCompareProps {
  comparedLcs: { [id: string]: LightCurve };
  comparedLcsLoading: boolean;
  comparedIds: string[];
  supernovae: SupernovaSummary[];
  onRemoveId: (id: string) => void;
  onClearAll: () => void;
  alignMode: "mjd" | "rest_frame";
  showObs: boolean;
  showModels: boolean;
  compareView?: "plots" | "table";
}

// Color palettes for compared supernovae
const PALETTES = [
  { g: "#2ecc71", r: "#e74c3c", name: "Emerald & Coral" }, // Green/Red
  { g: "#00d2d3", r: "#ff9f43", name: "Cyan & Apricot" },  // Teal/Orange
  { g: "#9b59b6", r: "#f1c40f", name: "Amethyst & Gold" }, // Violet/Yellow
  { g: "#3498db", r: "#e84118", name: "Sky & Crimson" },   // Blue/Fired brick
  { g: "#20bf6b", r: "#fd9644", name: "Turquoise & Peach" }
];

function dateToMJD(dateString: string): number {
  const date = new Date(dateString);
  return (date.getTime() / 86400000) + 40587;
}

// Sanitizer helper
function sanitizeBand(band: BandData, limit = 24.0): BandData {
  if (!band || !band.median) {
    return { mjd: [], median: [], upper_16th: [], lower_84th: [] };
  }
  const keep = band.median
    .map((mag, i) => ({ i, mag }))
    .filter(({ mag }) => mag <= limit);

  return {
    mjd: keep.map(({ i }) => band.mjd[i]),
    median: keep.map(({ i }) => band.median[i]),
    upper_16th: keep.map(({ i }) => band.upper_16th[i]),
    lower_84th: keep.map(({ i }) => band.lower_84th[i]),
  };
}

// Linear interpolation for tooltip alignment
function interpolate(mjdArr: number[], valArr: number[], targetMjd: number): number | null {
  if (!mjdArr || mjdArr.length === 0) return null;
  if (targetMjd < mjdArr[0] || targetMjd > mjdArr[mjdArr.length - 1]) return null;
  let lo = 0;
  for (let i = 0; i < mjdArr.length - 1; i++) {
    if (mjdArr[i] <= targetMjd && mjdArr[i + 1] >= targetMjd) {
      lo = i;
      break;
    }
  }
  const hi = lo + 1;
  if (hi >= mjdArr.length) return valArr[lo];
  const t = (targetMjd - mjdArr[lo]) / (mjdArr[hi] - mjdArr[lo]);
  return valArr[lo] + t * (valArr[hi] - valArr[lo]);
}

export default function LightCurveCompare({
  comparedLcs,
  comparedLcsLoading,
  comparedIds,
  supernovae,
  onRemoveId,
  onClearAll,
  alignMode,
  showObs,
  showModels,
  compareView = "plots",
}: LightCurveCompareProps) {
  const [viewMode, setViewMode] = useState<"overlay" | "grid">("overlay");

  // Single chart DOM ref (for overlay mode)
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const overlayChartRef = useRef<echarts.ECharts | null>(null);

  // Grouped charts DOM refs (for synchronized grid mode)
  const gridContainersRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});
  const gridChartsRefs = useRef<{ [id: string]: echarts.ECharts | null }>({});

  const loadedCount = comparedIds.filter((id) => comparedLcs[id]).length;

  // Build mapping of metadata for speed
  const metaMap = React.useMemo(() => {
    const map: { [id: string]: SupernovaSummary } = {};
    supernovae.forEach((s) => {
      map[s.object_id] = s;
    });
    return map;
  }, [supernovae]);

  // Clean obsolete charts in grid, resize logic
  useEffect(() => {
    const handleResize = () => {
      if (viewMode === "overlay" && overlayChartRef.current) {
        overlayChartRef.current.resize();
      } else if (viewMode === "grid") {
        Object.values(gridChartsRefs.current).forEach((chart: any) => {
          if (chart) chart.resize();
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [viewMode]);

  // 1. OVERLAY MODE: Render all selected lightcurves in a single ECharts instance
  useEffect(() => {
    if (viewMode !== "overlay") {
      if (overlayChartRef.current) {
        overlayChartRef.current.dispose();
        overlayChartRef.current = null;
      }
      return;
    }

    if (!overlayContainerRef.current) return;

    // Disposing existing chart before recreating
    if (overlayChartRef.current) {
      overlayChartRef.current.dispose();
      overlayChartRef.current = null;
    }

    let chartInstance = echarts.getInstanceByDom(overlayContainerRef.current);
    if (chartInstance) {
      chartInstance.dispose();
    }

    chartInstance = echarts.init(overlayContainerRef.current, "dark", {
      renderer: "canvas",
    });
    overlayChartRef.current = chartInstance;

    if (comparedLcsLoading && loadedCount === 0) {
      chartInstance.showLoading({
        text: "FETCHING FLUX DATAPOINTS...",
        color: "#f59e0b",
        textColor: "#f59e0b",
        maskColor: "rgba(2, 2, 4, 0.85)",
        zlevel: 100,
      });
      return;
    }

    chartInstance.hideLoading();

    if (comparedIds.length === 0) {
      chartInstance.clear();
      chartInstance.setOption({
        backgroundColor: "transparent",
        title: {
          text: "Select targets from list to plot comparison curves.",
          left: "center",
          top: "center",
          textStyle: {
            color: "#6b7280",
            fontSize: 14,
            fontFamily: "Space Grotesk, monospace",
          },
        },
      });
      return;
    }

    const series: any[] = [];
    const gLegendData: any[] = [];
    const rLegendData: any[] = [];
    let absoluteMinX = Infinity;
    let absoluteMaxX = -Infinity;
    let absoluteMinY = Infinity;
    let absoluteMaxY = -Infinity;

    comparedIds.forEach((id, orderIndex) => {
      const lc = comparedLcs[id];
      if (!lc) return;

      const metadata = metaMap[id];
      // T0 = first model MJD value (aligns all curves to start at day 0)
      let t0 = 0;
      if (alignMode === "rest_frame") {
        const gStart = lc.model_fit?.g_band?.mjd?.[0];
        const rStart = lc.model_fit?.r_band?.mjd?.[0];
        t0 = gStart != null && rStart != null ? Math.min(gStart, rStart) : (gStart ?? rStart ?? 0);
      }
      const tExpShift = t0;
      const palette = PALETTES[orderIndex % PALETTES.length];

      // Sanitize bands
      const gBand = lc.model_fit?.g_band ? sanitizeBand(lc.model_fit.g_band) : null;
      const rBand = lc.model_fit?.r_band ? sanitizeBand(lc.model_fit.r_band) : null;
      const obs = lc.observations || [];
      const discoveryDate = metaMap[id]?.basic_info?.discovery_date;
      const discoveryMjd = discoveryDate ? dateToMJD(discoveryDate) : undefined;

      // Helper to adjust X values
      const adjustX = (v: number) => (alignMode === "rest_frame" ? v - tExpShift : v);


      // g-band model fit
      if (showModels && gBand && gBand.mjd.length > 0 ) {
        const fitName = `${id} g-band median`;
        gLegendData.push({ name: fitName, itemStyle: { color: palette.g } });
        series.push({
          name: fitName,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          symbol: "none",
          lineStyle: { color: palette.g, width: 2, type: "solid" },
          data: gBand.mjd.map((mjd, idx) => [adjustX(mjd), gBand.median[idx]]),
          z: 5,
        });

        // 1-sigma uncertainty area
        series.push({
          name: `${id} g-band median`,
          type: "custom",
          xAxisIndex: 0,
          yAxisIndex: 0,
          clip: true,
          renderItem: function (params: any, api: any) {
            if (params.context.rendered) {
              return;
            }
            params.context.rendered = true;

            const upperPoints: any[] = [];
            const lowerPoints: any[] = [];
            let i = 0;
            while (true) {
              const x = api.value(0, i);
              if (x == null || isNaN(x)) break;
              upperPoints.push(api.coord([x, api.value(1, i)]));
              lowerPoints.push(api.coord([x, api.value(2, i)]));
              i++;
            }
            lowerPoints.reverse();

            return {
              type: "polygon",
              shape: {
                points: upperPoints.concat(lowerPoints),
              },
              style: { fill: palette.g, opacity: 0.04, stroke: "none" },
            };
          },
          data: gBand.mjd.map((mjd, idx) => [adjustX(mjd), gBand.upper_16th[idx], gBand.lower_84th[idx]]),
          tooltip: { show: false },
          z: 2,
        });
      }

      // r-band model fit
      if (showModels && rBand && rBand.mjd.length > 0 ) {
        const fitName = `${id} r-band median`;
        rLegendData.push({ name: fitName, itemStyle: { color: palette.r } });
        series.push({
          name: fitName,
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          smooth: true,
          symbol: "none",
          lineStyle: { color: palette.r, width: 2, type: "solid" },
          data: rBand.mjd.map((mjd, idx) => [adjustX(mjd), rBand.median[idx]]),
          z: 5,
        });

        // 1-sigma uncertainty area
        series.push({
          name: `${id} r-band median`,
          type: "custom",
          xAxisIndex: 1,
          yAxisIndex: 1,
          clip: true,
          renderItem: function (params: any, api: any) {
            if (params.context.rendered) {
              return;
            }
            params.context.rendered = true;

            const upperPoints: any[] = [];
            const lowerPoints: any[] = [];
            let i = 0;
            while (true) {
              const x = api.value(0, i);
              if (x == null || isNaN(x)) break;
              upperPoints.push(api.coord([x, api.value(1, i)]));
              lowerPoints.push(api.coord([x, api.value(2, i)]));
              i++;
            }
            lowerPoints.reverse();

            return {
              type: "polygon",
              shape: {
                points: upperPoints.concat(lowerPoints),
              },
              style: { fill: palette.r, opacity: 0.04, stroke: "none" },
            };
          },
          data: rBand.mjd.map((mjd, idx) => [adjustX(mjd), rBand.upper_16th[idx], rBand.lower_84th[idx]]),
          tooltip: { show: false },
          z: 2,
        });
      }

      // Observations
      if (showObs && obs.length > 0) {
        const obsG = obs.filter((o) => o.filter === "g");
        const obsR = obs.filter((o) => o.filter === "r");

        if (obsG.length > 0 ) {
          const obsGName = `${id} g-band obs`;
          gLegendData.push({ name: obsGName, itemStyle: { color: palette.g } });
          series.push({
            name: obsGName,
            type: "scatter",
            xAxisIndex: 0,
            yAxisIndex: 0,
            symbolSize: 7,
            data: obsG.map((o) => {
              const isAfter = discoveryMjd != null && o.mjd > discoveryMjd;
              const isLimit = o.is_upperlimit === true;
              return {
                value: [adjustX(o.mjd), o.mag],
                symbol: isLimit ? "triangle" : "circle",
                symbolSize: isLimit ? 6 : 7,
                itemStyle: { color: palette.g, borderColor: "#000", borderWidth: 0.8, opacity: isLimit ? 0.4 : (isAfter ? 0.25 : 1) }
              };
            }),
            z: 10,
          });
        }
        if (obsR.length > 0 ) {
          const obsRName = `${id} r-band obs`;
          rLegendData.push({ name: obsRName, itemStyle: { color: palette.r } });
          series.push({
            name: obsRName,
            type: "scatter",
            xAxisIndex: 1,
            yAxisIndex: 1,
            symbolSize: 7,
            data: obsR.map((o) => {
              const isAfter = discoveryMjd != null && o.mjd > discoveryMjd;
              const isLimit = o.is_upperlimit === true;
              return {
                value: [adjustX(o.mjd), o.mag],
                symbol: isLimit ? "triangle" : "circle",
                symbolSize: isLimit ? 6 : 7,
                itemStyle: { color: palette.r, borderColor: "#000", borderWidth: 0.8, opacity: isLimit ? 0.4 : (isAfter ? 0.25 : 1) }
              };
            }),
            z: 10,
          });
        }
      }

      // Track limits for bounds
      const localMjds = [
        ...(gBand?.mjd || []),
        ...(rBand?.mjd || []),
        ...obs.map((o) => o.mjd),
      ].map(adjustX);

      const localYVals = [
        ...(gBand?.median || []),
        ...(rBand?.median || []),
        ...obs.map((o) => o.mag),
      ];

      if (localMjds.length > 0) {
        absoluteMinX = Math.min(absoluteMinX, ...localMjds);
        absoluteMaxX = Math.max(absoluteMaxX, ...localMjds);
      }
      if (localYVals.length > 0) {
        absoluteMinY = Math.min(absoluteMinY, ...localYVals);
        absoluteMaxY = Math.max(absoluteMaxY, ...localYVals);
      }
    });

    const xMin = isFinite(absoluteMinX) ? absoluteMinX - 3 : -20;
    const xMax = isFinite(absoluteMaxX) ? absoluteMaxX + 3 : 100;
    const yMin = isFinite(absoluteMinY) ? absoluteMinY - 0.5 : -20;
    const calculatedAbsoluteMaxY = isFinite(absoluteMaxY) ? absoluteMaxY + 0.5 : -10;
    const yMax = Math.min(calculatedAbsoluteMaxY, -10);

    const option = {
      backgroundColor: "transparent",
      title: {
        text: `Comparative Overlay: ${alignMode === "rest_frame" ? "Aligned Evolution" : "Epoch Time (MJD)"}`,
        left: "center",
        textStyle: {
          color: "#cbd5e1",
          fontWeight: "600",
          fontSize: 13,
          fontFamily: "Space Grotesk, sans-serif",
        },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10, 10, 12, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 11, fontFamily: "JetBrains Mono" },
        axisPointer: { type: "cross" },
        formatter(params: any[]) {
          const valX = parseFloat(params[0]?.axisValue);
          if (isNaN(valX)) return "";

          let html = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;color:#f59e0b;">
            ${alignMode === "rest_frame" ? `Phase (Days since explosion): ${valX.toFixed(2)}d` : `MJD Epoch: ${valX.toFixed(4)}`}
          </div>`;

          // Group by supernova ID for scannable tooltip
          const snValues: { [id: string]: { g?: string; r?: string } } = {};

          comparedIds.forEach((id) => {
            const lc = comparedLcs[id];
            if (!lc) return;
            const metadata = metaMap[id];
            // T0 = first model MJD for tooltip inverse mapping
            let tooltipT0 = 0;
            if (alignMode === "rest_frame") {
              const gS = lc.model_fit?.g_band?.mjd?.[0];
              const rS = lc.model_fit?.r_band?.mjd?.[0];
              tooltipT0 = gS != null && rS != null ? Math.min(gS, rS) : (gS ?? rS ?? 0);
            }
            const searchMjd = alignMode === "rest_frame" ? valX + tooltipT0 : valX;

            const gB = lc.model_fit?.g_band ? sanitizeBand(lc.model_fit.g_band) : null;
            const rB = lc.model_fit?.r_band ? sanitizeBand(lc.model_fit.r_band) : null;

            let gStr = "";
            let rStr = "";

            if (gB) {
              const val = interpolate(gB.mjd, gB.median, searchMjd);
              if (val != null) gStr = `${val.toFixed(2)}`;
            }
            if (rB) {
              const val = interpolate(rB.mjd, rB.median, searchMjd);
              if (val != null) rStr = `${val.toFixed(2)}`;
            }

            if (gStr || rStr) {
              snValues[id] = { g: gStr, r: rStr };
            }
          });

          Object.keys(snValues).forEach((id, idx) => {
            const palette = PALETTES[comparedIds.indexOf(id) % PALETTES.length];
            const { g, r } = snValues[id];
            html += `<div style="margin-bottom:3px;display:flex;align-items:center;justify-content:between;gap:12px;">
              <span style="font-weight:600;color:#e2e8f0;">${id}:</span>
              <span style="font-size:11px;">
                ${g ? `<span style="color:${palette.g}">g:${g}</span>` : ""}
                ${g && r ? " | " : ""}
                ${r ? `<span style="color:${palette.r}">r:${r}</span>` : ""}
              </span>
            </div>`;
          });

          return html;
        },
      },
      legend: [
        {
          data: gLegendData,
          orient: "vertical",
          top: "10%",
          right: "3%",
          backgroundColor: "transparent",
          textStyle: { color: "#9ca3af", fontSize: 10, fontFamily: "Inter" },
        },
        {
          data: rLegendData,
          orient: "vertical",
          bottom: "10%",
          right: "3%",
          backgroundColor: "transparent",
          textStyle: { color: "#9ca3af", fontSize: 10, fontFamily: "Inter" },
        },
      ],
      grid: [
        { left: "8%", right: "22%", top: "10%", bottom: "55%", containLabel: true },
        { left: "8%", right: "22%", top: "55%", bottom: "10%", containLabel: true }
      ],
      dataZoom: [
        { type: "inside", filterMode: "none", xAxisIndex: [0, 1] }
      ],
      toolbox: {
        show: true,
        top: 15,
        right: 20,
        feature: {
          dataZoom: {
            title: { zoom: "Box Selection Zoom", back: "Undo Zoom" },
            xAxisIndex: [0, 1]
          },
          restore: { title: "Reset View" }
        },
        iconStyle: { borderColor: "#9ca3af" }
      },
      xAxis: [
        {
          gridIndex: 0,
          type: "value",
          nameLocation: "middle",
          nameGap: 24,
          min: xMin,
          max: xMax,
          splitLine: { show: false },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { show: false },
        },
        {
          gridIndex: 1,
          type: "value",
          name: alignMode === "rest_frame" ? "Days Since Explosion" : "Modified Julian Date (MJD)",
          nameLocation: "middle",
          nameGap: 24,
          min: xMin,
          max: xMax,
          splitLine: { show: false },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10, formatter: (v: number) => v.toFixed(0) },
        }
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: "value",
          name: "Absolute Magnitude (g-band)",
          nameLocation: "middle",
          nameGap: 45,
          inverse: true,
          splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)", type: "dashed" } },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10, formatter: (v: number) => v.toFixed(1) },
          min: yMin,
          max: yMax,
        },
        {
          gridIndex: 1,
          type: "value",
          name: "Absolute Magnitude (r-band)",
          nameLocation: "middle",
          nameGap: 45,
          inverse: true,
          splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)", type: "dashed" } },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10, formatter: (v: number) => v.toFixed(1) },
          min: yMin,
          max: yMax,
        }
      ],
      series,
    };

    chartInstance.setOption(option);

    return () => {
      chartInstance.dispose();
      overlayChartRef.current = null;
    };
  }, [viewMode, alignMode, comparedIds, comparedLcs, comparedLcsLoading, showObs, showModels]);


  // 2. SEPARATE SYNCHRONIZED GRIDS MODE
  useEffect(() => {
    if (viewMode !== "grid") {
      Object.values(gridChartsRefs.current).forEach((chart: any) => {
        if (chart) chart.dispose();
      });
      gridChartsRefs.current = {};
      return;
    }

    // Clean old instances not in comparedIds anymore
    Object.keys(gridChartsRefs.current).forEach((id) => {
      if (!comparedIds.includes(id)) {
        gridChartsRefs.current[id]?.dispose();
        delete gridChartsRefs.current[id];
      }
    });

    const activeInstances: echarts.ECharts[] = [];

    comparedIds.forEach((id, orderIndex) => {
      const container = gridContainersRefs.current[id];
      if (!container) return;

      const lc = comparedLcs[id];
      const metadata = metaMap[id];
      if (!lc || !metadata) return;

      let chartInstance = echarts.getInstanceByDom(container);
      if (!chartInstance) {
        chartInstance = echarts.init(container, "dark", { renderer: "canvas" });
      }
      gridChartsRefs.current[id] = chartInstance;

      chartInstance.clear();

      const palette = PALETTES[orderIndex % PALETTES.length];
      const gBand = lc.model_fit?.g_band ? sanitizeBand(lc.model_fit.g_band) : null;
      const rBand = lc.model_fit?.r_band ? sanitizeBand(lc.model_fit.r_band) : null;
      const obs = lc.observations || [];
      const discoveryDate = metaMap[id]?.basic_info?.discovery_date;
      const discoveryMjd = discoveryDate ? dateToMJD(discoveryDate) : undefined;

      // T0 = first model MJD for grid mode alignment
      let gridT0 = 0;
      if (alignMode === "rest_frame") {
        const gS = lc.model_fit?.g_band?.mjd?.[0];
        const rS = lc.model_fit?.r_band?.mjd?.[0];
        gridT0 = gS != null && rS != null ? Math.min(gS, rS) : (gS ?? rS ?? 0);
      }
      const tExpShift = gridT0;

      const adjustX = (v: number) => (alignMode === "rest_frame" ? v - tExpShift : v);

      const series: any[] = [];
      const legendData: string[] = [];

      // g-band
      if (showModels && gBand && gBand.mjd.length > 0 ) {
        const titleG = `${id} (g model)`;
        legendData.push(titleG);
        series.push({
          name: titleG,
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { color: palette.g, width: 2.2 },
          data: gBand.mjd.map((mjd, idx) => [adjustX(mjd), gBand.median[idx]]),
          z: 5,
        });

        series.push({
          name: `${id} (g 1σ)`,
          type: "custom",
          clip: true,
          renderItem: function (params: any, api: any) {
            if (params.context.rendered) {
              return;
            }
            params.context.rendered = true;

            const upperPoints: any[] = [];
            const lowerPoints: any[] = [];
            let i = 0;
            while (true) {
              const x = api.value(0, i);
              if (x == null || isNaN(x)) break;
              upperPoints.push(api.coord([x, api.value(1, i)]));
              lowerPoints.push(api.coord([x, api.value(2, i)]));
              i++;
            }
            lowerPoints.reverse();

            return {
              type: "polygon",
              shape: {
                points: upperPoints.concat(lowerPoints),
              },
              style: { fill: palette.g, opacity: 0.15, stroke: "none" },
            };
          },
          data: gBand.mjd.map((mjd, idx) => [adjustX(mjd), gBand.upper_16th[idx], gBand.lower_84th[idx]]),
          tooltip: { show: false },
          z: 2,
        });
      }

      // r-band
      if (showModels && rBand && rBand.mjd.length > 0 ) {
        const titleR = `${id} (r model)`;
        legendData.push(titleR);
        series.push({
          name: titleR,
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { color: palette.r, width: 2.2 },
          data: rBand.mjd.map((mjd, idx) => [adjustX(mjd), rBand.median[idx]]),
          z: 5,
        });

        series.push({
          name: `${id} (r 1σ)`,
          type: "custom",
          clip: true,
          renderItem: function (params: any, api: any) {
            if (params.context.rendered) {
              return;
            }
            params.context.rendered = true;

            const upperPoints: any[] = [];
            const lowerPoints: any[] = [];
            let i = 0;
            while (true) {
              const x = api.value(0, i);
              if (x == null || isNaN(x)) break;
              upperPoints.push(api.coord([x, api.value(1, i)]));
              lowerPoints.push(api.coord([x, api.value(2, i)]));
              i++;
            }
            lowerPoints.reverse();

            return {
              type: "polygon",
              shape: {
                points: upperPoints.concat(lowerPoints),
              },
              style: { fill: palette.r, opacity: 0.15, stroke: "none" },
            };
          },
          data: rBand.mjd.map((mjd, idx) => [adjustX(mjd), rBand.upper_16th[idx], rBand.lower_84th[idx]]),
          tooltip: { show: false },
          z: 2,
        });
      }

      // Observations
      if (showObs && obs.length > 0) {
        const obsG = obs.filter((o) => o.filter === "g");
        const obsR = obs.filter((o) => o.filter === "r");

        if (obsG.length > 0 ) {
          const titleObsG = `${id} (g obs)`;
          legendData.push(titleObsG);
          series.push({
            name: titleObsG,
            type: "scatter",
            symbolSize: 6,
            data: obsG.map((o) => {
              const isAfter = discoveryMjd != null && o.mjd > discoveryMjd;
              const isLimit = o.is_upperlimit === true;
              return {
                value: [adjustX(o.mjd), o.mag],
                symbol: isLimit ? "triangle" : "circle",
                symbolSize: isLimit ? 5 : 6,
                itemStyle: { color: palette.g, borderColor: "#000", borderWidth: 0.5, opacity: isLimit ? 0.4 : (isAfter ? 0.25 : 1) }
              };
            }),
            z: 10,
          });
        }
        if (obsR.length > 0 ) {
          const titleObsR = `${id} (r obs)`;
          legendData.push(titleObsR);
          series.push({
            name: titleObsR,
            type: "scatter",
            symbolSize: 6,
            data: obsR.map((o) => {
              const isAfter = discoveryMjd != null && o.mjd > discoveryMjd;
              const isLimit = o.is_upperlimit === true;
              return {
                value: [adjustX(o.mjd), o.mag],
                symbol: isLimit ? "triangle" : "circle",
                symbolSize: isLimit ? 5 : 6,
                itemStyle: { color: palette.r, borderColor: "#000", borderWidth: 0.5, opacity: isLimit ? 0.4 : (isAfter ? 0.25 : 1) }
              };
            }),
            z: 10,
          });
        }
      }

      const localMjds = [
        ...(gBand?.mjd || []),
        ...(rBand?.mjd || []),
        ...obs.map((o) => o.mjd),
      ].map(adjustX);

      const localYVals = [
        ...(gBand?.median || []),
        ...(rBand?.median || []),
        ...obs.map((o) => o.mag),
      ];

      const xMin = localMjds.length > 0 ? Math.min(...localMjds) - 2 : -20;
      const xMax = localMjds.length > 0 ? Math.max(...localMjds) + 2 : 100;
      const yMin = localYVals.length > 0 ? Math.min(...localYVals) - 0.4 : -20;
      const calculatedYMax = localYVals.length > 0 ? Math.max(...localYVals) + 0.4 : -10;
      const yMax = Math.min(calculatedYMax, -10);

      const singleOption = {
        backgroundColor: "transparent",
        title: {
          text: `Target: ${id} (z = ${metadata.basic_info.redshift.toFixed(4)})`,
          left: 10,
          top: 5,
          textStyle: { color: "#cbd5e1", fontSize: 11, fontFamily: "Space Grotesk, sans-serif" },
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(10, 10, 12, 0.95)",
          borderColor: "rgba(255, 255, 255, 0.15)",
          textStyle: { color: "#e2e8f0", fontSize: 9, fontFamily: "JetBrains Mono" },
          axisPointer: { type: "line" },
        },
        toolbox: {
          show: true,
          top: 10,
          right: 20,
          feature: {
            dataZoom: {
              title: { zoom: "Box Selection Zoom", back: "Undo Zoom" },
            },
            restore: { title: "Reset View" }
          },
          iconStyle: { borderColor: "#9ca3af" }
        },
        dataZoom: [
          { type: "inside", filterMode: "none" }
        ],
        grid: { left: "4%", right: "4%", bottom: "20%", top: "25%", containLabel: true },
        xAxis: {
          type: "value",
          min: xMin,
          max: xMax,
          splitLine: { show: false },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.1)" } },
          axisLabel: { color: "#64748b", fontSize: 9, fontFamily: "JetBrains Mono" },
        },
        yAxis: {
          type: "value",
          inverse: true,
          min: yMin,
          max: yMax,
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { color: "#64748b", fontSize: 9, fontFamily: "JetBrains Mono" },
        },
        series,
      };

      chartInstance.setOption(singleOption);
      activeInstances.push(chartInstance);
    });

    // Connect them for synchronized zoom + tooltips
    if (activeInstances.length > 1) {
      echarts.connect(activeInstances);
    }

    return () => {
      activeInstances.forEach((chart) => {
        chart.dispose();
      });
      gridChartsRefs.current = {};
    };
  }, [viewMode, alignMode, comparedIds, comparedLcs, comparedLcsLoading, showObs, showModels]);


  return (
    <div className="w-full h-full bg-black/60 border border-white/10 rounded-xl p-4 flex flex-col gap-4 overflow-hidden min-h-0">
      {comparedIds.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-3 min-h-0">
          <div className="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-500 mb-1">
            <CheckSquare className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-300 font-semibold">Scientific Comparison Stack is Empty</p>
          <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
            Toggle the <span className="text-amber-500 font-semibold font-mono">+ Compare</span> button on supernovae lists inside the center catalog panel to populate this comparative dashboard.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Main Chart viewport area */}
          <div className={`relative flex-1 min-h-0 bg-black/40 border border-white/10 rounded-xl p-3 flex-col justify-between overflow-hidden ${compareView === "plots" ? "flex" : "hidden"}`}>
            {viewMode === "overlay" ? (
              <div ref={overlayContainerRef} className="w-full h-full min-h-[300px]" />
            ) : (
                <div className="w-full h-full overflow-y-auto select-yCustomScroll flex flex-col gap-4 pr-1">
                {comparedIds.map((id) => (
                  <div
                    key={id}
                    className="w-full shrink-0 bg-white/5 border border-white/10 rounded-xl p-3 relative"
                    style={{ height: "240px" }}
                  >
                    {!comparedLcs[id] ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl gap-2 z-10">
                        <div className="w-4 h-4 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                          Acquiring flux coordinates for {id}...
                        </span>
                      </div>
                    ) : null}
                    <div
                      ref={(el) => {
                        gridContainersRefs.current[id] = el;
                      }}
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parameter Comparison Table */}
          <div className={`relative flex-1 min-h-0 bg-black/40 border border-white/10 rounded-xl flex-col overflow-hidden ${compareView === "table" ? "flex" : "hidden"}`}>
            <div className="p-3 pb-2 border-b border-white/10 shrink-0 bg-white/[0.02]">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-200">
                Parameter Comparison
              </h4>
            </div>
            <div className="flex-1 min-h-0 w-full overflow-auto select-yCustomScroll select-xCustomScroll">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead className="bg-white/[0.02] border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-[#0c0d12]/90 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] sticky left-0 z-20 backdrop-blur-md">Parameter</th>
                    {comparedIds.map((id, idx) => {
                      const palette = PALETTES[idx % PALETTES.length];
                      return (
                        <th key={id} className="p-3 text-xs font-mono font-bold text-slate-200 border-l border-white/5 bg-[#0c0d12]/90 backdrop-blur-md">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: palette.g }}
                            />
                            {id}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "k_energy", label: "Kinetic Energy (foe)", digits: 2 },
                    { key: "ni56", label: "Ni56 Mass (M☉)", digits: 3 },
                    { key: "zams", label: "Progenitor Mass (M☉)", digits: 1 },
                    { key: "mloss_rate", label: "Mass Loss (idx)", digits: 2 },
                    { key: "beta", label: "Beta", digits: 2 },
                    { key: "t_exp", label: "t_exp (days)", digits: 2 },
                    { key: "A_v", label: "A_v (mag)", digits: 2 },
                    { key: "logZ", label: "logZ (dex)", digits: 2 },
                    { key: "reduced_chi2", label: "Reduced Chi2", digits: 2 }
                  ].map((param) => (
                    <tr key={param.key} className="border-b border-white/5 even:bg-white/[0.02] hover:bg-white/[0.05] transition-colors group">
                      <td className="p-3 text-[11px] text-slate-400 font-mono tracking-wider font-semibold whitespace-nowrap bg-transparent group-even:bg-white/[0.02] group-hover:bg-white/[0.05] shadow-[1px_0_0_0_rgba(255,255,255,0.05)] sticky left-0 z-10">
                        {param.label}
                      </td>
                      {comparedIds.map((id) => {
                        const metadata = metaMap[id];
                        const p = metadata?.inferred_parameters;
                        if (!p) {
                          return (
                            <td key={id} className="p-3 border-l border-white/5">
                              <span className="text-slate-600 font-mono text-[11px]">N/A</span>
                            </td>
                          );
                        }

                        // @ts-ignore
                        const val = p[param.key] as number | undefined | null;
                        // @ts-ignore
                        const pctPlus = p[`${param.key}_pct_plus`] as number | undefined | null;
                        // @ts-ignore
                        const pctMinus = p[`${param.key}_pct_minus`] as number | undefined | null;

                        return (
                          <td key={id} className="p-3 align-top border-l border-white/5">
                            <div className="flex flex-col">
                              <span className="text-slate-200 font-mono font-bold text-[13px]">
                                {val !== null && val !== undefined ? val.toFixed(param.digits) : "N/A"}
                              </span>
                              {pctPlus !== null && pctPlus !== undefined && pctMinus !== null && pctMinus !== undefined ? (
                                <div className="flex flex-col text-[10px] font-mono leading-[1.3] mt-1 shrink-0">
                                  <span className="text-emerald-400">+{pctPlus.toFixed(1)}%</span>
                                  <span className="text-rose-400">-{pctMinus.toFixed(1)}%</span>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
