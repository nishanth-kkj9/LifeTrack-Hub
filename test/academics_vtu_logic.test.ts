import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeVtuUsn,
  calculateSemesterSgpa,
  calculateCumulativeCgpa,
  calculateAttendanceReport,
  estimateCurrentSemester,
  getEduStudentRecord,
  syncVtuProfileFromStudentRecord,
  parseVtuResultText,
  getGradeFromTotalMarks,
} from '../src/lib/vtuData.ts';
import { getSchemeConfig } from '../src/lib/vtuSchemes.ts';
import { VtuSubject } from '../src/types/index.ts';

describe('Academics & VTU Data Logic', () => {
  it('decodeVtuUsn correctly validates 2 and 3 letter branch codes', () => {
    const res2 = decodeVtuUsn('1MS22CS084');
    assert.equal(res2.valid, true);
    assert.equal(res2.branchCode, 'CS');
    assert.equal(res2.admissionYear, 2022);

    const res3 = decodeVtuUsn('1RV21CSE042');
    assert.equal(res3.valid, true);
    assert.equal(res3.branchCode, 'CSE');
    assert.equal(res3.admissionYear, 2021);

    const invalid = decodeVtuUsn('INVALID_USN_99');
    assert.equal(invalid.valid, false);
  });

  it('calculateSemesterSgpa enforces SEE >= 18 and Total >= 40 passing thresholds', () => {
    const subjects: VtuSubject[] = [
      {
        id: '1',
        code: 'SUB1',
        name: 'Math',
        credits: 4,
        cieMarks: 45,
        seeMarks: 17, // Failed SEE (< 18)
        attendedClasses: 0,
        totalClasses: 0,
      },
      {
        id: '2',
        code: 'SUB2',
        name: 'Physics',
        credits: 4,
        cieMarks: 40,
        seeMarks: 40, // Passed (CIE+SEE=80 -> Grade A+ = 9 points)
        attendedClasses: 0,
        totalClasses: 0,
      },
    ];

    const { sgpa, totalCredits } = calculateSemesterSgpa(subjects);
    assert.equal(totalCredits, 8);
    // SUB1: 4 * 0 = 0 points. SUB2: 4 * 9 = 36 points. Total points = 36 / 8 = 4.5 SGPA
    assert.equal(sgpa, 4.5);
  });

  it('calculateCumulativeCgpa excludes F-grade courses from CGPA until cleared per VTU regulation', () => {
    const sem1Subjects: VtuSubject[] = [
      { id: '1', code: 'S1', name: 'Subject 1', credits: 4, gradePoint: 9, attendedClasses: 0, totalClasses: 0 },
      { id: '2', code: 'S2', name: 'Subject 2', credits: 4, gradePoint: 0, attendedClasses: 0, totalClasses: 0 }, // F grade
    ];
    const sem2Subjects: VtuSubject[] = [
      { id: '3', code: 'S3', name: 'Subject 3', credits: 4, gradePoint: 8, attendedClasses: 0, totalClasses: 0 },
    ];

    const semesters = [
      { semesterNumber: 1, scheme: '2022' as const, branch: 'CS', subjects: sem1Subjects },
      { semesterNumber: 2, scheme: '2022' as const, branch: 'CS', subjects: sem2Subjects },
    ];

    const sem1Sgpa = calculateSemesterSgpa(sem1Subjects, '2022');
    assert.equal(sem1Sgpa.sgpa, 4.5);
    assert.equal(sem1Sgpa.totalCredits, 8);

    const { cgpa, totalCredits } = calculateCumulativeCgpa(semesters);
    // Passed credits = 4 (S1) + 4 (S3) = 8. (S2 is F grade, excluded until cleared).
    // Total weighted points = 4*9 + 4*8 = 36 + 32 = 68. CGPA = 68 / 8 = 8.5
    assert.equal(totalCredits, 8);
    assert.equal(cgpa, 8.5);
  });

  it('calculateAttendanceReport handles raw percentage and unreachable threshold boundary', () => {
    // 74.9% raw should be flagged as 'danger', not rounded up to 75% 'warning'
    const report1 = calculateAttendanceReport(749, 1000, 85);
    assert.equal(report1.status, 'danger');

    // Threshold 100% with missed class should set reachable: false and classesToAttend: null
    const report2 = calculateAttendanceReport(9, 10, 100);
    assert.equal(report2.reachable, false);
    assert.equal(report2.classesToAttend, null);
  });

  it('getSchemeConfig and getGradeFromTotalMarks differentiate 2021 (S/A) vs 2022 (O/A+) schemes', () => {
    const cfg2022 = getSchemeConfig('2022');
    assert.equal(cfg2022.scheme, '2022');
    assert.equal(cfg2022.minSeeTheory, 18);

    const cfg2021 = getSchemeConfig('2021');
    assert.equal(cfg2021.scheme, '2021');
    assert.equal(cfg2021.grades[0].letter, 'S');

    assert.equal(getGradeFromTotalMarks(92, '2021').letter, 'S');
    assert.equal(getGradeFromTotalMarks(92, '2022').letter, 'O');
    assert.equal(getGradeFromTotalMarks(86, '2021').letter, 'A');
    assert.equal(getGradeFromTotalMarks(86, '2022').letter, 'A+');
  });

  it('estimateCurrentSemester correctly calculates semester for admission year', () => {
    const semAug = estimateCurrentSemester(2024, new Date('2026-09-15'));
    assert.equal(semAug, 5); // 2 years + 1 = sem 5

    const semFeb = estimateCurrentSemester(2024, new Date('2026-02-15'));
    assert.equal(semFeb, 4); // 2 years = sem 4
  });

  it('getEduStudentRecord returns null for unknown or invalid USNs without fabricating data', () => {
    assert.equal(getEduStudentRecord('1MS99CS999'), null);
    assert.equal(getEduStudentRecord('hello'), null);
    assert.equal(getEduStudentRecord(''), null);

    const seeded = getEduStudentRecord('1MS22CS084');
    assert.ok(seeded !== null);
    assert.equal(seeded.studentName, 'Rahul Sharma');
  });

  it('syncVtuProfileFromStudentRecord does not fabricate student names or years for unknown/invalid USN', () => {
    const syncedInvalid = syncVtuProfileFromStudentRecord('hello');
    assert.equal(syncedInvalid.studentName, '');
    assert.equal(syncedInvalid.collegeName, 'Not available');
    assert.equal(syncedInvalid.admissionYear, undefined);
    assert.equal(syncedInvalid.semesters.length, 0);
  });

  it('parseVtuResultText skips incomplete rows instead of inventing 40/40 marks and warns on marks > 50', () => {
    const sample = [
      'BCS301 Mathematics for Computer Science', // Missing marks -> must be skipped
      'BCS302 Digital Design 45 78 PASS', // SEE > 50 -> keep raw marks & emit schemeWarning
      '21CS52 Computer Networks 44 48 PASS', // Total 92 -> S under 2021 scheme
    ].join('\n');

    const parsed = parseVtuResultText(sample, '2021');
    assert.equal(parsed.skippedRows.length, 1);
    assert.ok(parsed.skippedRows[0].includes('BCS301'));
    assert.equal(parsed.extractedSubjects.length, 2);

    const sub302 = parsed.extractedSubjects.find((s) => s.code === 'BCS302');
    assert.equal(sub302?.cieMarks, 45);
    assert.equal(sub302?.seeMarks, 78);
    assert.ok(typeof parsed.schemeWarning === 'string' && parsed.schemeWarning.length > 0);

    const sub52 = parsed.extractedSubjects.find((s) => s.code === '21CS52');
    assert.equal(sub52?.gradeLetter, 'S');
    assert.equal(sub52?.gradePoint, 10);
    assert.equal(sub52?.attendedClasses, 0);
    assert.equal(sub52?.totalClasses, 0);
  });
});
