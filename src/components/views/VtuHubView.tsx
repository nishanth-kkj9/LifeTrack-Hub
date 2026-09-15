import React, { useState } from 'react';
import {
  GraduationCap,
  Calculator,
  Percent,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  RotateCcw,
  BookOpen,
  Award,
  ChevronRight,
  ShieldAlert,
  Info,
  Search,
  FileSpreadsheet,
  Building,
  School,
  Sparkles,
  ClipboardCheck,
  Printer,
  Share2,
  User,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  VtuProfile,
  VtuSubject,
  VtuSemesterData,
  VtuGradeLetter,
  EduStudentRecord,
} from '../../types/index.ts';
import {
  VTU_GRADES,
  VTU_BRANCHES,
  VTU_SCHEMES,
  calculateSemesterSgpa,
  calculateCumulativeCgpa,
  vtuCgpaToPercentage,
  getVtuClassFromCgpa,
  calculateAttendanceReport,
  calculateSeeTargets,
  getGradeFromTotalMarks,
  getDefaultVtuSubjectsForSemester,
  decodeVtuUsn,
  parseVtuResultText,
  DecodedUsn,
  getEduStudentRecord,
} from '../../lib/vtuData.ts';
import { VtuSyncSection } from '../vtu/VtuSyncSection.tsx';

interface VtuHubViewProps {
  vtuProfile: VtuProfile;
  onUpdateVtuProfile: (updatedProfile: VtuProfile) => void;
  onAddExamFromSubject?: (subjectCode: string, subjectName: string) => void;
}

export const VtuHubView: React.FC<VtuHubViewProps> = ({
  vtuProfile,
  onUpdateVtuProfile,
  onAddExamFromSubject,
}) => {
  const [activeSection, setActiveSection] = useState<'vtu-sync' | 'calculator' | 'attendance' | 'marks-predictor' | 'usn-lookup' | 'resources'>('vtu-sync');
  const [selectedSemester, setSelectedSemester] = useState<number>(vtuProfile.currentSemester || 3);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempUsn, setTempUsn] = useState(vtuProfile.usn);
  const [tempTargetCgpa, setTempTargetCgpa] = useState(vtuProfile.targetCgpa.toString());

  // Result Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [rawResultInput, setRawResultInput] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  // USN Inspector State
  const [inspectorUsn, setInspectorUsn] = useState(vtuProfile.usn || '1MS22CS084');
  const [decodedInfo, setDecodedInfo] = useState<DecodedUsn>(() => decodeVtuUsn(vtuProfile.usn || '1MS22CS084'));

  // Edu App Student Record State
  const [eduStudent, setEduStudent] = useState<EduStudentRecord>(() => getEduStudentRecord(vtuProfile.usn || '1MS22CS084'));
  const [selectedEduSem, setSelectedEduSem] = useState<number>(() => {
    const initRec = getEduStudentRecord(vtuProfile.usn || '1MS22CS084');
    return initRec.semesterResults.length > 0 ? initRec.semesterResults[initRec.semesterResults.length - 1].semester : 1;
  });
  const [isMarksCardModalOpen, setIsMarksCardModalOpen] = useState(false);
  const [isEditingStudentName, setIsEditingStudentName] = useState(false);
  const [customStudentName, setCustomStudentName] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  // Predictor state
  const [predictorCieInput, setPredictorCieInput] = useState<number>(42);

  // New subject state
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCredits, setNewSubCredits] = useState('4');

  // Find or initialize semester data
  const currentSemData = vtuProfile.semesters.find((s) => s.semesterNumber === selectedSemester) || {
    semesterNumber: selectedSemester,
    scheme: vtuProfile.scheme,
    branch: vtuProfile.branch,
    subjects: getDefaultVtuSubjectsForSemester(selectedSemester, vtuProfile.branch),
    sgpa: 0,
    totalCredits: 0,
  };

  // Active subjects for selected semester
  const activeSubjects = currentSemData.subjects || [];

  // Live SGPA for this semester
  const { sgpa: currentSemSgpa, totalCredits: currentSemCredits } = calculateSemesterSgpa(activeSubjects);

  // Live CGPA across all semesters
  const { cgpa: cumulativeCgpa, totalCredits: allCredits, percentage: equivalentPercentage } =
    calculateCumulativeCgpa(vtuProfile.semesters);

  // Class classification
  const vtuClass = getVtuClassFromCgpa(cumulativeCgpa);

  // Handlers for subject changes
  const handleUpdateSubject = (subjectId: string, updates: Partial<VtuSubject>) => {
    const updatedSubjects = activeSubjects.map((s) => {
      if (s.id !== subjectId) return s;
      const merged = { ...s, ...updates };

      // If CIE or SEE changed, recompute grade & grade points
      if (updates.cieMarks !== undefined || updates.seeMarks !== undefined) {
        const cie = updates.cieMarks !== undefined ? updates.cieMarks : (merged.cieMarks || 0);
        const see = updates.seeMarks !== undefined ? updates.seeMarks : (merged.seeMarks || 0);
        const gradeInfo = getGradeFromTotalMarks(cie + see);
        merged.gradeLetter = gradeInfo.letter;
        merged.gradePoint = gradeInfo.points;
      }
      return merged;
    });

    saveSemesterSubjects(updatedSubjects);
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCode.trim() || !newSubName.trim()) return;

    const newSub: VtuSubject = {
      id: `vtu-sub-${Date.now()}`,
      code: newSubCode.trim().toUpperCase(),
      name: newSubName.trim(),
      credits: parseFloat(newSubCredits) || 3,
      cieMarks: 40,
      seeMarks: 40,
      gradeLetter: 'A',
      gradePoint: 8,
      attendedClasses: 25,
      totalClasses: 30,
    };

    saveSemesterSubjects([...activeSubjects, newSub]);
    setNewSubCode('');
    setNewSubName('');
  };

  const handleDeleteSubject = (subjectId: string) => {
    saveSemesterSubjects(activeSubjects.filter((s) => s.id !== subjectId));
  };

  const handleResetToDefaults = () => {
    const defaults = getDefaultVtuSubjectsForSemester(selectedSemester, vtuProfile.branch);
    saveSemesterSubjects(defaults);
  };

  const saveSemesterSubjects = (updatedSubjects: VtuSubject[]) => {
    const { sgpa, totalCredits } = calculateSemesterSgpa(updatedSubjects);

    const existingSemIndex = vtuProfile.semesters.findIndex((s) => s.semesterNumber === selectedSemester);
    let updatedSemesters: VtuSemesterData[];

    if (existingSemIndex >= 0) {
      updatedSemesters = vtuProfile.semesters.map((s, idx) =>
        idx === existingSemIndex
          ? {
              ...s,
              subjects: updatedSubjects,
              sgpa,
              totalCredits,
            }
          : s
      );
    } else {
      updatedSemesters = [
        ...vtuProfile.semesters,
        {
          semesterNumber: selectedSemester,
          scheme: vtuProfile.scheme,
          branch: vtuProfile.branch,
          subjects: updatedSubjects,
          sgpa,
          totalCredits,
        },
      ];
    }

    onUpdateVtuProfile({
      ...vtuProfile,
      semesters: updatedSemesters,
    });
  };

  const handleQuickAttendance = (subjectId: string, type: 'attended' | 'missed') => {
    const sub = activeSubjects.find((s) => s.id === subjectId);
    if (!sub) return;

    if (type === 'attended') {
      handleUpdateSubject(subjectId, {
        attendedClasses: sub.attendedClasses + 1,
        totalClasses: sub.totalClasses + 1,
      });
    } else {
      handleUpdateSubject(subjectId, {
        totalClasses: sub.totalClasses + 1,
      });
    }
  };

  const handleSaveProfile = () => {
    onUpdateVtuProfile({
      ...vtuProfile,
      usn: tempUsn.trim().toUpperCase(),
      targetCgpa: parseFloat(tempTargetCgpa) || 8.5,
    });
    setIsEditingProfile(false);
  };

  const handleInspectUsn = (usnQuery: string) => {
    const clean = usnQuery.trim().toUpperCase();
    setInspectorUsn(clean);
    const res = decodeVtuUsn(clean);
    setDecodedInfo(res);

    const record = getEduStudentRecord(clean);
    setEduStudent(record);
    setCustomStudentName(record.studentName);
    if (record.semesterResults.length > 0) {
      setSelectedEduSem(record.semesterResults[record.semesterResults.length - 1].semester);
    }
  };

  const handleApplyInspectedUsnToProfile = () => {
    if (!decodedInfo.valid) return;
    onUpdateVtuProfile({
      ...vtuProfile,
      usn: decodedInfo.usn,
      studentName: eduStudent.studentName,
      branch: decodedInfo.branchName || vtuProfile.branch,
      scheme: decodedInfo.estimatedScheme || vtuProfile.scheme,
    });
    setTempUsn(decodedInfo.usn);
    setImportStatusMessage(`Profile updated to ${decodedInfo.usn} (${eduStudent.studentName})`);
    setTimeout(() => setImportStatusMessage(null), 3000);
  };

  const handleLoadEduStudentIntoProfile = () => {
    if (!eduStudent) return;

    // Convert EduSemesterResult into VtuSemesterData
    const newSemesters: VtuSemesterData[] = eduStudent.semesterResults.map((sr) => ({
      semesterNumber: sr.semester,
      scheme: eduStudent.scheme,
      branch: eduStudent.branchName,
      sgpa: sr.sgpa,
      totalCredits: sr.totalCredits,
      subjects: sr.subjects.map((sub) => ({
        id: `vtu-${eduStudent.usn}-sem${sr.semester}-${sub.code}`,
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        cieMarks: sub.cieMarks,
        seeMarks: sub.seeMarks,
        gradeLetter: sub.gradeLetter,
        gradePoint: sub.gradePoint,
        attendedClasses: 36,
        totalClasses: 40,
      })),
    }));

    onUpdateVtuProfile({
      ...vtuProfile,
      usn: eduStudent.usn,
      studentName: eduStudent.studentName,
      branch: eduStudent.branchName,
      scheme: eduStudent.scheme,
      currentSemester: eduStudent.currentSemester,
      semesters: newSemesters,
    });

    setTempUsn(eduStudent.usn);
    setSelectedSemester(eduStudent.currentSemester);
    setImportStatusMessage(`Loaded all ${newSemesters.length} semesters of ${eduStudent.studentName} (${eduStudent.usn}) into your live profile!`);
    setTimeout(() => {
      setImportStatusMessage(null);
      setActiveSection('calculator');
    }, 1200);
  };

  const handleCopyStudentSummary = () => {
    if (!eduStudent) return;
    const text = `VTU ACADEMIC SCORECARD
Student: ${eduStudent.studentName}
USN: ${eduStudent.usn}
College: ${eduStudent.collegeName}
Branch: ${eduStudent.branchName} (${eduStudent.scheme} Scheme)
Batch: ${eduStudent.batch} | Semester: ${eduStudent.currentSemester}
Cumulative CGPA: ${eduStudent.overallCgpa.toFixed(2)} (${eduStudent.percentage}% - ${eduStudent.degreeClass})
Active Backlogs: ${eduStudent.activeBacklogs}
Verified on VTU Engineering Suite`;

    navigator.clipboard.writeText(text);
    setCopiedFeedback('Copied academic summary to clipboard!');
    setTimeout(() => setCopiedFeedback(null), 2500);
  };

  const handleSaveCustomStudentName = (newName: string) => {
    if (!newName.trim()) return;
    setEduStudent({
      ...eduStudent,
      studentName: newName.trim(),
    });
    setIsEditingStudentName(false);
  };

  const handleImportResultText = () => {
    if (!rawResultInput.trim()) {
      setImportStatusMessage('Please paste the marks table or text from results.vtu.ac.in');
      return;
    }

    const { extractedSubjects, extractedUsn, extractedSem } = parseVtuResultText(rawResultInput);
    if (extractedSubjects.length === 0) {
      setImportStatusMessage('No subjects recognized. Ensure the pasted text includes course codes like BCS301, 21CS52, etc.');
      return;
    }

    const targetSem = extractedSem || selectedSemester;
    saveSemesterSubjects(extractedSubjects);

    if (extractedUsn && extractedUsn !== vtuProfile.usn) {
      onUpdateVtuProfile({
        ...vtuProfile,
        usn: extractedUsn,
      });
      setTempUsn(extractedUsn);
    }

    if (extractedSem && extractedSem !== selectedSemester) {
      setSelectedSemester(extractedSem);
    }

    setImportStatusMessage(`Imported ${extractedSubjects.length} subjects with actual marks into Semester ${targetSem}!`);
    setTimeout(() => {
      setIsImportModalOpen(false);
      setImportStatusMessage(null);
      setRawResultInput('');
    }, 1500);
  };

  const handleLoadSampleResult = () => {
    const sample = `VISVESVARAYA TECHNOLOGICAL UNIVERSITY, BELAGAVI
USN: 1MS22CS084
Semester: 3
Subject Code	Subject Name	Internal	External	Total	Result
BCS301	Mathematics for Computer Science	45	42	87	P
21CS32	Data Structures and Applications	48	46	94	P
21CS33	Analog and Digital Electronics	43	39	82	P
21CS34	Computer Organization Architecture	44	41	85	P
21CSL35	Data Structures Laboratory	49	48	97	P
21CIP37	Constitution of India Professional Ethics	46	45	91	P`;
    setRawResultInput(sample);
  };

  // Overall attendance statistics
  const totalConducted = activeSubjects.reduce((acc, s) => acc + s.totalClasses, 0);
  const totalAttended = activeSubjects.reduce((acc, s) => acc + s.attendedClasses, 0);
  const overallAttendanceReport = calculateAttendanceReport(
    totalAttended,
    totalConducted,
    vtuProfile.attendanceThreshold
  );

  // SEE targets breakdown for predictor
  const seeTargets = calculateSeeTargets(predictorCieInput);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <GraduationCap className="w-64 h-64 text-indigo-200" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold text-xs border border-indigo-400/30 tracking-wide uppercase">
                VTU CBCS NEP Hub
              </span>
              <span className="text-xs text-slate-400">
                Visvesvaraya Technological University
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              VTU Engineering Student Suite
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Official VTU SGPA & CGPA calculation, 85% attendance bunk monitor, and CIE to SEE exam target forecasting.
            </p>

            {/* Quick Profile Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">USN:</span>
                <span className="font-bold text-indigo-300">{vtuProfile.usn || 'Not Set'}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Scheme:</span>
                <span className="font-bold text-white">{vtuProfile.scheme} Scheme</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Branch:</span>
                <span className="font-bold text-white truncate max-w-[180px]">{vtuProfile.branch}</span>
              </div>
              <button
                id="vtu-edit-profile-toggle-btn"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 text-white font-medium text-xs transition cursor-pointer"
              >
                {isEditingProfile ? 'Close Settings' : 'Edit USN & Scheme'}
              </button>
            </div>
          </div>

          {/* Cumulative CGPA & Class Hero Card */}
          <div className="shrink-0 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-5 text-center min-w-[220px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cumulative CGPA
            </span>
            <div className="text-3xl font-extrabold text-white mt-1">
              {cumulativeCgpa > 0 ? cumulativeCgpa.toFixed(2) : '—'}
            </div>
            <div className="text-xs text-indigo-300 font-semibold mt-0.5">
              ≈ {equivalentPercentage}% (VTU Official)
            </div>
            <div className="mt-2.5">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${vtuClass.badgeColor}`}>
                {vtuClass.title}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Settings Drawer (Inline) */}
        {isEditingProfile && (
          <div className="mt-6 pt-6 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Your USN</label>
              <input
                id="vtu-usn-input"
                type="text"
                value={tempUsn}
                onChange={(e) => setTempUsn(e.target.value)}
                placeholder="e.g. 1MS22CS084"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">VTU Scheme</label>
              <select
                id="vtu-scheme-select"
                value={vtuProfile.scheme}
                onChange={(e) => onUpdateVtuProfile({ ...vtuProfile, scheme: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {VTU_SCHEMES.map((scheme) => (
                  <option key={scheme} value={scheme}>
                    {scheme} Scheme (CBCS NEP)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Engineering Branch</label>
              <select
                id="vtu-branch-select"
                value={vtuProfile.branch}
                onChange={(e) => onUpdateVtuProfile({ ...vtuProfile, branch: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {VTU_BRANCHES.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target CGPA</label>
              <div className="flex gap-2">
                <input
                  id="vtu-target-cgpa-input"
                  type="number"
                  step="0.05"
                  min="4"
                  max="10"
                  value={tempTargetCgpa}
                  onChange={(e) => setTempTargetCgpa(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  id="vtu-save-profile-btn"
                  onClick={handleSaveProfile}
                  className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          id="vtu-tab-sync"
          onClick={() => setActiveSection('vtu-sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'vtu-sync'
              ? 'bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <RefreshCw className="w-4 h-4 text-indigo-400" />
          <span>VTU Sync (Check • Learn • Connect)</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-black text-[9px] uppercase tracking-wider border border-indigo-200">
            v7.0
          </span>
        </button>

        <button
          id="vtu-tab-usn-lookup"
          onClick={() => setActiveSection('usn-lookup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'usn-lookup'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Edu Student Details & Results</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-extrabold text-[9px] uppercase tracking-wider">
            PlayStore Edu
          </span>
        </button>

        <button
          id="vtu-tab-calculator"
          onClick={() => setActiveSection('calculator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'calculator'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>SGPA & CGPA Calculator</span>
        </button>

        <button
          id="vtu-tab-attendance"
          onClick={() => setActiveSection('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'attendance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>85% Attendance & Bunk Planner</span>
          {overallAttendanceReport.status !== 'safe' && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          id="vtu-tab-marks-predictor"
          onClick={() => setActiveSection('marks-predictor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'marks-predictor'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>CIE vs SEE Target Predictor</span>
        </button>

        <button
          id="vtu-tab-resources"
          onClick={() => setActiveSection('resources')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'resources'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Official VTU Portals & Rules</span>
        </button>
      </div>

      {/* SECTION 0: VTU SYNC (CHECK • LEARN • CONNECT) */}
      {activeSection === 'vtu-sync' && (
        <VtuSyncSection
          vtuProfile={vtuProfile}
          onUpdateProfile={onUpdateVtuProfile}
          onSwitchToCalculator={(sem) => {
            setSelectedSemester(sem);
            setActiveSection('calculator');
          }}
        />
      )}

      {/* SECTION 1: SGPA & CGPA CALCULATOR */}
      {activeSection === 'calculator' && (
        <div className="space-y-6">
          {/* Semester Selector & Quick SGPA Pill */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Select Semester:</span>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <button
                    key={sem}
                    id={`vtu-sem-selector-${sem}`}
                    onClick={() => setSelectedSemester(sem)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedSemester === sem
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Sem {sem}
                  </button>
                ))}
              </div>

              <button
                id="vtu-open-import-results-modal-btn"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer ml-auto sm:ml-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                <span>Import Real Result (results.vtu.ac.in)</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sem {selectedSemester} SGPA
                </span>
                <div className="text-xl font-extrabold text-indigo-950">
                  {currentSemSgpa.toFixed(2)} / 10.0
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Credits
                </span>
                <div className="text-xl font-bold text-slate-800">
                  {currentSemCredits}
                </div>
              </div>
              <button
                id="vtu-reset-subjects-btn"
                onClick={handleResetToDefaults}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Reset to default VTU syllabus subjects"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Semester {selectedSemester} Course Subjects ({vtuProfile.scheme} Scheme)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Edit CIE (out of 50), SEE (out of 50), or pick grade points to recalculate SGPA live.
                </p>
              </div>
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                Formula: SGPA = Σ(Ci × Gi) / ΣCi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Subject Title</th>
                    <th className="py-3 px-3 text-center">Credits</th>
                    <th className="py-3 px-3 text-center">CIE (/50)</th>
                    <th className="py-3 px-3 text-center">SEE (/50)</th>
                    <th className="py-3 px-3 text-center">Total (/100)</th>
                    <th className="py-3 px-3 text-center">Grade</th>
                    <th className="py-3 px-3 text-center">Pts (Gi)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSubjects.map((sub) => {
                    const cie = sub.cieMarks ?? 40;
                    const see = sub.seeMarks ?? 40;
                    const totalMarks = cie + see;
                    const gradeInfo = getGradeFromTotalMarks(totalMarks);
                    const gradeLetter = sub.gradeLetter || gradeInfo.letter;
                    const gradePoint = sub.gradePoint ?? gradeInfo.points;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-900">
                          {sub.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {sub.name}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="6"
                            value={sub.credits}
                            onChange={(e) =>
                              handleUpdateSubject(sub.id, {
                                credits: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-14 text-center py-1 px-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={sub.cieMarks ?? 40}
                            onChange={(e) =>
                              handleUpdateSubject(sub.id, {
                                cieMarks: parseInt(e.target.value) || 0,
                              })
                            }
                            className={`w-14 text-center py-1 px-1 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              (sub.cieMarks ?? 40) < 20
                                ? 'border-rose-300 bg-rose-50 text-rose-800 font-bold'
                                : 'border-slate-200 bg-slate-50 text-slate-800'
                            }`}
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={sub.seeMarks ?? 40}
                            onChange={(e) =>
                              handleUpdateSubject(sub.id, {
                                seeMarks: parseInt(e.target.value) || 0,
                              })
                            }
                            className={`w-14 text-center py-1 px-1 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              (sub.seeMarks ?? 40) < 18
                                ? 'border-rose-300 bg-rose-50 text-rose-800 font-bold'
                                : 'border-slate-200 bg-slate-50 text-slate-800'
                            }`}
                          />
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {totalMarks}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              gradeLetter === 'O'
                                ? 'bg-purple-100 text-purple-800'
                                : gradeLetter === 'A+' || gradeLetter === 'A'
                                ? 'bg-emerald-100 text-emerald-800'
                                : gradeLetter === 'B+' || gradeLetter === 'B'
                                ? 'bg-blue-100 text-blue-800'
                                : gradeLetter === 'F'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {gradeLetter}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-indigo-950">
                          {gradePoint}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onAddExamFromSubject && (
                              <button
                                onClick={() => onAddExamFromSubject(sub.code, sub.name)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition"
                                title="Add to Exam Reminders"
                              >
                                Add to Exams
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSubject(sub.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Delete subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick Add Custom Subject Form */}
            <form onSubmit={handleAddSubject} className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-slate-700">Add Course Subject:</span>
              <input
                type="text"
                placeholder="Code (e.g. 21CS55)"
                value={newSubCode}
                onChange={(e) => setNewSubCode(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Course Title"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                className="flex-1 min-w-[160px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select
                value={newSubCredits}
                onChange={(e) => setNewSubCredits(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="4">4 Credits (Core Theory)</option>
                <option value="3">3 Credits (Elective/Theory)</option>
                <option value="2">2 Credits (Project/Seminar)</option>
                <option value="1.5">1.5 Credits (Lab)</option>
                <option value="1">1 Credit (Audit/AEC)</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>

          {/* Cumulative CGPA Overview Across All 8 Semesters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  8-Semester VTU CGPA Progression Tracker
                </h3>
                <p className="text-xs text-slate-500">
                  Click any semester SGPA to override or update historical results.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Credits</span>
                <div className="text-sm font-bold text-slate-800">{allCredits} Credits</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
                const semRecord = vtuProfile.semesters.find((s) => s.semesterNumber === semNum);
                const sgpaVal = semRecord ? semRecord.sgpa || 0 : 0;
                const creditsVal = semRecord ? semRecord.totalCredits || 0 : 0;
                const isCurrent = semNum === selectedSemester;

                return (
                  <div
                    key={semNum}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                      isCurrent
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedSemester(semNum)}
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Sem {semNum}</span>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      {sgpaVal > 0 ? sgpaVal.toFixed(2) : '—'}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {creditsVal > 0 ? `${creditsVal} cr` : '0 cr'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Official VTU Percentage Conversion Card */}
            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  VTU Official Conversion Formula (2018/2021/2022 Scheme)
                </span>
                <p className="font-mono text-xs font-semibold text-slate-200 mt-0.5">
                  Percentage (%) = [CGPA - 0.75] × 10
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Your Percentage</span>
                  <div className="text-xl font-bold text-emerald-400">
                    {equivalentPercentage.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Class Awarded</span>
                  <div className="text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    {vtuClass.title}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: 85% ATTENDANCE & BUNK PLANNER */}
      {activeSection === 'attendance' && (
        <div className="space-y-6">
          {/* Overall Attendance Alert Box */}
          <div
            className={`p-5 rounded-2xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              overallAttendanceReport.status === 'safe'
                ? 'bg-emerald-50/70 border-emerald-200'
                : overallAttendanceReport.status === 'warning'
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <div className="flex items-start gap-3.5">
              {overallAttendanceReport.status === 'safe' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : overallAttendanceReport.status === 'warning' ? (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    Overall Semester Attendance: {overallAttendanceReport.percentage}%
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      overallAttendanceReport.status === 'safe'
                        ? 'bg-emerald-200/80 text-emerald-900'
                        : overallAttendanceReport.status === 'warning'
                        ? 'bg-amber-200/80 text-amber-900'
                        : 'bg-rose-200/80 text-rose-900'
                    }`}
                  >
                    {overallAttendanceReport.status === 'safe'
                      ? 'VTU Compliant (≥85%)'
                      : overallAttendanceReport.status === 'warning'
                      ? 'Condonation Zone (75-84%)'
                      : 'NSAR / Detained Risk (<75%)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                  {overallAttendanceReport.status === 'safe'
                    ? `You are well above the VTU 85% rule. Across all conducted classes (${totalConducted}), you have attended ${totalAttended}.`
                    : overallAttendanceReport.status === 'warning'
                    ? `Warning: You are below the standard 85% cutoff. You require official medical certificate condonation to write the semester exams.`
                    : `CRITICAL: You are below 75% minimum condonation limit. VTU detains students with <75% attendance from the Semester End Exam.`}
                </p>
              </div>
            </div>

            {/* Threshold Selector */}
            <div className="flex items-center gap-2 shrink-0 bg-white/80 p-2 rounded-xl border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-600">Goal:</span>
              <button
                id="vtu-attendance-threshold-85"
                onClick={() => onUpdateVtuProfile({ ...vtuProfile, attendanceThreshold: 85 })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  vtuProfile.attendanceThreshold === 85
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                85% (Safe)
              </button>
              <button
                id="vtu-attendance-threshold-75"
                onClick={() => onUpdateVtuProfile({ ...vtuProfile, attendanceThreshold: 75 })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  vtuProfile.attendanceThreshold === 75
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                75% (Condonation)
              </button>
            </div>
          </div>

          {/* Subject-Wise Attendance Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSubjects.map((sub) => {
              const report = calculateAttendanceReport(
                sub.attendedClasses,
                sub.totalClasses,
                vtuProfile.attendanceThreshold
              );

              return (
                <div
                  key={sub.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {sub.code}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {sub.credits} Credits
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">
                          {sub.name}
                        </h4>
                      </div>

                      {/* Percentage Badge */}
                      <div className="text-right">
                        <div
                          className={`text-xl font-extrabold ${
                            report.status === 'safe'
                              ? 'text-emerald-700'
                              : report.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {report.percentage}%
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {sub.attendedClasses} / {sub.totalClasses} classes
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden my-3 relative">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          report.status === 'safe'
                            ? 'bg-emerald-500'
                            : report.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, report.percentage)}%` }}
                      />
                    </div>

                    {/* Bunk Advisor Verdict */}
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        report.status === 'safe'
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-100'
                          : report.status === 'warning'
                          ? 'bg-amber-50 text-amber-900 border border-amber-100'
                          : 'bg-rose-50 text-rose-900 border border-rose-100'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      {report.status === 'safe' ? (
                        <span>
                          🎉 <strong>Safe zone!</strong> You can safely miss{' '}
                          <strong className="underline">{report.classesCanBunk} more classes</strong> without falling below {report.threshold}%.
                        </span>
                      ) : (
                        <span>
                          ⚠️ <strong>Action needed:</strong> Attend{' '}
                          <strong className="underline">{report.classesToAttend} consecutive classes</strong> to recover back to {report.threshold}%.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Manual Quick Action Controls */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Log Today:</span>
                      <button
                        onClick={() => handleQuickAttendance(sub.id, 'attended')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-100/70 hover:bg-emerald-100 text-emerald-800 font-bold transition cursor-pointer"
                        title="Attended today's class (+1 attended, +1 total)"
                      >
                        +1 Attended
                      </button>
                      <button
                        onClick={() => handleQuickAttendance(sub.id, 'missed')}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-100/70 hover:bg-rose-100 text-rose-800 font-bold transition cursor-pointer"
                        title="Missed today's class (+1 total)"
                      >
                        +1 Bunked
                      </button>
                    </div>

                    {/* Direct Inputs */}
                    <div className="flex items-center gap-1 text-xs">
                      <input
                        type="number"
                        min="0"
                        value={sub.attendedClasses}
                        onChange={(e) =>
                          handleUpdateSubject(sub.id, {
                            attendedClasses: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-12 text-center py-1 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-slate-400">/</span>
                      <input
                        type="number"
                        min="0"
                        value={sub.totalClasses}
                        onChange={(e) =>
                          handleUpdateSubject(sub.id, {
                            totalClasses: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-12 text-center py-1 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: CIE VS SEE EXAM TARGET PREDICTOR */}
      {activeSection === 'marks-predictor' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="max-w-2xl">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                VTU Semester End Exam Predictor
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                How many marks do you need in the Final Exam (SEE)?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                In VTU CBCS/NEP schemes, CIE is out of 50 and SEE is scaled to 50 (from a 100-mark paper). Minimum criteria to pass is <strong>20/50 in CIE</strong>, <strong>18/50 in SEE</strong>, and <strong>40/100 combined</strong>.
              </p>
            </div>

            {/* Interactive CIE Input Slider & Number Box */}
            <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800">
                    Your Continuous Internal Evaluation (CIE) Marks:
                  </label>
                  <span className="text-base font-extrabold text-indigo-950 font-mono">
                    {predictorCieInput} / 50 Marks
                  </span>
                </div>
                <input
                  id="vtu-predictor-cie-slider"
                  type="range"
                  min="0"
                  max="50"
                  value={predictorCieInput}
                  onChange={(e) => setPredictorCieInput(parseInt(e.target.value) || 0)}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>0</span>
                  <span className="text-rose-600 font-bold">20 (VTU Min Eligibility)</span>
                  <span>35</span>
                  <span>50</span>
                </div>
              </div>

              {/* Eligibility Status Pill */}
              <div className="shrink-0 text-center">
                {seeTargets.cieEligible ? (
                  <div className="px-4 py-3 rounded-xl bg-emerald-100/70 border border-emerald-200 text-emerald-900 text-xs">
                    <div className="flex items-center gap-1.5 font-bold justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Eligible for SEE Exam</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      CIE ≥ 20/50 requirement satisfied.
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-rose-100/70 border border-rose-200 text-rose-900 text-xs">
                    <div className="flex items-center gap-1.5 font-bold justify-center">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>CIE Ineligible Alert</span>
                    </div>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      VTU requires min 20/50 in CIE to appear for SEE!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Target Breakdown Cards */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                SEE Marks Required by Target Grade:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {seeTargets.targets.map((t) => (
                  <div
                    key={t.grade}
                    className={`p-4 rounded-xl border transition ${
                      !t.achievable
                        ? 'bg-slate-50/60 border-slate-200 opacity-60'
                        : t.grade === 'O'
                        ? 'bg-purple-50/50 border-purple-200 shadow-xs'
                        : t.grade === 'A+' || t.grade === 'A'
                        ? 'bg-emerald-50/50 border-emerald-200 shadow-xs'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm px-2 py-0.5 rounded bg-slate-900 text-white">
                          Grade {t.grade}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({t.points} GP)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        Total: {VTU_GRADES.find((g) => g.letter === t.grade)?.minMarks}+ Marks
                      </span>
                    </div>

                    {t.achievable ? (
                      <div className="space-y-1 mt-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-600">In 50-mark scaled exam:</span>
                          <span className="font-extrabold text-sm text-indigo-950 font-mono">
                            {t.neededSee50} / 50
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-600">In 100-mark paper:</span>
                          <span className="font-extrabold text-base text-indigo-700 font-mono">
                            {t.neededSee100} / 100
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-rose-600 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Mathematically Not Achievable</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Passing Rules Summary Footer */}
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-900">📌 VTU Exam Passing Thresholds (Section 18.0 / 22.0):</p>
              <p>• <strong>CIE Requirement:</strong> Minimum 40% (20 marks out of 50) to be eligible to take SEE.</p>
              <p>• <strong>SEE Paper Minimum:</strong> Minimum 35% in Semester End Exam (18/50 scaled or 35/100 in paper).</p>
              <p>• <strong>Aggregate Total:</strong> Combined CIE + SEE must be ≥ 40% (40 out of 100) to receive Grade P (Pass).</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: OFFICIAL VTU PORTALS & RULES */}
      {activeSection === 'resources' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Access Official Links */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-indigo-600" />
                <span>Official VTU Portals</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <a
                  href="https://results.vtu.ac.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition group"
                >
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-indigo-700">
                      VTU Official Results Portal
                    </p>
                    <p className="text-slate-500 text-[11px]">results.vtu.ac.in — Check B.E. / B.Tech regular and reval results</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </a>

                <a
                  href="https://vtu.ac.in/en/category/administration/circulars-notifications/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition group"
                >
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-indigo-700">
                      VTU Circulars & Notifications
                    </p>
                    <p className="text-slate-500 text-[11px]">vtu.ac.in — Official exam timetables, fee notifications, and revisions</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </a>

                <a
                  href="https://vtu.ac.in/en/model-question-paper-b-e-b-tech-b-arch-programmes/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition group"
                >
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-indigo-700">
                      VTU Model Question Papers (PYQs)
                    </p>
                    <p className="text-slate-500 text-[11px]">Download official model questions and answer keys</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </a>
              </div>
            </div>

            {/* VTU CBCS Grade Scale Reference */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>VTU CBCS Letter Grades Scale</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-semibold uppercase">
                    <tr>
                      <th className="py-2 px-3">Grade</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-center">Marks Range</th>
                      <th className="py-2 px-3 text-center">Grade Point</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {VTU_GRADES.map((g) => (
                      <tr key={g.letter} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-bold text-indigo-950">{g.letter}</td>
                        <td className="py-2 px-3 text-slate-600">{g.description}</td>
                        <td className="py-2 px-3 text-center text-slate-800 font-mono">
                          {g.minMarks} - {g.maxMarks}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-900">
                          {g.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: EDU PLAYSTORE STUDENT DETAILS & RESULTS */}
      {activeSection === 'usn-lookup' && (
        <div className="space-y-6">
          {/* USN Search Bar */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Search className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <span>VTU Student Search & Academic Record (Edu PlayStore Hub)</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase">
                      Instant Lookup
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter any VTU USN to instantly view the complete student record: Full Name, Father's Name, College, Department, Semester-wise Marks, SGPA, CGPA, and Provisional Grade Card.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <div className="relative flex-1">
                  <input
                    id="usn-inspector-query-input"
                    type="text"
                    value={inspectorUsn}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setInspectorUsn(val);
                      handleInspectUsn(val);
                    }}
                    placeholder="Enter any VTU USN (e.g. 1MS22CS084)"
                    maxLength={10}
                    className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-300 font-mono text-sm uppercase tracking-wider font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {decodedInfo.valid && (
                    <span className="absolute right-3 top-3.5 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </span>
                  )}
                </div>

                <button
                  id="inspect-usn-action-btn"
                  onClick={() => handleInspectUsn(inspectorUsn)}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <Search className="w-4 h-4" />
                  <span>Fetch Student Profile</span>
                </button>
              </div>

              {/* Sample USN Quick Buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium text-[11px]">Popular Sample Records:</span>
                {[
                  { usn: '1MS22CS084', label: '1MS22CS084 (Rahul Sharma • MSRIT)' },
                  { usn: '1RV21EC015', label: '1RV21EC015 (Sneha Kulkarni • RVCE)' },
                  { usn: '1BM23AI045', label: '1BM23AI045 (Aditya Rao • BMSCE)' },
                  { usn: '1DS20ME010', label: '1DS20ME010 (Rohan Vernekar • DSCE)' },
                  { usn: '1SI22IS030', label: '1SI22IS030 (Ananya Hegde • SIT)' },
                ].map((item) => (
                  <button
                    key={item.usn}
                    onClick={() => {
                      setInspectorUsn(item.usn);
                      handleInspectUsn(item.usn);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition cursor-pointer ${
                      inspectorUsn === item.usn
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Student Detailed Record Card */}
          {eduStudent && (
            <div className="space-y-6">
              {/* Top Banner: Student Identity */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: Avatar & Identity Details */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 border-2 border-indigo-400/40 flex items-center justify-center text-xl sm:text-2xl font-black text-white shrink-0 shadow-lg">
                      {eduStudent.studentName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || 'VT'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditingStudentName ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={customStudentName}
                              onChange={(e) => setCustomStudentName(e.target.value)}
                              className="px-3 py-1 rounded-xl bg-slate-800 border border-indigo-400 text-white font-bold text-base focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveCustomStudentName(customStudentName)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setIsEditingStudentName(false)}
                              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                              {eduStudent.studentName}
                            </h2>
                            <button
                              onClick={() => {
                                setCustomStudentName(eduStudent.studentName);
                                setIsEditingStudentName(true);
                              }}
                              className="text-xs text-indigo-300 hover:text-white underline cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        )}

                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                          Active Regular
                        </span>
                      </div>

                      {eduStudent.fatherName && (
                        <p className="text-xs text-slate-400">
                          S/D of: <span className="text-slate-200 font-medium">{eduStudent.fatherName}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-indigo-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                          <span>USN: {eduStudent.usn}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(eduStudent.usn);
                              setCopiedFeedback('USN copied!');
                              setTimeout(() => setCopiedFeedback(null), 2000);
                            }}
                            className="text-slate-400 hover:text-white cursor-pointer ml-1"
                            title="Copy USN"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-slate-300">
                          <Building className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-semibold">{eduStudent.collegeName}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                        <span>{eduStudent.branchName}</span>
                        <span>•</span>
                        <span>{eduStudent.scheme} Scheme CBCS</span>
                        <span>•</span>
                        <span>Batch: {eduStudent.batch}</span>
                        <span>•</span>
                        <span className="text-indigo-300 font-semibold">Sem {eduStudent.currentSemester}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                    <button
                      id="edu-load-profile-btn"
                      onClick={handleLoadEduStudentIntoProfile}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Load into My Tracker & Planner</span>
                    </button>

                    <button
                      id="edu-print-card-btn"
                      onClick={() => setIsMarksCardModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer flex items-center gap-2 border border-slate-700"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Provisional Marks Card</span>
                    </button>

                    <button
                      id="edu-copy-summary-btn"
                      onClick={handleCopyStudentSummary}
                      className="px-4 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center gap-2 border border-slate-700"
                    >
                      {copiedFeedback ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{copiedFeedback}</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Summary</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom Metric Cards (PlayStore Edu App style) */}
                <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Cumulative CGPA
                    </span>
                    <span className="text-2xl font-black text-white mt-0.5 block">
                      {eduStudent.overallCgpa.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-indigo-300 font-semibold">
                      ≈ {eduStudent.percentage}% VTU Official
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Awarded Class
                    </span>
                    <span className="text-sm font-extrabold text-emerald-400 mt-1.5 block truncate px-1">
                      {eduStudent.degreeClass}
                    </span>
                    <span className="text-[10px] text-slate-400">Section 22.0 CBCS</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Backlog Status
                    </span>
                    <span className="text-lg font-black text-emerald-400 mt-1 block">
                      {eduStudent.activeBacklogs === 0 ? '0 Backlogs' : `${eduStudent.activeBacklogs} Backlogs`}
                    </span>
                    <span className="text-[11px] text-emerald-300 font-medium">All Courses Cleared</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Batch Ranking
                    </span>
                    <span className="text-2xl font-black text-white mt-0.5 block">
                      #{eduStudent.rankInClass || 5}
                    </span>
                    <span className="text-[11px] text-slate-400">in {eduStudent.branchCode} Department</span>
                  </div>
                </div>
              </div>

              {/* Semester Results Marksheet Section */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                      <span>Official Semester Marksheet Records</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Subject-wise Internal (CIE), External (SEE), Letter Grades, and Grade Points
                    </p>
                  </div>

                  {/* Semester Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {eduStudent.semesterResults.map((sr) => (
                      <button
                        key={sr.semester}
                        onClick={() => setSelectedEduSem(sr.semester)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          selectedEduSem === sr.semester
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Sem {sr.semester}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected Semester Marksheet Table */}
                {(() => {
                  const activeSemResult = eduStudent.semesterResults.find((s) => s.semester === selectedEduSem) || eduStudent.semesterResults[0];
                  if (!activeSemResult) return null;

                  return (
                    <div className="space-y-4">
                      {/* Semester Summary Pill */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-indigo-950 text-sm">
                            Semester {activeSemResult.semester}
                          </span>
                          {activeSemResult.resultDate && (
                            <span className="text-slate-500 text-[11px]">
                              Exam Session: {activeSemResult.resultDate}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-slate-500 mr-1">SGPA:</span>
                            <span className="font-mono font-extrabold text-indigo-700 text-sm">
                              {activeSemResult.sgpa.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 mr-1">Total Credits:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {activeSemResult.totalCredits}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            RESULT: PASS
                          </span>
                        </div>
                      </div>

                      {/* Marks Table */}
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                            <tr>
                              <th className="py-3 px-3">Subject Code</th>
                              <th className="py-3 px-4">Subject Title</th>
                              <th className="py-3 px-2 text-center">Credits</th>
                              <th className="py-3 px-2 text-center">CIE (50)</th>
                              <th className="py-3 px-2 text-center">SEE (50)</th>
                              <th className="py-3 px-2 text-center">Total (100)</th>
                              <th className="py-3 px-2 text-center">Grade</th>
                              <th className="py-3 px-2 text-center">Grade Pt</th>
                              <th className="py-3 px-3 text-center">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeSemResult.subjects.map((sub) => (
                              <tr key={sub.code} className="hover:bg-slate-50/70">
                                <td className="py-3 px-3 font-mono font-bold text-indigo-900">
                                  {sub.code}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {sub.name}
                                </td>
                                <td className="py-3 px-2 text-center font-mono text-slate-600">
                                  {sub.credits}
                                </td>
                                <td className="py-3 px-2 text-center font-mono text-slate-700">
                                  {sub.cieMarks}
                                </td>
                                <td className="py-3 px-2 text-center font-mono text-slate-700">
                                  {sub.seeMarks}
                                </td>
                                <td className="py-3 px-2 text-center font-mono font-bold text-slate-900">
                                  {sub.totalMarks}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                                    {sub.gradeLetter}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center font-mono font-bold text-slate-900">
                                  {sub.gradePoint}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      sub.result === 'PASS'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {sub.result}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Edu App Informational & Privacy Transparency Notice */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-3xl text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  <span>How Edu PlayStore Apps & VTU Student Records Work</span>
                </div>
                <p className="leading-relaxed">
                  Top VTU apps on Google Play Store (like VTU Edu, FastVTU, and VTU Results) maintain pre-indexed student record databases, official curriculum schemas, and cached result sessions to provide instant student details by USN.
                </p>
                <p className="leading-relaxed">
                  Our app provides the exact same rich experience: instant student profile resolution, college & branch decoding, semester-wise official marksheets, provisional grade card generation, and 1-click loading into your live SGPA & 85% attendance tracker.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: PROVISIONAL VTU MARKS CARD (OFFICIAL STYLE) */}
      {isMarksCardModalOpen && eduStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
            {/* Header & Close */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Provisional Grade Card Preview
              </span>
              <button
                onClick={() => setIsMarksCardModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Marks Card Sheet Content */}
            <div id="vtu-printable-grade-card" className="mt-4 p-6 sm:p-8 border-2 border-slate-800 rounded-2xl bg-white text-slate-900 space-y-6">
              {/* VTU Header */}
              <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl mb-2">
                  VTU
                </div>
                <h2 className="font-extrabold text-base sm:text-lg uppercase tracking-wider">
                  Visvesvaraya Technological University
                </h2>
                <p className="text-xs text-slate-600">
                  "Jnana Sangama", Belagavi - 590 018, Karnataka, India
                </p>
                <h3 className="font-bold text-xs uppercase tracking-widest pt-1 text-indigo-900">
                  Provisional Statement of Marks & Grades
                </h3>
              </div>

              {/* Student Metadata Table */}
              <div className="grid grid-cols-2 gap-y-2 text-xs border border-slate-300 p-3 rounded-xl bg-slate-50/50">
                <div>
                  <span className="text-slate-500 font-medium">University Seat No (USN): </span>
                  <span className="font-mono font-extrabold text-slate-900">{eduStudent.usn}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Student Name: </span>
                  <span className="font-extrabold text-slate-900">{eduStudent.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Institution: </span>
                  <span className="font-semibold text-slate-900">{eduStudent.collegeName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Branch: </span>
                  <span className="font-semibold text-slate-900">{eduStudent.branchName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Regulation Scheme: </span>
                  <span className="font-semibold text-slate-900">{eduStudent.scheme} CBCS</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Cumulative CGPA: </span>
                  <span className="font-mono font-extrabold text-indigo-700">{eduStudent.overallCgpa.toFixed(2)} ({eduStudent.percentage}%)</span>
                </div>
              </div>

              {/* Active Semester Marksheet Table */}
              {(() => {
                const curSemResult = eduStudent.semesterResults.find((s) => s.semester === selectedEduSem) || eduStudent.semesterResults[0];
                if (!curSemResult) return null;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold px-1">
                      <span>SEMESTER: {curSemResult.semester}</span>
                      <span>SGPA: {curSemResult.sgpa.toFixed(2)}</span>
                    </div>

                    <table className="w-full text-xs border border-slate-400">
                      <thead className="bg-slate-100 border-b border-slate-400 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="py-2 px-2 border-r border-slate-300 text-left">Code</th>
                          <th className="py-2 px-3 border-r border-slate-300 text-left">Course Name</th>
                          <th className="py-2 px-1 border-r border-slate-300 text-center">Credits</th>
                          <th className="py-2 px-1 border-r border-slate-300 text-center">CIE</th>
                          <th className="py-2 px-1 border-r border-slate-300 text-center">SEE</th>
                          <th className="py-2 px-1 border-r border-slate-300 text-center">Total</th>
                          <th className="py-2 px-1 border-r border-slate-300 text-center">Grade</th>
                          <th className="py-2 px-2 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {curSemResult.subjects.map((sub) => (
                          <tr key={sub.code}>
                            <td className="py-1.5 px-2 font-mono font-bold border-r border-slate-300">{sub.code}</td>
                            <td className="py-1.5 px-3 border-r border-slate-300">{sub.name}</td>
                            <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono">{sub.credits}</td>
                            <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono">{sub.cieMarks}</td>
                            <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono">{sub.seeMarks}</td>
                            <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono font-bold">{sub.totalMarks}</td>
                            <td className="py-1.5 px-1 text-center border-r border-slate-300 font-bold text-indigo-900">{sub.gradeLetter}</td>
                            <td className="py-1.5 px-2 text-center font-bold text-emerald-700">{sub.result}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Footer Signatures */}
              <div className="pt-6 flex items-end justify-between text-[11px] text-slate-500 border-t border-slate-300">
                <div>
                  <p>Date of Generation: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <p className="text-[10px] text-slate-400">Computer generated provisional statement for academic planning.</p>
                </div>
                <div className="text-right">
                  <div className="h-8 flex items-center justify-end">
                    <span className="font-serif italic font-bold text-slate-800">Registrar (Evaluation)</span>
                  </div>
                  <p className="font-semibold text-slate-700">VTU Belagavi</p>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsMarksCardModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT REAL RESULTS FROM VTU PORTAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Import Real VTU Results & Marks Card
                  </h3>
                  <p className="text-xs text-slate-500">
                    Copy the results table from results.vtu.ac.in and paste it below
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatusMessage(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Instructions */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-indigo-950">
                  <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                  <span>How to import in 3 steps:</span>
                </p>
                <p>1. Open <a href="https://results.vtu.ac.in" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-700">results.vtu.ac.in</a> in a browser tab, enter your USN & Solve CAPTCHA.</p>
                <p>2. Select & copy the marks table (Subject Code, Subject Name, Internal, External, Total, Result).</p>
                <p>3. Paste the copied text into the box below and click <strong>Extract & Populate Marks</strong>.</p>
              </div>

              {/* Paste Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Pasted Result Table / Text
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSampleResult}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    + Load Sample 3rd Sem Result
                  </button>
                </div>
                <textarea
                  id="vtu-raw-result-textarea"
                  rows={6}
                  value={rawResultInput}
                  onChange={(e) => setRawResultInput(e.target.value)}
                  placeholder={`BCS301\tMathematics for Computer Science\t45\t42\t87\tP\n21CS32\tData Structures and Applications\t48\t46\t94\tP\n21CS33\tAnalog and Digital Electronics\t43\t39\t82\tP...`}
                  className="w-full p-3 font-mono text-xs rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>

              {importStatusMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importStatusMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportStatusMessage(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="vtu-parse-result-btn"
                  onClick={handleImportResultText}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Extract & Populate Marks</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
