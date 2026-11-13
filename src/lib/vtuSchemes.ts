export interface SchemeGradeRule {
  letter: string;
  points: number;
  minMarks: number;
  maxMarks: number;
}

export interface VtuSchemeConfig {
  scheme: '2022' | '2021' | '2018';
  name: string;
  grades: SchemeGradeRule[];
  minSeeTheory: number; // out of 50
  minSeePractical: number; // out of 50
  minTotalPercent: number;
  minCieTheory: number;
  minCiePractical: number;
}

export const VTU_SCHEME_CONFIGS: Record<'2022' | '2021' | '2018', VtuSchemeConfig> = {
  '2022': {
    scheme: '2022',
    name: 'VTU 2022 Scheme (CBCS)',
    grades: [
      { letter: 'O', points: 10, minMarks: 90, maxMarks: 100 },
      { letter: 'A+', points: 9, minMarks: 80, maxMarks: 89 },
      { letter: 'A', points: 8, minMarks: 70, maxMarks: 79 },
      { letter: 'B+', points: 7, minMarks: 60, maxMarks: 69 },
      { letter: 'B', points: 6, minMarks: 55, maxMarks: 59 },
      { letter: 'C', points: 5, minMarks: 50, maxMarks: 54 },
      { letter: 'P', points: 4, minMarks: 40, maxMarks: 49 },
      { letter: 'F', points: 0, minMarks: 0, maxMarks: 39 },
    ],
    minSeeTheory: 18,
    minSeePractical: 20,
    minTotalPercent: 40,
    minCieTheory: 20,
    minCiePractical: 25,
  },
  '2021': {
    scheme: '2021',
    name: 'VTU 2021 Scheme (CBCS)',
    grades: [
      { letter: 'S', points: 10, minMarks: 90, maxMarks: 100 },
      { letter: 'A', points: 9, minMarks: 80, maxMarks: 89 },
      { letter: 'B', points: 8, minMarks: 70, maxMarks: 79 },
      { letter: 'C', points: 7, minMarks: 60, maxMarks: 69 },
      { letter: 'D', points: 6, minMarks: 55, maxMarks: 59 },
      { letter: 'E', points: 4, minMarks: 40, maxMarks: 54 },
      { letter: 'F', points: 0, minMarks: 0, maxMarks: 39 },
    ],
    minSeeTheory: 18,
    minSeePractical: 20,
    minTotalPercent: 40,
    minCieTheory: 20,
    minCiePractical: 25,
  },
  '2018': {
    scheme: '2018',
    name: 'VTU 2018 Scheme (CBCS)',
    grades: [
      { letter: 'S+', points: 10, minMarks: 90, maxMarks: 100 },
      { letter: 'S', points: 9, minMarks: 80, maxMarks: 89 },
      { letter: 'A', points: 8, minMarks: 70, maxMarks: 79 },
      { letter: 'B', points: 7, minMarks: 60, maxMarks: 69 },
      { letter: 'C', points: 6, minMarks: 50, maxMarks: 59 },
      { letter: 'D', points: 5, minMarks: 45, maxMarks: 49 },
      { letter: 'E', points: 4, minMarks: 40, maxMarks: 44 },
      { letter: 'F', points: 0, minMarks: 0, maxMarks: 39 },
    ],
    minSeeTheory: 18,
    minSeePractical: 20,
    minTotalPercent: 40,
    minCieTheory: 20,
    minCiePractical: 25,
  },
};

export function getSchemeConfig(scheme?: string): VtuSchemeConfig {
  if (scheme === '2021') return VTU_SCHEME_CONFIGS['2021'];
  if (scheme === '2018') return VTU_SCHEME_CONFIGS['2018'];
  return VTU_SCHEME_CONFIGS['2022'];
}
