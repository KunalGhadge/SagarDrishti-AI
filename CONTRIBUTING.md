# Contributing to SagarDrishti AI (ORCA)

Thank you for your interest in contributing to **SagarDrishti AI (ORCA)** — Autonomous Marine Intelligence & Decision Support Platform (Team WE# / Smart India Hackathon 2026 / ISRO PS 26176)! We welcome contributions from the community to enhance maritime safety, Earth Observation analytics, and ocean intelligence.

---

## Before You Start

### 🚨 Feature Requests & Major Changes

**For new features, marine data sources, or significant architectural changes, please create an issue first to discuss your idea before submitting a PR.**

This helps us:

- Align on the marine data pipeline direction and design
- Avoid duplicate work
- Ensure the feature fits with the ISRO problem statement roadmap
- Save your valuable time on implementation

**What requires discussion:**

- New Marine Agents or multi-agent supervisor protocols
- New Model Context Protocol (MCP) data connectors (e.g. INCOIS, ISRO MOSDAC, IMD)
- New workflow visual DAG components
- Breaking changes to database or state schemas

**What doesn't require discussion:**

- Bug fixes
- Documentation improvements
- Minor UI tweaks and typography fixes
- Code refactoring (without behavior changes)

---

## Getting Started

1. **Fork this repository** on GitHub.

2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/KunalGhadge/SagarDrishti-AI.git
   cd SagarDrishti-AI
   ```

3. **Create a new branch** for your changes:

   ```bash
   git checkout -b feat/your-feature-name
   ```

4. **Install dependencies**:

   ```bash
   pnpm install
   ```

5. **Start the development server**:

   ```bash
   pnpm dev
   ```

---

## Code Quality & Guidelines

- Ensure all TypeScript types pass cleanly:
  ```bash
  pnpm check-types
  ```
- Run tests:
  ```bash
  pnpm test
  ```

We sincerely appreciate your contributions to **SagarDrishti AI**!
