import re

with open('/Users/medhansh29/REFITT-User-Portal/Frontend/src/components/LightCurveCompare.tsx', 'r') as f:
    content = f.read()

# 1. Remove activeBand conditions
content = content.replace('&& (activeBand === "both" || activeBand === "g")', '')
content = content.replace('&& (activeBand === "both" || activeBand === "r")', '')

# 2. Fix dependency arrays
content = content.replace(', activeBand]);', ']);')

# 3. Inject axis indices for g-band
content = content.replace('''          name: fitName,
          type: "line",''', '''          name: fitName,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,''', 1) # Only first occurrence (overlay)

content = content.replace('''          name: `${id} (g 1σ)`,
          type: "custom",''', '''          name: `${id} (g 1σ)`,
          type: "custom",
          xAxisIndex: 0,
          yAxisIndex: 0,''', 1)

content = content.replace('''            name: obsGName,
            type: "scatter",''', '''            name: obsGName,
            type: "scatter",
            xAxisIndex: 0,
            yAxisIndex: 0,''', 1)

# 4. Inject axis indices for r-band
# The second fitName match is r-band
content = content.replace('''          name: fitName,
          type: "line",''', '''          name: fitName,
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,''', 1)

content = content.replace('''          name: `${id} (r 1σ)`,
          type: "custom",''', '''          name: `${id} (r 1σ)`,
          type: "custom",
          xAxisIndex: 1,
          yAxisIndex: 1,''', 1)

content = content.replace('''            name: obsRName,
            type: "scatter",''', '''            name: obsRName,
            type: "scatter",
            xAxisIndex: 1,
            yAxisIndex: 1,''', 1)

# 5. Grid, xAxis, yAxis, dataZoom replacement
grid_replacement = """      grid: [
        { left: "3%", right: "52%", bottom: "18%", top: "12%", containLabel: true },
        { left: "52%", right: "3%", bottom: "18%", top: "12%", containLabel: true }
      ],
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: [0, 1],
          bottom: 40,
          height: 18,
          borderColor: "rgba(255,255,255,0.06)",
          fillerColor: "rgba(245, 158, 11, 0.05)",
          handleStyle: { color: "#f59e0b" },
          textStyle: { color: "#64748b", fontSize: 9 },
          startValue: xMin,
          endValue: xMax,
        },
        { type: "inside", xAxisIndex: [0, 1] },
      ],
      xAxis: [
        {
          gridIndex: 0,
          type: "value",
          name: alignMode === "rest_frame" ? "Rest Frame Phase (t - t_exp) [days]" : "Modified Julian Date (MJD)",
          nameLocation: "middle",
          nameGap: 24,
          min: xMin,
          max: xMax,
          splitLine: { show: false },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10 },
        },
        {
          gridIndex: 1,
          type: "value",
          name: alignMode === "rest_frame" ? "Rest Frame Phase (t - t_exp) [days]" : "Modified Julian Date (MJD)",
          nameLocation: "middle",
          nameGap: 24,
          min: xMin,
          max: xMax,
          splitLine: { show: false },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10 },
        }
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: "value",
          name: "Absolute Magnitude (g-band)",
          nameLocation: "middle",
          nameGap: 36,
          inverse: true,
          min: yMin,
          max: yMax,
          splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)", type: "dashed" } },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10 },
        },
        {
          gridIndex: 1,
          type: "value",
          name: "Absolute Magnitude (r-band)",
          nameLocation: "middle",
          nameGap: 36,
          inverse: true,
          min: yMin,
          max: yMax,
          splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)", type: "dashed" } },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
          axisLabel: { color: "#94a3b8", fontFamily: "JetBrains Mono", fontSize: 10 },
        }
      ],"""

# Find the block in overlay mode
pattern = r'      grid: {.*?yAxis: {.*?},'
content = re.sub(r'      grid: {.*?yAxis: {.*?},', grid_replacement, content, count=1, flags=re.DOTALL)

with open('/Users/medhansh29/REFITT-User-Portal/Frontend/src/components/LightCurveCompare.tsx', 'w') as f:
    f.write(content)
