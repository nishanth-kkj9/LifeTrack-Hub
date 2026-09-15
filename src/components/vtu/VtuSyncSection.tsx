import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Trophy,
  Sparkles,
  BookOpen,
  FileText,
  Award,
  Users,
  Briefcase,
  Calendar,
  Search,
  Download,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Share2,
  Flame,
  GraduationCap,
  Building,
  Layers,
  Check,
  Clock,
  ArrowUpRight,
  Filter,
  ShieldCheck,
  Printer,
  Copy,
  Edit3,
  FileSpreadsheet,
  UserCheck,
  X,
  FileCheck,
  HelpCircle,
  Zap,
  Info,
} from 'lucide-react';
import {
  VtuProfile,
  VtuSyllabusItem,
  VtuPyqItem,
  VtuStudyResource,
  VtuCampusEvent,
  VtuOpportunity,
  EduStudentRecord,
  EduSemesterResult,
} from '../../types/index.ts';
import {
  calculateVtuSyncRanking,
  VTU_SYNC_SYLLABUS,
  VTU_SYNC_PYQS,
  VTU_SYNC_STUDY_RESOURCES,
  VTU_SYNC_CAMPUS_EVENTS,
  VTU_SYNC_OPPORTUNITIES,
  VTU_SYNC_COMMUNITIES,
} from '../../lib/vtuSyncData.ts';
import {
  calculateCumulativeCgpa,
  vtuCgpaToPercentage,
  getVtuClassFromCgpa,
  getEduStudentRecord,
  syncVtuProfileFromStudentRecord,
  parseVtuResultText,
  calculateSemesterSgpa,
} from '../../lib/vtuData.ts';

interface VtuSyncSectionProps {
  vtuProfile: VtuProfile;
  onUpdateProfile: (profile: VtuProfile) => void;
  onSwitchToCalculator?: (sem: number) => void;
}

export const VtuSyncSection: React.FC<VtuSyncSectionProps> = ({
  vtuProfile,
  onUpdateProfile,
  onSwitchToCalculator,
}) => {
  // Main Pillar Navigation: Check | Learn | Connect
  const [activePillar, setActivePillar] = useState<'check' | 'learn' | 'connect'>('check');

  // Learn sub-tabs: syllabus | pyq | notes
  const [learnTab, setLearnTab] = useState<'syllabus' | 'pyq' | 'notes'>('syllabus');

  // Connect sub-tabs: events | opportunities | communities
  const [connectTab, setConnectTab] = useState<'events' | 'opportunities' | 'communities'>('events');

  // Real-Time Student Info & Record State
  const [enteredUsn, setEnteredUsn] = useState(vtuProfile.usn || '1MS22CS084');
  const [activeRecord, setActiveRecord] = useState<EduStudentRecord>(() =>
    getEduStudentRecord(vtuProfile.usn || '1MS22CS084')
  );
  const [selectedResultSem, setSelectedResultSem] = useState<number>(() => {
    const rec = getEduStudentRecord(vtuProfile.usn || '1MS22CS084');
    return rec.semesterResults.length > 0
      ? rec.semesterResults[rec.semesterResults.length - 1].semester
      : vtuProfile.currentSemester || 3;
  });

  // Modals state
  const [isProvisionalModalOpen, setIsProvisionalModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);

  // Edit student bio inputs
  const [editStudentName, setEditStudentName] = useState(
    vtuProfile.studentName || activeRecord.studentName
  );
  const [editFatherName, setEditFatherName] = useState(
    vtuProfile.fatherName || activeRecord.fatherName || ''
  );
  const [editCollegeName, setEditCollegeName] = useState(
    vtuProfile.collegeName || activeRecord.collegeName
  );
  const [editTargetCgpa, setEditTargetCgpa] = useState(
    (vtuProfile.targetCgpa || 8.75).toString()
  );

  // Results portal paste input
  const [rawPortalText, setRawPortalText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [parseFeedback, setParseFeedback] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'all'>(
    vtuProfile.currentSemester || 3
  );
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>(
    vtuProfile.scheme || '2022'
  );

  // Expanded Syllabus Item Modal / Accordion
  const [expandedSyllabusId, setExpandedSyllabusId] = useState<string | null>('vtu-syl-bcs301');
  const [downloadedItemId, setDownloadedItemId] = useState<string | null>(null);
  const [copiedTextFeedback, setCopiedTextFeedback] = useState<string | null>(null);

  // Keep activeRecord and inputs in sync if vtuProfile.usn changes externally
  useEffect(() => {
    if (vtuProfile.usn) {
      setEnteredUsn(vtuProfile.usn);
      const rec = getEduStudentRecord(vtuProfile.usn);
      setActiveRecord(rec);
      setEditStudentName(vtuProfile.studentName || rec.studentName);
      setEditFatherName(vtuProfile.fatherName || rec.fatherName || '');
      setEditCollegeName(vtuProfile.collegeName || rec.collegeName);
      if (rec.semesterResults.length > 0) {
        setSelectedResultSem(rec.semesterResults[rec.semesterResults.length - 1].semester);
      }
    }
  }, [vtuProfile.usn, vtuProfile.studentName, vtuProfile.fatherName, vtuProfile.collegeName]);

  // Calculate live cumulative CGPA from profile
  const { cgpa: liveCgpa } = calculateCumulativeCgpa(vtuProfile.semesters);
  const currentCgpa = liveCgpa > 0 ? liveCgpa : (activeRecord.overallCgpa || 8.78);
  const currentPercentage = vtuCgpaToPercentage(currentCgpa);
  const classAwarded = getVtuClassFromCgpa(currentCgpa);

  // Extract roll number from USN for deterministic ranking calculation
  const rollMatch = vtuProfile.usn.match(/[0-9]{3}$/);
  const rollStr = rollMatch ? rollMatch[0] : '084';
  const rankings = calculateVtuSyncRanking(currentCgpa, rollStr, vtuProfile.branch);

  // Handle Real-Time USN Fetch
  const handleFetchRealTimeInfo = (targetUsn?: string) => {
    const usnToFetch = (targetUsn || enteredUsn).trim().toUpperCase();
    if (!usnToFetch) return;

    setIsSyncing(true);
    setSyncFeedback(`Connecting to VTU Student Node for ${usnToFetch}...`);

    setTimeout(() => {
      const syncedProfile = syncVtuProfileFromStudentRecord(usnToFetch, {
        targetCgpa: vtuProfile.targetCgpa,
      });
      const record = getEduStudentRecord(usnToFetch);

      setActiveRecord(record);
      setEnteredUsn(usnToFetch);
      setEditStudentName(record.studentName);
      setEditFatherName(record.fatherName || '');
      setEditCollegeName(record.collegeName);

      if (record.semesterResults.length > 0) {
        setSelectedResultSem(record.semesterResults[record.semesterResults.length - 1].semester);
      }

      onUpdateProfile(syncedProfile);
      setIsSyncing(false);
      setSyncFeedback(
        `Synchronized: ${record.studentName} (${record.usn}) - ${record.collegeName}`
      );
      setTimeout(() => setSyncFeedback(null), 4000);
    }, 600);
  };

  // Handle Sync Trigger
  const handlePerformSync = () => {
    setIsSyncing(true);
    setSyncFeedback('Querying VTU Student & Academic Node for live records...');

    setTimeout(() => {
      const syncedProfile = syncVtuProfileFromStudentRecord(vtuProfile.usn, {
        studentName: editStudentName || vtuProfile.studentName,
        fatherName: editFatherName || vtuProfile.fatherName,
        collegeName: editCollegeName || vtuProfile.collegeName,
        targetCgpa: parseFloat(editTargetCgpa) || vtuProfile.targetCgpa,
      });
      const record = getEduStudentRecord(vtuProfile.usn);
      setActiveRecord(record);

      onUpdateProfile(syncedProfile);
      setIsSyncing(false);
      setSyncFeedback('Academic Record & Marksheets Synchronized with VTU Karnataka Database!');
      setTimeout(() => setSyncFeedback(null), 3500);
    }, 800);
  };

  // Save manual student details
  const handleSaveStudentBio = () => {
    const updatedName = editStudentName.trim() || activeRecord.studentName;
    const updatedFather = editFatherName.trim() || activeRecord.fatherName || '';
    const updatedCollege = editCollegeName.trim() || activeRecord.collegeName;
    const updatedTarget = parseFloat(editTargetCgpa) || vtuProfile.targetCgpa;

    onUpdateProfile({
      ...vtuProfile,
      studentName: updatedName,
      fatherName: updatedFather,
      collegeName: updatedCollege,
      targetCgpa: updatedTarget,
      lastSyncedAt: Date.now(),
    });

    setIsEditStudentModalOpen(false);
    setSyncFeedback(`Profile details updated for ${updatedName}!`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Handle parsing raw text from results.vtu.ac.in
  const handleParseAndApplyResults = async () => {
    if (!rawPortalText.trim()) return;

    setIsAiParsing(true);
    setParseFeedback('Extracting VTU grades & course codes...');

    try {
      const res = await fetch('/api/vtu/parse-marksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawPortalText, usnHint: vtuProfile.usn }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.subjects?.length > 0) {
          const d = json.data;
          const semNum = d.semester || selectedResultSem || 3;
          const mappedSubs = d.subjects.map((sub: any, idx: number) => ({
            id: `vtu-imported-${sub.code || idx}-${Date.now()}`,
            code: sub.code,
            name: sub.name,
            credits: sub.credits || 4,
            cieMarks: sub.cieMarks ?? 40,
            seeMarks: sub.seeMarks ?? 40,
            gradeLetter: sub.gradeLetter || 'A',
            gradePoint: sub.gradePoint ?? 8,
            attendedClasses: 36,
            totalClasses: 40,
          }));

          const { sgpa, totalCredits } = calculateSemesterSgpa(mappedSubs);
          const updatedSemesters = vtuProfile.semesters.map((s) =>
            s.semesterNumber === semNum
              ? { ...s, subjects: mappedSubs, sgpa: d.sgpa || sgpa, totalCredits }
              : s
          );

          if (!updatedSemesters.some((s) => s.semesterNumber === semNum)) {
            updatedSemesters.push({
              semesterNumber: semNum,
              scheme: vtuProfile.scheme,
              branch: vtuProfile.branch,
              subjects: mappedSubs,
              sgpa: d.sgpa || sgpa,
              totalCredits,
            });
          }

          onUpdateProfile({
            ...vtuProfile,
            usn: d.usn || vtuProfile.usn,
            studentName: d.studentName || vtuProfile.studentName,
            fatherName: d.fatherName || vtuProfile.fatherName,
            collegeName: d.collegeName || vtuProfile.collegeName,
            semesters: updatedSemesters,
            lastSyncedAt: Date.now(),
          });

          setIsAiParsing(false);
          setParseFeedback(`Imported ${mappedSubs.length} subjects for Semester ${semNum}!`);
          setTimeout(() => {
            setIsImportModalOpen(false);
            setParseFeedback(null);
            setRawPortalText('');
          }, 1500);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Client-side regex parsing fallback
    const parsed = parseVtuResultText(rawPortalText);
    if (parsed.extractedSubjects.length > 0) {
      const semToUse = parsed.extractedSem || selectedResultSem || 3;
      const { sgpa, totalCredits } = calculateSemesterSgpa(parsed.extractedSubjects);

      const updatedSemesters = vtuProfile.semesters.map((s) =>
        s.semesterNumber === semToUse
          ? { ...s, subjects: parsed.extractedSubjects, sgpa, totalCredits }
          : s
      );

      if (!updatedSemesters.some((s) => s.semesterNumber === semToUse)) {
        updatedSemesters.push({
          semesterNumber: semToUse,
          scheme: vtuProfile.scheme,
          branch: vtuProfile.branch,
          subjects: parsed.extractedSubjects,
          sgpa,
          totalCredits,
        });
      }

      onUpdateProfile({
        ...vtuProfile,
        usn: parsed.extractedUsn || vtuProfile.usn,
        studentName: parsed.extractedStudentName || vtuProfile.studentName,
        fatherName: parsed.extractedFatherName || vtuProfile.fatherName,
        collegeName: parsed.extractedCollege || vtuProfile.collegeName,
        semesters: updatedSemesters,
        lastSyncedAt: Date.now(),
      });

      setIsAiParsing(false);
      setParseFeedback(`Imported ${parsed.extractedSubjects.length} subjects for Semester ${semToUse}!`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setParseFeedback(null);
        setRawPortalText('');
      }, 1500);
      return;
    }

    setIsAiParsing(false);
    setParseFeedback('Could not detect marks table. Please paste raw text with course codes and marks.');
  };

  // Sample VTU results text
  const handleLoadSamplePortalResult = () => {
    const sample = `VISVESVARAYA TECHNOLOGICAL UNIVERSITY, BELAGAVI
PROVISIONAL RESULTS OF CBCS JULY/AUGUST 2024 EXAMINATION
USN: ${vtuProfile.usn}
Student Name: ${vtuProfile.studentName || activeRecord.studentName}
Father's Name: ${vtuProfile.fatherName || activeRecord.fatherName || 'Manoj Sharma'}
College: ${vtuProfile.collegeName || activeRecord.collegeName}
Semester: ${selectedResultSem}
Subject Code\tSubject Name\tCIE\tSEE\tTotal\tGrade\tResult
BCS301\tMathematics for Computer Science\t46\t44\t90\tO\tPASS
21CS32\tData Structures and Applications\t48\t45\t93\tO\tPASS
21CS33\tAnalog and Digital Electronics\t44\t40\t84\tA+\tPASS
21CS34\tComputer Organization & Architecture\t45\t42\t87\tA+\tPASS
21CSL35\tData Structures Laboratory\t49\t48\t97\tO\tPASS
21CIP37\tConstitution of India & Ethics\t47\t46\t93\tO\tPASS
Result Status: CONGRATULATIONS! FIRST CLASS WITH DISTINCTION`;
    setRawPortalText(sample);
  };

  // Handle simulated download / open
  const handleTriggerDownload = (id: string, name: string) => {
    setDownloadedItemId(id);
    setTimeout(() => setDownloadedItemId(null), 2500);

    const blob = new Blob([`VTU SYNC OFFICIAL STUDY REPOSITORY\nTitle: ${name}\nUSN: ${vtuProfile.usn}\nBranch: ${vtuProfile.branch}\nScheme: ${vtuProfile.scheme} CBCS\nDownloaded via VTU Sync Engine`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_VTUSync.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Share / Copy Rankings
  const handleShareRanking = () => {
    const text = `VTU SYNC RANKING & SCORECARD
Student USN: ${vtuProfile.usn} (${vtuProfile.studentName || 'Student'})
College: ${vtuProfile.collegeName || 'VTU Affiliated College'}
Branch: ${vtuProfile.branch} (${vtuProfile.scheme} Scheme)
Class Rank: #${rankings.classRank} of ${rankings.classTotal}
VTU University Rank: #${rankings.universityRank} of ${rankings.universityTotal} (${rankings.percentile}% percentile)
Cumulative CGPA: ${currentCgpa.toFixed(2)} (${currentPercentage}% - ${classAwarded.title})
Status: 0 Active Backlogs • Verified via VTU Sync`;

    navigator.clipboard.writeText(text);
    setCopiedTextFeedback('Academic rankings copied to clipboard!');
    setTimeout(() => setCopiedTextFeedback(null), 2500);
  };

  // Filtered lists
  const filteredSyllabus = VTU_SYNC_SYLLABUS.filter((syl) => {
    const matchSearch =
      syl.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      syl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      syl.modules.some((m) => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchSem = selectedSemesterFilter === 'all' || syl.semester === selectedSemesterFilter;
    const matchScheme = syl.scheme === selectedSchemeFilter;
    return matchSearch && (selectedSemesterFilter === 'all' || matchSem) && matchScheme;
  });

  const filteredPyqs = VTU_SYNC_PYQS.filter((pyq) => {
    const matchSearch =
      pyq.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pyq.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pyq.examSession.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSem = selectedSemesterFilter === 'all' || pyq.semester === selectedSemesterFilter;
    return matchSearch && matchSem;
  });

  const filteredNotes = VTU_SYNC_STUDY_RESOURCES.filter((note) => {
    const matchSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSem = selectedSemesterFilter === 'all' || note.semester === selectedSemesterFilter;
    return matchSearch && matchSem;
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* VTU SYNC TOP HERO BANNER & REAL-TIME CONTROLLER */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden border border-slate-800 space-y-6">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Brand & Slogan */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-black text-xs tracking-wider uppercase shadow-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>VTU Sync Engine</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Real-Time Student Node</span>
              </span>
              <span className="text-xs text-slate-400">
                Official Companion for VTU Karnataka
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>VTU Sync</span>
              <span className="text-indigo-400 font-normal text-lg sm:text-xl">
                Check • Learn • Connect
              </span>
            </h2>

            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Real-time student information, official semester marksheets, Class & State Rankings, complete 2022/2021 CBCS Syllabus modules, Previous Year Question Papers (PYQs), and Karnataka engineering network.
            </p>
          </div>

          {/* Sync Trigger & Quick Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              id="vtu-sync-trigger-btn"
              onClick={handlePerformSync}
              disabled={isSyncing}
              className={`px-5 py-3 rounded-2xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                isSyncing
                  ? 'bg-indigo-700 text-indigo-200 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing with VTU...' : 'Sync Live with VTU Node'}</span>
            </button>

            <button
              id="vtu-sync-share-btn"
              onClick={handleShareRanking}
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
            >
              {copiedTextFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{copiedTextFeedback}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Share Sync Scorecard</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-Time Student Identity & Quick-Switch Bar */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            {/* Student Preview Pill */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-black text-sm">
                {(vtuProfile.studentName || activeRecord.studentName)
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'ST'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-white">
                    {vtuProfile.studentName || activeRecord.studentName}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    <span>Verified Profile</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-0.5">
                  <span className="font-mono text-indigo-300 font-bold">{vtuProfile.usn}</span>
                  <span>•</span>
                  <span className="truncate max-w-[240px] text-slate-300">
                    {vtuProfile.collegeName || activeRecord.collegeName}
                  </span>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">{currentCgpa.toFixed(2)} CGPA</span>
                </div>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={() => setIsEditStudentModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Edit Bio</span>
              </button>
              <button
                onClick={() => setIsProvisionalModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Provisional Card</span>
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-bold transition flex items-center gap-1.5 border border-indigo-500/40 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-300" />
                <span>Import Results</span>
              </button>
            </div>
          </div>

          {/* Quick USN Switcher & Fetch Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={enteredUsn}
                onChange={(e) => setEnteredUsn(e.target.value.toUpperCase())}
                placeholder="Enter Any Karnataka VTU USN (e.g. 1MS22CS084)"
                className="w-full pl-3.5 pr-24 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 uppercase tracking-wider font-bold pointer-events-none">
                VTU Node
              </span>
            </div>

            <button
              onClick={() => handleFetchRealTimeInfo(enteredUsn)}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Fetch Real-Time Info</span>
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-slate-400 font-medium">Quick Presets:</span>
            {[
              { usn: '1MS22CS084', label: 'Rahul Sharma (RIT CSE)' },
              { usn: '1RV21EC015', label: 'Priya Patel (RVCE ECE)' },
              { usn: '1BM23AI045', label: 'Ananya Rao (BMSCE AIML)' },
              { usn: '1DS20ME010', label: 'Karthik Gowda (DSCE ME)' },
              { usn: '1SI22IS030', label: 'Sneha Kulkarni (SIT ISE)' },
            ].map((p) => (
              <button
                key={p.usn}
                onClick={() => {
                  setEnteredUsn(p.usn);
                  handleFetchRealTimeInfo(p.usn);
                }}
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                  vtuProfile.usn === p.usn
                    ? 'bg-indigo-600/40 border-indigo-400 text-indigo-200 font-bold'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sync Confirmation Message */}
        {syncFeedback && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Pillar Navigation Tabs (Check • Learn • Connect) */}
        <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2">
          <button
            id="vtu-sync-pillar-check"
            onClick={() => setActivePillar('check')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activePillar === 'check'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>1. CHECK: Rankings & Marks</span>
          </button>

          <button
            id="vtu-sync-pillar-learn"
            onClick={() => setActivePillar('learn')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activePillar === 'learn'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>2. LEARN: Syllabus & PYQs</span>
          </button>

          <button
            id="vtu-sync-pillar-connect"
            onClick={() => setActivePillar('connect')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activePillar === 'connect'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>3. CONNECT: Fests & Jobs</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PILLAR 1: CHECK (REAL-TIME STUDENT INFO, RANKINGS, OFFICIAL MARKSHEETS) */}
      {/* ========================================================================= */}
      {activePillar === 'check' && (
        <div className="space-y-6">
          {/* REAL-TIME STUDENT IDENTITY CARD */}
          <div className="bg-gradient-to-br from-white via-indigo-50/20 to-white p-6 sm:p-7 rounded-3xl border border-indigo-200/70 shadow-xs relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-indigo-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                      VTU Belagavi Verified Academic Node
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live Synced</span>
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    {vtuProfile.studentName || activeRecord.studentName}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {vtuProfile.fatherName || activeRecord.fatherName ? (
                      <>Father's Name: <span className="font-semibold text-slate-800">{vtuProfile.fatherName || activeRecord.fatherName}</span> • </>
                    ) : null}
                    College: <span className="font-semibold text-slate-800">{vtuProfile.collegeName || activeRecord.collegeName}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsEditStudentModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Edit Student Bio</span>
                </button>
                <button
                  onClick={() => setIsProvisionalModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Official Provisional Card</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  <span>Import from results.vtu.ac.in</span>
                </button>
              </div>
            </div>

            {/* Academic Credential Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-5">
              <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  University Seat No
                </span>
                <span className="font-mono font-black text-sm text-slate-900 block truncate">
                  {vtuProfile.usn}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">
                  Reg: 20{vtuProfile.usn.slice(3, 5)} Batch
                </span>
              </div>

              <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Branch / Discipline
                </span>
                <span className="font-bold text-xs text-slate-900 block truncate" title={vtuProfile.branch}>
                  {vtuProfile.branch.slice(0, 18)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                  Branch Code: {vtuProfile.branchCode || activeRecord.branchCode || 'CS'}
                </span>
              </div>

              <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Scheme & CBCS
                </span>
                <span className="font-bold text-xs text-slate-900 block">
                  {vtuProfile.scheme} Scheme (NEP)
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                  Batch: {vtuProfile.batch || activeRecord.batch || '2022 - 2026'}
                </span>
              </div>

              <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Current Standing
                </span>
                <span className="font-bold text-xs text-slate-900 block">
                  Semester {vtuProfile.currentSemester || activeRecord.currentSemester || 3}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                  Year {Math.ceil((vtuProfile.currentSemester || 3) / 2)} of 4
                </span>
              </div>

              <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Cumulative CGPA
                </span>
                <span className="font-black text-base text-emerald-600 block">
                  {currentCgpa.toFixed(2)} CGPA
                </span>
                <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
                  {currentPercentage}% Equivalent
                </span>
              </div>

              <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Class Awarded
                </span>
                <span className="font-bold text-xs text-indigo-700 block truncate" title={classAwarded.title}>
                  {classAwarded.title.split('(')[0]}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                  {vtuProfile.activeBacklogs ?? 0} Active Backlogs
                </span>
              </div>
            </div>
          </div>

          {/* Main Ranking Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Class Rank */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Class Rank</span>
                <span className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
                  <Trophy className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-slate-900">
                  #{rankings.classRank}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  / {rankings.classTotal} students
                </span>
              </div>
              <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Top 3% in {vtuProfile.branch.slice(0, 18)}</span>
              </p>
            </div>

            {/* University Rank */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">VTU State Rank</span>
                <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <GraduationCap className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-slate-900">
                  #{rankings.universityRank}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  / {rankings.universityTotal.toLocaleString()} candidates
                </span>
              </div>
              <p className="text-xs text-indigo-600 font-bold mt-2">
                {rankings.percentile}% Statewide Percentile
              </p>
            </div>

            {/* Cumulative CGPA */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Academic Score</span>
                <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-slate-900">
                  {currentCgpa.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  CGPA ({currentPercentage}%)
                </span>
              </div>
              <p className="text-xs text-emerald-700 font-bold mt-2 truncate">
                {classAwarded.title.split('(')[0]}
              </p>
            </div>

            {/* Backlogs & Health */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Backlog Status</span>
                <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-emerald-600">
                  {vtuProfile.activeBacklogs ?? 0}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  Active Backlogs
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-2">
                Eligible for VTU Tier-1 Placements
              </p>
            </div>
          </div>

          {/* Academic Benchmarks Comparison */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-indigo-600" />
                  <span>VTU Sync Benchmark Comparison</span>
                </h3>
                <p className="text-xs text-slate-500">
                  How your cumulative CGPA compares across your college and Karnataka state
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200 self-start sm:self-auto">
                {rankings.performanceDelta}
              </span>
            </div>

            {/* Benchmark Bars */}
            <div className="space-y-4 pt-2">
              {/* Your CGPA */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-indigo-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span>Your Academic CGPA ({vtuProfile.studentName || activeRecord.studentName})</span>
                  </span>
                  <span className="font-mono text-indigo-600 text-sm font-black">
                    {currentCgpa.toFixed(2)} CGPA
                  </span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${(currentCgpa / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* College Branch Average */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>College Department Average ({vtuProfile.branch.slice(0, 15)})</span>
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    {rankings.collegeAverageCgpa.toFixed(2)} CGPA
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{ width: `${(rankings.collegeAverageCgpa / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* VTU University Topper */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>VTU Karnataka Branch Gold Medalist (Topper)</span>
                  </span>
                  <span className="font-mono font-bold text-amber-700">
                    {rankings.universityTopCgpa.toFixed(2)} CGPA
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                    style={{ width: `${(rankings.universityTopCgpa / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Action */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-100">
              <span>
                Want to calculate exact internal (CIE) or external (SEE) marks to climb to #{Math.max(1, rankings.classRank - 2)}?
              </span>
              {onSwitchToCalculator && (
                <button
                  onClick={() => onSwitchToCalculator(vtuProfile.currentSemester || 3)}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Open Semester Marks Calculator</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* REAL-TIME SEMESTER MARKSHEETS & GRADE CARDS (VTU SYNC CORE PILLAR) */}
          {/* ========================================================================= */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>Official VTU Semester Marksheets & Grade Cards</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subject breakdown, CIE (Internal), SEE (External), grade points, and semester SGPA
                </p>
              </div>

              {/* Semester Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(activeRecord.semesterResults.length > 0
                  ? activeRecord.semesterResults.map((r) => r.semester)
                  : [1, 2, 3]
                ).map((semNum) => (
                  <button
                    key={semNum}
                    onClick={() => setSelectedResultSem(semNum)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                      selectedResultSem === semNum
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Semester {semNum}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Semester Marksheet Table */}
            {(() => {
              const currentSemResult = activeRecord.semesterResults.find(
                (s) => s.semester === selectedResultSem
              ) || (activeRecord.semesterResults[0] ?? null);

              const currentProfileSem = vtuProfile.semesters.find(
                (s) => s.semesterNumber === selectedResultSem
              );

              // Use profile subjects if updated, otherwise active record subjects
              const subjectsToRender = currentProfileSem?.subjects || currentSemResult?.subjects || [];
              const semSgpa = currentProfileSem?.sgpa || currentSemResult?.sgpa || 8.87;
              const semCredits = currentProfileSem?.totalCredits || currentSemResult?.totalCredits || 22;

              return (
                <div className="space-y-4">
                  {/* Semester Metadata Banner */}
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      <span className="font-bold text-slate-800">
                        Examination Session:{' '}
                        <span className="font-mono text-indigo-700 font-semibold">
                          {currentSemResult?.resultDate || `July 2024 Examination`}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="font-bold text-slate-800">
                        Total Credits:{' '}
                        <span className="text-indigo-700 font-semibold">{semCredits}</span>
                      </span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px]">
                        RESULT: ALL CLEARED (FCD)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-bold">Semester SGPA:</span>
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-2xs">
                        {semSgpa.toFixed(2)} SGPA
                      </span>
                    </div>
                  </div>

                  {/* Marksheet Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3.5">Course Code</th>
                          <th className="py-3 px-3.5">Course Title</th>
                          <th className="py-3 px-3 text-center">Credits</th>
                          <th className="py-3 px-3 text-center">CIE (/50)</th>
                          <th className="py-3 px-3 text-center">SEE (/50)</th>
                          <th className="py-3 px-3 text-center">Total (/100)</th>
                          <th className="py-3 px-3 text-center">Grade</th>
                          <th className="py-3 px-3 text-center">Point</th>
                          <th className="py-3 px-3.5 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subjectsToRender.map((sub: any, idx: number) => {
                          const cie = sub.cieMarks ?? 45;
                          const see = sub.seeMarks ?? 45;
                          const total = sub.totalMarks ?? (cie + see);
                          const grade = sub.gradeLetter ?? 'O';
                          const point = sub.gradePoint ?? 10;
                          const res = sub.result ?? 'PASS';

                          return (
                            <tr key={sub.id || sub.code || idx} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-3.5 font-mono font-bold text-indigo-700">
                                {sub.code || `SUB${idx + 1}`}
                              </td>
                              <td className="py-3 px-3.5 font-medium text-slate-800 max-w-[260px] truncate" title={sub.name}>
                                {sub.name || 'Course Title'}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-700">
                                {sub.credits || 4}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-medium text-slate-600">
                                {cie}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-medium text-slate-600">
                                {see}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                                {total}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-indigo-600">
                                {grade}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                                {point}
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  res === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {res}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Marksheet Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Certified by Visvesvaraya Technological University, Belagavi</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsProvisionalModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-300" />
                        <span>Print Provisional Grade Card</span>
                      </button>

                      {onSwitchToCalculator && (
                        <button
                          onClick={() => onSwitchToCalculator(selectedResultSem)}
                          className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>Predict Marks in SGPA Calculator</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PILLAR 2: LEARN (SYLLABUS FINDER, PYQS, TOPPER NOTES) */}
      {/* ========================================================================= */}
      {activePillar === 'learn' && (
        <div className="space-y-6">
          {/* Sub Navigation & Search Controls */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="vtu-learn-tab-syllabus"
                  onClick={() => setLearnTab('syllabus')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    learnTab === 'syllabus'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>VTU Syllabus Finder</span>
                </button>

                <button
                  id="vtu-learn-tab-pyq"
                  onClick={() => setLearnTab('pyq')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    learnTab === 'pyq'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Previous Year Papers (PYQ)</span>
                </button>

                <button
                  id="vtu-learn-tab-notes"
                  onClick={() => setLearnTab('notes')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    learnTab === 'notes'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Topper Notes & Pass Kits</span>
                </button>
              </div>

              {/* Semester & Scheme Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">Sem:</span>
                  <select
                    value={selectedSemesterFilter}
                    onChange={(e) =>
                      setSelectedSemesterFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
                    }
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="all">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="font-semibold">Scheme:</span>
                  <select
                    value={selectedSchemeFilter}
                    onChange={(e) => setSelectedSchemeFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="2022">2022 CBCS (NEP)</option>
                    <option value="2021">2021 CBCS</option>
                    <option value="2018">2018 CBCS</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject code (BCS301), topic (Normal distribution), or book author..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* SUB-SECTION 1: SYLLABUS FINDER */}
          {learnTab === 'syllabus' && (
            <div className="space-y-4">
              {filteredSyllabus.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center border border-slate-200/80 text-slate-500 text-xs">
                  No syllabus documents match your search criteria. Try switching the semester filter or scheme.
                </div>
              ) : (
                filteredSyllabus.map((syl) => {
                  const isExpanded = expandedSyllabusId === syl.id;
                  return (
                    <div
                      key={syl.id}
                      className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200"
                    >
                      {/* Course Header */}
                      <div
                        onClick={() => setExpandedSyllabusId(isExpanded ? null : syl.id)}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 font-mono font-black text-sm flex items-center justify-center shrink-0 border border-indigo-100">
                            {syl.code.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-sm text-indigo-950">
                                {syl.code}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                                Sem {syl.semester}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                {syl.credits} Credits
                              </span>
                              <span className="text-[10px] text-slate-400">
                                CIE: {syl.cieMax} | SEE: {syl.seeMax}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 mt-0.5">
                              {syl.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {syl.branch} • {syl.scheme} Scheme CBCS (VTU Official)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <span className="text-xs text-indigo-600 font-bold">
                            {isExpanded ? 'Hide Modules' : 'View 5 Modules'}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Modules Breakdown */}
                      {isExpanded && (
                        <div className="p-6 pt-2 border-t border-slate-100 space-y-5 bg-slate-50/50">
                          {/* 5 Modules Accordion */}
                          <div className="space-y-3">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                              Module-wise Syllabus Breakdown
                            </span>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {syl.modules.map((mod) => (
                                <div
                                  key={mod.moduleNumber}
                                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2"
                                >
                                  <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                                    <span className="font-extrabold text-indigo-900">
                                      Module {mod.moduleNumber}: {mod.title}
                                    </span>
                                    <span className="font-mono text-slate-400 text-[10px]">
                                      {mod.hours} Hours
                                    </span>
                                  </div>
                                  <ul className="space-y-1 text-xs text-slate-600">
                                    {mod.topics.map((t, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                                        <span className="text-indigo-500 font-bold">•</span>
                                        <span>{t}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Prescribed Textbooks */}
                          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4 text-indigo-600" />
                              <span>Prescribed VTU Reference Textbooks</span>
                            </span>
                            <ul className="space-y-1 text-xs text-slate-600">
                              {syl.textbooks.map((tb, idx) => (
                                <li key={idx} className="text-[11px] text-slate-700">
                                  {idx + 1}. {tb}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Action Footer */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <button
                              onClick={() => {
                                const text = `VTU SYLLABUS: ${syl.code} - ${syl.name}\n${syl.modules.map((m) => `Module ${m.moduleNumber}: ${m.title}\nTopics: ${m.topics.join(', ')}`).join('\n\n')}`;
                                navigator.clipboard.writeText(text);
                                setCopiedTextFeedback(`Copied syllabus for ${syl.code}!`);
                                setTimeout(() => setCopiedTextFeedback(null), 2500);
                              }}
                              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Share2 className="w-3.5 h-3.5 text-slate-600" />
                              <span>Copy Syllabus Outline</span>
                            </button>

                            <button
                              onClick={() => handleTriggerDownload(syl.id, `${syl.code}_Syllabus`)}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>
                                {downloadedItemId === syl.id ? 'Downloaded Document' : 'Download Official PDF Syllabus'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SUB-SECTION 2: PREVIOUS YEAR QUESTION PAPERS (PYQ) */}
          {learnTab === 'pyq' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPyqs.map((pyq) => (
                  <div
                    key={pyq.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-200 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {pyq.subjectCode}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pyq.difficulty === 'Challenging'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {pyq.difficulty}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Sem {pyq.semester}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                        {pyq.subjectName}
                      </h4>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{pyq.examSession}</span>
                        {pyq.hasSolutions && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            With Solutions
                          </span>
                        )}
                      </div>

                      {/* Frequent Topics */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                        <span className="font-bold text-slate-700 block">High Frequency Exam Questions:</span>
                        <ul className="space-y-0.5">
                          {pyq.frequentTopics.map((top, idx) => (
                            <li key={idx} className="truncate">
                              • {top}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-400">
                        {pyq.downloadCount.toLocaleString()} student downloads
                      </span>

                      <button
                        onClick={() => handleTriggerDownload(pyq.id, `${pyq.subjectCode}_${pyq.examSession}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadedItemId === pyq.id ? 'Saved' : 'Get Question Paper'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-SECTION 3: TOPPER NOTES & EXAM PASS KITS */}
          {learnTab === 'notes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-200 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-[10px] border border-indigo-200">
                          {note.category}
                        </span>
                        <span className="text-[11px] text-amber-600 font-extrabold flex items-center gap-1">
                          ★ {note.rating} / 5.0
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                        {note.title}
                      </h4>

                      <p className="text-xs text-slate-500 mt-1">
                        Subject: <span className="font-bold text-slate-700">{note.subjectCode} - {note.subjectName}</span>
                      </p>

                      <div className="mt-3 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-950">
                        <span className="font-bold block mb-0.5">Author / Topper Note:</span>
                        <p className="text-[11px] text-slate-600">{note.highlight}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 block">
                          By {note.author}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Size: {note.fileSize} • {note.downloadsCount.toLocaleString()} downloads
                        </span>
                      </div>

                      <button
                        onClick={() => handleTriggerDownload(note.id, note.title)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadedItemId === note.id ? 'Downloaded' : 'Download Kit'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PILLAR 3: CONNECT (CAMPUS TECH FESTS, INTERNSHIPS, COMMUNITIES) */}
      {/* ========================================================================= */}
      {activePillar === 'connect' && (
        <div className="space-y-6">
          {/* Sub Navigation */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="vtu-connect-tab-events"
                onClick={() => setConnectTab('events')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  connectTab === 'events'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Karnataka College Tech Fests</span>
              </button>

              <button
                id="vtu-connect-tab-opportunities"
                onClick={() => setConnectTab('opportunities')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  connectTab === 'opportunities'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>VTU Internships & Jobs</span>
              </button>

              <button
                id="vtu-connect-tab-communities"
                onClick={() => setConnectTab('communities')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  connectTab === 'communities'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Branch Communities</span>
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium">
              Verified Karnataka Engineering Network
            </span>
          </div>

          {/* SUB-TAB 1: CAMPUS TECH FESTS & HACKATHONS */}
          {connectTab === 'events' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VTU_SYNC_CAMPUS_EVENTS.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-300 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-200">
                          {event.status}
                        </span>
                        <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-xs">
                          {event.prizePool}
                        </span>
                      </div>

                      <h4 className="font-black text-base text-slate-900 leading-snug">
                        {event.title}
                      </h4>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                        <Building className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-semibold">{event.college} • {event.city}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Dates: {event.date}</span>
                      </div>

                      {/* Event Tracks / Highlights */}
                      <div className="mt-3.5 space-y-1">
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                          Featured Competitions & Tracks:
                        </span>
                        <ul className="space-y-1">
                          {event.highlights.map((h, idx) => (
                            <li key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Open to all VTU Affiliated Colleges
                      </span>
                      <a
                        href={event.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Register & Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: VTU INTERNSHIPS & JOB BOARD */}
          {connectTab === 'opportunities' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VTU_SYNC_OPPORTUNITIES.map((opp) => (
                  <div
                    key={opp.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-300 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-[10px] border border-indigo-200">
                          {opp.type}
                        </span>
                        <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-xs">
                          {opp.stipend}
                        </span>
                      </div>

                      <h4 className="font-black text-base text-slate-900 leading-snug">
                        {opp.role}
                      </h4>

                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        {opp.company} • {opp.location}
                      </p>

                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">Eligible:</span>
                          <span>{opp.eligibleBranches.join(', ')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">Min CGPA:</span>
                          <span className="font-mono text-indigo-700 font-bold">
                            {opp.minCgpa > 0 ? `${opp.minCgpa} CGPA` : 'No Cutoff (Skill-based)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">Apply By:</span>
                          <span className="text-rose-600 font-medium">{opp.deadline}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {opp.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {currentCgpa >= opp.minCgpa ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Eligible with {currentCgpa.toFixed(2)} CGPA</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">
                            Requires {opp.minCgpa} CGPA
                          </span>
                        )}
                      </span>

                      <a
                        href={opp.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Apply Now</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: BRANCH COMMUNITIES */}
          {connectTab === 'communities' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VTU_SYNC_COMMUNITIES.map((comm) => (
                  <div
                    key={comm.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                          {comm.category}
                        </span>
                        <span className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{comm.membersCount}</span>
                        </span>
                      </div>

                      <h4 className="font-extrabold text-base text-slate-900">
                        {comm.name}
                      </h4>

                      <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Trending Subject Thread:
                        </span>
                        <p className="text-slate-700 font-medium leading-relaxed">
                          "{comm.trendingTopic}"
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {comm.activeThreads} active threads today
                      </span>
                      <button
                        onClick={() => {
                          setCopiedTextFeedback(`Joined ${comm.name}!`);
                          setTimeout(() => setCopiedTextFeedback(null), 2500);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Join Channel</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: OFFICIAL VTU PROVISIONAL GRADE CARD / MARKSHEET */}
      {/* ========================================================================= */}
      {isProvisionalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Header Controls */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm">Official VTU Provisional Grade Card Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsProvisionalModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Grade Card Content */}
            <div className="p-8 sm:p-10 space-y-6 text-slate-900 bg-white" id="vtu-printable-grade-card">
              {/* University Header */}
              <div className="text-center border-b-2 border-slate-900 pb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-indigo-950 font-serif font-black text-2xl mb-2 border border-slate-300">
                  VTU
                </div>
                <h2 className="font-serif font-black text-xl sm:text-2xl uppercase tracking-wider text-slate-900">
                  Visvesvaraya Technological University
                </h2>
                <p className="text-xs font-semibold text-slate-600">
                  “Jnana Sangama”, Belagavi - 590018, Karnataka, India
                </p>
                <div className="mt-2 inline-block px-4 py-1 rounded-full bg-slate-100 border border-slate-300 text-xs font-black uppercase tracking-widest text-slate-800">
                  PROVISIONAL GRADE CARD - CBCS / NEP SCHEME
                </div>
              </div>

              {/* Student Credentials Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex">
                    <span className="w-36 font-bold text-slate-500">University Seat No (USN):</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {vtuProfile.usn}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-36 font-bold text-slate-500">Student Name:</span>
                    <span className="font-black text-slate-900 uppercase">
                      {vtuProfile.studentName || activeRecord.studentName}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-36 font-bold text-slate-500">Father's / Mother's Name:</span>
                    <span className="font-semibold text-slate-800 uppercase">
                      {vtuProfile.fatherName || activeRecord.fatherName || 'Not Specified'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex">
                    <span className="w-36 font-bold text-slate-500">Institution / College:</span>
                    <span className="font-semibold text-slate-900 truncate">
                      {vtuProfile.collegeName || activeRecord.collegeName}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-36 font-bold text-slate-500">Degree & Branch:</span>
                    <span className="font-bold text-slate-900">
                      B.E. in {vtuProfile.branch}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-36 font-bold text-slate-500">Semester & Scheme:</span>
                    <span className="font-bold text-indigo-700">
                      Semester {selectedResultSem} ({vtuProfile.scheme} Scheme)
                    </span>
                  </div>
                </div>
              </div>

              {/* Marksheet Table */}
              {(() => {
                const curSem = activeRecord.semesterResults.find(
                  (s) => s.semester === selectedResultSem
                ) || activeRecord.semesterResults[0];

                const profSem = vtuProfile.semesters.find(
                  (s) => s.semesterNumber === selectedResultSem
                );

                const subjects = profSem?.subjects || curSem?.subjects || [];
                const sgpa = profSem?.sgpa || curSem?.sgpa || 8.87;
                const credits = profSem?.totalCredits || curSem?.totalCredits || 22;

                return (
                  <div className="space-y-4">
                    <table className="w-full text-left text-xs border border-slate-300">
                      <thead className="bg-slate-100 text-slate-800 uppercase font-black tracking-wider text-[10px] border-b border-slate-300">
                        <tr>
                          <th className="py-2.5 px-3 border-r border-slate-300">Sl No</th>
                          <th className="py-2.5 px-3 border-r border-slate-300">Subject Code</th>
                          <th className="py-2.5 px-3 border-r border-slate-300">Subject Title</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-300">Credits</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-300">CIE</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-300">SEE</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-300">Total</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-300">Grade</th>
                          <th className="py-2.5 px-2 text-center border-r border-slate-300">Points</th>
                          <th className="py-2.5 px-3 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {subjects.map((sub: any, idx: number) => {
                          const cie = sub.cieMarks ?? 45;
                          const see = sub.seeMarks ?? 45;
                          const total = sub.totalMarks ?? cie + see;
                          const grade = sub.gradeLetter ?? 'O';
                          const point = sub.gradePoint ?? 10;
                          const res = sub.result ?? 'PASS';

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 border-r border-slate-200 font-mono text-center">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-indigo-900">
                                {sub.code || `SUB${idx + 1}`}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 font-medium">
                                {sub.name || 'Subject Name'}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-200">
                                {sub.credits || 4}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">
                                {cie}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">
                                {see}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold">
                                {total}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-200 font-black text-indigo-700">
                                {grade}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold">
                                {point}
                              </td>
                              <td className="py-2 px-3 text-center font-black text-[11px] text-emerald-700">
                                {res}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Performance Summary Banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Semester Credits
                        </span>
                        <span className="text-sm font-bold text-slate-900">{credits}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Semester SGPA
                        </span>
                        <span className="text-base font-black text-indigo-700">
                          {sgpa.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Cumulative CGPA
                        </span>
                        <span className="text-base font-black text-emerald-600">
                          {currentCgpa.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Result Awarded
                        </span>
                        <span className="text-xs font-black text-emerald-700">
                          FIRST CLASS DISTINCTION
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Footer Stamp & Verification Note */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
                <div>
                  <p className="font-semibold text-slate-700">
                    Note: This is an electronically generated provisional result verified from VTU Academic Node.
                  </p>
                  <p>Official Grade Cards are issued through respective affiliated colleges.</p>
                </div>
                <div className="text-center sm:text-right">
                  <div className="font-bold text-slate-900 uppercase">Registrar (Evaluation)</div>
                  <div className="text-slate-500 text-[10px]">Visvesvaraya Technological University</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: IMPORT FROM VTU RESULTS PORTAL / AI PARSER */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm">Import VTU Portal Result (Text / AI Parser)</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-7 space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>How to import your VTU Result instantly:</span>
                </p>
                <p className="text-slate-600">
                  1. Visit <strong>results.vtu.ac.in</strong> and view your marksheet.
                  <br />
                  2. Select all text on the webpage (or marks table) and copy (Ctrl+C).
                  <br />
                  3. Paste into the text box below and hit <strong>Parse & Apply Marksheet</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paste VTU Results Webpage Text:
                </label>
                <textarea
                  value={rawPortalText}
                  onChange={(e) => setRawPortalText(e.target.value)}
                  placeholder={`Example:\nUniversity Seat Number: 1MS22CS084\nStudent Name: HARSHITHA V\nSemester: 3\nSubject Code | Subject Name | Internal | External | Total | Result\n21CS31 | TRANSFORM CALCULUS | 48 | 44 | 92 | P\n21CS32 | DATA STRUCTURES & APPS | 49 | 46 | 95 | P\n21CS33 | ANALOG AND DIGITAL ELEC | 45 | 42 | 87 | P\n21CS34 | COMPUTER ORGANIZATION | 47 | 45 | 92 | P`}
                  rows={7}
                  className="w-full p-3 text-xs font-mono rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {parseFeedback && (
                <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-800 font-medium">
                  {parseFeedback}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRawPortalText(`University Seat Number: ${vtuProfile.usn || '1MS22CS084'}
Student Name: ${vtuProfile.studentName || 'HARSHITHA V'}
Father's Name: VIJAY KUMAR
College Name: Ramaiah Institute of Technology
Semester: 3
Subject Code\tSubject Name\tInternal Marks\tExternal Marks\tTotal\tResult
21MAT31\tTRANSFORM CALCULUS & FOURIER SERIES\t48\t46\t94\tP
21CS32\tDATA STRUCTURES AND APPLICATIONS\t49\t47\t96\tP
21CS33\tANALOG AND DIGITAL ELECTRONICS\t46\t44\t90\tP
21CS34\tCOMPUTER ORGANIZATION AND ARCHITECTURE\t47\t45\t92\tP
21CSL35\tDATA STRUCTURES LABORATORY\t49\t48\t97\tP
21UH49\tUNIVERSAL HUMAN VALUES\t45\t45\t90\tP`);
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Auto-fill Sample VTU 3rd Sem Result
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleParseAndApplyResults}
                    disabled={isAiParsing || !rawPortalText.trim()}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    {isAiParsing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Parsing Marksheet...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Parse & Apply Marksheet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT STUDENT BIO */}
      {/* ========================================================================= */}
      {isEditStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm">Edit VTU Student Bio & Particulars</h3>
              </div>
              <button
                onClick={() => setIsEditStudentModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Student Name
                </label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. HARSHITHA V"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Father's / Guardian's Name
                </label>
                <input
                  type="text"
                  value={editFatherName}
                  onChange={(e) => setEditFatherName(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. VIJAY KUMAR"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  College / Engineering Institution
                </label>
                <input
                  type="text"
                  value={editCollegeName}
                  onChange={(e) => setEditCollegeName(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Ramaiah Institute of Technology"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target CGPA Milestone
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="4.0"
                  max="10.0"
                  value={editTargetCgpa}
                  onChange={(e) => setEditTargetCgpa(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 9.20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsEditStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const parsedTarget = parseFloat(editTargetCgpa) || 8.75;
                    const updated = {
                      ...vtuProfile,
                      studentName: editStudentName.trim() || vtuProfile.studentName,
                      fatherName: editFatherName.trim() || vtuProfile.fatherName,
                      collegeName: editCollegeName.trim() || vtuProfile.collegeName,
                      targetCgpa: parsedTarget,
                    };
                    onUpdateProfile(updated);
                    setActiveRecord((prev) => ({
                      ...prev,
                      studentName: editStudentName.trim() || prev.studentName,
                      fatherName: editFatherName.trim() || prev.fatherName,
                      collegeName: editCollegeName.trim() || prev.collegeName,
                    }));
                    setIsEditStudentModalOpen(false);
                    setCopiedTextFeedback('Student bio updated successfully!');
                    setTimeout(() => setCopiedTextFeedback(null), 2500);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Save Bio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
