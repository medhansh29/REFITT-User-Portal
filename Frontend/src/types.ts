export interface BasicInfo {
  discovery_date: string;
  redshift: number;
  plateau_duration_days: number | null;
}

export interface InferredParameters {
  zams: number; // Zero Age Main Sequence Mass
  zams_pct_uncertainty?: number;
  zams_pct_plus?: number;
  zams_pct_minus?: number;
  k_energy: number; // Kinetic Energy
  k_energy_pct_uncertainty?: number;
  k_energy_pct_plus?: number;
  k_energy_pct_minus?: number;
  mloss_rate: number; // Mass Loss Rate
  mloss_rate_pct_uncertainty?: number;
  mloss_rate_pct_plus?: number;
  mloss_rate_pct_minus?: number;
  beta: number; // Wind velocity profile parameter
  beta_pct_uncertainty?: number;
  beta_pct_plus?: number;
  beta_pct_minus?: number;
  ni56: number; // Nickel-56 mass fraction
  ni56_pct_uncertainty?: number;
  ni56_pct_plus?: number;
  ni56_pct_minus?: number;
  t_exp: number; // Explosion time reference
  t_exp_pct_uncertainty?: number;
  t_exp_pct_plus?: number;
  t_exp_pct_minus?: number;
  A_v: number; // Visual dust extinction
  A_v_pct_uncertainty?: number;
  A_v_pct_plus?: number;
  A_v_pct_minus?: number;
  logZ: number; // Log metallicity
  logZ_pct_uncertainty?: number;
  logZ_pct_plus?: number;
  logZ_pct_minus?: number;
  reduced_chi2?: number | null;
}

export interface ParameterHistoryBounds {
  val: number;
  plus: number;
  minus: number;
  pct_plus: number;
  pct_minus: number;
}

export interface ParameterHistoryItem {
  date: string;
  filter: string;
  phase: number;
  parameters: Record<string, ParameterHistoryBounds>;
}

export interface MorphologyAnomalies {
  early_rise_excess: boolean;
  arrested_cooling: boolean;
  plateau_extension: boolean;
  plateau_rebrightening: boolean;
  precursor_detection: boolean;
}

export interface CompositionAnomalies {
  peak_brightness_excess: boolean;
  nickel_overabundance: boolean;
}

export interface BivariateOutliers {
  mloss_ek_magnetar: boolean;
  ek_ni_pair_instability: boolean;
  texp_beta_diffusion: boolean;
  logz_av_dust: boolean;
}

export interface MultivariateClusters3D {
  energy_engine: boolean;
  progenitor_evolution: boolean;
  modeling_degeneracy: boolean;
  ejecta_efficiency: boolean;
  lc_morphology: boolean;
}

export interface Anomalies {
  morphology: MorphologyAnomalies;
  composition: CompositionAnomalies;
  bivariate_outliers: BivariateOutliers;
  multivariate_clusters_3d: MultivariateClusters3D;
}

export interface SupernovaSummary {
  object_id: string;
  basic_info: BasicInfo;
  inferred_parameters: InferredParameters;
  anomalies: Anomalies;
  has_light_curve: boolean;
  lightcurve?: LightCurve;
  parameter_history?: ParameterHistoryItem[];
}

// Detailed Lightcurves types
export interface Observation {
  mjd: number;
  mag: number;
  magerr: number;
  filter: "g" | "r";
}

export interface BandData {
  mjd: number[];
  median: number[];
  upper_16th: number[];
  lower_84th: number[];
}

export interface ModelFit {
  r_band?: BandData;
  g_band?: BandData;
}

export interface LightCurve {
  object_id: string;
  observations: Observation[];
  model_fit: ModelFit;
}
