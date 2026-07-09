import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { LightCurve, Observation, BandData } from "../types";

interface LightCurveChartProps {
  data: LightCurve | null;
  loading: boolean;
  objectId: string;
}

const COLOR_G = "#2ecc71";
const COLOR_R = "#e74c3c";

// Helper: Strips pre-explosion MCMC artifacts (mag > limit) from a model-fit band in sync.
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

// Helper: Linearly interpolates a value from a sorted (mjd, values) pair at targetMjd.
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

// Helper: Builds scatter + error-bar series for raw forced photometry observations.
function buildObsSeries(filterLabel: "g" | "r", obs: Observation[], color: string) {
  const filtered = obs.filter((o) => o.filter === filterLabel);
  if (filtered.length === 0) return [];

  return [
    // ── Scatter dots ───────────────────────────────────────────────────────
    {
      name: `${filterLabel}-band obs`,
      type: "scatter",
      symbolSize: 9,
      itemStyle: { color, borderColor: "#000", borderWidth: 1.2 },
      data: filtered.map((o) => [o.mjd, o.mag]),
      z: 10,
    },
    // ── Error bars (vertical line + end ticks) ─────────────────────────────
    {
      name: `${filterLabel}-band obs err`,
      type: "custom",
      clip: true,
      renderItem(params: any, api: any) {
        const mjd = api.value(0);
        const mag = api.value(1);
        const magerr = api.value(2);

        const centre = api.coord([mjd, mag]);
        const top = api.coord([mjd, mag - magerr]); // brighter (lower number)
        const bot = api.coord([mjd, mag + magerr]); // dimmer  (higher number)
        const TICK = 4; // half-width of the end-cap tick in pixels

        return {
          type: "group",
          children: [
            // Vertical stem
            {
              type: "line",
              shape: { x1: centre[0], y1: top[1], x2: centre[0], y2: bot[1] },
              style: { stroke: color, lineWidth: 1.5, opacity: 0.85 },
            },
            // Top tick (bright end)
            {
              type: "line",
              shape: {
                x1: centre[0] - TICK,
                y1: top[1],
                x2: centre[0] + TICK,
                y2: top[1],
              },
              style: { stroke: color, lineWidth: 1.5, opacity: 0.85 },
            },
            // Bottom tick (faint end)
            {
              type: "line",
              shape: {
                x1: centre[0] - TICK,
                y1: bot[1],
                x2: centre[0] + TICK,
                y2: bot[1],
              },
              style: { stroke: color, lineWidth: 1.5, opacity: 0.85 },
            },
          ],
        };
      },
      // [mjd, mag, magerr] — third value drives the error bar extent
      data: filtered.map((o) => [o.mjd, o.mag, o.magerr]),
      tooltip: { show: false },
      legendHoverLink: false,
      z: 9,
    },
  ];
}

// Helper: Builds the ECharts series for one photometric band's 1σ error envelope + median line.
function buildBandSeries(label: "g" | "r", bandData: BandData, color: string) {
  const fillColor =
    color === COLOR_G ? "rgba(46, 204, 113, 0.18)" : "rgba(231, 76, 60, 0.18)";

  return [
    // ── 1σ Error Envelope (Custom Polygon Array) ─────────────────────────
    {
      name: `${label}-band 1σ`,
      type: "custom",
      itemStyle: { color: fillColor },
      clip: true, // Prevents shading from bleeding over axes when zoomed
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
          style: {
            fill: fillColor,
            stroke: "none",
          },
        };
      },
      data: bandData.mjd.map((mjd, idx) => [
        mjd,
        bandData.upper_16th[idx],
        bandData.lower_84th[idx],
      ]),
      tooltip: { show: false },
      z: 2,
    },
    // ── Median Fit Line ──────────────────────────────────────────────────
    {
      name: `${label}-band median`,
      type: "line",
      smooth: true,
      symbol: "none",
      itemStyle: { color },
      lineStyle: { color, width: 2.5 },
      data: bandData.mjd.map((mjd, i) => [mjd, bandData.median[i]]),
      z: 5,
    },
  ];
}

export default function LightCurveChart({ data, loading, objectId }: LightCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize ECharts instance on theme 'dark'
    let chart = echarts.getInstanceByDom(containerRef.current);
    if (!chart) {
      chart = echarts.init(containerRef.current, "dark", {
        renderer: "canvas",
      });
    }
    chartInstanceRef.current = chart;

    const handleResize = () => {
      chart?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    if (loading) {
      chart.showLoading({
        text: "FETCHING ASTRO DATA...",
        color: "#f59e0b",
        textColor: "#f59e0b",
        maskColor: "rgba(2, 2, 4, 0.85)",
        zlevel: 100,
      });
      return;
    }

    chart.hideLoading();

    if (!data) {
      // Clear chart and render elegant placeholder text
      chart.clear();
      chart.setOption({
        backgroundColor: "transparent",
        title: {
          text: "No detailed light curve model fit available for this object.",
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

    chart.clear();

    const obs = data.observations || [];
    const series: any[] = [];

    // Sanitize bands using limits
    const gBandSanitized = data.model_fit?.g_band
      ? sanitizeBand(data.model_fit.g_band)
      : null;
    const rBandSanitized = data.model_fit?.r_band
      ? sanitizeBand(data.model_fit.r_band)
      : null;

    // Populate g-band custom median, envelope, scatter observations, and error ranges
    if (gBandSanitized && gBandSanitized.mjd.length > 0) {
      series.push(...buildBandSeries("g", gBandSanitized, COLOR_G));
    }
    if (obs.some((o) => o.filter === "g")) {
      series.push(...buildObsSeries("g", obs, COLOR_G));
    }

    // Populate r-band custom median, envelope, scatter observations, and error ranges
    if (rBandSanitized && rBandSanitized.mjd.length > 0) {
      series.push(...buildBandSeries("r", rBandSanitized, COLOR_R));
    }
    if (obs.some((o) => o.filter === "r")) {
      series.push(...buildObsSeries("r", obs, COLOR_R));
    }

    // Compute exact limits to ensure raw data and models are never cropped
    const MAG_PAD = 0.4;
    const allMjdList = [
      ...(gBandSanitized?.mjd || []),
      ...(rBandSanitized?.mjd || []),
      ...obs.map((o) => o.mjd),
    ];

    const xMin = allMjdList.length > 0 ? Math.min(...allMjdList) - 3 : 60800;
    const xMax = allMjdList.length > 0 ? Math.max(...allMjdList) + 3 : 61050;

    const allUpperList = [
      ...(gBandSanitized?.upper_16th || []),
      ...(rBandSanitized?.upper_16th || []),
      ...obs.map((o) => o.mag - o.magerr),
    ];
    const allLowerList = [
      ...(gBandSanitized?.lower_84th || []),
      ...(rBandSanitized?.lower_84th || []),
      ...obs.map((o) => o.mag + o.magerr),
    ];

    const yAxisMin = allUpperList.length > 0 ? Math.min(...allUpperList) - MAG_PAD : -20.0;
    const calculatedMax = allLowerList.length > 0 ? Math.max(...allLowerList) + MAG_PAD : -12.0;
    const yAxisMax = Math.min(calculatedMax, -10.0);

    const option = {
      backgroundColor: "transparent",
      title: {
        show: false // Removed entirely since context is clear from main header
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderColor: "#1e293b",
        borderWidth: 1,
        textStyle: { color: "#e5e7eb", fontSize: 12 },
        axisPointer: { type: "line" },
        // Custom linear interpolation tooltip across both band alignment grids
        formatter(params: any[]) {
          const hoveredMjd = parseFloat(params[0]?.axisValue);
          if (isNaN(hoveredMjd)) return "";

          let html = `<div style="font-family:JetBrains Mono,monospace;font-weight:bold;margin-bottom:6px;font-size:12px;color:#9ca3af;">
              MJD Epoch: ${hoveredMjd.toFixed(4)}
            </div>`;

          if (gBandSanitized) {
            const med = interpolate(gBandSanitized.mjd, gBandSanitized.median, hoveredMjd);
            const u = interpolate(gBandSanitized.mjd, gBandSanitized.upper_16th, hoveredMjd);
            const l = interpolate(gBandSanitized.mjd, gBandSanitized.lower_84th, hoveredMjd);
            if (med != null) {
              const err = l != null && u != null
                ? ` <span style="color:#6b7280;font-size:11px;">±${((l - u) / 2).toFixed(3)}</span>`
                : "";
              html += `<div style="line-height:1.8;font-family:sans-serif;">
                  <span style="display:inline-block;border-radius:50%;width:8px;height:8px;
                               background:${COLOR_G};margin-right:6px;"></span>
                  g-band fit: <b>${med.toFixed(3)}</b>${err}
                </div>`;
            }
          }

          if (rBandSanitized) {
            const med = interpolate(rBandSanitized.mjd, rBandSanitized.median, hoveredMjd);
            const u = interpolate(rBandSanitized.mjd, rBandSanitized.upper_16th, hoveredMjd);
            const l = interpolate(rBandSanitized.mjd, rBandSanitized.lower_84th, hoveredMjd);
            if (med != null) {
              const err = l != null && u != null
                ? ` <span style="color:#6b7280;font-size:11px;">±${((l - u) / 2).toFixed(3)}</span>`
                : "";
              html += `<div style="line-height:1.8;font-family:sans-serif;">
                  <span style="display:inline-block;border-radius:50%;width:8px;height:8px;
                               background:${COLOR_R};margin-right:6px;"></span>
                  r-band fit: <b>${med.toFixed(3)}</b>${err}
                </div>`;
            }
          }

          // Fetch nearby observations (faint dots) within ±1.5 days to inspect error offsets
          const nearby = obs.filter((o) => Math.abs(o.mjd - hoveredMjd) < 1.5);
          if (nearby.length > 0) {
            html += `<div style="margin-top:6px;border-top:1px solid #1e293b;padding-top:4px;">`;
            nearby.forEach((o) => {
              const dotColor = o.filter === "g" ? COLOR_G : COLOR_R;
              html += `<div style="line-height:1.7;font-size:11px;">
                  <span style="display:inline-block;border-radius:50%;width:6px;height:6px;
                               background:${dotColor};margin-right:6px;"></span>
                  Observed ${o.filter}-band: <b>${o.mag.toFixed(3)}</b>
                  <span style="color:#6b7280;">±${o.magerr.toFixed(3)}</span>
                </div>`;
            });
            html += `</div>`;
          }

          return html;
        },
      },
      legend: {
        data: [
          "g-band obs",
          "g-band median",
          "r-band obs",
          "r-band median",
        ],
        bottom: "8%",
        right: "3%",
        orient: "vertical",
        backgroundColor: "transparent",
        textStyle: { color: "#9ca3af", fontSize: 11, fontFamily: "Inter" },
      },
      grid: {
        left: 65,
        right: "18%",
        bottom: "10%",
        top: "8%",
        containLabel: true,
      },
      toolbox: {
        show: true,
        top: 15,
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
      xAxis: {
        type: "value",
        name: "Modified Julian Date (MJD)",
        nameLocation: "middle",
        nameGap: 24,
        min: xMin,
        max: xMax,
        splitLine: { show: false },
        axisLine: { lineStyle: { color: "#1e293b" } },
        axisLabel: {
          color: "#9ca3af",
          fontFamily: "JetBrains Mono",
          formatter: (v: number) => v.toFixed(0),
        },
      },
      yAxis: {
        type: "value",
        name: "Absolute Magnitude (mag)",
        nameLocation: "middle",
        nameGap: 45,
        inverse: true, // Lower magnitute is brighter (higher up)
        min: yAxisMin,
        max: yAxisMax,
        splitLine: { lineStyle: { color: "#111827", type: "dashed" } },
        axisLine: { lineStyle: { color: "#1e293b" } },
        axisLabel: {
          color: "#9ca3af",
          fontFamily: "JetBrains Mono",
          formatter: (v: number) => v.toFixed(1),
        },
      },
      series,
    };

    chart.setOption(option, true);
  }, [data, loading, objectId]);

  return (
    <div className="relative w-full h-full min-h-[340px] bg-black/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
      <div id="chart-canvas-container" className="w-full flex-1 min-h-0" ref={containerRef} />
    </div>
  );
}
