export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskCategory = 'study' | 'work' | 'personal' | 'finance' | 'health' | 'project' | 'other';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskRecurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  completed: boolean;
  completedAt?: number;
  subtasks: Subtask[];
  createdAt: number;
  tags?: string[];
  estimatedMinutes?: number;
  actualMinutes?: number;
  isStarred?: boolean;
  recurring?: TaskRecurrence;
  status?: TaskStatus;
  notes?: string;
}

export type TransactionType = 'income' | 'expense';

export type FinanceCategory =
  | 'Tuition & Education'
  | 'Books & Supplies'
  | 'Housing & Rent'
  | 'Food & Dining'
  | 'Groceries'
  | 'Transportation'
  | 'Bills & Utilities'
  | 'Shopping'
  | 'Health & Wellness'
  | 'Salary & Wages'
  | 'Freelance & Gigs'
  | 'Allowance & Grants'
  | 'Investments & Savings'
  | 'Other';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: FinanceCategory;
  date: string; // YYYY-MM-DD
  paymentMethod: 'Card' | 'Cash' | 'Bank Transfer' | 'Online Wallet' | 'Other';
  notes?: string;
  createdAt: number;
}

export interface BudgetSettings {
  monthlyBudget: number;
  savingsGoal: number;
}

export type ExamStatus = 'not_started' | 'studying' | 'reviewing' | 'ready';

export interface ExamTopic {
  id: string;
  title: string;
  completed: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ExamReminder {
  id: string;
  subject: string;
  courseCode?: string;
  examDate: string; // YYYY-MM-DD
  examTime: string; // HH:mm
  roomOrVenue?: string;
  targetScore?: string;
  status: ExamStatus;
  topics: ExamTopic[];
  studyGuide?: string;
  sources?: GroundingSource[];
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  category?: string;
  targetDaysPerWeek: number;
  completedDates: string[]; // YYYY-MM-DD
  streak: number;
  bestStreak: number;
  createdAt: number;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  category?: string;
  pinned: boolean;
  updatedAt: number;
}

export type VtuGradeLetter = 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F';

export interface VtuSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  cieMarks?: number; // CIE out of 50
  seeMarks?: number; // SEE out of 50 or 100
  gradePoint?: number; // 0-10
  gradeLetter?: VtuGradeLetter;
  attendedClasses: number;
  totalClasses: number;
}

export interface VtuSemesterData {
  semesterNumber: number; // 1 to 8
  scheme: '2022' | '2021' | '2018';
  branch: string;
  subjects: VtuSubject[];
  sgpa?: number;
  totalCredits?: number;
}

export interface EduSubjectResult {
  code: string;
  name: string;
  credits: number;
  cieMarks: number;
  seeMarks: number;
  totalMarks: number;
  gradeLetter: VtuGradeLetter;
  gradePoint: number;
  result: 'PASS' | 'FAIL';
}

export interface EduSemesterResult {
  semester: number;
  sgpa: number;
  totalCredits: number;
  resultDate?: string;
  subjects: EduSubjectResult[];
}

export interface EduStudentRecord {
  usn: string;
  studentName: string;
  fatherName?: string;
  collegeCode: string;
  collegeName: string;
  branchCode: string;
  branchName: string;
  scheme: '2022' | '2021' | '2018';
  admissionYear: number;
  batch: string;
  currentSemester: number;
  overallCgpa: number;
  percentage: number;
  degreeClass: string;
  activeBacklogs: number;
  rankInClass?: number;
  semesterResults: EduSemesterResult[];
}

export interface VtuSyncRanking {
  classRank: number;
  classTotal: number;
  universityRank: number;
  universityTotal: number;
  percentile: number;
  collegeAverageCgpa: number;
  universityTopCgpa: number;
  performanceDelta: string;
}

export interface VtuSyllabusModule {
  moduleNumber: number;
  title: string;
  topics: string[];
  hours: number;
}

export interface VtuSyllabusItem {
  id: string;
  code: string;
  name: string;
  scheme: '2022' | '2021' | '2018';
  branch: string;
  semester: number;
  credits: number;
  cieMax: number;
  seeMax: number;
  modules: VtuSyllabusModule[];
  textbooks: string[];
  courseOutcomes: string[];
}

export interface VtuPyqItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  scheme: '2022' | '2021' | '2018';
  examSession: string; // e.g. "July 2024", "Jan 2024", "Model QP 2024"
  type: 'Regular' | 'Supplementary' | 'Model';
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  hasSolutions: boolean;
  downloadCount: number;
  frequentTopics: string[];
  previewUrl?: string;
}

export interface VtuStudyResource {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  category: 'Topper Notes' | 'Formula Sheet' | 'Lab Manual' | 'Question Bank' | 'Viva Guide';
  author: string;
  semester: number;
  downloadsCount: number;
  rating: number;
  fileSize: string;
  highlight: string;
}

export interface VtuCampusEvent {
  id: string;
  title: string;
  college: string;
  city: string;
  type: 'Tech Fest' | 'Hackathon' | 'Robotics' | 'Coding Contest' | 'Cultural & Tech';
  date: string;
  prizePool: string;
  status: 'Registration Open' | 'Starting Soon' | 'Closing Soon';
  registrationUrl: string;
  highlights: string[];
}

export interface VtuOpportunity {
  id: string;
  role: string;
  company: string;
  location: string;
  stipend: string;
  type: 'Summer Internship' | 'Graduate Engineer Trainee' | 'Research Fellowship' | 'Freelance Project';
  eligibleBranches: string[];
  minCgpa: number;
  deadline: string;
  applyUrl: string;
  tags: string[];
}

export interface VtuProfile {
  usn: string;
  studentName?: string;
  fatherName?: string;
  collegeCode?: string;
  collegeName?: string;
  branchCode?: string;
  scheme: '2022' | '2021' | '2018';
  currentSemester: number;
  branch: string;
  admissionYear?: number;
  batch?: string;
  semesters: VtuSemesterData[];
  targetCgpa: number;
  attendanceThreshold: 85 | 75;
  lastSyncedAt?: number;
  semesterResults?: EduSemesterResult[];
  activeBacklogs?: number;
  rankInClass?: number;
}

export interface UserAppData {
  tasks: Task[];
  transactions: Transaction[];
  budget: BudgetSettings;
  exams: ExamReminder[];
  habits: Habit[];
  notes: QuickNote[];
  vtuProfile?: VtuProfile;
  masterPlan?: string;
  lastUpdated?: number;
}
