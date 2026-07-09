import React, { useMemo } from "react";
import { SupernovaSummary } from "../types";

export type SortOption = "id" | "redshift" | "k_energy" | "plateau_duration";
export type SortDirection = "asc" | "desc";

interface FilterState {
  sortBy: SortOption;
  sortDirection: SortDirection;
  searchId: string;
  onlyWithLc: boolean;
  minRedshift: string;
  maxRedshift: string;
  minEnergy: string;
  maxEnergy: string;
  minPlateau: string;
  maxPlateau: string;
  minZams: string;
  maxZams: string;
  minNi56: string;
  maxNi56: string;
  minAv: string;
  maxAv: string;
  minLuminosity: string;
  maxLuminosity: string;
  paramMatchMode: "AND" | "OR";
  maxRedshiftVal: number;
  anomalyMatchMode: "AND" | "OR";
  // Individual anomaly categories
  morphology: {
    early_rise_excess: boolean;
    arrested_cooling: boolean;
    plateau_extension: boolean;
    plateau_rebrightening: boolean;
    precursor_detection: boolean;
  };
  composition: {
    peak_brightness_excess: boolean;
    nickel_overabundance: boolean;
  };
  bivariate_outliers: {
    mloss_ek_magnetar: boolean;
    ek_ni_pair_instability: boolean;
    texp_beta_diffusion: boolean;
    logz_av_dust: boolean;
  };
  multivariate_clusters_3d: {
    energy_engine: boolean;
    progenitor_evolution: boolean;
    modeling_degeneracy: boolean;
    ejecta_efficiency: boolean;
    lc_morphology: boolean;
  };
}

interface AstroFiltersProps {
  supernovae: SupernovaSummary[];
  filters: FilterState;
  onChange: (updater: (prev: FilterState) => FilterState) => void;
  onReset: () => void;
  totalCount: number;
  matchedCount: number;
  compact?: boolean;
}

export default function AstroFilters({
  supernovae,
  filters,
  onChange,
  onReset,
  totalCount,
  matchedCount,
  compact = false,
}: AstroFiltersProps) {
  const toggleMorphology = (key: keyof FilterState["morphology"]) => {
    onChange((prev) => ({
      ...prev,
      morphology: {
        ...prev.morphology,
        [key]: !prev.morphology[key],
      },
    }));
  };

  const toggleComposition = (key: keyof FilterState["composition"]) => {
    onChange((prev) => ({
      ...prev,
      composition: {
        ...prev.composition,
        [key]: !prev.composition[key],
      },
    }));
  };

  const toggleBivariate = (key: keyof FilterState["bivariate_outliers"]) => {
    onChange((prev) => ({
      ...prev,
      bivariate_outliers: {
        ...prev.bivariate_outliers,
        [key]: !prev.bivariate_outliers[key],
      },
    }));
  };

  const toggleMultivariate = (key: keyof FilterState["multivariate_clusters_3d"]) => {
    onChange((prev) => ({
      ...prev,
      multivariate_clusters_3d: {
        ...prev.multivariate_clusters_3d,
        [key]: !prev.multivariate_clusters_3d[key],
      },
    }));
  };

  // Helper to count how many checkboxes are active in the whole system
  const getActiveFilterCount = () => {
    let count = 0;
    Object.values(filters.morphology).forEach((v) => v && count++);
    Object.values(filters.composition).forEach((v) => v && count++);
    Object.values(filters.bivariate_outliers).forEach((v) => v && count++);
    Object.values(filters.multivariate_clusters_3d).forEach((v) => v && count++);
    return count;
  };

  const activeCheckpointCount = getActiveFilterCount();

  const anomalyCounts = useMemo(() => {
    const counts = {
      morphology: { early_rise_excess: 0, arrested_cooling: 0, plateau_extension: 0, plateau_rebrightening: 0, precursor_detection: 0 },
      composition: { peak_brightness_excess: 0, nickel_overabundance: 0 },
      bivariate_outliers: { mloss_ek_magnetar: 0, ek_ni_pair_instability: 0, texp_beta_diffusion: 0, logz_av_dust: 0 },
      multivariate_clusters_3d: { energy_engine: 0, progenitor_evolution: 0, modeling_degeneracy: 0, ejecta_efficiency: 0, lc_morphology: 0 },
    };

    supernovae.forEach((s) => {
      if (!s.anomalies) return;
      Object.keys(counts.morphology).forEach(k => { if ((s.anomalies.morphology as any)[k]) counts.morphology[k as keyof typeof counts.morphology]++; });
      Object.keys(counts.composition).forEach(k => { if ((s.anomalies.composition as any)[k]) counts.composition[k as keyof typeof counts.composition]++; });
      Object.keys(counts.bivariate_outliers).forEach(k => { if ((s.anomalies.bivariate_outliers as any)[k]) counts.bivariate_outliers[k as keyof typeof counts.bivariate_outliers]++; });
      Object.keys(counts.multivariate_clusters_3d).forEach(k => { if ((s.anomalies.multivariate_clusters_3d as any)[k]) counts.multivariate_clusters_3d[k as keyof typeof counts.multivariate_clusters_3d]++; });
    });
    return counts;
  }, [supernovae]);

  const morphSum = (Object.values(anomalyCounts.morphology) as number[]).reduce((a, b) => a + b, 0);
  const compSum = (Object.values(anomalyCounts.composition) as number[]).reduce((a, b) => a + b, 0);
  const bivSum = (Object.values(anomalyCounts.bivariate_outliers) as number[]).reduce((a, b) => a + b, 0);
  const multiSum = (Object.values(anomalyCounts.multivariate_clusters_3d) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className={`bg-black/60 border border-white/10 rounded-xl backdrop-blur-md flex flex-col justify-start transition-all duration-300 flex-1 ${
      compact ? "p-3.5 gap-3.5" : "p-5 gap-5"
    }`}>
      {/* Numerical physical parameters */}
      <div className="flex flex-col gap-4">

          {/* Redshift row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Redshift (z)</span>
              <span className="text-[9px] text-slate-600 font-mono">z_val</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.001"
                value={filters.minRedshift}
                placeholder="Min (e.g. 0.01)"
                onChange={(e) => onChange((prev) => ({ ...prev, minRedshift: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="0.001"
                value={filters.maxRedshift}
                placeholder="Max (e.g. 0.09)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxRedshift: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Kinetic Energy row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Kinetic Energy (E_k)</span>
              <span className="text-[9px] text-slate-600 font-mono">foe (10^51 erg)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.1"
                value={filters.minEnergy}
                placeholder="Min (e.g. 0.5)"
                onChange={(e) => onChange((prev) => ({ ...prev, minEnergy: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="0.1"
                value={filters.maxEnergy}
                placeholder="Max (e.g. 2.5)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxEnergy: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Plateau Duration row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Plateau Duration</span>
              <span className="text-[9px] text-slate-600 font-mono">days</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="1"
                value={filters.minPlateau}
                placeholder="Min (e.g. 60)"
                onChange={(e) => onChange((prev) => ({ ...prev, minPlateau: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="1"
                value={filters.maxPlateau}
                placeholder="Max (e.g. 110)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxPlateau: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Luminosity Excess (Peak Lum) row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Luminosity Excess</span>
              <span className="text-[9px] text-slate-600 font-mono">mag</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.5"
                value={filters.minLuminosity}
                placeholder="Min (e.g. -20)"
                onChange={(e) => onChange((prev) => ({ ...prev, minLuminosity: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="0.5"
                value={filters.maxLuminosity}
                placeholder="Max (e.g. -15)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxLuminosity: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Progenitor Mass row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Progenitor Mass (ZAMS)</span>
              <span className="text-[9px] text-slate-600 font-mono">M☉</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.5"
                value={filters.minZams}
                placeholder="Min (e.g. 12)"
                onChange={(e) => onChange((prev) => ({ ...prev, minZams: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="0.5"
                value={filters.maxZams}
                placeholder="Max (e.g. 25)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxZams: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Dust Extinction row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Dust Extinction (A_v)</span>
              <span className="text-[9px] text-slate-600 font-mono">mag</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.05"
                value={filters.minAv}
                placeholder="Min (e.g. 0.05)"
                onChange={(e) => onChange((prev) => ({ ...prev, minAv: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="0.05"
                value={filters.maxAv}
                placeholder="Max (e.g. 0.85)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxAv: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Nickel Yield row */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Nickel Yield (m_ni)</span>
              <span className="text-[9px] text-slate-600 font-mono">M☉</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={filters.minNi56}
                placeholder="Min (e.g. 0.02)"
                onChange={(e) => onChange((prev) => ({ ...prev, minNi56: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="number"
                step="0.01"
                value={filters.maxNi56}
                placeholder="Max (e.g. 0.15)"
                onChange={(e) => onChange((prev) => ({ ...prev, maxNi56: e.target.value }))}
                className="w-full bg-black/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>
        </div>
      {/* Category: Morphology */}
      {morphSum > 0 && (
      <details className="border-t border-white/10 pt-3 group" open={!compact}>
        <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] font-bold text-violet-400 font-display uppercase tracking-widest select-none outline-none mb-1.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block text-[8px]">▶</span>
            Lightcurve Morphology
          </span>
          {Object.values(filters.morphology).filter(Boolean).length > 0 && (
            <span className="text-[9px] bg-violet-400/20 text-violet-300 font-mono px-1.5 py-0.5 rounded-full leading-none">
              {Object.values(filters.morphology).filter(Boolean).length}
            </span>
          )}
        </summary>
        <div className="flex flex-col gap-2 pl-2.5 pt-1">
          {anomalyCounts.morphology.early_rise_excess > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.morphology.early_rise_excess}
              onChange={() => toggleMorphology("early_rise_excess")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Early Rise Excess <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.morphology.early_rise_excess})</span></span>
          </label>
          )}
          {anomalyCounts.morphology.arrested_cooling > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.morphology.arrested_cooling}
              onChange={() => toggleMorphology("arrested_cooling")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Arrested Cooling <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.morphology.arrested_cooling})</span></span>
          </label>
          )}
          {anomalyCounts.morphology.plateau_extension > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.morphology.plateau_extension}
              onChange={() => toggleMorphology("plateau_extension")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Plateau Extension <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.morphology.plateau_extension})</span></span>
          </label>
          )}
          {anomalyCounts.morphology.plateau_rebrightening > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.morphology.plateau_rebrightening}
              onChange={() => toggleMorphology("plateau_rebrightening")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Plateau Rebrightening <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.morphology.plateau_rebrightening})</span></span>
          </label>
          )}
          {anomalyCounts.morphology.precursor_detection > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.morphology.precursor_detection}
              onChange={() => toggleMorphology("precursor_detection")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Precursor Detection <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.morphology.precursor_detection})</span></span>
          </label>
          )}
        </div>
      </details>
      )}

      {/* Category: Composition */}
      {compSum > 0 && (
      <details className="border-t border-white/10 pt-3 group" open={!compact}>
        <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] font-bold text-pink-400 font-display uppercase tracking-widest select-none outline-none mb-1.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block text-[8px]">▶</span>
            Chemical Composition
          </span>
          {Object.values(filters.composition).filter(Boolean).length > 0 && (
            <span className="text-[9px] bg-pink-400/20 text-pink-300 font-mono px-1.5 py-0.5 rounded-full leading-none">
              {Object.values(filters.composition).filter(Boolean).length}
            </span>
          )}
        </summary>
        <div className="flex flex-col gap-2 pl-2.5 pt-1">
          {anomalyCounts.composition.peak_brightness_excess > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.composition.peak_brightness_excess}
              onChange={() => toggleComposition("peak_brightness_excess")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Peak Brightness Excess <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.composition.peak_brightness_excess})</span></span>
          </label>
          )}
          {anomalyCounts.composition.nickel_overabundance > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.composition.nickel_overabundance}
              onChange={() => toggleComposition("nickel_overabundance")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Nickel-56 Overabundance <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.composition.nickel_overabundance})</span></span>
          </label>
          )}
        </div>
      </details>
      )}

      {/* Category: Bivariate Outliers */}
      {bivSum > 0 && (
      <details className="border-t border-white/10 pt-3 group" open={!compact}>
        <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] font-bold text-blue-400 font-display uppercase tracking-widest select-none outline-none mb-1.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block text-[8px]">▶</span>
            Extreme Bivariate Outliers
          </span>
          {Object.values(filters.bivariate_outliers).filter(Boolean).length > 0 && (
            <span className="text-[9px] bg-blue-400/20 text-blue-300 font-mono px-1.5 py-0.5 rounded-full leading-none">
              {Object.values(filters.bivariate_outliers).filter(Boolean).length}
            </span>
          )}
        </summary>
        <div className="flex flex-col gap-2 pl-2.5 pt-1">
          {anomalyCounts.bivariate_outliers.mloss_ek_magnetar > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.bivariate_outliers.mloss_ek_magnetar}
              onChange={() => toggleBivariate("mloss_ek_magnetar")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>(Ṁ × Ek) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.bivariate_outliers.mloss_ek_magnetar})</span></span>
          </label>
          )}
          {anomalyCounts.bivariate_outliers.ek_ni_pair_instability > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.bivariate_outliers.ek_ni_pair_instability}
              onChange={() => toggleBivariate("ek_ni_pair_instability")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>(Ek × 56Ni) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.bivariate_outliers.ek_ni_pair_instability})</span></span>
          </label>
          )}
          {anomalyCounts.bivariate_outliers.texp_beta_diffusion > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.bivariate_outliers.texp_beta_diffusion}
              onChange={() => toggleBivariate("texp_beta_diffusion")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>(texp × β) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.bivariate_outliers.texp_beta_diffusion})</span></span>
          </label>
          )}
          {anomalyCounts.bivariate_outliers.logz_av_dust > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.bivariate_outliers.logz_av_dust}
              onChange={() => toggleBivariate("logz_av_dust")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>(log Z × AV) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.bivariate_outliers.logz_av_dust})</span></span>
          </label>
          )}
        </div>
      </details>
      )}

      {/* Category: 3D Multivariate Clusters */}
      {multiSum > 0 && (
      <details className="border-t border-white/10 pt-3 group" open={!compact}>
        <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] font-bold text-emerald-400 font-display uppercase tracking-widest select-none outline-none mb-1.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <span className="transition-transform duration-200 group-open:rotate-90 inline-block text-[8px]">▶</span>
            Multivariate Clusters (3D)
          </span>
          {Object.values(filters.multivariate_clusters_3d).filter(Boolean).length > 0 && (
            <span className="text-[9px] bg-emerald-400/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded-full leading-none">
              {Object.values(filters.multivariate_clusters_3d).filter(Boolean).length}
            </span>
          )}
        </summary>
        <div className="flex flex-col gap-2 pl-2.5 pt-1">
          {anomalyCounts.multivariate_clusters_3d.energy_engine > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.multivariate_clusters_3d.energy_engine}
              onChange={() => toggleMultivariate("energy_engine")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Energy Engine (Ek × Ṁ × 56Ni) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.multivariate_clusters_3d.energy_engine})</span></span>
          </label>
          )}
          {anomalyCounts.multivariate_clusters_3d.progenitor_evolution > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.multivariate_clusters_3d.progenitor_evolution}
              onChange={() => toggleMultivariate("progenitor_evolution")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Progenitor Evolution (ZAMS × Ṁ × log Z) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.multivariate_clusters_3d.progenitor_evolution})</span></span>
          </label>
          )}
          {anomalyCounts.multivariate_clusters_3d.modeling_degeneracy > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.multivariate_clusters_3d.modeling_degeneracy}
              onChange={() => toggleMultivariate("modeling_degeneracy")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Modeling Degeneracy (AV × texp × log Z) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.multivariate_clusters_3d.modeling_degeneracy})</span></span>
          </label>
          )}
          {anomalyCounts.multivariate_clusters_3d.ejecta_efficiency > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.multivariate_clusters_3d.ejecta_efficiency}
              onChange={() => toggleMultivariate("ejecta_efficiency")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Ejecta Efficiency (Ek × Ṁ × β) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.multivariate_clusters_3d.ejecta_efficiency})</span></span>
          </label>
          )}
          {anomalyCounts.multivariate_clusters_3d.lc_morphology > 0 && (
          <label className="flex items-center text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.multivariate_clusters_3d.lc_morphology}
              onChange={() => toggleMultivariate("lc_morphology")}
              className="mr-2.5 rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>LC Morphology (texp × 56Ni × AV) <span className="text-slate-500 font-mono text-[10px] ml-1">({anomalyCounts.multivariate_clusters_3d.lc_morphology})</span></span>
          </label>
          )}
        </div>
      </details>
      )}

      {/* Summary count panel / Reset button */}
      <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-500">Selected:</span>
          <span className="text-slate-200">
            {matchedCount} / <span className="text-slate-500">{totalCount} objects</span>
          </span>
        </div>
        <button
          onClick={onReset}
          className="w-full bg-white/5 hover:bg-amber-500/15 hover:text-amber-400 border border-white/10 rounded-lg py-2.5 text-xs font-semibold tracking-widest text-slate-300 hover:border-amber-500/30 transition-colors uppercase font-display cursor-pointer"
        >
          Reset Work Filters
        </button>
      </div>
    </div>
  );
}
