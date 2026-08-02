export type OrganId = "heart" | "brain" | "liver" | "kidneys" | "eyeball" | "intestine";

export type Hotspot = {
  id: string;
  label: string;
  detail: string;
  position: [number, number, number];
  color: string;
};

export type Organ = {
  id: OrganId;
  name: string;
  scientificName: string;
  system: string;
  model: string;
  icon: string;
  accent: string;
  description: string;
  poetic: string;
  size: string;
  weight: string;
  location: string;
  function: string;
  dailyFact: string;
  medical: string;
  tissue: string;
  comparison: string;
  conditions: string[];
  hotspots: Hotspot[];
};

export const organs: Organ[] = [
  {
    id: "heart",
    name: "Heart",
    scientificName: "Cor",
    system: "Cardiovascular",
    model: "/models/heart.glb",
    icon: "♥",
    accent: "#ee7c6a",
    description: "A muscular organ that pumps blood throughout the body, delivering oxygen and nutrients to every cell.",
    poetic: "The tireless pump",
    size: "About the size of your fist",
    weight: "250–350 g",
    location: "Behind the sternum, slightly left",
    function: "Circulates oxygenated blood",
    dailyFact: "Beats about 100,000 times",
    medical: "Its electrical rhythm coordinates every heartbeat.",
    tissue: "Cardiac muscle tissue",
    comparison: "Heart vs. brain",
    conditions: ["Coronary artery disease", "Arrhythmia", "Heart valve disorders"],
    hotspots: [
      { id: "aorta", label: "Aorta", detail: "Main artery", position: [-0.35, 1.65, 0.55], color: "#ee7c6a" },
      { id: "left-atrium", label: "Left Atrium", detail: "Receives oxygenated blood", position: [0.82, 0.65, 0.5], color: "#f2a33b" },
      { id: "right-atrium", label: "Right Atrium", detail: "Receives venous blood", position: [-0.9, 0.35, 0.55], color: "#6393d8" },
      { id: "left-ventricle", label: "Left Ventricle", detail: "Pumps to the body", position: [0.7, -0.75, 0.65], color: "#f2a33b" },
      { id: "right-ventricle", label: "Right Ventricle", detail: "Pumps to the lungs", position: [-0.65, -0.68, 0.66], color: "#ee7c6a" },
      { id: "mitral", label: "Mitral Valve", detail: "Prevents backflow", position: [0.18, -1.35, 0.48], color: "#d89bc4" },
    ],
  },
  {
    id: "brain",
    name: "Brain",
    scientificName: "Encephalon",
    system: "Nervous System",
    model: "/models/brain.glb",
    icon: "◉",
    accent: "#c58696",
    description: "The body’s command center, integrating sensation, memory, emotion, and precise movement.",
    poetic: "The universe within",
    size: "Roughly two clenched fists",
    weight: "1.3–1.4 kg",
    location: "Protected within the skull",
    function: "Processes and coordinates signals",
    dailyFact: "Uses about 20% of the body’s energy",
    medical: "Billions of neurons communicate through electrical and chemical signals.",
    tissue: "Cerebral cortex",
    comparison: "Brain vs. eye",
    conditions: ["Migraine", "Stroke", "Neurodegenerative disease"],
    hotspots: [
      { id: "frontal", label: "Frontal Lobe", detail: "Planning & movement", position: [-0.7, 0.65, 0.8], color: "#ee7c6a" },
      { id: "parietal", label: "Parietal Lobe", detail: "Sensory integration", position: [0.15, 1.1, 0.65], color: "#f2a33b" },
      { id: "temporal", label: "Temporal Lobe", detail: "Memory & hearing", position: [0.75, -0.1, 0.82], color: "#6393d8" },
      { id: "cerebellum", label: "Cerebellum", detail: "Balance & coordination", position: [0.72, -0.9, 0.55], color: "#d89bc4" },
    ],
  },
  {
    id: "liver",
    name: "Liver",
    scientificName: "Hepar",
    system: "Digestive System",
    model: "/models/liver.glb",
    icon: "≈",
    accent: "#b86858",
    description: "A remarkable metabolic organ that filters blood, processes nutrients, and produces bile.",
    poetic: "The quiet alchemist",
    size: "About the size of a football",
    weight: "1.4–1.6 kg",
    location: "Upper right abdomen",
    function: "Metabolism, detoxification & bile",
    dailyFact: "Performs more than 500 functions",
    medical: "It can regenerate a substantial portion of lost tissue.",
    tissue: "Hepatic lobules",
    comparison: "Liver vs. intestine",
    conditions: ["Fatty liver disease", "Hepatitis", "Cirrhosis"],
    hotspots: [
      { id: "right-lobe", label: "Right Lobe", detail: "Largest hepatic lobe", position: [-0.75, 0.35, 0.75], color: "#ee7c6a" },
      { id: "left-lobe", label: "Left Lobe", detail: "Crosses the midline", position: [0.85, 0.25, 0.75], color: "#f2a33b" },
      { id: "portal", label: "Portal Vein", detail: "Nutrient-rich inflow", position: [0.1, -0.3, 0.82], color: "#6393d8" },
    ],
  },
  {
    id: "kidneys",
    name: "Kidneys",
    scientificName: "Renes",
    system: "Urinary System",
    model: "/models/kidneys.glb",
    icon: "∞",
    accent: "#c96963",
    description: "Paired filtration organs that balance fluids, electrolytes, blood pressure, and waste removal.",
    poetic: "The master filters",
    size: "Each is about a computer mouse",
    weight: "120–170 g each",
    location: "Either side of the spine below the ribs",
    function: "Filters blood and forms urine",
    dailyFact: "Filters roughly 180 L of fluid",
    medical: "Nephrons fine-tune the chemistry of the bloodstream.",
    tissue: "Renal cortex",
    comparison: "Kidneys vs. liver",
    conditions: ["Kidney stones", "Chronic kidney disease", "Urinary infection"],
    hotspots: [
      { id: "cortex", label: "Renal Cortex", detail: "Outer filtering layer", position: [-0.9, 0.55, 0.7], color: "#ee7c6a" },
      { id: "medulla", label: "Renal Medulla", detail: "Concentrates urine", position: [0.85, 0.2, 0.7], color: "#f2a33b" },
      { id: "ureter", label: "Ureter", detail: "Carries urine", position: [0.4, -1.1, 0.5], color: "#6393d8" },
    ],
  },
  {
    id: "eyeball",
    name: "Eye",
    scientificName: "Oculus",
    system: "Sensory System",
    model: "/models/eyeball.glb",
    icon: "⊙",
    accent: "#7294b9",
    description: "A precision sensory organ that converts focused light into neural signals interpreted as vision.",
    poetic: "A window made of light",
    size: "About 24 mm across",
    weight: "Around 7.5 g",
    location: "Within the bony orbit",
    function: "Captures and focuses light",
    dailyFact: "Makes thousands of tiny movements",
    medical: "The retina is an extension of the central nervous system.",
    tissue: "Retinal layers",
    comparison: "Eye vs. brain",
    conditions: ["Myopia", "Cataract", "Glaucoma"],
    hotspots: [
      { id: "cornea", label: "Cornea", detail: "Clear focusing surface", position: [0, 0.05, 1.3], color: "#6393d8" },
      { id: "iris", label: "Iris", detail: "Controls light entry", position: [0.5, 0.2, 1.05], color: "#f2a33b" },
      { id: "optic", label: "Optic Nerve", detail: "Carries visual signals", position: [-0.8, -0.25, -0.5], color: "#d89bc4" },
    ],
  },
  {
    id: "intestine",
    name: "Intestine",
    scientificName: "Intestinum",
    system: "Digestive System",
    model: "/models/intestine.glb",
    icon: "§",
    accent: "#d78b77",
    description: "A folded digestive passage where nutrients are absorbed and the microbiome supports whole-body health.",
    poetic: "The inner garden",
    size: "About 6–7 m when extended",
    weight: "Varies with contents",
    location: "Central and lower abdomen",
    function: "Digestion and nutrient absorption",
    dailyFact: "Hosts trillions of microorganisms",
    medical: "Its surface is amplified by folds, villi, and microvilli.",
    tissue: "Intestinal villi",
    comparison: "Intestine vs. liver",
    conditions: ["Irritable bowel syndrome", "Inflammatory bowel disease", "Celiac disease"],
    hotspots: [
      { id: "duodenum", label: "Duodenum", detail: "First small-intestine segment", position: [0.6, 0.8, 0.75], color: "#f2a33b" },
      { id: "jejunum", label: "Jejunum", detail: "Major absorption region", position: [-0.45, 0.1, 0.82], color: "#ee7c6a" },
      { id: "colon", label: "Colon", detail: "Reclaims water", position: [0.75, -0.55, 0.72], color: "#6393d8" },
    ],
  },
];

export const organById = Object.fromEntries(organs.map((organ) => [organ.id, organ])) as Record<OrganId, Organ>;
