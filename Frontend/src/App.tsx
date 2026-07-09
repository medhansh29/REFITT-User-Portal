import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Database,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Info,
  CircleAlert,
  Flame,
  Globe,
  Radio,
  History,
  TrendingUp,
  X,
  Layers,
  Watch,
  Menu,
} from "lucide-react";
import { SupernovaSummary, LightCurve } from "./types";
import AstroFilters from "./components/AstroFilters";
import SupernovaCard from "./components/SupernovaCard";
import LightCurveChart from "./components/LightCurveChart";
import LightCurveCompare from "./components/LightCurveCompare";
import ParameterHistoryChart from "./components/ParameterHistoryChart";

const INITIAL_FILTERS = {
  sortBy: "id" as "id" | "redshift" | "k_energy" | "plateau_duration" | "luminosity",
  sortDirection: "asc" as "asc" | "desc",
  searchId: "",
  onlyWithLc: false,
  minRedshift: "",
  maxRedshift: "",
  minEnergy: "",
  maxEnergy: "",
  minPlateau: "",
  maxPlateau: "",
  minZams: "",
  maxZams: "",
  minNi56: "",
  maxNi56: "",
  minAv: "",
  maxAv: "",
  minLuminosity: "",
  maxLuminosity: "",
  paramMatchMode: "AND" as "AND" | "OR",
  maxRedshiftVal: 0.120,
  anomalyMatchMode: "AND" as "AND" | "OR",
  morphology: {
    early_rise_excess: false,
    arrested_cooling: false,
    plateau_extension: false,
    plateau_rebrightening: false,
    precursor_detection: false,
  },
  composition: {
    peak_brightness_excess: false,
    nickel_overabundance: false,
  },
  bivariate_outliers: {
    mloss_ek_magnetar: false,
    ek_ni_pair_instability: false,
    texp_beta_diffusion: false,
    logz_av_dust: false,
  },
  multivariate_clusters_3d: {
    energy_engine: false,
    progenitor_evolution: false,
    modeling_degeneracy: false,
    ejecta_efficiency: false,
    lc_morphology: false,
  },
};

export default function App() {
  // Core catalog states
  const [supernovae, setSupernovae] = useState<SupernovaSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedLc, setSelectedLc] = useState<LightCurve | null>(null);

  // Comparison module states
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [comparedLcs, setComparedLcs] = useState<{ [id: string]: LightCurve }>({});
  const [comparedLcsLoading, setComparedLcsLoading] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<"single" | "compare">("single");

  // Modal active states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"single" | "compare">("single");

  // Status and fetch loaders
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [lcLoading, setLcLoading] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [lcError, setLcError] = useState<string | null>(null);

  // Active filters State
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // Compare mode Controls State
  const [alignMode, setAlignMode] = useState<"mjd" | "rest_frame">("rest_frame");
  const [showObs, setShowObs] = useState<boolean>(true);
  const [showModels, setShowModels] = useState<boolean>(true);
  const [compareView, setCompareView] = useState<"plots" | "table">("plots");
  const [historyPopup, setHistoryPopup] = useState<{ objectId: string; paramKey: string; paramLabel: string } | null>(null);

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  


  // Measure the sidebar height to dynamically balance/match panels
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState<number | null>(null);

  useEffect(() => {
    // If we wanted to track main container height we could do it here,
    // but the sidebar is now a drawer, so we don't strictly need to sync heights.
  }, []);

  // Fetch all supernovae catalog summary on mount
  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const response = await fetch("data/summary_index.json");
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: Failed to fetch catalog dataset`);
        }
        const data = await response.json();
        setSupernovae(data);
      } catch (err: any) {
        setCatalogError(err.message || "An unresolved network error occurred.");
      } finally {
        setCatalogLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Retrieve individual lightcurve from monolithic state when selection changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedLc(null);
      return;
    }

    const selectedItem = supernovae.find((item) => item.object_id === selectedId);
    
    if (selectedItem && selectedItem.has_light_curve && selectedItem.lightcurve) {
      setSelectedLc(selectedItem.lightcurve);
      setLcError(null);
    } else {
      setSelectedLc(null);
      setLcError(selectedItem && !selectedItem.has_light_curve ? null : "Light curve data missing from payload");
    }
  }, [selectedId, supernovae]);

  // Extract compared lightcurves from payload when comparedIds matches
  useEffect(() => {
    const missingIds = comparedIds.filter((id) => !comparedLcs[id]);
    if (missingIds.length === 0) return;

    setComparedLcs((prev) => {
      const next = { ...prev };
      missingIds.forEach((id) => {
        const item = supernovae.find((s) => s.object_id === id);
        if (item && item.lightcurve) {
          next[id] = item.lightcurve;
        }
      });
      return next;
    });
  }, [comparedIds, comparedLcs, supernovae]);

  const handleToggleCompare = (id: string) => {
    setComparedIds((prev) => {
      const isCurrentlyCompared = prev.includes(id);
      if (isCurrentlyCompared) {
        return prev.filter((x) => x !== id);
      } else {
        // Automatically switch active mode so the user can see their workspace
        setActiveMode("compare");
        return [...prev, id];
      }
    });
  };

  const handleRemoveComparedId = (id: string) => {
    setComparedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleClearAllCompared = () => {
    setComparedIds([]);
    setComparedLcs({});
    setActiveMode("single");
  };

  // Handle resetting all filters and selections
  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSelectedId(null);
    setComparedIds([]);
    setComparedLcs({});
    setActiveMode("single");
  };

  // Compile active selected anomalies list in the current filter state
  const activeAnomalyKeys = useMemo(() => {
    const keys: { category: string; key: string }[] = [];
    Object.entries(filters.morphology).forEach(([k, v]) => v && keys.push({ category: "morphology", key: k }));
    Object.entries(filters.composition).forEach(([k, v]) => v && keys.push({ category: "composition", key: k }));
    Object.entries(filters.bivariate_outliers).forEach(([k, v]) => v && keys.push({ category: "bivariate_outliers", key: k }));
    Object.entries(filters.multivariate_clusters_3d).forEach(([k, v]) => v && keys.push({ category: "multivariate_clusters_3d", key: k }));
    return keys;
  }, [filters]);

  // Filter out catalog records based on dynamic thresholds
  const filteredSupernovae = useMemo(() => {
    const results = supernovae.filter((item) => {
      // 1. Search ID keyword
      if (
        filters.searchId &&
        !item.object_id.toLowerCase().includes(filters.searchId.toLowerCase())
      ) {
        return false;
      }



      // 3. Physical parameters workbench ranges check
      const rangeChecks: boolean[] = [];

      // Redshift (z)
      const redshift = item.basic_info.redshift;
      if (filters.minRedshift !== "") {
        rangeChecks.push(redshift >= parseFloat(filters.minRedshift));
      }
      if (filters.maxRedshift !== "") {
        rangeChecks.push(redshift <= parseFloat(filters.maxRedshift));
      }

      // Kinetic Energy (k_energy)
      const energy = item.inferred_parameters.k_energy;
      if (filters.minEnergy !== "") {
        rangeChecks.push(energy >= parseFloat(filters.minEnergy));
      }
      if (filters.maxEnergy !== "") {
        rangeChecks.push(energy <= parseFloat(filters.maxEnergy));
      }

      // Plateau Duration
      const plateau = item.basic_info.plateau_duration_days;
      if (filters.minPlateau !== "") {
        if (plateau === null) {
          rangeChecks.push(false);
        } else {
          rangeChecks.push(plateau >= parseFloat(filters.minPlateau));
        }
      }
      if (filters.maxPlateau !== "") {
        if (plateau === null) {
          rangeChecks.push(false);
        } else {
          rangeChecks.push(plateau <= parseFloat(filters.maxPlateau));
        }
      }

      // Progenitor Mass (zams)
      const zams = item.inferred_parameters.zams;
      if (filters.minZams !== "") {
        rangeChecks.push(zams >= parseFloat(filters.minZams));
      }
      if (filters.maxZams !== "") {
        rangeChecks.push(zams <= parseFloat(filters.maxZams));
      }

      // Nickel-56 Yield (ni56)
      const ni = item.inferred_parameters.ni56;
      if (filters.minNi56 !== "") {
        rangeChecks.push(ni >= parseFloat(filters.minNi56));
      }
      if (filters.maxNi56 !== "") {
        rangeChecks.push(ni <= parseFloat(filters.maxNi56));
      }

      // Dust Extinction (A_v)
      const av = item.inferred_parameters.A_v;
      if (filters.minAv !== "") {
        rangeChecks.push(av >= parseFloat(filters.minAv));
      }
      if (filters.maxAv !== "") {
        rangeChecks.push(av <= parseFloat(filters.maxAv));
      }

      // Peak Luminosity (Magnitude)
      if (filters.minLuminosity !== "" || filters.maxLuminosity !== "") {
        let peakLum: number | null = null;
        if (item.lightcurve) {
          const allMags: number[] = [];
          if (item.lightcurve.model_fit?.g_band) allMags.push(...item.lightcurve.model_fit.g_band.median.filter((m: number) => m <= 24.0));
          if (item.lightcurve.model_fit?.r_band) allMags.push(...item.lightcurve.model_fit.r_band.median.filter((m: number) => m <= 24.0));
          if (item.lightcurve.observations) allMags.push(...item.lightcurve.observations.filter(o => o.mag <= 24.0).map(o => o.mag));
          if (allMags.length > 0) peakLum = Math.min(...allMags);
        }

        if (peakLum === null) {
          rangeChecks.push(false);
        } else {
          // Keep in mind mag is inverted, but we just do simple numeric bounds
          if (filters.minLuminosity !== "") {
            rangeChecks.push(peakLum >= parseFloat(filters.minLuminosity));
          }
          if (filters.maxLuminosity !== "") {
            rangeChecks.push(peakLum <= parseFloat(filters.maxLuminosity));
          }
        }
      }

      // Combine range checks (Intersection logic only)
      if (rangeChecks.length > 0) {
        if (!rangeChecks.every((val) => val === true)) return false;
      }

      // 4. Anomaly flags correlation filter matching
      if (activeAnomalyKeys.length > 0) {
        const matchResults = activeAnomalyKeys.map(({ category, key }) => {
          const categoryObj = (item.anomalies as any)[category];
          return categoryObj ? categoryObj[key] === true : false;
        });

        // Intersection logic only
        return matchResults.every((val) => val === true);
      }

      return true;
    });

    results.sort((a, b) => {
      let valA: any;
      let valB: any;
      
      switch (filters.sortBy) {
        case "redshift":
          valA = a.basic_info.redshift;
          valB = b.basic_info.redshift;
          break;
        case "k_energy":
          valA = a.inferred_parameters.k_energy;
          valB = b.inferred_parameters.k_energy;
          break;
        case "plateau_duration":
          valA = a.basic_info.plateau_duration_days;
          valB = b.basic_info.plateau_duration_days;
          break;
        case "luminosity": {
          const getPeak = (item: SupernovaSummary) => {
            let peak: number | null = null;
            if (item.lightcurve) {
              const allMags: number[] = [];
              if (item.lightcurve.model_fit?.g_band) allMags.push(...item.lightcurve.model_fit.g_band.median.filter(m => m <= 24.0));
              if (item.lightcurve.model_fit?.r_band) allMags.push(...item.lightcurve.model_fit.r_band.median.filter(m => m <= 24.0));
              if (item.lightcurve.observations) allMags.push(...item.lightcurve.observations.filter(o => o.mag <= 24.0).map(o => o.mag));
              if (allMags.length > 0) peak = Math.min(...allMags);
            }
            return peak;
          };
          valA = getPeak(a);
          valB = getPeak(b);
          break;
        }
        case "id":
        default:
          valA = a.object_id;
          valB = b.object_id;
          break;
      }
      
      if (valA === null || valA === undefined) return filters.sortDirection === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return filters.sortDirection === "asc" ? -1 : 1;
      
      if (valA < valB) {
        if (filters.sortBy === "luminosity") return filters.sortDirection === "asc" ? 1 : -1;
        return filters.sortDirection === "asc" ? -1 : 1;
      }
      if (valA > valB) {
        if (filters.sortBy === "luminosity") return filters.sortDirection === "asc" ? -1 : 1;
        return filters.sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

    return results;
  }, [supernovae, filters, activeAnomalyKeys]);

  // Detailed parameter dictionary of the active chosen supernova
  const selectedSupernova = useMemo(() => {
    return supernovae.find((item) => item.object_id === selectedId) || null;
  }, [supernovae, selectedId]);

  const isPlotOpen = activeMode === "single" ? (selectedId !== "") : (comparedIds.length > 0);

  return (
    <div className="min-h-screen bg-[#020204] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Dynamic Cosmic Banner Header */}
      <header className="border-b border-white/10 bg-black/40 sticky top-0 z-50 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Title & Home Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsFilterDrawerOpen(prev => !prev)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
            title="Toggle Filter Workbench"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleResetFilters}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity text-left group"
            title="Reset all filters and return home"
          >
            <div className="w-9 h-9 rounded-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5 text-black animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-tight text-white font-display flex items-center gap-2.5">
                REFITT-Lite
              </h1>
              <span className="hidden sm:flex text-[10px] bg-white/10 group-hover:bg-amber-500/20 group-hover:text-amber-400 group-hover:border-amber-500/30 text-slate-300 px-2 py-1 rounded border border-white/10 transition-colors uppercase font-bold tracking-wider items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Reset Home
              </span>
            </div>
          </button>
        </div>

        {/* Global physical states */}
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col text-right font-mono">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Catalog Target Range</span>
            <span className="text-xs text-amber-500 font-semibold">{supernovae.length} Core Stellar Events Loaded</span>
          </div>

          <div className="h-8 w-[1px] bg-white/10 hidden lg:block" />
        </div>
      </header>

      {/* Wrapper for Sidebar and Main Content */}
      <div className="flex flex-1 w-full max-w-[1800px] mx-auto overflow-hidden relative">
        
        {/* Push-style Drawer for AstroFilters */}
        <aside 
          className={`shrink-0 transition-all duration-300 ease-in-out flex flex-col border-r border-white/10 bg-[#020204] ${
            isFilterDrawerOpen ? "w-[320px] opacity-100" : "w-0 opacity-0 border-r-0"
          }`}
        >
          <div className="w-[320px] h-full flex flex-col min-h-0">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 sticky top-0 z-10 shrink-0">
              <h2 className="text-sm font-bold tracking-widest text-slate-300 font-display uppercase">
                Filter Workbench
              </h2>
              <button 
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 select-yCustomScroll bg-black/60">
              <AstroFilters
                supernovae={supernovae}
                filters={filters}
                onChange={setFilters}
                onReset={handleResetFilters}
                totalCount={supernovae.length}
                matchedCount={filteredSupernovae.length}
                compact={false}
              />
            </div>
          </div>
        </aside>

        {/* Main Container Dashboard */}
        <main className="flex-1 w-full px-4 md:px-6 py-6 flex flex-col gap-6 overflow-y-auto overflow-x-hidden relative">
        
        {/* Global Control Bar */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filters.searchId}
              placeholder="Search by Object ID (e.g. ZTF25...)"
              onChange={(e) => setFilters((prev) => ({ ...prev, searchId: e.target.value }))}
              className="w-full bg-black/80 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-[#e5e7eb] placeholder-slate-700 focus:outline-none focus:border-amber-500/60 font-mono"
            />
          </div>
          <div className="flex w-full md:w-auto gap-3 items-center">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Sort By
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
              className="bg-black/80 border border-white/10 rounded-lg px-2 py-2 text-xs text-[#e5e7eb] focus:outline-none focus:border-amber-500/60 font-mono min-w-[140px]"
            >
              <option value="id">Object ID</option>
              <option value="redshift">Redshift (z)</option>
              <option value="k_energy">Expl. Energy (E_k)</option>
              <option value="plateau_duration">Plateau Duration</option>
              <option value="luminosity">Luminosity (Mag)</option>
            </select>
            <select
              value={filters.sortDirection}
              onChange={(e) => setFilters(prev => ({ ...prev, sortDirection: e.target.value as any }))}
              className="bg-black/80 border border-white/10 rounded-lg px-2 py-2 text-xs text-[#e5e7eb] focus:outline-none focus:border-amber-500/60 font-mono w-28"
            >
              <option value="asc">Low → High</option>
              <option value="desc">High → Low</option>
            </select>
          </div>
        </div>

        {/* Central Column: Expanded feed of stellar event cards */}
        <section id="catalog-listing" className="w-full flex flex-col">
          <div 
            className="p-4 bg-black/60 border border-white/10 rounded-xl flex flex-col gap-3.5"
            style={{ 
              minHeight: "750px",
              height: "fit-content",
            }}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-widest text-[#9ca3af] font-display uppercase">
                Anomalous Targets ({filteredSupernovae.length})
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                Click a card or thumbnail to launch detailed fit workspace
              </span>
            </div>

            {catalogLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-xs font-mono text-[#9ca3af] tracking-widest uppercase">Loading database catalog...</span>
              </div>
            ) : catalogError ? (
              <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 text-center">
                <CircleAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-xs text-red-300 font-semibold mb-1">Catalog Connection Lost</p>
                <p className="text-[10px] text-red-400 font-mono">{catalogError}</p>
              </div>
            ) : filteredSupernovae.length === 0 ? (
              <div className="border border-white/10 bg-black/40 rounded-xl py-12 px-4 text-center flex-1 flex flex-col justify-center">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold mb-1">No stellar events matched criteria</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Try revising the Redshift scope or resetting Checked anomaly classes.
                </p>
              </div>
            ) : (
              <div 
                className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 select-yCustomScroll"
                style={{ 
                  maxHeight: "800px" 
                }}
              >
                {filteredSupernovae.map((item) => (
                  <SupernovaCard
                    key={item.object_id}
                    item={item}
                    isSelected={selectedId === item.object_id}
                    onSelect={() => {
                      setSelectedId(item.object_id);
                      setModalMode("single");
                      setIsModalOpen(true);
                    }}
                    isCompared={comparedIds.includes(item.object_id)}
                    onToggleCompare={() => handleToggleCompare(item.object_id)}
                    onShowHistory={(objId, paramK, paramL) => setHistoryPopup({ objectId: objId, paramKey: paramK, paramLabel: paramL })}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      </div>

      {/* Floating Action Button for Comparing Selected Plots */}
      {comparedIds.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 animate-pulse-slow">
          <button
            onClick={() => {
              setModalMode("compare");
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2.5 px-6 py-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-black font-bold font-display rounded-full shadow-2xl shadow-amber-500/30 text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer border border-amber-400/20 transform hover:scale-105 active:scale-95"
          >
            <Layers className="w-4 h-4 text-black" />
            Compare Selected Plots ({comparedIds.length})
          </button>
        </div>
      )}

      {/* Cohesive Large Format Pop-Up Modal View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-[95vw] bg-[#08090c] border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden z-10 animate-fade-in">
            {/* Modal Navigation & Workspace Header */}
            <div className="flex justify-between items-center px-6 py-4.5 border-b border-white/10 bg-black/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9.5 h-9.5 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-inner">
                  {modalMode === "single" ? (
                    <TrendingUp className="w-4.5 h-4.5" />
                  ) : (
                    <History className="w-4.5 h-4.5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display uppercase tracking-widest text-[#e5e7eb] leading-tight">
                    {modalMode === "single"
                      ? `Single Target Analysis Workspace: ${selectedId}`
                      : `Multi-Target Comparative Workbench`}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {modalMode === "single"
                      ? "Interactive light curve telemetry & best-fit models"
                      : `Overlay of ${comparedIds.length} chosen supernova profiles`}
                  </p>
                </div>
              </div>

              {/* Comparative Options Panels - only show in compare mode */}
              {modalMode === "compare" && comparedIds.length > 0 && (
                <div className="flex items-center justify-between gap-4 border border-white/5 bg-white/5 px-3 py-1.5 rounded-xl shrink-0">
                  <div className="flex items-center gap-4">
                    {/* Temporal Alignment */}
                    <div className="flex bg-black rounded-lg p-0.5 border border-white/10 shrink-0">
                      <button
                        onClick={() => setAlignMode("mjd")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-[9px] transition-all cursor-pointer uppercase ${
                          alignMode === "mjd" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Watch className="w-3 h-3" /> MJD Epoch
                      </button>
                      <button
                        onClick={() => setAlignMode("rest_frame")}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-[9px] transition-all cursor-pointer uppercase ${
                          alignMode === "rest_frame" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Flame className="w-3 h-3" /> Phase (t-texp)
                      </button>
                    </div>

                    {/* Visual Feeds */}
                    <div className="flex items-center gap-4 border-l border-white/10 pl-4 shrink-0">
                      <label className="flex items-center gap-1.5 select-none cursor-pointer text-slate-300 hover:text-white transition-colors text-[10px]">
                        <input
                          type="checkbox"
                          checked={showObs}
                          onChange={() => setShowObs(!showObs)}
                          className="rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 w-3 h-3"
                        />
                        <span>Obs Scatter</span>
                      </label>
                      <label className="flex items-center gap-1.5 select-none cursor-pointer text-slate-300 hover:text-white transition-colors text-[10px]">
                        <input
                          type="checkbox"
                          checked={showModels}
                          onChange={() => setShowModels(!showModels)}
                          className="rounded bg-black border-white/10 text-amber-500 checked:bg-amber-500 checked:border-amber-500 focus:ring-0 w-3 h-3"
                        />
                        <span>MCMC fits</span>
                      </label>
                    </div>
                  </div>

                  {/* View Controls */}
                  <div className="flex bg-black rounded-lg p-0.5 border border-white/10 shrink-0">
                    <button
                      onClick={() => setCompareView("plots")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-[9px] transition-all cursor-pointer uppercase ${
                        compareView === "plots" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      📈 Plots Only
                    </button>
                    <button
                      onClick={() => setCompareView("table")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-[9px] transition-all cursor-pointer uppercase ${
                        compareView === "table" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      📊 Data Table
                    </button>
                  </div>
                </div>
              )}

              {/* Close Button Trigger */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-all cursor-pointer border border-transparent hover:border-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scroll Workspace Canvas */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
              {modalMode === "single" ? (
                <div className="flex flex-col gap-2 w-full h-full min-h-0 overflow-hidden">
                  {/* Interactive ECharts - Full Width Plot at the Top */}
                  <div className="flex flex-col gap-2 w-full flex-1 min-h-0">
                    <LightCurveChart
                      data={selectedLc}
                      loading={lcLoading}
                      objectId={selectedId}
                    />
                    {/* Error notifications */}
                    {lcError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-xs text-red-300 flex items-start gap-2.5 shrink-0">
                        <CircleAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold block text-[10px]">Model Synchronizer Error</span>
                          <span className="text-[9px] font-mono text-red-400">{lcError}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inferred Parameters Section - Full Width below the plot */}
                  {selectedSupernova ? (
                    <div className="bg-black/60 border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 w-full shrink-0">
                      <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                        <h3 className="text-[10px] font-bold tracking-widest text-[#9ca3af] font-display uppercase flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-amber-500" />
                          Model Parameters
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            MCMC Best-Fit
                          </span>
                        </div>
                      </div>

                      {/* Parameter items layout - Strict 2x7 Grid */}
                      <div className="grid grid-cols-7 gap-1.5">
                        {(() => {
                          const p = selectedSupernova.inferred_parameters;
                          let peakLum: number | null = null;
                          if (selectedSupernova.lightcurve) {
                            const allMags: number[] = [];
                            if (selectedSupernova.lightcurve.model_fit?.g_band) allMags.push(...selectedSupernova.lightcurve.model_fit.g_band.median.filter(m => m <= 24.0));
                            if (selectedSupernova.lightcurve.model_fit?.r_band) allMags.push(...selectedSupernova.lightcurve.model_fit.r_band.median.filter(m => m <= 24.0));
                            if (selectedSupernova.lightcurve.observations) allMags.push(...selectedSupernova.lightcurve.observations.filter(o => o.mag <= 24.0).map(o => o.mag));
                            if (allMags.length > 0) peakLum = Math.min(...allMags);
                          }
                          const items = [
                            { key: "discovery", label: "Discovery", val: selectedSupernova.basic_info.discovery_date, pct_plus: null, pct_minus: null, unit: "", digits: 0, isString: true },
                            { key: "redshift", label: "Redshift (z)", val: selectedSupernova.basic_info.redshift, pct_plus: null, pct_minus: null, unit: "", digits: 4 },
                            { key: "plateau_dur", label: "Plat. Dur (d)", val: selectedSupernova.basic_info.plateau_duration_days, pct_plus: null, pct_minus: null, unit: "d", digits: 1 },
                            { key: "peak_lum", label: "Peak Lum (mag)", val: peakLum, pct_plus: null, pct_minus: null, unit: "mag", digits: 2 },
                            { key: "observations", label: "Observations", val: selectedSupernova.lightcurve?.observations ? selectedSupernova.lightcurve.observations.length : 0, pct_plus: null, pct_minus: null, unit: "", digits: 0 },
                            { key: "k_energy", label: "E_k (foe)", val: p.k_energy, pct_plus: p.k_energy_pct_plus, pct_minus: p.k_energy_pct_minus, unit: "foe", digits: 2 },
                            { key: "ni56", label: "M_Ni (M☉)", val: p.ni56, pct_plus: p.ni56_pct_plus, pct_minus: p.ni56_pct_minus, unit: "M☉", digits: 3 },
                            { key: "zams", label: "Prog Mass (M☉)", val: p.zams, pct_plus: p.zams_pct_plus, pct_minus: p.zams_pct_minus, unit: "M☉", digits: 1 },
                            { key: "mloss_rate", label: "M_loss (idx)", val: p.mloss_rate, pct_plus: p.mloss_rate_pct_plus, pct_minus: p.mloss_rate_pct_minus, unit: "idx", digits: 2 },
                            { key: "beta", label: "Beta", val: p.beta, pct_plus: p.beta_pct_plus, pct_minus: p.beta_pct_minus, unit: "val", digits: 2 },
                            { key: "t_exp", label: "t_exp (days)", val: p.t_exp, pct_plus: p.t_exp_pct_plus, pct_minus: p.t_exp_pct_minus, unit: "days", digits: 2 },
                            { key: "A_v", label: "A_v (mag)", val: p.A_v, pct_plus: p.A_v_pct_plus, pct_minus: p.A_v_pct_minus, unit: "mag", digits: 2 },
                            { key: "logZ", label: "logZ (dex)", val: p.logZ, pct_plus: p.logZ_pct_plus, pct_minus: p.logZ_pct_minus, unit: "dex", digits: 2 },
                            { key: "reduced_chi2", label: "red_chi2", val: p.reduced_chi2, pct_plus: null, pct_minus: null, unit: "val", digits: 2 },
                          ];

                          return items.map((item) => {
                            const hasHistory = selectedSupernova.parameter_history && selectedSupernova.parameter_history.length > 0;
                            const isInteractive = !!(hasHistory && ["zams", "k_energy", "mloss_rate", "beta", "ni56", "t_exp", "A_v", "logZ"].includes(item.key));
                            
                            const handleClick = () => {
                              if (isInteractive) {
                                setHistoryPopup({
                                  objectId: selectedSupernova.object_id,
                                  paramKey: item.key,
                                  paramLabel: item.label
                                });
                              }
                            };

                            return (
                              <div 
                                key={item.key} 
                                onClick={handleClick}
                                className={`bg-black/85 border border-white/5 p-1 rounded-md flex flex-col justify-between min-h-0 leading-tight transition-colors ${
                                  isInteractive ? "cursor-pointer hover:bg-white/[0.05] hover:border-white/10" : ""
                                }`}
                                title={isInteractive ? "Click to view convergence history" : undefined}
                              >
                                <span className="text-[7.5px] text-slate-500 uppercase font-mono tracking-wider font-semibold truncate">{item.label}</span>
                                <div className="text-slate-200 font-mono font-bold text-[10px] flex flex-wrap items-baseline gap-0.5 mt-0.5">
                                  {item.isString ? (
                                    <span className="truncate">{item.val}</span>
                                  ) : (
                                    <>
                                      <span>{item.val !== null && item.val !== undefined ? item.val.toFixed(item.digits) : "N/A"}</span>
                                      {item.unit && <span className="text-[7px] text-slate-500 font-normal">{item.unit}</span>}
                                    </>
                                  )}
                                </div>
                                {item.pct_plus !== null && item.pct_plus !== undefined && item.pct_minus !== null && item.pct_minus !== undefined ? (
                                  <div className="flex flex-col text-[8.5px] font-mono leading-[1.2] mt-1 shrink-0">
                                    <span className="text-emerald-400">+{item.pct_plus.toFixed(1)}%</span>
                                    <span className="text-rose-400">-{item.pct_minus.toFixed(1)}%</span>
                                  </div>
                                ) : (
                                  <div className="h-[15px]"></div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-center border border-dashed border-white/10 bg-black/40 rounded-xl p-6">
                      <span className="text-xs text-slate-500 font-mono">Parameters unavailable</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 w-full overflow-hidden min-h-0">
                  <LightCurveCompare
                    comparedLcs={comparedLcs}
                    comparedLcsLoading={comparedLcsLoading}
                    comparedIds={comparedIds}
                    supernovae={supernovae}
                    onRemoveId={handleRemoveComparedId}
                    onClearAll={handleClearAllCompared}
                    alignMode={alignMode}
                    showObs={showObs}
                    showModels={showModels}
                    compareView={compareView}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {historyPopup && (() => {
        const item = supernovae.find(s => s.object_id === historyPopup.objectId);
        if (!item || !item.parameter_history) return null;
        return (
          <ParameterHistoryChart
            objectId={historyPopup.objectId}
            paramKey={historyPopup.paramKey}
            paramLabel={historyPopup.paramLabel}
            history={item.parameter_history}
            onClose={() => setHistoryPopup(null)}
          />
        );
      })()}

      {/* Global CSS for scrollbars */}
      <style>{`
        .select-yCustomScroll::-webkit-scrollbar {
          width: 5px;
        }
        .select-yCustomScroll::-webkit-scrollbar-track {
          background: #020204;
          border-radius: 99px;
        }
        .select-yCustomScroll::-webkit-scrollbar-thumb {
          background: rgba(245, 158, 11, 0.35);
          border-radius: 99px;
        }
        .select-yCustomScroll::-webkit-scrollbar-thumb:hover {
          background: rgba(245, 158, 11, 0.6);
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
