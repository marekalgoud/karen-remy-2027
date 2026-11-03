# Project conventions

- This is a French, mobile-first wedding puzzle game built with Vite, React, and TypeScript.
- Puzzle content is authored in `src/data/puzzles.ts`; keep each puzzle's presentation customizable.
- Firebase is optional during local development. Do not treat client-side answer checks or scores as tamper-resistant.
- Prefer small components and semantic HTML, and preserve the existing visual system in `src/styles.css`.