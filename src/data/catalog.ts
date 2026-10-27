// @ts-nocheck
import CAR2_GLB_URL from "@/assets/models/car-2";
import CAR3_GLB_URL from "@/assets/models/car-3";
import SF90_GLB_URL from "@/assets/models/sf90-stradale";

export const PAINT_COLORS = [
  {
    id: "rosso-corsa",
    name: "Rosso Corsa",
    code: "FER 322",
    hex: "#CE1318",
    heritage: "Signature Scuderia Racing Red",
  },
  {
    id: "rosso-scuderia",
    name: "Rosso Scuderia",
    code: "FER 323",
    hex: "#E52419",
    heritage: "Formula 1 High-Chroma Scarlet",
  },
  {
    id: "giallo-modena",
    name: "Giallo Modena",
    code: "FER 4305",
    hex: "#EAB60E",
    heritage: "Modena Tribute Yellow",
  },
  {
    id: "grigio-silverstone",
    name: "Grigio Silverstone",
    code: "FER 740",
    hex: "#43484F",
    heritage: "Liquid Gunmetal Metallic",
  },
  {
    id: "blu-tdf",
    name: "Blu Tour de France",
    code: "FER 522",
    hex: "#0E2D6D",
    heritage: "Historic GT Deep Cobalt",
  },
  {
    id: "verde-british",
    name: "Verde British",
    code: "FER 611",
    hex: "#0B392A",
    heritage: "Motorsport Racing Emerald",
  },
  {
    id: "bianco-avus",
    name: "Bianco Avus",
    code: "FER 100",
    hex: "#EAECEF",
    heritage: "Pure Architectural White",
  },
  {
    id: "nero-daytona",
    name: "Nero Daytona",
    code: "FER 508",
    hex: "#131519",
    heritage: "Obsidian Deep Metallic",
  },
];

export const PAINT_FINISHES = [
  {
    id: "gloss",
    name: "Gloss Clearcoat",
    subtitle: "Wet Maranello mirror lacquer",
    roughness: 0.16,
    metalness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    flakeScale: 0.008,
    iridescence: 0,
  },
  {
    id: "metallic",
    name: "Metallic Flake",
    subtitle: "High-density aluminum micro-flake",
    roughness: 0.22,
    metalness: 0.68,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    flakeScale: 0.045,
    iridescence: 0.06,
  },
  {
    id: "satin",
    name: "Satin Opaco",
    subtitle: "Tailor Made anodized silk matte",
    roughness: 0.42,
    metalness: 0.52,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    flakeScale: 0.02,
    iridescence: 0,
  },
  {
    id: "pearl",
    name: "Tri-Layer Pearl",
    subtitle: "Three-stage mica depth & clearcoat",
    roughness: 0.18,
    metalness: 0.48,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    flakeScale: 0.032,
    iridescence: 0.34,
  },
];

export const CALIPER_SWATCHES = [
  {
    id: "giallo",
    name: "Giallo Modena",
    hex: "#F2BE13",
    metalness: 0.28,
    roughness: 0.2,
  },
  {
    id: "rosso",
    name: "Rosso Scuderia",
    hex: "#D6161C",
    metalness: 0.3,
    roughness: 0.2,
  },
  {
    id: "blu",
    name: "Blu Corsa",
    hex: "#1452B8",
    metalness: 0.35,
    roughness: 0.22,
  },
  {
    id: "alluminio",
    name: "Alluminio",
    hex: "#B9C0C8",
    metalness: 0.82,
    roughness: 0.24,
  },
  {
    id: "nero",
    name: "Nero Lucido",
    hex: "#191B20",
    metalness: 0.35,
    roughness: 0.18,
  },
];

export const WHEEL_SWATCHES = [
  {
    id: "grigio-corsa",
    name: "Grigio Corsa Forged",
    hex: "#949AA4",
    metalness: 0.9,
    roughness: 0.22,
  },
  {
    id: "nero-opaco",
    name: "Matte Nero Opaco",
    hex: "#202328",
    metalness: 0.55,
    roughness: 0.4,
  },
  {
    id: "diamond-silver",
    name: "Diamond Machined",
    hex: "#D5DAE2",
    metalness: 0.96,
    roughness: 0.13,
  },
  {
    id: "oro-chiaro",
    name: "Oro Chiaro Racing",
    hex: "#B6995B",
    metalness: 0.88,
    roughness: 0.23,
  },
];

export const INTERIOR_SWATCHES = [
  {
    id: "nero-leather",
    name: "Nero Leather",
    hex: "#1B1D21",
    metalness: 0.06,
    roughness: 0.58,
  },
  {
    id: "cuoio",
    name: "Cuoio Toscana",
    hex: "#8B4B28",
    metalness: 0.06,
    roughness: 0.54,
  },
  {
    id: "rosso-int",
    name: "Rosso Ferrari",
    hex: "#851419",
    metalness: 0.06,
    roughness: 0.55,
  },
  {
    id: "crema",
    name: "Crema Atelier",
    hex: "#C8BBA5",
    metalness: 0.05,
    roughness: 0.56,
  },
];

export const STUDIO_THEMES = [
  {
    id: "forged",
    name: "Forged Dark Atelier",
    subtitle: "Obsidian basalt floor · warm tungsten & cool softbox",
    bgHex: "#060709",
    fogHex: "#060709",
    keyColor: "#F5F7FA",
    rimColor: "#FFB267",
    fillColor: "#5E7EA6",
    keyIntensity: 2.35,
    envIntensity: 1.25,
    floorHex: "#0B0D11",
  },
  {
    id: "maranello",
    name: "Centro Stile Gallery",
    subtitle: "Crisp architectural daylight & high-clarity reflections",
    bgHex: "#0A0C10",
    fogHex: "#0A0C10",
    keyColor: "#FFFFFF",
    rimColor: "#DCE8FA",
    fillColor: "#8FA4BE",
    keyIntensity: 2.85,
    envIntensity: 1.55,
    floorHex: "#101319",
  },
  {
    id: "fiorano",
    name: "Fiorano Dusk",
    subtitle: "Low-angle Emilia-Romagna golden amber grazing light",
    bgHex: "#090708",
    fogHex: "#090708",
    keyColor: "#FFD4A6",
    rimColor: "#FF6B3D",
    fillColor: "#48587A",
    keyIntensity: 2.55,
    envIntensity: 1.2,
    floorHex: "#0D0A0B",
  },
  {
    id: "windtunnel",
    name: "Galleria del Vento",
    subtitle: "Cold CFD wind-tunnel telemetry illumination",
    bgHex: "#04080D",
    fogHex: "#04080D",
    keyColor: "#D8F1FF",
    rimColor: "#38BDF8",
    fillColor: "#1E3A5F",
    keyIntensity: 2.45,
    envIntensity: 1.35,
    floorHex: "#070D14",
  },
];

export const POWER_MODES = [
  {
    id: "edrive",
    name: "eDrive",
    tag: "EV FRONT AXLE",
    combinedOutput: "220 cv",
    v8State: "OFF (Standby)",
    electricState: "RAC-e Twin Front Axle · 25 km Range · ≤ 135 km/h",
    accentHex: "#38BDF8",
    description:
      "Internal combustion engine shut off. Driven purely by the two independent front-axle RAC-e electric motors with active torque vectoring up to 135 km/h over a 25 km zero-emission range.",
  },
  {
    id: "hybrid",
    name: "Hybrid",
    tag: "OPTIMAL EFFICIENCY",
    combinedOutput: "1,000 cv*",
    v8State: "Auto Start/Stop · 780 cv Available",
    electricState: "MGU-K Regen + RAC-e Assisted",
    accentHex: "#34D399",
    description:
      "Default start-up setting. Control logic autonomously blends or decouples the F154FA V8 and electric motors to optimize energy recovery and instantaneous throttle response.",
  },
  {
    id: "performance",
    name: "Performance",
    tag: "CONTINUOUS V8 + CHARGE",
    combinedOutput: "1,000 cv",
    v8State: "780 cv Active Continuous",
    electricState: "Battery Priority Sustain + Boost",
    accentHex: "#F5C518",
    description:
      "Keeps the 90° twin-turbo V8 running continuously, prioritizing battery charge maintenance so consistent hybrid boost remains available lap after lap on road or circuit.",
  },
  {
    id: "qualify",
    name: "Qualify",
    tag: "MAXIMUM ATTACK",
    combinedOutput: "1,000 cv (735 kW)",
    v8State: "780 cv @ 7,500 rpm (800 Nm)",
    electricState: "Full 162 kW (220 cv) Peak Deployment",
    accentHex: "#DC1A22",
    description:
      "Unlocks unrestricted combined output of 1,000 cv (735 kW), prioritizing maximum power deployment over battery charging across all three synchronous electric motors and the twin-turbo V8.",
  },
];

export const CAMERA_PRESETS = [
  {
    id: "hero",
    label: "Hero 3/4 Atelier",
    shortLabel: "Hero",
    position: [-4.65, 2.3, -5.15],
    target: [0, 0.48, 0.05],
    fov: 40,
    overview: true,
  },
  {
    id: "front",
    label: "Front S-Duct & Matrix LED",
    shortLabel: "Front",
    position: [0, 1.3, -5.7],
    target: [0, 0.52, -0.85],
    fov: 35,
    overview: true,
  },
  {
    id: "profile",
    label: "Berlinetta Side Proportions",
    shortLabel: "Profile",
    position: [-7.15, 1.75, 0.16],
    target: [0, 0.56, 0.16],
    fov: 38,
    overview: true,
  },
  {
    id: "rear",
    label: "Rear Shut-Off Gurney & Exhausts",
    shortLabel: "Rear 3/4",
    position: [4.3, 2.15, 5.2],
    target: [0, 0.62, 0.35],
    fov: 38,
    overview: true,
  },
  {
    id: "wheel",
    label: "Forged Wheel & Brembo CCM",
    shortLabel: "Wheel / Brake",
    position: [-1.98, 0.44, -1.52],
    target: [-0.84, 0.358, -1.155],
    fov: 32,
  },
  {
    id: "engine",
    label: "F154FA V8 & MGU-K Deck",
    shortLabel: "Engine Bay",
    position: [1.32, 1.88, 2.26],
    target: [0, 0.68, 1.02],
    fov: 36,
  },
  {
    id: "cockpit",
    label: "Driver's Eye Digital Cockpit",
    shortLabel: "Cockpit",
    // Pull back behind the rim and aim through it toward the digital cluster.
    position: [-0.346, 1.3, 0.85],
    target: [-0.346, 0.88, -0.82],
    fov: 54,
    interior: !0,
  },
];

export const COMPONENT_SPECS = {
  paintwork: {
    id: "paintwork",
    code: "EXT-01 // COACHWORK",
    name: "Multi-Material Coachwork & Paintwork",
    subtitle: "Centro Stile cab-forward berlinetta architecture",
    category: "Exterior & Aero",
    design:
      "Styled by Centro Stile Ferrari under Flavio Manzoni, the SF90 Stradale shifts cabin volume forward and lowers the center of gravity by 20 mm with a 20 mm lower roof overhang, creating extreme cab-forward proportions between mid-engine berlinettas and flagship Ferrari hypercars.",
    function:
      "Every outer body surface works as a bound aerodynamic channel, routing clean high-energy air over the lowered rear deck while guiding cooling mass flow into side intercooler intakes without adding parasitic frontal area.",
    materials:
      "Hybrid multi-material spaceframe chassis combining hollow-cast aluminum alloys, ultra-high-strength aluminum extrusions, and structural carbon-fiber bulkhead — delivering 20% higher bending stiffness and 40% greater torsional rigidity with no weight penalty.",
    verifiedSpecs: [
      {
        label: "Length × Width × Height",
        value: "4,710 × 1,972 × 1,186 mm",
      },
      {
        label: "Wheelbase",
        value: "2,650 mm",
        detail: "1,679 mm F / 1,652 mm R track",
      },
      {
        label: "Minimum Dry Weight",
        value: "1,570 kg",
        detail: "With lightweight options",
      },
      {
        label: "Weight-to-Power Ratio",
        value: "1.57 kg/cv",
        detail: "45% Front / 55% Rear",
      },
      {
        label: "Torsional Rigidity Gain",
        value: "+40%",
        detail: "+20% bending stiffness",
      },
    ],
    camera: {
      position: [-3.25, 1.32, -3.4],
      target: [0, 0.58, 0.05],
      fov: 38,
    },
    hotspot: [-0.88, 0.82, -0.35],
  },
  headlights: {
    id: "headlights",
    code: "OPT-02 // MATRIX LED",
    name: "Matrix LED C-Architecture Headlights",
    subtitle: "First active beam-control Matrix LED system on a series Ferrari",
    category: "Exterior & Aero",
    design:
      "Departing from traditional L-shaped lamp clusters, the SF90 Stradale introduces razor-thin slit headlamps integrated directly into aerodynamic brake cooling air intakes, forming a futuristic C-shaped nose signature.",
    function:
      "Active Matrix LED beam control dynamically shadows oncoming vehicles and reflective signs in real time while maintaining full high-beam illumination elsewhere, flanked by direct brake-caliper cooling ducts.",
    materials:
      "Optical-grade hard-coated polycarbonate outer lens, autoclaved carbon-fiber internal projector carrier buckets, multi-element precision glass optics, and solid-state high-output Matrix LED emitters.",
    verifiedSpecs: [
      {
        label: "Optical Technology",
        value: "Active Matrix LED",
        detail: "Ferrari production debut",
      },
      {
        label: "DRL Signature",
        value: "Ultra-slim horizontal C-blade",
      },
      {
        label: "Integrated Ducting",
        value: "Direct front CCM brake air intake",
      },
      {
        label: "Adaptive Control",
        value: "Individual selective LED dimming",
      },
    ],
    camera: {
      position: [-1.45, 0.88, -3.05],
      target: [-0.62, 0.62, -1.82],
      fov: 32,
    },
    hotspot: [-0.72, 0.65, -1.86],
  },
  taillights: {
    id: "taillights",
    code: "OPT-03 // QUAD LED RING",
    name: "Evolved Twin-Ring LED Taillights",
    subtitle: "Squircular horizontal luminous rings lowering visual tail height",
    category: "Exterior & Aero",
    design:
      "Reinterpreting Ferrari's classic round twin tail lamps, the SF90 introduces flattened squircular horizontal luminous rings paired with an integrated central third brake light along the upper spoiler trailing edge.",
    function:
      "Visually widens and lowers the rear tail stance while leaving generous open extraction apertures beneath the lamps to evacuate hot air from the twin turbochargers and rear transaxle coolers.",
    materials:
      "Injection-molded PMMA optical light guides, high-intensity ruby/amber solid-state LED arrays, and precision-machined dark anodized outer bezels.",
    verifiedSpecs: [
      {
        label: "Rear Lamp Architecture",
        value: "Quad horizontal luminous LED rings",
      },
      {
        label: "Auxiliary Brake Lamp",
        value: "Central spoiler-integrated LED bar",
      },
      {
        label: "Thermal Integration",
        value: "Vented rear aero extraction recess",
      },
    ],
    camera: {
      position: [1.62, 1.16, 3.35],
      target: [0.48, 0.86, 2.02],
      fov: 32,
    },
    hotspot: [0.76, 0.88, 2.05],
  },
  wheels: {
    id: "wheels",
    code: "CHS-04 // AERO FORGED",
    name: "20-Inch Aerodynamic Forged Wheels",
    subtitle: "Spoke outer-channel profiles functioning as axial rotor blades",
    category: "Chassis & Rolling Gear",
    design:
      "Sculpted 5-twin-spoke forged wheels developed specifically in Ferrari's wind tunnel with equally spaced radial wing-profile elements integrated along the outer rim channel between the spokes.",
    function:
      "Acts like an axial compressor rotor blade in motion — extracting high-pressure turbulent air from inside the wheel arch, feeding brake cooling flow, and generating lateral flow aligned with the car sides to cut aerodynamic drag.",
    materials:
      "Forged aerospace 6061-T6 aluminum monoblock blank CNC-milled to minimum wall thickness (optional autoclaved structural carbon-fiber wheels saving an additional 4 kg per corner), fastened with lightweight Gr.5 titanium lug bolts.",
    verifiedSpecs: [
      {
        label: "Front Rim Dimension",
        value: "9.5J × 20 in",
      },
      {
        label: "Rear Rim Dimension",
        value: "11.5J × 20 in",
      },
      {
        label: "Fasteners",
        value: "5 × Gr.5 Titanium Lug Bolts",
      },
      {
        label: "Aero Effect",
        value: "Radial outer-channel wing profiles",
      },
    ],
    camera: {
      position: [-1.96, 0.45, -1.48],
      target: [-0.88, 0.358, -1.155],
      fov: 31,
    },
    hotspot: [-0.95, 0.46, -1.155],
  },
  tires: {
    id: "tires",
    code: "CHS-05 // ULTRA-HIGH GRIP",
    name: 'Bespoke K-Marked 20" Performance Tires',
    subtitle: "Asymmetric multi-compound tread co-engineered for 1,000 cv AWD",
    category: "Chassis & Rolling Gear",
    design:
      "Staggered ultra-low-profile 255/35 ZR20 front and wide 315/30 ZR20 rear tires co-developed with Michelin (Pilot Sport Cup 2 R on Assetto Fiorano) and Pirelli/Bridgestone specifically for the SF90 Stradale.",
    function:
      "Transmits combined 1,000 cv longitudinal traction and electric front-axle RAC-e torque vectoring forces while sustaining up to 390 kg aerodynamic vertical load at 250 km/h.",
    materials:
      "Dual-compound motorsport elastomer tread (high-molecular-weight outer shoulder compound + high-silica inner wet band) over aramid-nylon zero-degree high-speed belt ply.",
    verifiedSpecs: [
      {
        label: "Front Tire Size",
        value: "255/35 ZR20 XL (97Y)",
      },
      {
        label: "Rear Tire Size",
        value: "315/30 ZR20 XL (104Y)",
      },
      {
        label: "Assetto Fiorano Spec",
        value: "Michelin Pilot Sport Cup 2",
      },
      {
        label: "100 – 0 km/h Stopping",
        value: "< 29.5 m",
      },
    ],
    camera: {
      position: [1.94, 0.42, 1.92],
      target: [0.82, 0.358, 1.496],
      fov: 31,
    },
    hotspot: [0.95, 0.62, 1.496],
  },
  calipers: {
    id: "calipers",
    code: "BRK-06 // BREMBO MONOBLOCK",
    name: "Brembo Aero Brake Calipers & Brake-by-Wire",
    subtitle: "6-piston front & 4-piston rear calipers with integrated aero appendages",
    category: "Chassis & Rolling Gear",
    design:
      "Bespoke Brembo monoblock front calipers debut sculpted aerodynamic intake appendages engineered hand-in-hand with Ferrari aerodynamicists, paired with inboard 4-piston rear calipers.",
    function:
      "Works seamlessly with Ferrari's new electro-hydraulic Brake-by-Wire control unit, blending electric motor regenerative braking on the front RAC-e axle with hydraulic clamping pressure imperceptibly under threshold braking.",
    materials:
      "CNC-machined high-stiffness forged aluminum alloy monoblock bodies, ventilated titanium thermal-barrier pistons, and heat-resistant ceramic-matrix brake pads.",
    verifiedSpecs: [
      {
        label: "Front Caliper Spec",
        value: "6-Piston Brembo Aero Monoblock",
      },
      {
        label: "Rear Caliper Spec",
        value: "4-Piston Brembo Monoblock",
      },
      {
        label: "Control Architecture",
        value: "Electro-Hydraulic Brake-by-Wire",
      },
      {
        label: "Energy Recovery",
        value: "Blended ABS / EBD + RAC-e Regen",
      },
    ],
    camera: {
      position: [-1.72, 0.4, -1.02],
      target: [-0.845, 0.37, -1.13],
      fov: 26,
    },
    hotspot: [-0.89, 0.43, -1.03],
  },
  brakes_ccm: {
    id: "brakes_ccm",
    code: "BRK-07 // CARBON-CERAMIC",
    name: "Ventilated Carbon-Ceramic Brake Discs",
    subtitle: "398 mm front & 360 mm rear cross-drilled C/SiC rotors",
    category: "Chassis & Rolling Gear",
    design:
      "Oversized internally ventilated and cross-drilled carbon-ceramic discs mounted on lightweight floating aluminum bells to allow radial thermal expansion without coning under repeated 340 km/h stops.",
    function:
      "Saves roughly 50% unsprung rotating mass compared to cast-iron rotors while maintaining fade-free friction coefficients above 800°C during repeated circuit laps at Fiorano.",
    materials:
      "Chopped carbon-fiber reinforced silicon carbide (C/SiC) ceramic matrix sintered at 1,700°C, paired with hard-anodized forged aluminum mounting bells and stainless floating bobbins.",
    verifiedSpecs: [
      {
        label: "Front CCM Disc Size",
        value: "398 × 223 × 38 mm",
      },
      {
        label: "Rear CCM Disc Size",
        value: "360 × 233 × 32 mm",
      },
      {
        label: "100 – 0 km/h Braking",
        value: "< 29.5 m",
      },
      {
        label: "eSSC Integration",
        value: "FDE 2.0 Brake Torque Control",
      },
    ],
    camera: {
      position: [1.74, 0.39, -1.32],
      target: [0.835, 0.358, -1.154],
      fov: 26,
    },
    hotspot: [0.85, 0.28, -1.26],
  },
  carbon_splitter: {
    id: "carbon_splitter",
    code: "CFRP-08 // FRONT AERO",
    name: "Carbon-Fiber Front Splitter & Vortex Generators",
    subtitle: "Raised front underbody step accelerating ground-effect suction",
    category: "Exterior & Aero",
    design:
      "The front chassis overhang features a 15 mm raised central keel section relative to the main floor plane, framed by a razor-sharp carbon-fiber chin splitter and outer aero flick strakes.",
    function:
      "Increases airflow volume compressed over specialized underbody vortex generators, energizing boundary-layer suction beneath the front axle to balance the massive rear downforce of the Shut-Off Gurney.",
    materials:
      "Autoclave-cured pre-preg 2×2 twill 3K aerospace carbon fiber with high-modulus epoxy resin matrix and UV-stabilized clear or matte lacquer.",
    verifiedSpecs: [
      {
        label: "Front Underbody Lift",
        value: "+15 mm raised central section",
      },
      {
        label: "Aero Device",
        value: "Underbody twin vortex generators",
      },
      {
        label: "Radiator Packaging",
        value: "2 tilted front heat exchangers",
      },
      {
        label: "Composite Layup",
        value: "Autoclaved pre-preg CFRP",
      },
    ],
    camera: {
      position: [-1.45, 0.48, -3.28],
      target: [0, 0.26, -2.05],
      fov: 32,
    },
    hotspot: [0, 0.22, -2.18],
  },
  carbon_skirts: {
    id: "carbon_skirts",
    code: "CFRP-09 // SILL BLADES",
    name: "Carbon-Fiber Rocker Sills & Side Splitters",
    subtitle: "Floor edge sealing blades and rear intercooler duct dividers",
    category: "Exterior & Aero",
    design:
      "Knife-edged carbon-fiber sill extensions run along both lower flanks between the axles, kicking upward ahead of the rear tires to frame the high-mounted side air intakes.",
    function:
      "Acts as an aerodynamic skirt controlling lateral air spill into the low-pressure underbody floor channel while stripping turbulent front wheel wake away from rear cooling intakes.",
    materials:
      "Multi-axial pre-preg carbon-fiber reinforced polymer (CFRP) engineered with stone-chip impact-resistant urethane clearcoat.",
    verifiedSpecs: [
      {
        label: "Aerodynamic Role",
        value: "Underfloor lateral vortex seal",
      },
      {
        label: "Rear Quarter Integration",
        value: "Intercooler & brake duct splitter",
      },
      {
        label: "Assetto Fiorano Weight Save",
        value: "-30 kg package contribution",
      },
    ],
    camera: {
      position: [-2.45, 0.52, 0.35],
      target: [-0.88, 0.22, 0.2],
      fov: 34,
    },
    hotspot: [-0.91, 0.2, 0.25],
  },
  carbon_diffuser: {
    id: "carbon_diffuser",
    code: "CFRP-10 // VENTURI DIFFUSER",
    name: "Carbon-Fiber Multi-Strake Rear Diffuser",
    subtitle: "Unobstructed expansion volume enabled by raised exhaust layout",
    category: "Exterior & Aero",
    design:
      "By relocating the entire exhaust tailpipe assembly high into the rear bumper fascia, Ferrari's aerodynamicists freed the entire lower rear width for an expansive multi-fence carbon-fiber Venturi diffuser.",
    function:
      "Decelerates and expands high-velocity underfloor airflow smoothly back to ambient pressure, generating powerful low-drag ground-effect downforce across the rear axle.",
    materials:
      "High-temperature autoclave pre-preg carbon fiber with ceramic thermal backing near the transaxle and turbocharger outlet zone.",
    verifiedSpecs: [
      {
        label: "Aero Packaging Enabler",
        value: "High-mounted exhaust routing",
      },
      {
        label: "Strake Geometry",
        value: "Full-width vertical guide fences",
      },
      {
        label: "Combined Aero Load",
        value: "390 kg downforce @ 250 km/h",
      },
    ],
    camera: {
      position: [-1.45, 0.52, 3.45],
      target: [0, 0.28, 2.02],
      fov: 33,
    },
    hotspot: [-0.28, 0.24, 2.12],
  },
  aero_gurney: {
    id: "aero_gurney",
    code: "AERO-11 // PATENTED ACTIVE WING",
    name: "Patented Active Shut-Off Gurney System",
    subtitle: "F1-inspired two-section suspended rear wing with electric actuators",
    category: "Exterior & Aero",
    design:
      "Ferrari's signature aerodynamic invention on the SF90 Stradale: a two-part rear deck trailing wing consisting of a fixed trailing element and a mobile forward wedge flush with the ultra-low engine cover.",
    function:
      "In Low-Drag (LD) straight-line mode, both sections align so air flows cleanly over and under the suspended element. Under braking, cornering, or directional changes, electric actuators lower the mobile wedge (High-Downforce / HD mode), shutting off the lower slot and exposing a upright Gurney area — generating 390 kg total downforce at 250 km/h.",
    materials:
      "Hollow structural carbon-fiber aero elements driven by dual high-speed brushless electric actuators polling vehicle speed, lateral G, longitudinal deceleration, and steering input hundreds of times per second.",
    verifiedSpecs: [
      {
        label: "Total Peak Downforce",
        value: "390 kg (860 lb) @ 250 km/h",
      },
      {
        label: "Operating States",
        value: "Low-Drag (LD) / High-Downforce (HD)",
      },
      {
        label: "Actuation Drive",
        value: "Dual electric brushless actuators",
      },
      {
        label: "Control Telemetry",
        value: "Speed, Yaw, Lat/Long G, Steering",
      },
    ],
    camera: {
      position: [1.38, 1.38, 3.12],
      target: [0, 0.94, 2.02],
      fov: 30,
    },
    hotspot: [0, 0.97, 2.06],
  },
  exhausts: {
    id: "exhausts",
    code: "EXH-12 // INCONEL EXHAUST",
    name: "High-Mount Titanium & Inconel Exhaust",
    subtitle: "Redesigned gas-fluid-dynamic layout with optional Titanium savings",
    category: "PHEV Powertrain",
    design:
      "Positioned higher in the rear tail fascia than on prior mid-engine Ferraris, the exhaust line runs substantially straighter and shorter directly aft from the twin rear turbochargers.",
    function:
      "Reduces exhaust backpressure to help unlock 780 cv from the F154FA V8 while enriching high-frequency harmonic acoustics and clearing the entire lower chassis for the rear Venturi diffuser.",
    materials:
      "Thin-wall Inconel superalloy exhaust manifolds feeding equal-length turbine housings, paired with lightweight brushed titanium tailpipe outlets on Assetto Fiorano specifications.",
    verifiedSpecs: [
      {
        label: "Header Metallurgy",
        value: "Inconel superalloy manifolds",
      },
      {
        label: "Acoustic Tuning",
        value: "Redesigned hot-tube harmonics",
      },
      {
        label: "Max V8 Engine Speed",
        value: "8,000 rpm",
      },
      {
        label: "Specific ICE Output",
        value: "195 cv / liter",
      },
    ],
    camera: {
      position: [0.95, 0.62, 3.25],
      target: [0, 0.42, 2.18],
      fov: 29,
    },
    hotspot: [0, 0.41, 2.24],
  },
  steering_wheel: {
    id: "steering_wheel",
    code: "HMI-13 // F1 TOUCH WHEEL",
    name: "Carbon-Fiber F1 Steering Wheel & eManettino",
    subtitle: "'Eyes on the road, hands on the wheel' touch-capacitive interface",
    category: "Cockpit & HMI",
    design:
      "Inaugurates Ferrari's generational HMI leap: a sculpted flat-bottom carbon-fiber wheel housing LED shift lights along the upper rim, the rotary eManettino hybrid power selector, classic red Manettino dynamics dial, and capacitive touch pads.",
    function:
      "Allows the driver to control virtually every vehicle, navigation, cruise, and hybrid power function with thumb swipes without ever removing hands from the wheel at track speeds.",
    materials:
      "Exposed 3K carbon-fiber upper/lower rim, hand-stitched perforated Italian leather grip bolsters, CNC-milled aluminum column shift paddles, and embedded F1 sequential RPM shift LEDs.",
    verifiedSpecs: [
      {
        label: "Hybrid Selector",
        value: "4-Mode eManettino (eD / H / P / Q)",
      },
      {
        label: "Chassis Dynamics Dial",
        value: "5-Position Manettino + eSSC",
      },
      {
        label: "Steering Assistance",
        value: "Torque-Feedback EPS + RAC-e",
      },
      {
        label: "Shift Interface",
        value: "Column-mounted carbon/alloy paddles",
      },
    ],
    camera: {
      position: [-0.346, 0.955, 0.14],
      target: [-0.346, 0.8, -0.44],
      fov: 50,
      interior: !0,
    },
    hotspot: [-0.346, 0.88, -0.35],
  },
  cockpit: {
    id: "cockpit",
    code: "HMI-14 // DIGITAL CABIN",
    name: 'Aeronautical Cockpit & 16" Curved HD Cluster',
    subtitle: "Wraparound driver binnacle with modern F1 gated bridge",
    category: "Cockpit & HMI",
    design:
      "Inspired by single-seater aviation cockpits, the cabin wraps an automotive industry-first single 16-inch curved high-definition screen around the driver, paired with a sculpted carbon-fiber central F1 shift-gate bridge paying homage to classic manual Ferrari gates.",
    function:
      "Consolidates telemetry, navigation, hybrid energy flows, and 8,000 rpm yellow rev counter directly in the driver's line of sight while deeply bolstered racing seats anchor occupant mass during >1.4 g cornering.",
    materials:
      "Full-grain Frau leather & Alcantara upholstery with contrast Rosso stitching, exposed carbon-fiber tunnel bridge and door panels, and optical anti-reflective curved display glass.",
    verifiedSpecs: [
      {
        label: "Instrument Cluster",
        value: "16-inch Curved HD Digital Screen",
      },
      {
        label: "Seating Layout",
        value: "2-Seat Berlinetta Bucket Shell",
      },
      {
        label: "Center Console",
        value: "Modernized F1 Gate Shift Bridge",
      },
      {
        label: "Luggage Volume",
        value: "74 L front compartment + 20 L shelf",
      },
    ],
    camera: {
      position: [0.16, 1.02, 0.24],
      target: [-0.26, 0.72, -0.46],
      fov: 56,
      interior: !0,
    },
    hotspot: [0.32, 0.85, -0.1],
  },
  engine_v8: {
    id: "engine_v8",
    code: "PWR-15 // F154FA TWIN-TURBO V8",
    name: "4.0L 90° Twin-Turbocharged F154FA V8",
    subtitle: "780 cv — highest output 8-cylinder in Ferrari history at launch",
    category: "PHEV Powertrain",
    design:
      "Bored out to 88 mm for a 3,990 cc displacement with completely redesigned cylinder heads, narrow-angle central 350-bar direct fuel injection, smaller-inertia twin-scroll turbochargers, and a lowered flywheel lowering the engine mass center by 15 mm.",
    function:
      "Delivers 780 cv (574 kW) at 7,500 rpm and 800 Nm at 6,000 rpm with zero perceptible turbo lag, coupled to a completely redesigned compact 8-speed oil-bath dual-clutch F1 transmission.",
    materials:
      "Sand-cast AlSi7Mg aluminum block and heads, forged steel flat-plane crankshaft, titanium connecting rods, Rosso Corsa wrinkle-coated plenums, carbon intake plenum chamber, and Inconel manifolds.",
    verifiedSpecs: [
      {
        label: "Engine Code & Type",
        value: "F154 FA · 90° Twin-Turbo V8",
      },
      {
        label: "Displacement",
        value: "3,990 cc (88 mm × 82 mm)",
      },
      {
        label: "Maximum ICE Power",
        value: "780 cv (574 kW) @ 7,500 rpm",
      },
      {
        label: "Maximum ICE Torque",
        value: "800 Nm @ 6,000 rpm",
      },
      {
        label: "Compression & Redline",
        value: "9.5 : 1 · 8,000 rpm · Dry Sump",
      },
      {
        label: "Transmission",
        value: "8-Speed F1 Dual-Clutch (DCT)",
      },
    ],
    camera: {
      position: [1.18, 1.76, 2.08],
      target: [0, 0.68, 1],
      fov: 34,
    },
    hotspot: [0, 0.84, 0.98],
    requiresXrayHint: !0,
  },
  hybrid_system: {
    id: "hybrid_system",
    code: "PHEV-16 // 3-MOTOR E-4WD",
    name: "Tri-Motor Plug-In Hybrid Architecture",
    subtitle: "Rear Axial-Flux MGU-K + Twin Front RAC-e Torque-Vectoring Axle",
    category: "PHEV Powertrain",
    design:
      "Ferrari's first series-production PHEV integrates three synchronous electric motors: one Formula 1-derived MGUK (Motor Generator Unit, Kinetic) sandwiched between the V8 and gearbox on the rear axle, and two independent motors on the front axle (RAC-e).",
    function:
      "Adds 220 cv (162 kW) electric power for 1,000 cv combined output, enables full-electric eDrive up to 25 km, provides electronic reverse gear (saving gearbox weight), and independently varies torque to each front wheel in corners (RAC-e Torque Vectoring).",
    materials:
      "High-power-density axial-flux permanent-magnet synchronous rotors, silicon-carbide (SiC) power inverters, and a liquid-cooled 7.9 kWh lithium-ion battery pack mounted low behind the seats.",
    verifiedSpecs: [
      {
        label: "Electric Motors",
        value: "1 × Rear MGU-K + 2 × Front RAC-e",
      },
      {
        label: "Peak Electric Power",
        value: "220 cv (162 kW)",
      },
      {
        label: "Combined System Power",
        value: "1,000 cv (735 kW / 986 hp)",
      },
      {
        label: "HV Battery Capacity",
        value: "7.9 kWh Li-Ion",
      },
      {
        label: "All-Electric Range",
        value: "25 km (up to 135 km/h)",
      },
    ],
    camera: {
      position: [-2.45, 1.62, -1.95],
      target: [0, 0.44, 0.15],
      fov: 38,
    },
    hotspot: [0, 0.48, 1.32],
    requiresXrayHint: !0,
  },
  glass_canopy: {
    id: "glass_canopy",
    code: "GLZ-17 // CANOPY & LEXAN",
    name: "Wraparound Visor Canopy & Engine Window",
    subtitle: "Aeronautical A-pillar visor screen and transparent engine deck",
    category: "Exterior & Aero",
    design:
      "Slender blacked-out A-pillars create a helmet-visor wraparound windshield curvature while a transparent rear deck window frames the mid-mounted F154FA 90° V8 engine.",
    function:
      "Minimizes aerodynamic A-pillar wake vortex drag and lowers cabin mass overhead; on Assetto Fiorano specification, an ultralight louvered Lexan rear screen further reduces upper-body weight.",
    materials:
      "Laminated acoustic solar-control safety glass forward glazing with optional motorsport-grade polycarbonate Lexan rear engine cover.",
    verifiedSpecs: [
      {
        label: "Canopy Geometry",
        value: "Wraparound visor windshield",
      },
      {
        label: "Rear Engine Window",
        value: "Tempered glass / Assetto Lexan",
      },
      {
        label: "Roof Height",
        value: "1,186 mm (-20 mm lowered CoG)",
      },
    ],
    camera: {
      position: [-2.15, 1.55, -2.05],
      target: [0, 0.92, -0.35],
      fov: 36,
    },
    hotspot: [0, 1.02, 0.56],
  },
};

export const COMPONENT_IDS = [
  "paintwork",
  "headlights",
  "taillights",
  "aero_gurney",
  "carbon_splitter",
  "carbon_skirts",
  "carbon_diffuser",
  "wheels",
  "tires",
  "calipers",
  "brakes_ccm",
  "exhausts",
  "steering_wheel",
  "cockpit",
  "engine_v8",
  "hybrid_system",
];

export const CARS = [
  {
    id: "sf90",
    brand: "Ferrari",
    model: "SF90 Stradale",
    year: "2019 – 2024",
    tagline: "1,000 cv V8 Plug-In Hybrid · Type F173",
    shortTitle: "SF90 Stradale",
    assetUrl: SF90_GLB_URL,
    rotationY: 0,
    targetLength: 4.53,
    isSF90Reference: !0,
    defaultPaintHex: "#CE1318",
    accentHex: "#DC1A22",
    license: {
      title: "Composite SF90 reference build (73 meshes)",
      author:
        "Base berlinetta CAD by vicent091036 (Three.js examples) + custom SF90 powertrain / aero geometry",
      license: "CC-BY 4.0 (base mesh)",
      source: "https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf",
      note: "Official SF90 CAD is proprietary; drop an SF90 .glb into public/models/sf90-stradale.glb to replace.",
    },
    telemetry: [
      {
        label: "Combined Output",
        value: "1,000 cv",
        sub: "780 cv V8 + 220 cv PHEV",
      },
      {
        label: "0 – 100 km/h",
        value: "2.5 s",
        sub: "0 – 200 km/h 6.7 s",
      },
      {
        label: "Top Speed",
        value: "340 km/h",
        sub: "Fiorano 79 s",
      },
      {
        label: "Downforce",
        value: "390 kg",
        sub: "@ 250 km/h",
      },
      {
        label: "Dry Weight",
        value: "1,570 kg",
        sub: "1.57 kg/cv",
      },
    ],
    components: {},
  },
  {
    id: "aventador",
    brand: "Lamborghini",
    model: "Aventador LP 700-4",
    year: "2011 – 2016",
    tagline: "6.5 L naturally aspirated V12 · Carbon monocoque · Scissor doors",
    shortTitle: "Aventador LP 700-4",
    assetUrl: CAR2_GLB_URL,
    rotationY: Math.PI,
    targetLength: 4.78,
    isSF90Reference: !1,
    defaultPaintHex: "#E8A317",
    accentHex: "#F2B705",
    license: {
      title: "( FREE ) Lamborghini Aventador LP 700-4",
      author: "SDC PERFORMANCE™️ (Sketchfab) · repackaged by Z10ren",
      license: "CC-BY 4.0",
      source: "https://github.com/Z10ren/LamborghiniWeb",
      note: "Simplified to ~600k triangles and Draco-compressed (2.5 MB) for this showroom.",
    },
    telemetry: [
      {
        label: "Max Power",
        value: "700 CV",
        sub: "515 kW @ 8,250 rpm",
      },
      {
        label: "0 – 100 km/h",
        value: "2.9 s",
        sub: "7-speed ISR · AWD",
      },
      {
        label: "Top Speed",
        value: "350 km/h",
        sub: "217 mph",
      },
      {
        label: "Max Torque",
        value: "690 Nm",
        sub: "@ 5,500 rpm",
      },
      {
        label: "Dry Weight",
        value: "1,575 kg",
        sub: "2.25 kg/CV",
      },
    ],
    components: {
      paintwork: {
        name: "Carbon-Fiber Monocoque Coachwork",
        subtitle: "Stealth-fighter inspired hexagonal design language",
        design:
          "Designed by Filippo Perini at Centro Stile Lamborghini, the LP 700-4 draws on aeronautical forms: a hexagonal theme runs through the windows, intakes and lights, and the iconic upward-opening scissor doors are retained from the Countach lineage.",
        function:
          "The body shrouds a one-piece carbon-fiber monocoque with aluminium front and rear sub-frames, giving a torsional stiffness of 35,000 Nm/° while keeping the tub at just 147.5 kg.",
        materials:
          "RTM-Lambo resin-transfer-moulded carbon-fiber monocoque, aluminium sub-frames, carbon and SMC composite outer panels.",
        verifiedSpecs: [
          {
            label: "Length × Width × Height",
            value: "4,780 × 2,030 × 1,136 mm",
          },
          {
            label: "Wheelbase",
            value: "2,700 mm",
          },
          {
            label: "Dry Weight",
            value: "1,575 kg",
          },
          {
            label: "Monocoque Mass",
            value: "147.5 kg",
            detail: "35,000 Nm/° torsional",
          },
        ],
      },
      engine_v8: {
        name: "L539 6.5 L Naturally Aspirated V12",
        subtitle: "All-new 60° V12 — the first new Lamborghini V12 since 1963",
        design:
          "A clean-sheet 6,498 cc 60° V12 (L539) replaced the Bizzarrini-derived unit, mounted longitudinally mid-ship with the 7-speed ISR gearbox ahead of it for optimal weight distribution.",
        function:
          "Delivers 700 CV at 8,250 rpm and 690 Nm at 5,500 rpm through a single-clutch Independent Shifting Rod gearbox with 50 ms shifts and Haldex IV all-wheel drive.",
        materials: "Aluminium-silicon alloy block and heads, dry-sump lubrication, forged internals.",
        verifiedSpecs: [
          {
            label: "Configuration",
            value: "60° V12 · 6,498 cc",
          },
          {
            label: "Max Power",
            value: "700 CV (515 kW) @ 8,250 rpm",
          },
          {
            label: "Max Torque",
            value: "690 Nm @ 5,500 rpm",
          },
          {
            label: "Gearbox",
            value: "7-speed ISR · 50 ms shifts",
          },
          {
            label: "Drive",
            value: "Haldex IV AWD",
          },
        ],
      },
      hybrid_system: {
        name: "No Hybrid System — Pure V12",
        subtitle: "This model is not electrified",
        design: "The LP 700-4 pre-dates Lamborghini's hybrid era (Sián, Revuelto).",
        function: "All 700 CV is produced by the naturally aspirated V12.",
        materials: "—",
        verifiedSpecs: [
          {
            label: "Electrification",
            value: "None",
          },
        ],
      },
      wheels: {
        name: "Forged Alloy Wheels (Dione)",
        subtitle: "Staggered 19-inch front / 20-inch rear",
        design:
          "Multi-spoke forged wheels with centre-lock-look caps and exposed carbon-ceramic brakes behind.",
        function: "Staggered fitment supports the rear-biased torque split of the AWD system.",
        materials: "Forged aluminium alloy.",
        verifiedSpecs: [
          {
            label: "Front",
            value: "9J × 19 in",
          },
          {
            label: "Rear",
            value: "12J × 20 in",
          },
        ],
      },
      tires: {
        name: "Pirelli P Zero (Lamborghini Spec)",
        subtitle: "Developed with Pirelli for the Aventador",
        design: "Staggered ultra-low-profile tyres.",
        function: "Transmits 690 Nm through all four wheels.",
        materials: "Pirelli P Zero compound.",
        verifiedSpecs: [
          {
            label: "Front",
            value: "255/35 ZR19",
          },
          {
            label: "Rear",
            value: "335/30 ZR20",
          },
        ],
      },
      brakes_ccm: {
        name: "Carbon-Ceramic Brake Discs (CCB)",
        subtitle: "Standard carbon-ceramic system",
        design: "Ventilated, cross-drilled carbon-ceramic discs.",
        function: "100 – 0 km/h in approx. 32.5 m as quoted at launch.",
        materials: "Carbon-ceramic (C/SiC) composite.",
        verifiedSpecs: [
          {
            label: "Front Discs",
            value: "400 × 38 mm",
          },
          {
            label: "Rear Discs",
            value: "380 × 38 mm",
          },
        ],
      },
      calipers: {
        name: "Brembo Monoblock Calipers",
        subtitle: "6-piston front / 4-piston rear",
        design: "Fixed aluminium monoblock calipers.",
        function: "Clamps the 400 / 380 mm carbon-ceramic discs.",
        materials: "Aluminium monoblock.",
        verifiedSpecs: [
          {
            label: "Front",
            value: "6-piston",
          },
          {
            label: "Rear",
            value: "4-piston",
          },
        ],
      },
      aero_gurney: {
        name: "Active Rear Wing & Engine Cover Vents",
        subtitle: "Three-position electronically actuated spoiler",
        design: "A rear wing rises from the deck, and variable engine-cover flaps open to cool the V12.",
        function: "Wing positions: retracted (low drag), 4° (high speed) and 11° (maximum downforce).",
        materials: "Carbon-fiber composite.",
        verifiedSpecs: [
          {
            label: "Wing Angles",
            value: "0° / 4° / 11°",
          },
        ],
      },
      cockpit: {
        name: "TFT Digital Cockpit & Scissor Doors",
        subtitle: "Fighter-jet style start button under a red flip cover",
        design:
          "A fully digital TFT instrument cluster and aeronautical switchgear sit under a low roofline; the scissor doors are modelled open in this asset.",
        function: "Drive-select modes Strada, Sport and Corsa adjust engine, gearbox, AWD and ESP.",
        materials: "Leather, Alcantara and carbon-fiber trim.",
        verifiedSpecs: [
          {
            label: "Instrumentation",
            value: "Full TFT digital cluster",
          },
          {
            label: "Drive Modes",
            value: "Strada / Sport / Corsa",
          },
        ],
      },
      headlights: {
        name: "Bi-Xenon Headlamps with LED DRL",
        subtitle: "Y-shaped LED signature",
        design: "Slim units with Y-motif LED daytime running lights.",
        function: "Bi-xenon low/high beam with LED indicators.",
        materials: "Polycarbonate lenses, LED/xenon sources.",
        verifiedSpecs: [
          {
            label: "Technology",
            value: "Bi-Xenon + LED DRL",
          },
        ],
      },
      taillights: {
        name: "Y-Signature LED Tail Lamps",
        subtitle: "Full LED rear lighting",
        design: "Y-shaped LED graphics flank the quad exhaust and diffuser.",
        function: "Brake, tail and indicator functions in LED.",
        materials: "LED arrays, tinted lenses.",
        verifiedSpecs: [
          {
            label: "Technology",
            value: "Full LED",
          },
        ],
      },
    },
  },
  {
    id: "mclaren-vgt",
    brand: "McLaren",
    model: "Ultimate Vision Gran Turismo",
    year: "2017 Concept",
    tagline: "1,150 PS hybrid Vision GT concept · Prone driving position",
    shortTitle: "Ultimate Vision GT",
    assetUrl: CAR3_GLB_URL,
    rotationY: Math.PI,
    targetLength: 4.95,
    isSF90Reference: !1,
    defaultPaintHex: "#F26A1B",
    accentHex: "#FF6B1A",
    license: {
      title: "Mclaren Ultimate Vision GT | updated + texture",
      author: "kevin (ケビン) — sketchfab.com/sohyalebret",
      license: "CC-BY 4.0",
      source:
        "https://sketchfab.com/3d-models/mclaren-ultimate-vision-gt-updated-texture-9356ec0503bd45debd2b4cec317ad4c6",
      note: "Textures resized to 1K and Draco-compressed (2.2 MB) for this showroom.",
    },
    telemetry: [
      {
        label: "Combined Output",
        value: "1,150 PS",
        sub: "4.0 TT V8 + 2 e-motors",
      },
      {
        label: "Max Torque",
        value: "1,275 Nm",
        sub: "Hybrid system total",
      },
      {
        label: "Weight",
        value: "1,000 kg",
        sub: "Concept figure",
      },
      {
        label: "Layout",
        value: "Mid-engine",
        sub: "Front e-axle AWD",
      },
      {
        label: "Debut",
        value: "2017",
        sub: "Gran Turismo Sport",
      },
    ],
    components: {
      paintwork: {
        name: "Vision GT Concept Body",
        subtitle: "Designed by McLaren Design for Gran Turismo Sport",
        design:
          "An extreme single-seat concept revealed in 2017 for Polyphony Digital's Vision Gran Turismo programme, previewing McLaren's design direction for the 2030s with a jet-canopy cockpit and open rear structure.",
        function:
          "The slippery shell is shaped around a central prone driving position, lowering frontal area and centre of gravity.",
        materials: "Conceptual carbon-fiber structure (virtual concept — no production car exists).",
        verifiedSpecs: [
          {
            label: "Status",
            value: "Virtual concept (GT Sport)",
          },
          {
            label: "Seating",
            value: "Single, prone position",
          },
          {
            label: "Quoted Weight",
            value: "1,000 kg",
          },
        ],
      },
      engine_v8: {
        name: "4.0 L Twin-Turbo V8 Hybrid",
        subtitle: "Mid-mounted petrol V8 driving the rear axle",
        design:
          "A 4.0-litre twin-turbocharged V8 sits behind the driver, paired with two electric motors driving the front wheels.",
        function: "Combined system output quoted at 1,150 PS and 1,275 Nm with all-wheel traction.",
        materials: "Conceptual — specification as published by McLaren in 2017.",
        verifiedSpecs: [
          {
            label: "Engine",
            value: "4.0 L twin-turbo V8",
          },
          {
            label: "Combined Power",
            value: "1,150 PS",
          },
          {
            label: "Combined Torque",
            value: "1,275 Nm",
          },
        ],
      },
      hybrid_system: {
        name: "Twin Front-Axle Electric Motors",
        subtitle: "Electric all-wheel drive concept",
        design: "Two electric motors on the front axle complement the rear-driven V8.",
        function: "Provides torque-vectored all-wheel drive and hybrid boost.",
        materials: "Conceptual.",
        verifiedSpecs: [
          {
            label: "E-Motors",
            value: "2 × front axle",
          },
        ],
      },
      cockpit: {
        name: "Prone 'Superman' Driving Position",
        subtitle: "Driver lies face-down beneath a jet canopy",
        design: "The driver enters through a canopy and lies prone, head forward, to minimise height.",
        function:
          "A heads-up display projects telemetry onto the canopy; the position drastically lowers the car's centre of gravity.",
        materials: "Conceptual carbon tub and canopy.",
        verifiedSpecs: [
          {
            label: "Position",
            value: "Prone, centre-line",
          },
        ],
      },
      aero_gurney: {
        name: "Active Aero & Open Rear Structure",
        subtitle: "Integrated active aerodynamics",
        design: "An open-work rear deck and active wing elements manage downforce.",
        function: "Active aero devices adjust drag and downforce (conceptual).",
        materials: "Conceptual carbon-fiber.",
        verifiedSpecs: [
          {
            label: "Aero",
            value: "Active (concept)",
          },
        ],
      },
      wheels: {
        name: "Aero Disc Wheels",
        subtitle: "Closed-face aerodynamic wheels",
        design: "Low-drag covered wheels with McLaren centre caps.",
        function: "Reduces wheel-arch turbulence.",
        materials: "Conceptual.",
        verifiedSpecs: [
          {
            label: "Type",
            value: "Aero disc (concept)",
          },
        ],
      },
    },
  },
];

export function getCarById(Q) {
  return CARS.find((A) => A.id === Q) || CARS[0];
}

export function getComponentSpec(Q, A) {
  const g = COMPONENT_SPECS[A];
  if (Q.isSF90Reference) return g;
  const I = Q.components[A];
  return I
    ? {
        ...g,
        ...I,
      }
    : {
        ...g,
        name: g.name.replace(/SF90|F154FA|Matrix LED/g, "").trim(),
        subtitle: `${Q.brand} ${Q.model}`,
        design: `This mesh group is classified as "${g.category}" on the ${Q.brand} ${Q.model}.`,
        function: "No verified manufacturer documentation for this component is bundled with this asset.",
        materials: "Refer to the manufacturer's technical specification.",
        verifiedSpecs: [
          {
            label: "Documentation",
            value: "Not available for this model",
          },
        ],
      };
}

export const HOTSPOT_IDS = [
  "headlights",
  "carbon_splitter",
  "wheels",
  "calipers",
  "steering_wheel",
  "engine_v8",
  "aero_gurney",
  "exhausts",
  "carbon_diffuser",
];

export const PANEL_SECTIONS = [
  "Exterior & Aero",
  "Chassis & Rolling Gear",
  "Cockpit & HMI",
  "PHEV Powertrain",
];
