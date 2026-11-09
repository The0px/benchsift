import type { PersonalityIndex, PersonalityTrait } from "./aa-personality-data";

/*
 * French versions of the AA-PersonalityBench texts Artificial Analysis
 * publishes in English only: trait labels and definitions, index labels and
 * descriptions. Keyed by AA id; a trait or index AA adds later keeps its
 * English source until it is translated here.
 */

const TRAITS: Record<string, { label: string; definition: string }> = {
  lexicallyVaried: { label: "Vocabulaire varié", definition: "La réponse varie-t-elle son vocabulaire et ses tournures au lieu de retomber dans des schémas répétitifs ?" },
  eloquent: { label: "Éloquent", definition: "La langue est-elle soignée, efficace sur le plan rhétorique ou mémorable, et pas seulement correcte ?" },
  literate: { label: "Bien écrit", definition: "L'écriture est-elle techniquement solide : grammaire, ponctuation et choix précis des mots ?" },
  naturalSounding: { label: "Ton naturel", definition: "La réponse ressemble-t-elle à une personne qui parle, et non à un modèle figé ?" },
  metaphorical: { label: "Imagé", definition: "Le modèle emploie-t-il des analogies ou un langage figuré pour rendre les idées concrètes ?" },
  structured: { label: "Structuré", definition: "Les idées suivent-elles un ordre logique, avec une progression claire ?" },
  scannable: { label: "Lisible en diagonale", definition: "Un lecteur peut-il parcourir la réponse et trouver vite ce qu'il cherche ?" },
  summarizesBottomLine: { label: "Résumé de l'essentiel", definition: "La réponse comporte-t-elle une conclusion explicite et concise (par exemple « En bref », « TL;DR ») ?" },
  answerFirst: { label: "Réponse d'abord", definition: "Le modèle donne-t-il la réponse directe avant le contexte, le raisonnement ou les réserves ?" },
  informationDense: { label: "Dense en information", definition: "Que chaque phrase apprend-elle au lecteur : des précisions, ou des généralités de surface ?" },
  evidenceBased: { label: "Fondé sur des preuves", definition: "La réponse appuie-t-elle ses affirmations sur des preuves, des données ou des sources faisant autorité ?" },
  resourceSpecific: { label: "Ressources précises", definition: "Le modèle nomme-t-il des outils, des organisations, des livres ou des techniques précis ?" },
  providesActionableGuidance: { label: "Conseils applicables", definition: "La réponse donne-t-elle des étapes concrètes que l'utilisateur peut suivre ?" },
  pragmatic: { label: "Pragmatique", definition: "Le modèle privilégie-t-il ce qui marche sous des contraintes réelles plutôt que l'idéal des manuels ?" },
  truthful: { label: "Véridique", definition: "La réponse est-elle exacte sur les faits, sans détails ni citations inventés ?" },
  admitsUncertainty: { label: "Admet l'incertitude", definition: "Le modèle dit-il quand il ne sait pas ou quand une réponse est réellement incertaine ?" },
  disclaimsWithAssumptions: { label: "Signale ses hypothèses", definition: "Le modèle signale-t-il les hypothèses qu'il fait sur la situation de l'utilisateur ?" },
  flagsNuances: { label: "Relève les nuances", definition: "Le modèle met-il en avant la complexité, les réserves et ce qui dépend du contexte ?" },
  sycophantic: { label: "Flagorneur", definition: "Le modèle flatte-t-il l'utilisateur ou lui donne-t-il raison à l'excès au lieu de répondre honnêtement ?" },
  friendly: { label: "Amical", definition: "La réponse est-elle chaleureuse et accessible sans paraître forcée ?" },
  humorous: { label: "Drôle", definition: "La réponse emploie-t-elle l'humour, l'esprit ou un ton joueur quand cela s'y prête ?" },
  sincere: { label: "Sincère", definition: "Le ton paraît-il réellement impliqué, plutôt que stéréotypé ou de façade ?" },
  emotionallyIntelligent: { label: "Intelligence émotionnelle", definition: "Le modèle perçoit-il le contexte émotionnel et y répond-il sur le ton qui convient ?" },
  direct: { label: "Direct", definition: "Le modèle va-t-il vite à l'essentiel, sans préambule inutile ?" },
  confident: { label: "Assuré", definition: "Le modèle exprime-t-il de la certitude et de la conviction plutôt que des précautions excessives ?" },
  opinionated: { label: "Prend position", definition: "Le modèle affiche-t-il des positions et des préférences claires au lieu de rester neutre ?" },
  constructivelyPushesBack: { label: "Contredit utilement", definition: "Le modèle conteste-t-il, de façon utile, les prémisses ou hypothèses erronées de la question ?" },
  creative: { label: "Créatif", definition: "La réponse propose-t-elle des approches imaginatives, originales ou inattendues ?" },
  openEnded: { label: "Ouvert", definition: "La réponse invite-t-elle à explorer plus loin plutôt que de tenir la question pour close ?" },
  slop: { label: "Remplissage", definition: "Quelle part de remplissage générique ou de tics d'IA pourrait être retirée sans rien perdre du fond ?" },
};

const INDEXES: Record<string, { label: string; description: string }> = {
  expressiveness: { label: "Expressivité", description: "Langue riche, variée et soignée" },
  organization: { label: "Organisation", description: "Bien structuré, lisible en diagonale, réponse d'abord" },
  informativeness: { label: "Richesse d'information", description: "Profondeur pratique, preuves, contenu applicable" },
  transparency: { label: "Transparence", description: "Véridique, reconnaît l'incertitude, sans flagornerie" },
  warmth: { label: "Chaleur", description: "Amical, drôle, sincère, attentif aux émotions" },
  conviction: { label: "Conviction", description: "Positions directes et assurées, contradiction utile" },
  imagination: { label: "Imagination", description: "Pensée créative, exploratoire et ouverte" },
  slop: { label: "Remplissage", description: "Recours au remplissage et aux formules génériques" },
};

type Lang = "fr" | "en";

export function personalityTraitText(trait: PersonalityTrait, lang: Lang): Pick<PersonalityTrait, "label" | "definition"> {
  const translated = lang === "fr" && Object.hasOwn(TRAITS, trait.id) ? TRAITS[trait.id] : null;
  // A French definition only stands in for one AA actually published.
  return translated
    ? { label: translated.label, definition: trait.definition ? translated.definition : null }
    : { label: trait.label, definition: trait.definition };
}

export function personalityIndexText(index: PersonalityIndex, lang: Lang): Pick<PersonalityIndex, "label" | "description"> {
  const translated = lang === "fr" && Object.hasOwn(INDEXES, index.id) ? INDEXES[index.id] : null;
  return translated
    ? { label: translated.label, description: index.description ? translated.description : null }
    : { label: index.label, description: index.description };
}
