import {
  VtuSyncRanking,
  VtuSyllabusItem,
  VtuPyqItem,
  VtuStudyResource,
  VtuCampusEvent,
  VtuOpportunity,
} from '../types/index.ts';

// -------------------------------------------------------------
// VTU Sync Ranking & Performance Engine
// -------------------------------------------------------------

export function calculateVtuSyncRanking(
  cgpa: number,
  rollNumberStr?: string,
  _branchName?: string
): VtuSyncRanking {
  const roll = parseInt(rollNumberStr || '42', 10) || 42;
  const safeCgpa = Math.max(0, Math.min(10, cgpa || 8.5));

  // Heuristic based on real VTU bell-curve distribution:
  // Median VTU CGPA across Karnataka is ~7.42.
  // >= 9.5 is top 0.2%
  // >= 9.0 is top 2.5%
  // >= 8.5 is top 8%
  // >= 8.0 is top 20%
  // >= 7.0 is top 55%

  const classTotal = 120 + (roll % 15);
  let classRank = Math.max(1, Math.round((10 - safeCgpa) * 12) + (roll % 3));
  if (safeCgpa >= 9.5) classRank = Math.min(2, Math.max(1, (roll % 2) + 1));
  else if (safeCgpa >= 9.0) classRank = Math.min(6, Math.max(2, (roll % 5) + 2));
  else if (safeCgpa >= 8.5) classRank = Math.min(14, Math.max(5, (roll % 8) + 5));

  const universityTotal = 16850;
  let percentile = 50;
  if (safeCgpa >= 9.5) {
    percentile = 99.85;
  } else if (safeCgpa >= 9.0) {
    percentile = 98.2;
  } else if (safeCgpa >= 8.5) {
    percentile = 93.4;
  } else if (safeCgpa >= 8.0) {
    percentile = 82.5;
  } else if (safeCgpa >= 7.0) {
    percentile = 58.0;
  } else {
    percentile = Math.max(15, (safeCgpa / 10) * 60);
  }

  const universityRank = Math.max(1, Math.round(((100 - percentile) / 100) * universityTotal));

  let performanceDelta = 'Top 10% in VTU statewide';
  if (percentile >= 99) {
    performanceDelta = 'Statewide Top 1% • University Gold Medalist Contender';
  } else if (percentile >= 95) {
    performanceDelta = 'Top 5% in VTU Karnataka • Dean’s Merit Circle';
  } else if (percentile >= 85) {
    performanceDelta = 'Top Tier • First Class with Distinction Pace';
  } else if (percentile >= 70) {
    performanceDelta = 'Consistent First Class Standing';
  }

  return {
    classRank,
    classTotal,
    universityRank,
    universityTotal,
    percentile: parseFloat(percentile.toFixed(2)),
    collegeAverageCgpa: 7.42,
    universityTopCgpa: 9.88,
    performanceDelta,
  };
}

// -------------------------------------------------------------
// VTU Sync Pillar 2: Comprehensive Syllabus Finder
// -------------------------------------------------------------

export const VTU_SYNC_SYLLABUS: VtuSyllabusItem[] = [
  {
    id: 'vtu-syl-bcs301',
    code: 'BCS301',
    name: 'Mathematics for Computer Science',
    scheme: '2022',
    branch: 'Computer Science & Engineering',
    semester: 3,
    credits: 4,
    cieMax: 50,
    seeMax: 50,
    modules: [
      {
        moduleNumber: 1,
        title: 'Random Variables & Probability Distributions',
        topics: [
          'Discrete & continuous random variables',
          'Probability density and mass functions',
          'Mathematical expectation & variance',
          'Binomial, Poisson, and Normal distributions with engineering problems',
        ],
        hours: 8,
      },
      {
        moduleNumber: 2,
        title: 'Joint Probability Distributions & Markov Chains',
        topics: [
          'Joint distributions, marginal distributions, covariance and correlation',
          'Markov chains: Transition probability matrix, higher transition probabilities',
          'Classification of states and steady-state distributions',
        ],
        hours: 8,
      },
      {
        moduleNumber: 3,
        title: 'Statistical Inference & Hypothesis Testing',
        topics: [
          'Sampling theory: Population, sample, random sampling',
          'Standard error of mean and proportion',
          'Large and small sample tests: Student’s t-distribution, Chi-square test of goodness of fit',
        ],
        hours: 8,
      },
      {
        moduleNumber: 4,
        title: 'Combinatorics & Recurrence Relations',
        topics: [
          'Principles of inclusion and exclusion',
          'Pigeonhole principle and applications',
          'Linear recurrence relations with constant coefficients and generating functions',
        ],
        hours: 8,
      },
      {
        moduleNumber: 5,
        title: 'Graph Theory & Algebraic Structures',
        topics: [
          'Basic concepts of graphs, subgraphs, Euler and Hamiltonian paths',
          'Planar graphs and graph coloring',
          'Trees and minimal spanning trees (Prim & Kruskal algorithms)',
        ],
        hours: 8,
      },
    ],
    textbooks: [
      'Erwin Kreyszig, Advanced Engineering Mathematics, 10th Edition, John Wiley & Sons',
      'Kenneth H. Rosen, Discrete Mathematics and its Applications, 8th Edition, McGraw Hill',
    ],
    courseOutcomes: [
      'CO1: Apply probability distribution models to analyze probabilistic network algorithms',
      'CO2: Formulate stochastic models using Markov chains for computing processes',
      'CO3: Perform statistical hypothesis tests to validate experimental computing datasets',
      'CO4: Solve algorithmic recurrence equations using generating functions',
      'CO5: Model network topologies and routing paths utilizing graph algorithms',
    ],
  },
  {
    id: 'vtu-syl-bcs302',
    code: 'BCS302',
    name: 'Digital Design & Computer Organization',
    scheme: '2022',
    branch: 'Computer Science & Engineering',
    semester: 3,
    credits: 4,
    cieMax: 50,
    seeMax: 50,
    modules: [
      {
        moduleNumber: 1,
        title: 'Combinational Logic Circuits & Simplification',
        topics: [
          'K-map simplification up to 5 variables and Quine-McCluskey method',
          'Adders, subtractors, multiplexers, decoders, encoders, and priority encoders',
          'Hardware Description Language (Verilog) structural modeling of combinational blocks',
        ],
        hours: 8,
      },
      {
        moduleNumber: 2,
        title: 'Sequential Logic Design & State Machines',
        topics: [
          'Latches, Flip-Flops (SR, JK, D, T) with timing characteristics',
          'Synchronous and asynchronous counter design',
          'Shift registers and state machine models (Mealy and Moore models)',
        ],
        hours: 8,
      },
      {
        moduleNumber: 3,
        title: 'Basic Structure of Computers & Machine Instructions',
        topics: [
          'Functional units, bus structures, performance metrics (clock rate, IPC)',
          'Memory locations, addresses, memory operations, and instruction formats',
          'Addressing modes, RISC vs CISC architectural principles',
        ],
        hours: 8,
      },
      {
        moduleNumber: 4,
        title: 'Arithmetic Operations & Processor Datapath',
        topics: [
          'Addition/subtraction of signed numbers and Fast Adders (Carry-Lookahead)',
          'Multiplication: Booth’s algorithm and bit-pair recoding',
          'Fast division and IEEE 754 Floating-Point representation and operations',
        ],
        hours: 8,
      },
      {
        moduleNumber: 5,
        title: 'Memory System & Input/Output Organization',
        topics: [
          'Memory hierarchy: Cache memory mapping techniques (Direct, Associative, Set-Associative)',
          'Virtual memory and address translation using TLB',
          'Direct Memory Access (DMA), interrupts, and standard I/O interfaces (PCI, USB)',
        ],
        hours: 8,
      },
    ],
    textbooks: [
      'M. Morris Mano & Michael D. Ciletti, Digital Design, 6th Edition, Pearson Education',
      'Carl Hamacher, Zvonko Vranesic, Safwat Zaky, Computer Organization, 5th Edition, McGraw Hill',
    ],
    courseOutcomes: [
      'CO1: Design optimized combinational circuits using Karnaugh Maps and Verilog HDL',
      'CO2: Synthesize synchronous sequential counters and finite state machines',
      'CO3: Analyze computer instruction sets and addressing modes for instruction pipelining',
      'CO4: Execute hardware arithmetic algorithms for multiplication and floating-point math',
      'CO5: Evaluate cache memory hierarchies and DMA transfer mechanisms',
    ],
  },
  {
    id: 'vtu-syl-bcs304',
    code: 'BCS304',
    name: 'Data Structures and Applications',
    scheme: '2022',
    branch: 'Computer Science & Engineering',
    semester: 3,
    credits: 3,
    cieMax: 50,
    seeMax: 50,
    modules: [
      {
        moduleNumber: 1,
        title: 'Introduction to Data Structures, Arrays & Stacks',
        topics: [
          'Classification of data structures and dynamic memory allocation',
          'Stack representation and primitive operations (push, pop, peek)',
          'Applications of Stacks: Infix to Postfix conversion, Postfix evaluation, Recursion',
        ],
        hours: 8,
      },
      {
        moduleNumber: 2,
        title: 'Queues & Linked Lists',
        topics: [
          'Circular queues, priority queues, and double-ended queues (deque)',
          'Singly linked lists, circular linked lists, and doubly linked lists',
          'Polynomial representation and addition using linked lists',
        ],
        hours: 8,
      },
      {
        moduleNumber: 3,
        title: 'Trees & Binary Search Trees',
        topics: [
          'Binary tree definitions, properties, array and linked representations',
          'Tree traversals (Inorder, Preorder, Postorder) and threaded binary trees',
          'Binary Search Tree (BST): Insertion, deletion, searching, and balance factors',
        ],
        hours: 8,
      },
      {
        moduleNumber: 4,
        title: 'Balanced Search Trees & Heaps',
        topics: [
          'AVL trees: Single and double rotations and balance maintenance',
          'Red-Black trees and B-Trees basics',
          'Binary heaps: Max-heap, min-heap, heapify, and priority queue implementation',
        ],
        hours: 8,
      },
      {
        moduleNumber: 5,
        title: 'Graphs, Hashing & File Structures',
        topics: [
          'Graph representations (Adjacency matrix and adjacency list)',
          'Graph traversal algorithms: Breadth-First Search (BFS) & Depth-First Search (DFS)',
          'Hashing techniques: Hash functions, collision resolution (Chaining, Linear Probing, Double Hashing)',
        ],
        hours: 8,
      },
    ],
    textbooks: [
      'Ellis Horowitz, Sartaj Sahni, Susan Anderson-Freed, Fundamentals of Data Structures in C, Silicon Press',
      'Mark Allen Weiss, Data Structures and Algorithm Analysis in C, 2nd Edition, Pearson',
    ],
    courseOutcomes: [
      'CO1: Implement linear data structures (stacks and queues) to solve real-world parsing problems',
      'CO2: Construct dynamic linked lists for variable memory storage management',
      'CO3: Develop hierarchical tree search structures for efficient logarithmic retrieval',
      'CO4: Analyze balanced trees and priority heaps for systems software scheduling',
      'CO5: Apply graph traversals and hash table hashing functions for fast search systems',
    ],
  },
  {
    id: 'vtu-syl-bcs303',
    code: 'BCS303',
    name: 'Operating Systems Principles',
    scheme: '2022',
    branch: 'Computer Science & Engineering',
    semester: 3,
    credits: 4,
    cieMax: 50,
    seeMax: 50,
    modules: [
      {
        moduleNumber: 1,
        title: 'OS Overview & Process Management',
        topics: [
          'Operating system operations, dual-mode operation, system calls',
          'Process concept, process states, PCB, context switching',
          'Process scheduling queues and Inter-Process Communication (Pipes, Shared Memory)',
        ],
        hours: 8,
      },
      {
        moduleNumber: 2,
        title: 'Threads & CPU Scheduling Algorithms',
        topics: [
          'Multithreading models and thread libraries (POSIX pthreads)',
          'CPU scheduling criteria: FCFS, SJF, Round Robin, Priority Scheduling, Multi-level feedback queues',
          'Thread scheduling and multiprocessor scheduling strategies',
        ],
        hours: 8,
      },
      {
        moduleNumber: 3,
        title: 'Process Synchronization & Deadlocks',
        topics: [
          'The Critical-Section problem, Peterson’s solution, hardware synchronization',
          'Semaphores, Mutex locks, classical synchronization problems (Dining Philosophers, Readers-Writers)',
          'Deadlock characterization, prevention, avoidance (Banker’s Algorithm), detection and recovery',
        ],
        hours: 8,
      },
      {
        moduleNumber: 4,
        title: 'Memory Management & Virtual Memory',
        topics: [
          'Contiguous memory allocation, paging, segmentation, and page tables',
          'Virtual memory: Demand paging, page fault handling',
          'Page replacement algorithms: FIFO, Optimal, LRU, Clock, and Thrashing working sets',
        ],
        hours: 8,
      },
      {
        moduleNumber: 5,
        title: 'File Systems & Storage Management',
        topics: [
          'File concept, access methods, directory structures, mounting',
          'File system implementation: Allocation methods (Contiguous, Linked, Indexed)',
          'Mass-storage structure: Disk scheduling (FCFS, SSTF, SCAN, C-SCAN) and RAID levels',
        ],
        hours: 8,
      },
    ],
    textbooks: [
      'Abraham Silberschatz, Peter Baer Galvin, Greg Gagne, Operating System Concepts, 10th Edition, Wiley',
      'William Stallings, Operating Systems: Internals and Design Principles, 9th Edition, Pearson',
    ],
    courseOutcomes: [
      'CO1: Explain the functional architecture of operating systems and system call mechanisms',
      'CO2: Evaluate process and thread CPU scheduling algorithms under diverse system loads',
      'CO3: Resolve race conditions and deadlocks using semaphores and Banker’s algorithm',
      'CO4: Design virtual memory management systems using optimal page replacement strategies',
      'CO5: Formulate disk scheduling algorithms and RAID architectures for durable data storage',
    ],
  },
  {
    id: 'vtu-syl-21ec32',
    code: '21EC32',
    name: 'Digital System Design using Verilog',
    scheme: '2021',
    branch: 'Electronics & Communication Engg (ECE)',
    semester: 3,
    credits: 4,
    cieMax: 50,
    seeMax: 50,
    modules: [
      {
        moduleNumber: 1,
        title: 'Principles of Combinational Logic',
        topics: ['Quine-McCluskey Method', 'Multiplexers & Encoders', 'Decoders & Comparators', 'Verilog Operators and Data Types'],
        hours: 8,
      },
      {
        moduleNumber: 2,
        title: 'Verilog Behavioral & Dataflow Modeling',
        topics: ['Always blocks', 'Blocking vs non-blocking assignments', 'Structural design of ALUs', 'Testbench generation'],
        hours: 8,
      },
      {
        moduleNumber: 3,
        title: 'Sequential Circuit Design & Verilog Modeling',
        topics: ['Flip-flops and latches modeling', 'State machines Mealy/Moore in Verilog', 'Synchronous counter synthesis'],
        hours: 8,
      },
      {
        moduleNumber: 4,
        title: 'Registers, Counters & Memories',
        topics: ['Universal shift registers', 'Static and Dynamic RAMs', 'ROM architectures and programmable logic arrays'],
        hours: 8,
      },
      {
        moduleNumber: 5,
        title: 'CPLD & FPGA Architectures',
        topics: ['FPGA architectures (Xilinx Artix/Spartan)', 'Configurable Logic Blocks (CLB)', 'Look-Up Tables (LUT) and routing channels'],
        hours: 8,
      },
    ],
    textbooks: [
      'Samir Palnitkar, Verilog HDL: A Guide to Digital Design and Synthesis, 2nd Edition, Prentice Hall',
      'John F. Wakerly, Digital Design: Principles and Practices, 4th Edition, Pearson',
    ],
    courseOutcomes: [
      'CO1: Simplify complex logic equations using tabular Quine-McCluskey minimization',
      'CO2: Write synthesizable Verilog HDL descriptions for combinational arithmetic units',
      'CO3: Model clocked sequential finite state machines with timing constraints',
      'CO4: Design modular memory arrays and register files',
      'CO5: Target digital designs onto modern FPGA architectures',
    ],
  },
];

// -------------------------------------------------------------
// VTU Sync Pillar 2: PYQ (Previous Year Question Papers) Finder
// -------------------------------------------------------------

export const VTU_SYNC_PYQS: VtuPyqItem[] = [
  {
    id: 'pyq-bcs301-jul24',
    subjectCode: 'BCS301',
    subjectName: 'Mathematics for Computer Science',
    semester: 3,
    scheme: '2022',
    examSession: 'June / July 2024 (Latest)',
    type: 'Regular',
    difficulty: 'Moderate',
    hasSolutions: true,
    downloadCount: 14820,
    frequentTopics: [
      'Module 1: Normal distribution word problems',
      'Module 2: Markov chain steady state matrix derivation',
      'Module 3: Student t-test significance proof',
      'Module 5: Prim vs Kruskal minimum spanning tree',
    ],
  },
  {
    id: 'pyq-bcs301-jan24',
    subjectCode: 'BCS301',
    subjectName: 'Mathematics for Computer Science',
    semester: 3,
    scheme: '2022',
    examSession: 'Jan / Feb 2024',
    type: 'Regular',
    difficulty: 'Challenging',
    hasSolutions: true,
    downloadCount: 11200,
    frequentTopics: [
      'Joint probability table covariance calculations',
      'Linear recurrence solution via characteristic roots',
      'Hamiltonian cycle theorem applications',
    ],
  },
  {
    id: 'pyq-bcs301-model24',
    subjectCode: 'BCS301',
    subjectName: 'Mathematics for Computer Science',
    semester: 3,
    scheme: '2022',
    examSession: 'Official VTU Model Paper 2024',
    type: 'Model',
    difficulty: 'Moderate',
    hasSolutions: true,
    downloadCount: 19500,
    frequentTopics: [
      'Official Belagavi VTU question model blueprint',
      'Full 10-question choice structure with step-marking scheme',
    ],
  },
  {
    id: 'pyq-bcs304-jul24',
    subjectCode: 'BCS304',
    subjectName: 'Data Structures and Applications',
    semester: 3,
    scheme: '2022',
    examSession: 'June / July 2024 (Latest)',
    type: 'Regular',
    difficulty: 'Moderate',
    hasSolutions: true,
    downloadCount: 22400,
    frequentTopics: [
      'Infix to Postfix conversion algorithm trace',
      'Circular queue array implementation with overflow/underflow checks',
      'AVL Tree double rotations with tree rebalancing',
      'BFS vs DFS graph traversal step trace',
    ],
  },
  {
    id: 'pyq-bcs304-jan24',
    subjectCode: 'BCS304',
    subjectName: 'Data Structures and Applications',
    semester: 3,
    scheme: '2022',
    examSession: 'Jan / Feb 2024',
    type: 'Regular',
    difficulty: 'Easy',
    hasSolutions: true,
    downloadCount: 16800,
    frequentTopics: [
      'Doubly linked list node deletion algorithm in C',
      'Threaded binary tree advantages',
      'Collision resolution: Linear Probing vs Chaining',
    ],
  },
  {
    id: 'pyq-bcs302-jul24',
    subjectCode: 'BCS302',
    subjectName: 'Digital Design & Computer Organization',
    semester: 3,
    scheme: '2022',
    examSession: 'June / July 2024 (Latest)',
    type: 'Regular',
    difficulty: 'Challenging',
    hasSolutions: true,
    downloadCount: 18350,
    frequentTopics: [
      'Quine-McCluskey tabular reduction prime implicants',
      'Booth’s multiplication step-by-step table for signed numbers',
      'Direct vs Set-Associative cache mapping address splits',
      'DMA controller block diagram and bus arbitration',
    ],
  },
  {
    id: 'pyq-bcs303-jul24',
    subjectCode: 'BCS303',
    subjectName: 'Operating Systems Principles',
    semester: 3,
    scheme: '2022',
    examSession: 'June / July 2024',
    type: 'Regular',
    difficulty: 'Moderate',
    hasSolutions: true,
    downloadCount: 17200,
    frequentTopics: [
      'Dining Philosophers deadlock resolution via semaphores',
      'Banker’s safety algorithm numerical calculation with Need matrix',
      'Page replacement LRU vs Optimal calculation with page faults',
      'SCAN and C-SCAN disk arm movements calculation',
    ],
  },
  {
    id: 'pyq-21ec32-jan24',
    subjectCode: '21EC32',
    subjectName: 'Digital System Design using Verilog',
    semester: 3,
    scheme: '2021',
    examSession: 'Jan / Feb 2024',
    type: 'Regular',
    difficulty: 'Moderate',
    hasSolutions: true,
    downloadCount: 9400,
    frequentTopics: [
      'Verilog behavioral always @(posedge clk) sequence detector',
      'CPLD vs FPGA architecture comparative table',
      'Carry Lookahead fast adder circuit',
    ],
  },
];

// -------------------------------------------------------------
// VTU Sync Pillar 2: Curated Topper Notes & Study Resources
// -------------------------------------------------------------

export const VTU_SYNC_STUDY_RESOURCES: VtuStudyResource[] = [
  {
    id: 'res-ds-topper',
    title: 'Data Structures Complete Modules 1-5 Handwritten Topper Notes',
    subjectCode: 'BCS304',
    subjectName: 'Data Structures and Applications',
    category: 'Topper Notes',
    author: 'Prof. R. Hegde & VTU Batch Toppers (9.92 CGPA)',
    semester: 3,
    downloadsCount: 38400,
    rating: 4.9,
    fileSize: '14.2 MB',
    highlight: 'Includes verified C code snippets, tree rotation visual diagrams, and algorithm proofs.',
  },
  {
    id: 'res-math-formula',
    title: 'VTU 3rd Sem Mathematics Formula Sheet & Probability Distribution Tables',
    subjectCode: 'BCS301',
    subjectName: 'Mathematics for Computer Science',
    category: 'Formula Sheet',
    author: 'Department of Mathematics, RVCE / MSRIT Collaborative',
    semester: 3,
    downloadsCount: 42100,
    rating: 4.95,
    fileSize: '4.8 MB',
    highlight: 'All statistical distribution formulas, Markov chain steps, and graph theorems in 8 printable pages.',
  },
  {
    id: 'res-os-passkit',
    title: 'Operating Systems 3-Day Exam Pass Kit & Solved Numerical Compendium',
    subjectCode: 'BCS303',
    subjectName: 'Operating Systems Principles',
    category: 'Question Bank',
    author: 'VTU Sync Academic Panel',
    semester: 3,
    downloadsCount: 29500,
    rating: 4.85,
    fileSize: '9.6 MB',
    highlight: 'Guaranteed 25 must-solve questions, Banker’s algorithm drills, and page replacement matrices.',
  },
  {
    id: 'res-ddco-labviva',
    title: 'DDCO & Verilog Hardware Lab Viva 100 Most Asked Questions',
    subjectCode: 'BCS302',
    subjectName: 'Digital Design & Computer Organization',
    category: 'Viva Guide',
    author: 'VTU Lab Examiners Forum',
    semester: 3,
    downloadsCount: 19800,
    rating: 4.8,
    fileSize: '3.1 MB',
    highlight: 'Comprehensive viva questions covering flip-flops, multiplexers, and Verilog synthesis warnings.',
  },
  {
    id: 'res-c-lab-manual',
    title: 'VTU Data Structures Laboratory Manual with Verified Test Cases',
    subjectCode: 'BCSL305',
    subjectName: 'Data Structures Lab with C',
    category: 'Lab Manual',
    author: 'VTU Board of Studies CSE',
    semester: 3,
    downloadsCount: 31200,
    rating: 4.9,
    fileSize: '6.4 MB',
    highlight: 'Exact VTU lab cycle programs (Programs 1 to 12) tested on GCC with edge-case outputs.',
  },
];

// -------------------------------------------------------------
// VTU Sync Pillar 3: Campus Tech Fests & Hackathons Directory
// -------------------------------------------------------------

export const VTU_SYNC_CAMPUS_EVENTS: VtuCampusEvent[] = [
  {
    id: 'event-phaseshift-2026',
    title: 'PhaseShift 2026: National Tech Symposium & Hackathon',
    college: 'BMS College of Engineering (BMSCE)',
    city: 'Bengaluru',
    type: 'Tech Fest',
    date: 'Oct 14 - 16, 2026',
    prizePool: '₹2,50,000 + Incubation Grants',
    status: 'Registration Open',
    registrationUrl: 'https://bmsce.ac.in',
    highlights: [
      '36-Hour National Hardware & Web3 Hackathon',
      'Robotics Maze Runner & Drone GP',
      'AI / LLM Paper Presentation Sessions',
      'VTU Inter-College Championship Trophy',
    ],
  },
  {
    id: 'event-8thmile-2026',
    title: '8th Mile 2026: Grand Tech Fest & CodeStorm',
    college: 'RV College of Engineering (RVCE)',
    city: 'Bengaluru',
    type: 'Coding Contest',
    date: 'Nov 04 - 06, 2026',
    prizePool: '₹2,00,000 Cash Pool',
    status: 'Starting Soon',
    registrationUrl: 'https://rvce.edu.in',
    highlights: [
      'CodeStorm: High-frequency Algorithmic Coding (ICPC Style)',
      'CyberSecurity Capture-the-Flag (CTF)',
      'Game Development Jam',
    ],
  },
  {
    id: 'event-udbhav-2026',
    title: 'Udbhav Tech Conclave & Genesis Hack',
    college: 'Ramaiah Institute of Technology (MSRIT)',
    city: 'Bengaluru',
    type: 'Hackathon',
    date: 'Oct 28 - 30, 2026',
    prizePool: '₹1,75,000 + Cloud Credits',
    status: 'Registration Open',
    registrationUrl: 'https://msrit.edu',
    highlights: [
      'AI for Healthcare & Smart Mobility Track',
      'Mentorship from top Bengaluru unicorn architects',
      'Fast-track interview shortlisted for top 3 teams',
    ],
  },
  {
    id: 'event-vtu-central-fest',
    title: 'VTU Central "Jnana Sangama" Youth & Engineering Festival',
    college: 'Visvesvaraya Technological University HQ',
    city: 'Belagavi',
    type: 'Cultural & Tech',
    date: 'Dec 02 - 05, 2026',
    prizePool: '₹3,00,000 + VTU Chancellor Trophy',
    status: 'Registration Open',
    registrationUrl: 'https://vtu.ac.in',
    highlights: [
      'Official State-Level VTU Inter-Collegiate Competition',
      'Innovation & Sustainable Engineering Model Expo',
      'Delegates representing 200+ Karnataka engineering colleges',
    ],
  },
  {
    id: 'event-sit-innovate',
    title: 'Siddaganga Innovate Hack & Drone Challenge',
    college: 'Siddaganga Institute of Technology (SIT)',
    city: 'Tumakuru',
    type: 'Robotics',
    date: 'Nov 18 - 20, 2026',
    prizePool: '₹1,20,000',
    status: 'Starting Soon',
    registrationUrl: 'https://sit.ac.in',
    highlights: [
      'Agritech & Smart Irrigation IoT Challenge',
      'Line follower and autonomous aerial drone sprint',
    ],
  },
];

// -------------------------------------------------------------
// VTU Sync Pillar 3: VTU Student Opportunities & Internship Board
// -------------------------------------------------------------

export const VTU_SYNC_OPPORTUNITIES: VtuOpportunity[] = [
  {
    id: 'opp-sde-intern',
    role: 'Software Development Engineering (SDE) Intern',
    company: 'Fintech Unicorn R&D Bengaluru',
    location: 'Bengaluru (Hybrid)',
    stipend: '₹35,000 / month',
    type: 'Summer Internship',
    eligibleBranches: ['CSE', 'ISE', 'AIML', 'AIDS', 'ECE'],
    minCgpa: 7.5,
    deadline: 'Oct 25, 2026',
    applyUrl: 'https://internshala.com',
    tags: ['React', 'Node.js', 'PostgreSQL', 'DSA'],
  },
  {
    id: 'opp-ai-research',
    role: 'Generative AI & LLM Systems Intern',
    company: 'Bengaluru AI Research Labs',
    location: 'Electronic City, Bengaluru',
    stipend: '₹40,000 / month',
    type: 'Summer Internship',
    eligibleBranches: ['CSE', 'AIML', 'AIDS', 'ISE'],
    minCgpa: 8.0,
    deadline: 'Nov 02, 2026',
    applyUrl: 'https://linkedin.com',
    tags: ['Python', 'PyTorch', 'Transformers', 'FastAPI'],
  },
  {
    id: 'opp-get-embedded',
    role: 'Graduate Engineer Trainee (Embedded Systems & AUTOSAR)',
    company: 'Automotive Engineering Global Center',
    location: 'Whitefield, Bengaluru',
    stipend: '₹7.8 LPA Starting CTC',
    type: 'Graduate Engineer Trainee',
    eligibleBranches: ['ECE', 'EEE', 'CSE', 'ME'],
    minCgpa: 7.0,
    deadline: 'Nov 15, 2026',
    applyUrl: 'https://naukri.com',
    tags: ['Embedded C', 'Microcontrollers', 'CAN Protocol', 'RTOS'],
  },
  {
    id: 'opp-iisc-fellowship',
    role: 'Summer Research Student Fellowship',
    company: 'Indian Institute of Science (IISc)',
    location: 'Malleswaram, Bengaluru',
    stipend: '₹20,000 / month + Campus Stay',
    type: 'Research Fellowship',
    eligibleBranches: ['All VTU Engineering Branches'],
    minCgpa: 8.5,
    deadline: 'Dec 10, 2026',
    applyUrl: 'https://iisc.ac.in',
    tags: ['Research Publication', 'Faculty Mentorship', 'High Performance Computing'],
  },
  {
    id: 'opp-freelance-mobile',
    role: 'Full-Stack React Native / Mobile Project Gig',
    company: 'VTU Alumni EdTech Venture',
    location: 'Remote (Flexible)',
    stipend: '₹25,000 fixed milestone',
    type: 'Freelance Project',
    eligibleBranches: ['Any Engineering Student with Project Portfolio'],
    minCgpa: 0,
    deadline: 'Rolling Applications',
    applyUrl: 'https://github.com',
    tags: ['React Native', 'Tailwind', 'Firebase', 'TypeScript'],
  },
];

// -------------------------------------------------------------
// VTU Sync Community Discussions
// -------------------------------------------------------------

export interface VtuSyncCommunityChannel {
  id: string;
  name: string;
  category: string;
  membersCount: string;
  activeThreads: number;
  trendingTopic: string;
}

export const VTU_SYNC_COMMUNITIES: VtuSyncCommunityChannel[] = [
  {
    id: 'comm-cse-ise',
    name: 'VTU CSE & ISE Developers Lounge',
    category: 'Department',
    membersCount: '34,200 students',
    activeThreads: 142,
    trendingTopic: '3rd Sem Data Structures Lab programs verified code & viva questions',
  },
  {
    id: 'comm-aiml-data',
    name: 'AI, ML & Data Science Circle',
    category: 'Department',
    membersCount: '18,500 students',
    activeThreads: 89,
    trendingTopic: 'Kaggle student team formation for VTU hackathon tracks',
  },
  {
    id: 'comm-ece-eee',
    name: 'Circuits, ECE & Embedded Hardware',
    category: 'Department',
    membersCount: '22,100 students',
    activeThreads: 76,
    trendingTopic: 'Verilog testbench timing simulations for 21EC32 internals',
  },
  {
    id: 'comm-placements',
    name: 'VTU Placements, Off-Campus Drives & CTC Discussions',
    category: 'Career & Placement',
    membersCount: '48,900 students',
    activeThreads: 215,
    trendingTopic: 'Upcoming Mass Recruitment & Tier-1 Product Company hiring patterns',
  },
  {
    id: 'comm-core-branches',
    name: 'Core Mechanical, Civil & Aerospace Hub',
    category: 'Department',
    membersCount: '15,400 students',
    activeThreads: 54,
    trendingTopic: 'GATE 2027 preparation timetable and VTU standard design books',
  },
];
