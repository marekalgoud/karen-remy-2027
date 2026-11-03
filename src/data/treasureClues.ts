export const treasureClues = [
  { number: 1, path: '/indice/9c4a71e2b6f03d8a', letter: 'B' },
  { number: 2, path: '/indice/2e8b5f1a94c7036d', letter: 'A' },
  { number: 3, path: '/indice/7d3f0a8c51e2496b', letter: 'G' },
  { number: 4, path: '/indice/a61c9e24f7b3058d', letter: 'U' },
  { number: 5, path: '/indice/4b0d7e3a926f1c85', letter: 'E' },
] as const

export type TreasureClue = (typeof treasureClues)[number]