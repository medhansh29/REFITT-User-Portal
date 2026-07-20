# REFITT User Portal

The REFITT User Portal is a comprehensive web dashboard for visualizing and analyzing astronomical transient events (e.g., supernovae). It provides an interactive interface for researchers to track light curves, compare model fits with observational data, and inspect inferred physical parameters.

## Key Features

- **Interactive Light Curve Visualization**: Fully interactive ECharts-powered light curves showing multiple photometric bands (e.g., g-band, r-band) alongside MCMC model fits and confidence intervals. Support for distinct upper limit non-detection rendering.
- **Single Target Analysis**: Detailed view for individual supernovae, including observational metadata, inferred physical parameters, and parameter history tracking.
- **Multi-Target Comparative Workbench**: Compare multiple light curves simultaneously with overlaid timelines and dedicated multi-column parameter comparison tables.
- **Aladin Lite Sky Map Integration**: Seamless integration with the Aladin Lite API to visualize the precise celestial location of transients overlaid on Pan-STARRS survey data.
- **Anomaly Footprint Visualization**: Dynamic horizontal diverging bar charts to instantly highlight significant physical parameter deviations ($Z$-scores) using ECharts.
- **Dynamic Filtering**: Advanced filtering by object class (e.g., Type Ia, IIP, Ib/c), morphological anomalies, and numerical thresholds.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Visualization**: Apache ECharts
- **Icons**: Lucide React

## Getting Started

1. Navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
