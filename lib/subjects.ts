export interface Subject {
  id: string;
  name: string;
  icon: string;
  blurb: string;
}

/**
 * Single source of truth for the USMLE Step 1 subjects (First Aid order).
 * A subject becomes playable on the dashboard once its question bank is
 * non-empty in Supabase; cards with no questions yet show Coming soon.
 */
export const SUBJECTS: Subject[] = [
  { id: "Biochemistry", name: "Biochemistry", icon: "🧪", blurb: "Metabolism, enzymes, molecular biology" },
  { id: "Immunology", name: "Immunology", icon: "🛡️", blurb: "Immunodeficiencies, hypersensitivity, complement" },
  { id: "Microbiology", name: "Microbiology", icon: "🦠", blurb: "Bacteriology, virology, mycology" },
  { id: "Pathology", name: "Pathology", icon: "🔬", blurb: "Cell injury, neoplasia, systemic pathology" },
  { id: "Pharmacology", name: "Pharmacology", icon: "💊", blurb: "Drug mechanisms, toxicities, antidotes" },
  { id: "PHS", name: "PHS", icon: "📊", blurb: "Public health sciences: biostats, ethics, prevention" },
  { id: "Cardiovascular", name: "Cardiovascular", icon: "🫀", blurb: "Heart and vascular disease" },
  { id: "Endocrine", name: "Endocrine", icon: "🧬", blurb: "Hormones, thyroid, diabetes, adrenal" },
  { id: "Gastrointestinal", name: "Gastrointestinal", icon: "🍽️", blurb: "Esophagus, liver, bowel disease" },
  { id: "Oncology and Hematology", name: "Oncology and Hematology", icon: "🩸", blurb: "Cancers, anemias, coagulation" },
  { id: "Musculoskeletal", name: "Musculoskeletal", icon: "🦴", blurb: "Bones, joints, muscle, skin" },
  { id: "Neurology", name: "Neurology", icon: "🧠", blurb: "Brain, spinal cord, nerves" },
  { id: "Psychiatry", name: "Psychiatry", icon: "🧩", blurb: "Mental disorders, behavior" },
  { id: "Renal", name: "Renal", icon: "🫘", blurb: "Kidney, electrolytes, acid-base" },
  { id: "Reproductive", name: "Reproductive", icon: "👶", blurb: "Pregnancy, gynecology, urology" },
  { id: "Respiratory", name: "Respiratory", icon: "🫁", blurb: "Lungs, pleura, ventilation" },
];
