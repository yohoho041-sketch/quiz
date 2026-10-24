"""
Seed data generator for the Quiz app.
Creates sample quizzes with offline diagram images (SVGs) so users can test immediately.
100% offline, zero internet or pip dependencies required.
"""

import os
import database

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")


def create_sample_images():
    """Create offline SVG sample diagrams in the uploads folder."""
    os.makedirs(UPLOADS_DIR, exist_ok=True)

    # 1. Computer Von Neumann Architecture Diagram
    von_neumann_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 350" width="100%" height="100%">
  <rect width="600" height="350" fill="#0f172a" rx="12"/>
  <rect x="30" y="30" width="540" height="290" fill="#1e293b" stroke="#334155" stroke-width="2" rx="8"/>
  <text x="300" y="60" text-anchor="middle" fill="#38bdf8" font-family="sans-serif" font-size="18" font-weight="bold">Von Neumann Architecture</text>
  
  <!-- CPU Box -->
  <rect x="60" y="90" width="220" height="180" fill="#090d16" stroke="#6366f1" stroke-width="2" stroke-dasharray="4" rx="6"/>
  <text x="170" y="115" text-anchor="middle" fill="#818cf8" font-family="sans-serif" font-size="14" font-weight="bold">Central Processing Unit (CPU)</text>
  
  <!-- ALU -->
  <rect x="80" y="135" width="180" height="45" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" rx="4"/>
  <text x="170" y="162" text-anchor="middle" fill="#f1f5f9" font-family="sans-serif" font-size="13">Arithmetic Logic Unit (ALU)</text>
  
  <!-- Control Unit -->
  <rect x="80" y="200" width="180" height="45" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" rx="4"/>
  <text x="170" y="227" text-anchor="middle" fill="#f1f5f9" font-family="sans-serif" font-size="13">Control Unit (CU) [ ? ]</text>
  
  <!-- Memory Box -->
  <rect x="360" y="100" width="180" height="70" fill="#090d16" stroke="#10b981" stroke-width="2" rx="6"/>
  <text x="450" y="130" text-anchor="middle" fill="#34d399" font-family="sans-serif" font-size="14" font-weight="bold">Memory Unit</text>
  <text x="450" y="152" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11">Data &amp; Instructions (RAM)</text>
  
  <!-- Input/Output Box -->
  <rect x="360" y="200" width="180" height="70" fill="#090d16" stroke="#f59e0b" stroke-width="2" rx="6"/>
  <text x="450" y="235" text-anchor="middle" fill="#fbbf24" font-family="sans-serif" font-size="14" font-weight="bold">Input / Output Devices</text>

  <!-- Connecting Arrows / Busses -->
  <path d="M 280 157 L 360 135" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M 280 225 L 360 235" stroke="#94a3b8" stroke-width="2"/>
  <text x="320" y="195" fill="#a5b4fc" font-size="11" font-family="sans-serif">System Bus</text>
</svg>"""

    # 2. Logic Gate Diagram
    logic_gate_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="100%" height="100%">
  <rect width="600" height="300" fill="#0f172a" rx="12"/>
  <text x="300" y="45" text-anchor="middle" fill="#38bdf8" font-family="sans-serif" font-size="18" font-weight="bold">Digital Logic Circuit</text>
  
  <!-- Inputs -->
  <line x1="80" y1="100" x2="200" y2="100" stroke="#38bdf8" stroke-width="3"/>
  <text x="60" y="105" fill="#e2e8f0" font-family="sans-serif" font-size="16" font-weight="bold">A (1)</text>

  <line x1="80" y1="160" x2="200" y2="160" stroke="#38bdf8" stroke-width="3"/>
  <text x="60" y="165" fill="#e2e8f0" font-family="sans-serif" font-size="16" font-weight="bold">B (0)</text>

  <!-- AND Gate -->
  <path d="M 200 80 L 250 80 A 50 50 0 0 1 250 180 L 200 180 Z" fill="#1e293b" stroke="#818cf8" stroke-width="2.5"/>
  <text x="235" y="135" text-anchor="middle" fill="#a5b4fc" font-family="sans-serif" font-size="14" font-weight="bold">AND</text>

  <!-- NOT Bubble at output -->
  <circle cx="305" cy="130" r="7" fill="#0f172a" stroke="#f43f5e" stroke-width="2.5"/>

  <!-- Output line -->
  <line x1="312" y1="130" x2="480" y2="130" stroke="#f43f5e" stroke-width="3"/>
  <text x="510" y="135" fill="#fb7185" font-family="sans-serif" font-size="18" font-weight="bold">Q = ?</text>
</svg>"""

    # 3. Biology Cell Structure Diagram
    cell_diagram_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 350" width="100%" height="100%">
  <rect width="600" height="350" fill="#0f172a" rx="12"/>
  <text x="300" y="40" text-anchor="middle" fill="#34d399" font-family="sans-serif" font-size="18" font-weight="bold">Cell Organelle Identification</text>

  <!-- Cell membrane -->
  <ellipse cx="300" cy="190" rx="250" ry="130" fill="#1e293b" stroke="#10b981" stroke-width="3"/>
  
  <!-- Mitochondria (indicated by Arrow and Target) -->
  <g transform="translate(140, 160) rotate(-25)">
    <ellipse cx="40" cy="20" rx="45" ry="22" fill="#0f172a" stroke="#fbbf24" stroke-width="2"/>
    <path d="M 10 20 Q 25 10 40 20 T 70 20" stroke="#f59e0b" stroke-width="2" fill="none"/>
  </g>
  
  <!-- Nucleus -->
  <circle cx="380" cy="190" r="55" fill="#312e81" stroke="#818cf8" stroke-width="2.5"/>
  <circle cx="380" cy="190" r="22" fill="#4338ca"/>
  <text x="380" y="240" text-anchor="middle" fill="#c7d2fe" font-size="12" font-family="sans-serif">Nucleus</text>

  <!-- Pointer to Mitochondria marked as [X] -->
  <line x1="160" y1="90" x2="175" y2="150" stroke="#f43f5e" stroke-width="2.5"/>
  <rect x="90" y="60" width="140" height="32" fill="#881337" stroke="#f43f5e" rx="6"/>
  <text x="160" y="81" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold">Organelle [X] ?</text>
</svg>"""

    files = {
        "von_neumann.svg": von_neumann_svg,
        "logic_gate.svg": logic_gate_svg,
        "cell_organelle.svg": cell_diagram_svg
    }

    for fname, content in files.items():
        fpath = os.path.join(UPLOADS_DIR, fname)
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)


def seed_database(force: bool = False):
    """Populate database with default sample quizzes only if force=True."""
    database.init_db()
    if not force:
        return

    create_sample_images()

    existing = database.list_quizzes()
    if existing:
        return  # already seeded

    # Quiz 1: Computer Science & Systems Architecture
    database.create_quiz({
        "title": "Computer Systems & Hardware Architecture",
        "description": "Test your knowledge on processor architecture, digital logic, and computing memory hierarchies.",
        "category": "Computer Science",
        "time_limit_minutes": 10,
        "questions": [
            {
                "question_text": "Examine the diagram of the Von Neumann Architecture below. What is the primary role of the highlighted Control Unit (CU)?",
                "image_url": "/uploads/von_neumann.svg",
                "explanation": "The Control Unit (CU) coordinates the components of the computer system by directing the flow of data and instructions between CPU, memory, and I/O devices according to the fetch-decode-execute cycle.",
                "options": [
                    {"option_text": "Performs mathematical arithmetic and binary boolean logic operations", "is_correct": False},
                    {"option_text": "Directs the operations of the processor and manages instruction execution", "is_correct": True},
                    {"option_text": "Holds permanent system firmware and bootstrap loader routines", "is_correct": False},
                    {"option_text": "Translates high-level programming language code into assembly", "is_correct": False}
                ]
            },
            {
                "question_text": "Based on the digital logic circuit shown below with inputs A = 1 and B = 0, what is the output Q of this NAND gate?",
                "image_url": "/uploads/logic_gate.svg",
                "explanation": "An AND gate with inputs 1 and 0 produces 0. The bubble represents a NOT operation (inversion), turning 0 into 1. Therefore, the NAND gate output Q is 1.",
                "options": [
                    {"option_text": "Q = 0", "is_correct": False},
                    {"option_text": "Q = 1", "is_correct": True},
                    {"option_text": "Q is High Impedance (Z)", "is_correct": False},
                    {"option_text": "Undefined state / Oscillation", "is_correct": False}
                ]
            },
            {
                "question_text": "Which level of processor cache is typically the fastest, smallest in capacity, and closest to the CPU core registers?",
                "image_url": "",
                "explanation": "L1 (Level 1) cache is the fastest and closest cache to the execution units on each CPU core, operating at near processor clock speeds.",
                "options": [
                    {"option_text": "L1 Cache", "is_correct": True},
                    {"option_text": "L2 Cache", "is_correct": False},
                    {"option_text": "L3 Shared Cache", "is_correct": False},
                    {"option_text": "DDR5 System RAM", "is_correct": False}
                ]
            },
            {
                "question_text": "In modern 64-bit operating systems, what is the purpose of Virtual Memory and Paging?",
                "image_url": "",
                "explanation": "Virtual memory maps process memory addresses to physical RAM or secondary storage (swap/paging file), providing memory isolation and allowing programs to use more memory than physical RAM.",
                "options": [
                    {"option_text": "To increase the clock frequency of the graphics card", "is_correct": False},
                    {"option_text": "To provide memory protection, isolation, and abstract physical RAM constraints", "is_correct": True},
                    {"option_text": "To permanently eliminate the need for physical RAM", "is_correct": False},
                    {"option_text": "To compress files stored on NVMe SSD drives", "is_correct": False}
                ]
            }
        ]
    })

    # Quiz 2: General Science & Cellular Biology
    database.create_quiz({
        "title": "General Science & Cell Biology",
        "description": "Identify vital cellular structures, energy conversion pathways, and fundamental biological functions.",
        "category": "Biology",
        "time_limit_minutes": 8,
        "positive_marks": 4.0,
        "negative_marks": 1.0,
        "questions": [
            {
                "question_type": "mcq",
                "question_text": "In the diagram of the eukaryotic animal cell below, identify organelle [X] known as the 'powerhouse of the cell'.",
                "image_url": "/uploads/cell_organelle.svg",
                "explanation": "Organelle [X] is the Mitochondrion, responsible for generating adenosine triphosphate (ATP) through cellular respiration.",
                "options": [
                    {"option_text": "Endoplasmic Reticulum", "is_correct": False},
                    {"option_text": "Golgi Apparatus", "is_correct": False},
                    {"option_text": "Mitochondrion", "is_correct": True},
                    {"option_text": "Lysosome", "is_correct": False}
                ]
            },
            {
                "question_type": "mcq",
                "question_text": "What chemical compound provides energy for biological processes within living cells?",
                "image_url": "",
                "explanation": "ATP (Adenosine Triphosphate) is the primary energy currency used by cells to fuel metabolic reactions.",
                "options": [
                    {"option_text": "ATP (Adenosine Triphosphate)", "is_correct": True},
                    {"option_text": "RNA (Ribonucleic Acid)", "is_correct": False},
                    {"option_text": "NaCl (Sodium Chloride)", "is_correct": False},
                    {"option_text": "H2O2 (Hydrogen Peroxide)", "is_correct": False}
                ]
            },
            {
                "question_type": "mcq",
                "question_text": "What is the process by which green plants and certain organisms use sunlight to synthesize nutrients from CO2 and water?",
                "image_url": "",
                "explanation": "Photosynthesis converts solar energy, carbon dioxide, and water into glucose and oxygen inside chloroplasts.",
                "options": [
                    {"option_text": "Fermentation", "is_correct": False},
                    {"option_text": "Glycolysis", "is_correct": False},
                    {"option_text": "Photosynthesis", "is_correct": True},
                    {"option_text": "Hydrolysis", "is_correct": False}
                ]
            }
        ]
    })

    # Quiz 3: JEE Main / Advanced Physics & Physical Chemistry Booster
    database.create_quiz({
        "title": "JEE Booster: Physics & Physical Chemistry",
        "description": "Authentic JEE pattern assessment featuring Section A Single Choice MCQs (+4, -1) and Section B Numerical / Integer Value questions (+4, 0 with zero negative penalty).",
        "category": "JEE Prep",
        "time_limit_minutes": 15,
        "positive_marks": 4.0,
        "negative_marks": 1.0,
        "questions": [
            {
                "question_type": "mcq",
                "question_text": "A Carnot engine operates between temperatures T1 = 500 K and T2 = 300 K. If it absorbs 1000 J of heat from the source in each cycle, what is the net work done per cycle?",
                "image_url": "",
                "explanation": "Efficiency η = 1 - (T2/T1) = 1 - (300/500) = 0.4. Work done W = η * Q_in = 0.4 * 1000 J = 400 J.",
                "options": [
                    {"option_text": "200 J", "is_correct": False},
                    {"option_text": "400 J", "is_correct": True},
                    {"option_text": "600 J", "is_correct": False},
                    {"option_text": "800 J", "is_correct": False}
                ]
            },
            {
                "question_type": "mcq",
                "question_text": "Which of the following organic compounds exhibits optical isomerism (chirality)?",
                "image_url": "",
                "explanation": "2-chlorobutane (CH3-CH(Cl)-CH2-CH3) has an asymmetric / chiral carbon center bonded to four different groups: -H, -Cl, -CH3, and -C2H5.",
                "options": [
                    {"option_text": "2-chlorobutane", "is_correct": True},
                    {"option_text": "1-chlorobutane", "is_correct": False},
                    {"option_text": "2-methylpropane", "is_correct": False},
                    {"option_text": "Propanoic acid", "is_correct": False}
                ]
            },
            {
                "question_type": "integer",
                "question_text": "A projectile is launched from flat ground with initial speed v = 40 m/s at an angle of 30° above the horizontal. Taking g = 10 m/s², find the maximum height H achieved in meters.",
                "image_url": "",
                "explanation": "Vertical velocity vy = v * sin(30°) = 40 * 0.5 = 20 m/s. Maximum height H = (vy)^2 / (2g) = 400 / 20 = 20 meters. (Notice: Integer type questions strictly have NO negative marking).",
                "correct_numerical_value": 20.0,
                "numerical_tolerance": 0.0,
                "options": []
            },
            {
                "question_type": "integer",
                "question_text": "Consider the gas-phase dissociation equilibrium N2O4(g) ⇌ 2NO2(g) at total pressure P = 3 atm. At equilibrium, the degree of dissociation α is 0.5. Calculate the equilibrium constant Kp in atm.",
                "image_url": "",
                "explanation": "For N2O4 ⇌ 2NO2, Kp = (4 * α^2 * P) / (1 - α^2) = (4 * 0.25 * 3) / (1 - 0.25) = 3 / 0.75 = 4. (Notice: Integer type questions strictly have NO negative marking).",
                "correct_numerical_value": 4.0,
                "numerical_tolerance": 0.1,
                "options": []
            }
        ]
    })


if __name__ == "__main__":
    import sys
    if "--force" in sys.argv:
        seed_database(force=True)
        print("Database initialized and sample quizzes seeded successfully.")
    else:
        print("Automatic sample quiz seeding is disabled. Pass --force to populate sample quizzes.")
