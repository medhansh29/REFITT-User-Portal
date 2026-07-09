import React, { useState, useEffect } from "react";
import { SupernovaSummary, LightCurve } from "../types";

interface SupernovaCardProps {
  key?: React.Key;
  item: SupernovaSummary;
  isSelected: boolean;
  onSelect: () => void;
  isCompared: boolean;
  onToggleCompare: () => void;
  onShowHistory?: (objectId: string, paramKey: string, paramLabel: string) => void;
}

// Helper: Strips pre-explosion MCMC artifacts (mag > limit) from a model-fit band.
function sanitizeBand(band: any, limit = 24.0) {
  if (!band || !band.median) {
    return { mjd: [], median: [] };
  }
  const keep = band.median
    .map((mag: number, i: number) => ({ i, mag }))
    .filter(({ mag }) => mag <= limit);

  return {
    mjd: keep.map(({ i }) => band.mjd[i]),
    median: keep.map(({ i }) => band.median[i]),
  };
}

interface MiniPlotProps {
  lightcurve?: LightCurve;
}

function MiniPlot({ lightcurve: lc }: MiniPlotProps) {
  if (!lc) {
    return (
      <div className="text-[10px] font-mono text-slate-600">Plot unavailable</div>
    );
  }

  const g_band = lc.model_fit?.g_band ? sanitizeBand(lc.model_fit.g_band) : null;
  const r_band = lc.model_fit?.r_band ? sanitizeBand(lc.model_fit.r_band) : null;
  const obs = lc.observations || [];
  
  const obs_g = obs.filter(o => o.filter === 'g' && o.mag <= 24.0);
  const obs_r = obs.filter(o => o.filter === 'r' && o.mag <= 24.0);

  const allMjd: number[] = [];
  const allMedian: number[] = [];

  if (g_band) {
    allMjd.push(...g_band.mjd);
    allMedian.push(...g_band.median);
  }
  if (r_band) {
    allMjd.push(...r_band.mjd);
    allMedian.push(...r_band.median);
  }
  obs_g.forEach(o => {
    allMjd.push(o.mjd);
    allMedian.push(o.mag);
  });
  obs_r.forEach(o => {
    allMjd.push(o.mjd);
    allMedian.push(o.mag);
  });

  if (allMjd.length === 0) {
    return <div className="text-[10px] font-mono text-slate-600">No data points</div>;
  }

  const minMjd = Math.min(...allMjd);
  const maxMjd = Math.max(...allMjd);
  const minMag = Math.min(...allMedian);
  const maxMag = Math.min(Math.max(...allMedian), -10); // Cap bottom of y-axis at -10

  const paddingX = 16;
  const paddingY = 16;
  const width = 800; // Increased base width for better resolution in full-width layout
  const height = 180;

  const mapX = (mjd: number) => {
    if (maxMjd === minMjd) return width / 2;
    return paddingX + ((mjd - minMjd) / (maxMjd - minMjd)) * (width - 2 * paddingX);
  };

  const mapY = (mag: number) => {
    if (maxMag === minMag) return height / 2;
    // Lower magnitude means brighter (higher peak), so map minMag to lower Y pixels
    return paddingY + ((mag - minMag) / (maxMag - minMag)) * (height - 2 * paddingY);
  };

  let gPath = "";
  if (g_band && g_band.mjd.length > 0) {
    gPath = g_band.mjd
      .map((mjd, i) => `${i === 0 ? "M" : "L"} ${mapX(mjd).toFixed(1)} ${mapY(g_band.median[i]).toFixed(1)}`)
      .join(" ");
  }

  let rPath = "";
  if (r_band && r_band.mjd.length > 0) {
    rPath = r_band.mjd
      .map((mjd, i) => `${i === 0 ? "M" : "L"} ${mapX(mjd).toFixed(1)} ${mapY(r_band.median[i]).toFixed(1)}`)
      .join(" ");
  }

  return (
    <svg className="w-full h-full pointer-events-none select-none" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <g opacity="0.1" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} strokeDasharray="3,3" />
      </g>
      {gPath && (
        <path
          d={gPath}
          fill="none"
          stroke="#2ecc71"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
      )}
      {rPath && (
        <path
          d={rPath}
          fill="none"
          stroke="#e74c3c"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
      )}
      {obs_g.map((o, idx) => (
        <circle key={`g-${idx}`} cx={mapX(o.mjd)} cy={mapY(o.mag)} r="3" fill="#2ecc71" stroke="#000" strokeWidth="1" />
      ))}
      {obs_r.map((o, idx) => (
        <circle key={`r-${idx}`} cx={mapX(o.mjd)} cy={mapY(o.mag)} r="3" fill="#e74c3c" stroke="#000" strokeWidth="1" />
      ))}
    </svg>
  );
}

export default function SupernovaCard({
  item,
  isSelected,
  onSelect,
  isCompared,
  onToggleCompare,
  onShowHistory,
}: SupernovaCardProps) {
  const { object_id, basic_info, anomalies, has_light_curve, inferred_parameters, lightcurve } = item;

  // Gather active anomalies as tags
  const activeTags: { label: string; color: string }[] = [];

  // Morphology tag helper
  if (anomalies.morphology.early_rise_excess) {
    activeTags.push({ label: "Early Rise", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" });
  }
  if (anomalies.morphology.arrested_cooling) {
    activeTags.push({ label: "Arrested Cooling", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" });
  }
  if (anomalies.morphology.plateau_extension) {
    activeTags.push({ label: "Plat Extension", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" });
  }
  if (anomalies.morphology.plateau_rebrightening) {
    activeTags.push({ label: "Plateau Rebright", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" });
  }
  if (anomalies.morphology.precursor_detection) {
    activeTags.push({ label: "Precursor", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" });
  }

  // Composition tag helper
  if (anomalies.composition.peak_brightness_excess) {
    activeTags.push({ label: "Peak Brightness", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" });
  }
  if (anomalies.composition.nickel_overabundance) {
    activeTags.push({ label: "Ni-56 Overabundant", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" });
  }

  // Bivariate tags
  if (anomalies.bivariate_outliers.mloss_ek_magnetar) {
    activeTags.push({ label: "(Ṁ × Ek)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" });
  }
  if (anomalies.bivariate_outliers.ek_ni_pair_instability) {
    activeTags.push({ label: "(Ek × 56Ni)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" });
  }
  if (anomalies.bivariate_outliers.texp_beta_diffusion) {
    activeTags.push({ label: "(texp × β)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" });
  }
  if (anomalies.bivariate_outliers.logz_av_dust) {
    activeTags.push({ label: "(log Z × AV)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" });
  }

  // Multivariate 3D tags
  if (anomalies.multivariate_clusters_3d.energy_engine) {
    activeTags.push({ label: "Energy Engine (Ek × Ṁ × 56Ni)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" });
  }
  if (anomalies.multivariate_clusters_3d.progenitor_evolution) {
    activeTags.push({ label: "Progenitor Evol (ZAMS × Ṁ × log Z)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" });
  }
  if (anomalies.multivariate_clusters_3d.modeling_degeneracy) {
    activeTags.push({ label: "Degeneracy (AV × texp × log Z)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" });
  }
  if (anomalies.multivariate_clusters_3d.ejecta_efficiency) {
    activeTags.push({ label: "Ejecta Eff (Ek × Ṁ × β)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" });
  }
  if (anomalies.multivariate_clusters_3d.lc_morphology) {
    activeTags.push({ label: "Morphology (texp × 56Ni × AV)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" });
  }

  // Calculate Peak Luminosity (minimum magnitude since scale is inverted)
  let peakLum: number | null = null;
  if (lightcurve) {
    const allMags: number[] = [];
    if (lightcurve.model_fit?.g_band) allMags.push(...lightcurve.model_fit.g_band.median.filter((m: number) => m <= 24.0));
    if (lightcurve.model_fit?.r_band) allMags.push(...lightcurve.model_fit.r_band.median.filter((m: number) => m <= 24.0));
    if (lightcurve.observations) allMags.push(...lightcurve.observations.filter(o => o.mag <= 24.0).map(o => o.mag));
    if (allMags.length > 0) peakLum = Math.min(...allMags);
  }

  const renderParam = (
    label: string,
    key: string,
    val: number | undefined | null,
    pct_plus: number | undefined | null,
    pct_minus: number | undefined | null,
    digits: number,
    unit: string
  ) => {
    const hasHistory = item.parameter_history && item.parameter_history.length > 0;
    const isInteractive = !!(hasHistory && ["zams", "k_energy", "mloss_rate", "beta", "ni56", "t_exp", "A_v", "logZ"].includes(key));

    const handleClick = (e: React.MouseEvent) => {
      if (isInteractive && onShowHistory) {
        e.stopPropagation();
        onShowHistory(item.object_id, key, label);
      }
    };

    return (
      <div 
        onClick={handleClick}
        className={`flex flex-col min-w-0 ${isInteractive ? "cursor-pointer hover:bg-white/[0.05] rounded px-1 py-0.5 transition-colors border border-transparent hover:border-white/5" : ""}`}
        title={isInteractive ? "Click to view convergence history" : undefined}
      >
        <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5 truncate">{label}</span>
        <span className="text-slate-200 font-medium flex items-center gap-1 min-w-0">
          {val !== undefined && val !== null ? (
            <>
              <span className="truncate">{val.toFixed(digits)}</span>
              {unit && <span className="text-[9px] text-slate-500 font-normal">{unit}</span>}
              {pct_plus !== undefined && pct_plus !== null && pct_minus !== undefined && pct_minus !== null && (
                <span className="flex flex-col text-[7px] font-mono leading-none select-none ml-1 shrink-0">
                  <span className="text-emerald-400">+{pct_plus.toFixed(1)}%</span>
                  <span className="text-rose-400">-{pct_minus.toFixed(1)}%</span>
                </span>
              )}
            </>
          ) : "N/A"}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border flex flex-col gap-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30"
          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20"
      }`}
    >
      {/* Header Row: Checkbox, ID, and Tags */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isCompared}
            onClick={(e) => e.stopPropagation()} // stops triggering parent selection or modal triggers
            onChange={(e) => {
              e.stopPropagation();
              onToggleCompare();
            }}
            className="w-4.5 h-4.5 rounded border-white/25 bg-black text-amber-500 focus:ring-0 cursor-pointer transition-all"
          />
          <span className={`font-display text-[15px] tracking-wide font-bold ${
            isSelected ? "text-amber-400" : "text-[#e5e7eb]"
          }`}>
            {object_id}
          </span>
        </div>

        {/* Display active tags */}
        {activeTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
            {activeTags.slice(0, 4).map((tag, idx) => (
              <span
                key={idx}
                className={`text-[9.5px] font-mono font-medium px-2 py-0.5 rounded border ${tag.color} max-w-full truncate`}
              >
                {tag.label}
              </span>
            ))}
            {activeTags.length > 4 && (
              <span className="text-[9px] font-mono text-gray-500 px-1 border border-transparent self-center">
                +{activeTags.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mini Plot Thumbnail (Top, Full Width) */}
      {has_light_curve && (
        <div className="w-full h-[180px] bg-black/50 border border-white/5 hover:border-white/10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative transition-all duration-200">
          <MiniPlot lightcurve={item.lightcurve} />
        </div>
      )}

      {/* Properties & Parameters Grid (Bottom) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-y-3 gap-x-2 text-[11px] font-mono text-[#9ca3af]">
        <div>
          <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5">Discovery</span>
          <span className="text-slate-200 font-medium">{basic_info.discovery_date}</span>
        </div>
        <div>
          <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5">Redshift (z)</span>
          <span className="text-slate-200 font-medium">{basic_info.redshift.toFixed(4)}</span>
        </div>
        <div>
          <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5">Plat. Dur (d)</span>
          <span className="text-slate-200 font-medium">
            {basic_info.plateau_duration_days !== null && basic_info.plateau_duration_days !== undefined ? basic_info.plateau_duration_days.toFixed(1) : "N/A"}
          </span>
        </div>
        <div>
          <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5">Peak Lum (mag)</span>
          <span className="text-slate-200 font-medium">
            {peakLum !== null ? peakLum.toFixed(2) : "N/A"}
          </span>
        </div>
        <div>
          <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5">Observations</span>
          <span className="text-slate-200 font-medium">
            {lightcurve?.observations ? lightcurve.observations.length : 0}
          </span>
        </div>
        {renderParam("E_k (foe)", "k_energy", inferred_parameters?.k_energy, inferred_parameters?.k_energy_pct_plus, inferred_parameters?.k_energy_pct_minus, 2, "")}
        {renderParam("M_Ni (M☉)", "ni56", inferred_parameters?.ni56, inferred_parameters?.ni56_pct_plus, inferred_parameters?.ni56_pct_minus, 3, "")}
        {renderParam("Prog Mass (M☉)", "zams", inferred_parameters?.zams, inferred_parameters?.zams_pct_plus, inferred_parameters?.zams_pct_minus, 1, "")}
        {renderParam("M_loss (idx)", "mloss_rate", inferred_parameters?.mloss_rate, inferred_parameters?.mloss_rate_pct_plus, inferred_parameters?.mloss_rate_pct_minus, 2, "")}
        {renderParam("Beta", "beta", inferred_parameters?.beta, inferred_parameters?.beta_pct_plus, inferred_parameters?.beta_pct_minus, 2, "")}
        {renderParam("t_exp (days)", "t_exp", inferred_parameters?.t_exp, inferred_parameters?.t_exp_pct_plus, inferred_parameters?.t_exp_pct_minus, 2, "")}
        {renderParam("A_v (mag)", "A_v", inferred_parameters?.A_v, inferred_parameters?.A_v_pct_plus, inferred_parameters?.A_v_pct_minus, 2, "")}
        {renderParam("logZ (dex)", "logZ", inferred_parameters?.logZ, inferred_parameters?.logZ_pct_plus, inferred_parameters?.logZ_pct_minus, 2, "")}
        <div>
          <span className="block text-[9.5px] text-slate-500 uppercase tracking-widest mb-0.5">red_chi2</span>
          <span className="text-slate-200 font-medium">
            {inferred_parameters?.reduced_chi2 !== undefined && inferred_parameters.reduced_chi2 !== null ? inferred_parameters.reduced_chi2.toFixed(2) : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}
