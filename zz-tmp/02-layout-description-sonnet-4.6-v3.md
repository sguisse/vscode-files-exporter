🔬 Audit & Raffinement du Prompt Graphify

📋 Audit Sans Concession

❌ Problèmes Identifiés

| Zone | Criticité | Problème |
|------|-----------|---------|
| **Objectif** | 🔴 Majeur | "RAG Graph" non mentionné — le prompt ignore totalement le contexte multi-solutions RAG |
| **graph.json** | 🔴 Majeur | Format supposé unique et implicite — aucun schéma défini, aucune variabilité prévue |
| **Relations/Edges** | 🔴 Majeur | Les relations entre nœuds ne sont jamais formalisées — traitement superficiel des edges |
| **Multi-RAG** | 🔴 Majeur | Pas d'abstraction pour supporter Neo4j, LlamaIndex, LangChain, Weaviate, etc. |
| **Interopérabilité** | 🔴 Majeur | Aucune interface de conversion/mapping vers un schéma pivot |
| **Configuration** | 🟠 Important | Réduite à un textarea JSON — pas de sections typées, pas de validation, pas de profils |
| **Extension Backend** | 🟠 Important | `postMessage` mentionné mais jamais architecturé |
| **Types de relations** | 🟠 Important | Directions, cardinalités, poids des edges absents |
| **Monaco Editor** | 🟡 Mineur | Suggéré comme optionnel alors que critique pour l'édition de schémas |
| **AI Assistant** | 🟡 Mineur | Gemini hardcodé — pas d'abstraction pour d'autres LLMs |



-------------------------

🚀 Graphify: VS Code Webview UI Architecture

Multi-RAG Graph Navigation & Visual Exploration Plugin

-------------------------

🎯 Application Objective

Graphify est un outil d'exploration visuelle et d'analyse structurelle interactif, directement intégré dans l'IDE. Son ambition centrale est de constituer un hub de navigation unifié pour des solutions RAG hétérogènes (Neo4j Graph RAG, LlamaIndex Knowledge Graph, LangChain Graph RAG, Weaviate, MemGraph, Amazon Neptune, etc.), en faisant abstraction des formats natifs de chaque solution via un schéma pivot normalisé.
Il traduit les graphes de connaissances en arbres hiérarchiques synchronisés et en réseaux de nœuds interactifs, permettant :
- La navigation multi-sources dans des graphes provenant de solutions RAG disparates
- La visualisation des relations typées entre entités (dépendances, invocations, héritages, références sémantiques, co-occurrences, etc.)
- L'analyse d'impact pré-refactoring via les chaînes d'appels parents/enfants
- L'audit architectural par IA (LLM configurable) sur des clusters de nœuds sélectionnés
- La conversion transparente entre formats natifs RAG et schéma pivot via des adaptateurs déclarés
-------------------------

🏛️ Architecture Globale de l'Extension

Séparation Extension Host / Webview


┌─────────────────────────────────────────────────────────┐
│                   VS Code Extension Host                 │
│                                                         │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │  GraphAdapter   │    │    ConfigurationService  │   │
│  │  Registry       │    │    (profiles, validation)│   │
│  └────────┬────────┘    └──────────────┬───────────┘   │
│           │                            │               │
│  ┌────────▼────────────────────────────▼───────────┐   │
│  │           MessageBroker (postMessage API)        │   │
│  └────────────────────────┬────────────────────────┘   │
└───────────────────────────│─────────────────────────────┘
                            │ serialize / deserialize
┌───────────────────────────▼─────────────────────────────┐
│                      Webview Panel                       │
│                                                         │
│   GraphRenderer │ FilterEngine │ AIPanel │ ConfigEditor │
└─────────────────────────────────────────────────────────┘


Protocole de Messages (Extension ↔ Webview)


// Types de messages entrants (Extension → Webview)
type InboundMessage =
  | { type: 'GRAPH_LOADED';    payload: NormalizedGraph }
  | { type: 'CONFIG_UPDATED';  payload: GraphifyConfig }
  | { type: 'AI_RESPONSE';     payload: AIAnalysisResult }
  | { type: 'ADAPTER_LIST';    payload: AdapterDescriptor[] }
  | { type: 'ERROR';           payload: { code: string; message: string } };

// Types de messages sortants (Webview → Extension)
type OutboundMessage =
  | { type: 'REQUEST_GRAPH';   payload: { source: string; adapterId: string } }
  | { type: 'SAVE_CONFIG';     payload: GraphifyConfig }
  | { type: 'REQUEST_AI';      payload: { nodes: string[]; prompt: string } }
  | { type: 'OPEN_FILE';       payload: { path: string; line?: number } };


-------------------------

📐 Schéma Pivot : NormalizedGraph

> **Principe fondateur** : Toute source de données RAG doit être convertie vers ce schéma avant d'être consommée par Graphify. Ce schéma est le contrat d'interface entre les adaptateurs et le moteur de rendu.

Spécification TypeScript du Schéma Pivot


// ─── Métadonnées du Graphe ─────────────────────────────────────────────────

interface GraphMetadata {
  id:          string;           // UUID unique de cette instance de graphe
  source:      string;           // Nom lisible de la source ("Neo4j Prod", "LlamaIndex v2")
  adapterId:   string;           // Identifiant de l'adaptateur utilisé
  version:     string;           // Version du schéma pivot (semver: "1.0.0")
  createdAt:   string;           // ISO 8601
  nodeCount:   number;
  edgeCount:   number;
  tags:        string[];         // Labels libres pour filtrage
}

// ─── Nœud Normalisé ────────────────────────────────────────────────────────

interface NormalizedNode {
  id:          string;           // Identifiant unique stable (peut être UUID ou hash)
  label:       string;           // Nom d'affichage principal
  type:        NodeType;         // Voir enum ci-dessous
  subType?:    string;           // Type secondaire libre (ex: "Controller", "Entity")

  // Localisation source (optionnelle selon la nature du nœud)
  source?: {
    file:      string;           // Chemin relatif à la racine du workspace
    line?:     number;
    column?:   number;
    module?:   string;           // Nom du module/package
  };

  // Données sémantiques (pour les graphes RAG)
  semantic?: {
    embedding?:   number[];      // Vecteur d'embedding (si disponible)
    score?:       number;        // Score de pertinence contextuel [0-1]
    summary?:     string;        // Résumé généré ou extrait
    community?:   string;        // Identifiant de communauté (Louvain, etc.)
  };

  // Rendu visuel (peut être surchargé par la configuration)
  visual?: {
    color?:    string;           // Hex ou CSS variable
    shape?:    NodeShape;
    size?:     number;
    icon?:     string;           // Codicon ID ou URL SVG
  };

  properties:  Record<string, unknown>;  // Propriétés natives passthrough
  nativeId?:   string;          // ID dans le système source (pour débogage)
}

enum NodeType {
  FILE        = 'file',
  CLASS       = 'class',
  METHOD      = 'method',
  FUNCTION    = 'function',
  MODULE      = 'module',
  CONCEPT     = 'concept',       // Entité sémantique RAG
  DOCUMENT    = 'document',      // Chunk ou document RAG
  ENTITY      = 'entity',        // Entité nommée (NER)
  COMMUNITY   = 'community',     // Cluster de communauté
  CUSTOM      = 'custom',
}

type NodeShape = 'circle' | 'box' | 'diamond' | 'triangle' | 'star' | 'hexagon';

// ─── Relation Normalisée ───────────────────────────────────────────────────

interface NormalizedEdge {
  id:          string;           // Identifiant unique
  source:      string;           // ID du nœud source
  target:      string;           // ID du nœud cible

  relation:    EdgeRelation;     // Type sémantique de la relation
  label?:      string;           // Label d'affichage (peut différer du type)

  direction:   EdgeDirection;    // Voir enum
  cardinality: EdgeCardinality;  // Voir enum

  // Métriques de la relation
  weight?:     number;           // Force/importance de la relation [0-1]
  confidence?: number;           // Confiance si inférée par IA [0-1]
  frequency?:  number;           // Nombre d'occurrences observées

  // Contexte temporel
  temporal?: {
    since?:    string;           // ISO 8601 — date d'apparition
    until?:    string;           // ISO 8601 — date de disparition
  };

  // Rendu visuel
  visual?: {
    color?:    string;
    width?:    number;
    dashes?:   boolean;
    arrow?:    'to' | 'from' | 'both' | 'none';
  };

  properties:  Record<string, unknown>;
  nativeId?:   string;
}

enum EdgeRelation {
  // Relations structurelles (code)
  CALLS           = 'CALLS',
  IMPORTS         = 'IMPORTS',
  INHERITS        = 'INHERITS',
  IMPLEMENTS      = 'IMPLEMENTS',
  CONTAINS        = 'CONTAINS',
  REFERENCES      = 'REFERENCES',
  DEFINES         = 'DEFINES',
  OVERRIDES       = 'OVERRIDES',

  // Relations sémantiques (RAG)
  RELATED_TO      = 'RELATED_TO',
  SIMILAR_TO      = 'SIMILAR_TO',
  MENTIONS        = 'MENTIONS',
  DERIVED_FROM    = 'DERIVED_FROM',
  PART_OF         = 'PART_OF',
  ANSWERS         = 'ANSWERS',
  CONTRADICTS     = 'CONTRADICTS',

  // Relations de graphe de connaissances
  IS_A            = 'IS_A',
  HAS_PROPERTY    = 'HAS_PROPERTY',
  BELONGS_TO      = 'BELONGS_TO',

  CUSTOM          = 'CUSTOM',    // + champ `label` obligatoire
}

enum EdgeDirection {
  DIRECTED    = 'directed',      // source → target
  UNDIRECTED  = 'undirected',    // source — target
  BIDIRECTED  = 'bidirected',    // source ↔ target
}

enum EdgeCardinality {
  ONE_TO_ONE    = '1:1',
  ONE_TO_MANY   = '1:N',
  MANY_TO_ONE   = 'N:1',
  MANY_TO_MANY  = 'N:N',
}

// ─── Graphe Normalisé Complet ──────────────────────────────────────────────

interface NormalizedGraph {
  metadata:  GraphMetadata;
  nodes:     NormalizedNode[];
  edges:     NormalizedEdge[];

  // Index de navigation rapide (pré-calculé par l'adaptateur)
  index?: {
    nodeById:    Record<string, NormalizedNode>;
    edgesBySource: Record<string, string[]>;   // nodeId → edgeIds
    edgesByTarget: Record<string, string[]>;
    nodesByType:   Record<NodeType, string[]>;
  };
}


-------------------------

🔌 Interface des Adaptateurs RAG

> **Principe** : Chaque solution RAG implémente `IGraphAdapter`. L'extension maintient un registre d'adaptateurs. L'utilisateur sélectionne et configure son adaptateur dans le panneau Configuration.


// ─── Interface Principale à Implémenter ───────────────────────────────────

interface IGraphAdapter {

  // Identité de l'adaptateur
  readonly descriptor: AdapterDescriptor;

  /**
   * Valide que la configuration fournie est correcte.
   * Retourne un tableau d'erreurs (vide = valide).
   */
  validate(config: AdapterConfig): Promise<ValidationError[]>;

  /**
   * Point d'entrée principal : convertit la source native
   * vers le NormalizedGraph.
   * @param source  Chemin fichier, URL, ou connexion DB selon l'adaptateur
   * @param config  Configuration spécifique à cet adaptateur
   * @param options Options de normalisation (filtres, limites)
   */
  convert(
    source:   string,
    config:   AdapterConfig,
    options?: ConversionOptions
  ): Promise<NormalizedGraph>;

  /**
   * Retourne les types de relations natifs de cette solution RAG
   * et leur mapping suggéré vers EdgeRelation.
   */
  getRelationMappings(): RelationMapping[];

  /**
   * Retourne les types de nœuds natifs et leur mapping suggéré
   * vers NodeType.
   */
  getNodeTypeMappings(): NodeTypeMapping[];

  /**
   * Capacités optionnelles déclarées par l'adaptateur.
   */
  getCapabilities(): AdapterCapabilities;
}

// ─── Descripteur d'Adaptateur ─────────────────────────────────────────────

interface AdapterDescriptor {
  id:           string;          // "neo4j", "llamaindex", "langchain-graph", ...
  displayName:  string;          // "Neo4j Graph Database"
  version:      string;
  icon?:        string;          // URL ou codicon
  docsUrl?:     string;
  configSchema: JSONSchema7;     // JSON Schema de la configuration attendue
}

// ─── Mapping de Relations ──────────────────────────────────────────────────

interface RelationMapping {
  nativeType:     string;        // Ex: "CALLS" dans Neo4j, "child" dans LlamaIndex
  normalizedType: EdgeRelation;  // Mapping vers le schéma pivot
  directionHint?: EdgeDirection; // Direction implicite dans cette source
  confidence:     number;        // Confiance du mapping automatique [0-1]
  overridable:    boolean;       // L'utilisateur peut-il surcharger ce mapping?
}

interface NodeTypeMapping {
  nativeType:     string;
  normalizedType: NodeType;
  confidence:     number;
  overridable:    boolean;
}

// ─── Options de Conversion ────────────────────────────────────────────────

interface ConversionOptions {
  maxNodes?:         number;     // Limite pour éviter les graphes trop denses
  maxEdges?:         number;
  includeEmbeddings?: boolean;   // Inclure les vecteurs (coûteux)
  nodeTypeFilter?:   NodeType[];
  edgeTypeFilter?:   EdgeRelation[];
  depthLimit?:       number;     // Profondeur max depuis les nœuds racines
  rootNodeIds?:      string[];   // Partir de nœuds spécifiques
}

// ─── Capacités de l'Adaptateur ────────────────────────────────────────────

interface AdapterCapabilities {
  supportsStreaming:    boolean;  // Chargement incrémental possible
  supportsSubgraph:    boolean;  // Extraction de sous-graphe
  supportsEmbeddings:  boolean;  // Fournit des vecteurs
  supportsLiveSync:    boolean;  // Mise à jour en temps réel
  supportsQuery:       boolean;  // Supporte les requêtes (Cypher, SPARQL...)
  maxRecommendedNodes: number;
}

// ─── Erreurs de Validation ────────────────────────────────────────────────

interface ValidationError {
  field:    string;
  message:  string;
  severity: 'error' | 'warning';
}


Adaptateurs Pré-embarqués


// Exemple d'adaptateur Neo4j (structure attendue)
class Neo4jAdapter implements IGraphAdapter {
  readonly descriptor: AdapterDescriptor = {
    id: 'neo4j',
    displayName: 'Neo4j Graph Database',
    version: '1.0.0',
    configSchema: {
      type: 'object',
      required: ['uri', 'auth'],
      properties: {
        uri:      { type: 'string', format: 'uri' },
        auth: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          }
        },
        database: { type: 'string', default: 'neo4j' },
        query:    { type: 'string', description: 'Cypher query optionnelle' },
      }
    }
  };
  // ...implement convert(), getRelationMappings(), etc.
}

// Registre des adaptateurs disponibles
const BUILT_IN_ADAPTERS: AdapterDescriptor[] = [
  { id: 'neo4j',           displayName: 'Neo4j'                    },
  { id: 'llamaindex',      displayName: 'LlamaIndex Knowledge Graph'},
  { id: 'langchain-graph', displayName: 'LangChain Graph RAG'       },
  { id: 'weaviate',        displayName: 'Weaviate'                  },
  { id: 'memgraph',        displayName: 'MemGraph'                  },
  { id: 'json-file',       displayName: 'JSON File (schéma pivot)'  },
  { id: 'custom',          displayName: 'Adaptateur personnalisé'   },
];


-------------------------

🏗️ Global Webview Container

- Layout: Full-viewport (100vh, 100vw), overflow: hidden — comportement de tab éditeur natif VS Code.
- Theming: Héritage strict des CSS variables VS Code (var(--vscode-editor-background), var(--vscode-foreground), var(--vscode-focusBorder), etc.) — zéro couleur hardcodée.
- Initialisation: Au montage, la Webview émet REQUEST_ADAPTER_LIST pour récupérer les adaptateurs disponibles depuis l'Extension Host, puis affiche l'écran de sélection de source si aucun graphe n'est chargé.
-------------------------

🪧 Action Toolbar (Top Header)

- Layout: Flexbox Row sticky, hauteur fixe (40px), alignement vertical centré.
- Section Gauche: Icône app + titre "Graphify" + badge indiquant la source active ([Neo4j: prod]).
- Section Droite:
  - Sélecteur de Source RAG: <vscode-dropdown> listant les sources configurées (alimenté par ADAPTER_LIST).
  - Bouton Charger: Déclenche postMessage({ type: 'REQUEST_GRAPH', payload: { source, adapterId } }) — jamais un <input type="file"> direct.
  - Bouton Vue: Ouvre la Selection Overlay.
  - Indicateur de statut: Spinner + label ("Conversion en cours...", "X nœuds chargés") reflétant l'état du pipeline de conversion.
-------------------------

🔍 Exploration Filters (Collapsible Panel)

- Layout: <vscode-accordion> pleine largeur sous le header.
- Grille: 4 colonnes (ajout d'une colonne Relations).
- Colonne 1 — Types de Nœuds: <vscode-checkbox> par NodeType avec compteur dynamique (Class (12), Document (45)).
- Colonne 2 — Types de Relations: <vscode-checkbox> par EdgeRelation présent dans le graphe chargé, avec indicateur de direction (→ / ↔ / —).
- Colonne 3 — Recherche: <vscode-text-field> + <vscode-dropdown> (Contains / Exact / Regex) + bouton Rechercher.
- Colonne 4 — Cibles: Toggles Tree View / Graph View / Les deux + filtre par weight minimal (slider pour les edges RAG).
-------------------------

🗂️ Main Workspace (VS Code Tabbed Interface)

- Layout: <vscode-panels> occupant flex-1.
🕸️ Tab 1: Explorer View (Split Layout)

- Layout: Split pane redimensionnable — 30/70 par défaut.
Volet Gauche — Hierarchical Tree (30%)

- Ligne utilitaire : dropdown de groupement (par Type / Module / Communauté RAG / Source), ordre de tri, bouton effacer sélection.
- Arbre natif avec carets d'expansion, checkboxes multi-sélection.
- Nouveau : Indicateur inline du nombre de relations par nœud (→ 5 | ← 3).
- Clic sur nœud → centrage du graphe sur ce nœud + highlight dans le Graph View.
Volet Droit — Network Graph (70%)

- Toolbar interne:
  - Inputs "Profondeur Appelants / Appelés" (entiers, min 0, max 10).
  - <vscode-dropdown> Layout physique : Force-directed / Hierarchical / Circular / Dagre.
  - Bouton "Ajuster à l'écran".
  - Bouton "Exporter PNG/SVG".
- Canvas Vis.js:
    - Rendu physique des nœuds via NormalizedGraph.
    - Affichage des edges typés : couleur et style de trait dictés par EdgeRelation et EdgeDirection (arrow, dashes pour les relations inférées).
    - Tooltip riche au survol d'un edge : [source] --[RELATION: weight=0.87]--> [target] + propriétés natives passthrough.
    - Tooltip nœud : Label, Type, SubType, Score sémantique, résumé, fichier source cliquable.
    - Double-clic nœud → expansion de voisinage (émet REQUEST_GRAPH avec rootNodeIds).
- Légende dynamique:
      - Overlay bas-gauche — nœuds et types de relations présents dans la vue courante (pas tous les types de l'enum).
      - Mise à jour réactive au filtrage.
✨ Tab 2: AI Assistant

- Layout: Deux colonnes (sidebar contrôles + zone output).
- Sidebar:
  - Résumé : "X nœuds sélectionnés, Y relations incluses"
  - <vscode-dropdown> Sélection du LLM (Gemini / GPT-4 / Ollama local — configurable)
  - Prompt personnalisable (<vscode-text-area>) pré-rempli selon le contexte sélectionné.
  - Bouton "Lancer l'analyse".
- Zone Output:
    - Rendu Markdown (blocs de code, gras, listes) via styles VS Code.
    - Bouton "Copier" et bouton "Ouvrir dans éditeur" (crée un fichier .md temporaire).
⚙️ Tab 3: Configuration

- Layout: Flex colonne scrollable, organisée en sections expandables.
Section 1 — Sources RAG


┌─────────────────────────────────────────────┐
│  Sources Configurées                    [+] │
├─────────────────────────────────────────────┤
│  ● Neo4j Prod     [neo4j]     [Tester] [✎] │
│  ○ LlamaIndex Dev [llamaindex][Tester] [✎] │
│  + Ajouter une source                       │
└─────────────────────────────────────────────┘


Chaque source est éditée dans un formulaire généré dynamiquement depuis le configSchema JSON Schema de l'adaptateur sélectionné (rendu via @rjsf/core ou équivalent léger).
Section 2 — Mapping des Relations

Table éditable permettant de surcharger les RelationMapping de l'adaptateur actif :
| Relation Native | Type Pivot | Direction | Couleur | Style |
|----------------|-----------|-----------|---------|-------|
| `CALLS` | `CALLS` | → | `#FF6B6B` | solid |
| `child` | `CONTAINS` | → | `#4ECDC4` | solid |
| `similar` | `SIMILAR_TO` | ↔ | `#95E1D3` | dashed |



Section 3 — Rendu Visuel

Monaco Editor instance (mode JSON) ou <vscode-text-area> monospace pour éditer le schéma de rendu :

{
  "nodes": {
    "file":      { "color": "#569CD6", "shape": "box",     "icon": "file" },
    "class":     { "color": "#4EC9B0", "shape": "circle",  "icon": "symbol-class" },
    "method":    { "color": "#DCDCAA", "shape": "diamond", "icon": "symbol-method" },
    "concept":   { "color": "#C586C0", "shape": "hexagon", "icon": "lightbulb" },
    "document":  { "color": "#9CDCFE", "shape": "box",     "icon": "file-text" },
    "community": { "color": "#CE9178", "shape": "star",    "icon": "layers" }
  },
  "edges": {
    "CALLS":       { "color": "#FF6B6B", "width": 2, "dashes": false },
    "SIMILAR_TO":  { "color": "#95E1D3", "width": 1, "dashes": true  },
    "RELATED_TO":  { "color": "#C586C0", "width": 1, "dashes": true  },
    "INHERITS":    { "color": "#4EC9B0", "width": 3, "dashes": false }
  }
}


Bouton Valider (parsing JSON + validation contre le schéma interne) + bouton Sauvegarder & Appliquer (émet SAVE_CONFIG).
Section 4 — LLM & AI

- <vscode-dropdown> Provider : Gemini / OpenAI / Ollama / Azure OpenAI
- <vscode-text-field> API Key (masquée, stockée via vscode.SecretStorage)
- <vscode-text-field> Model ID
- <vscode-text-area> Prompt système par défaut
-------------------------

🪟 Selection Overlay (Modal View)

- Déclencheur: Bouton toolbar ou raccourci clavier (Ctrl+Shift+G).
- Layout: Backdrop semi-transparent centré, carte modale élevée (var(--vscode-notifications-background), var(--vscode-widget-shadow)).
- Structure:
  - Header: Titre + compteur + icône fermeture.
  - Filter Strip: Badges rapides par NodeType présent dans la sélection.
  - Filter Relations Strip: (Nouveau) Badges par EdgeRelation impliqué dans les nœuds sélectionnés.
  - Liste: Chaque item affiche icône type, label, subtype, chemin source cliquable, badge de score sémantique si disponible, compteur de relations (→5 ←3).
  - Footer: "Fermer" + "Analyser avec IA" (shortcut vers Tab 2 avec contexte pré-chargé) + "Exporter sélection JSON".
-------------------------

📦 Dépendances Techniques Recommandées

| Rôle | Package | Justification |
|------|---------|---------------|
| UI Components | `@vscode/webview-ui-toolkit` | Cohérence native VS Code |
| Graph Rendering | `vis-network` | Physique, interactif, configurable |
| Layout avancé | `elkjs` + `dagre` | Layouts hiérarchiques pour grands graphes |
| Monaco Editor | `monaco-editor` | Édition JSON avec validation inline |
| Schema Validation | `ajv` | Validation JSON Schema (configSchema adaptateurs) |
| Markdown Render | `marked` + `highlight.js` | Output AI Assistant |
| State Management | `zustand` ou `valtio` | Léger, compatible Webview sans framework lourd |



-------------------------

✅ Checklist d'Implémentation

- Définir NormalizedGraph comme package TypeScript partagé (/shared/schema)
- Implémenter IGraphAdapter pour json-file en premier (référence)
- Implémenter l'adaptateur neo4j avec mapping Cypher → NormalizedGraph
- Implémenter l'adaptateur llamaindex (parser JSON natif LlamaIndex)
- Implémenter l'adaptateur langchain-graph
- Construire le GraphAdapterRegistry dans l'Extension Host
- Construire le MessageBroker avec typage complet
- Intégrer la table de mapping des relations dans la Configuration
- Valider le configSchema de chaque adaptateur via AJV au chargement
- Implémenter les tooltips enrichis sur edges (relation + weight + propriétés)
- Tests unitaires sur chaque adaptateur (golden fixture par source RAG)
