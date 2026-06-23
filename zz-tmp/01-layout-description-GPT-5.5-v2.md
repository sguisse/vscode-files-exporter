Voici une version auditéе, renforcée et beaucoup plus explicite de ton prompt, en conservant l’intention initiale et en l’enrichissant fortement sur les points manquants : architecture VS Code, modèle pivot, intégration multi-RAG Graph, mapping des relations, configuration, convertisseurs, extensibilité, validation et robustesse.
-------------------------

Audit sans concession du prompt initial

Le prompt initial décrit bien une UI Webview VS Code pour explorer un graphe chargé depuis un graph.json, avec Tree View, Graph View, assistant IA et configuration. En revanche, il reste trop centré sur l’interface et pas assez sur l’architecture d’extension VS Code, la donnée, la normalisation et l’intégration de graphes hétérogènes.
Points faibles identifiés

- Le modèle de données est trop implicite
  - graph.json est mentionné, mais son format n’est pas défini.
  - Il n’y a pas de schéma de validation.
  - Les nœuds et relations ne sont pas normalisés.
  - Impossible d’intégrer proprement plusieurs solutions de RAG Graph sans modèle transverse.
- Absence de schéma pivot
    - Pour naviguer dans plusieurs solutions RAG Graph, il faut un schéma commun.
    - Chaque solution peut représenter les documents, chunks, embeddings, entités, citations, relations, appels, dépendances ou similarités différemment.
    - Sans schéma pivot, chaque nouvelle intégration nécessitera de modifier directement l’UI et la logique métier.
- Relations sous-spécifiées
      - Les relations sont le cœur d’un graphe.
      - Le prompt parle de parents/enfants, appelants/appelés, dépendances, mais ne définit pas :
        - type de relation ;
        - direction ;
        - cardinalité ;
        - poids ;
        - confiance ;
        - métadonnées ;
        - source de preuve ;
        - mapping visuel ;
        - hiérarchies vs liens transverses.
- Pas d’interface de conversion
        - Il faut une interface explicite permettant de convertir un modèle natif vers le schéma transverse.
        - Cette interface doit être implémentable pour chaque backend : LangChain, LlamaIndex, Neo4j, GraphRAG, Haystack, graphe custom, analyse statique de code, etc.
- Configuration trop limitée
          - La configuration actuelle se limite surtout aux couleurs et formes.
          - Il faut prévoir :
            - profils de configuration ;
            - mapping des types de nodes ;
            - mapping des types de relations ;
            - stratégie de grouping ;
            - paramètres de rendu ;
            - paramètres de filtrage ;
            - paramètres IA ;
            - paramètres de conversion ;
            - paramètres de performance ;
            - configuration workspace vs globale.
- Architecture VS Code insuffisamment détaillée
            - Le prompt décrit le Webview, mais pas assez :
              - extension host ;
              - commandes VS Code ;
              - postMessage ;
              - stockage ;
              - workspaceState / globalState ;
              - gestion de fichiers ;
              - watchers ;
              - sécurité CSP ;
              - séparation frontend/backend.
- Manque de stratégie de validation
              - Il faut valider :
                - le fichier source natif ;
                - le schéma pivot ;
                - la configuration ;
                - les mappings ;
                - les relations orphelines ;
                - les cycles ou incohérences.
- Pas de stratégie multi-sources
                - Le plugin doit pouvoir charger plusieurs graphes :
                  - un graphe code ;
                  - un graphe RAG ;
                  - un graphe documentaire ;
                  - un graphe d’architecture ;
                  - un graphe runtime.
                - Il faut donc prévoir des sources multiples, fusion, namespaces et résolution d’identifiants.
- IA Gemini trop couplée
                  - Gemini peut être le provider par défaut, mais l’architecture devrait être provider-agnostic.
                  - Prévoir une abstraction AIProvider, tout en gardant Gemini comme implémentation initiale.
- Performance non traitée
                    - Les graphes RAG peuvent être volumineux.
                    - Il faut prévoir :
                      - pagination ;
                      - virtualisation ;
                      - rendu progressif ;
                      - clustering ;
                      - lazy loading ;
                      - index côté extension host ;
                      - filtrage avant envoi au Webview.
-------------------------

Prompt refondu et enrichi


# 🚀 Graphify: VS Code Extension & Webview UI Architecture

## 🎯 Application Objective

**Graphify** est une extension VS Code interactive permettant l’exploration visuelle, structurelle et sémantique de graphes issus de plusieurs sources : code source, architectures logicielles, dépendances, graphes documentaires, graphes RAG, graphes de connaissances, GraphRAG, LangChain, LlamaIndex, Neo4j, Haystack ou tout format custom.

Graphify sert de pont entre :
- des modèles natifs hétérogènes ;
- un schéma pivot transverse normalisé ;
- une interface visuelle unifiée dans VS Code.

Son objectif principal est de permettre aux développeurs, architectes et équipes IA/RAG de naviguer dans des graphes complexes directement depuis leur IDE.

Graphify doit pouvoir ingérer un fichier structurel, par exemple `graph.json`, mais ne doit pas être limité à ce seul format. Il doit accepter plusieurs modèles natifs via des convertisseurs/adapters, puis les transformer vers un **Pivot Graph Schema** commun.

À partir de ce schéma normalisé, Graphify doit afficher :
- une arborescence hiérarchique ;
- un graphe réseau interactif ;
- des relations filtrables ;
- des sous-graphes contextuels ;
- des chaînes d’impact ;
- des relations RAG entre documents, chunks, embeddings, entités, prompts, réponses, sources et citations ;
- des analyses IA via Gemini ou un provider IA configurable.

Graphify doit permettre de :
- visualiser les dépendances ;
- isoler des domaines fonctionnels via des filtres robustes ;
- analyser l’impact avant refactoring ;
- explorer les relations parent/enfant ;
- explorer les chaînes appelants/appelés ;
- naviguer entre fichiers, classes, méthodes, documents, chunks, entités RAG ou concepts métiers ;
- inspecter les relations structurelles, sémantiques et documentaires ;
- utiliser un assistant IA intégré pour auditer, expliquer, résumer ou améliorer des clusters architecturaux.

---

# 🧱 Architecture générale de l’extension VS Code

L’extension doit être conçue en deux couches principales :

## 1. Extension Host Backend

Responsabilités :
- enregistrement des commandes VS Code ;
- chargement des fichiers de graphe ;
- sélection de fichiers via l’API VS Code ;
- lecture du workspace ;
- conversion des modèles natifs vers le schéma pivot ;
- validation des données ;
- indexation des nodes et relations ;
- filtrage serveur avant envoi au Webview ;
- gestion de la configuration ;
- stockage des préférences utilisateur ;
- gestion sécurisée des clés API IA ;
- communication avec le Webview via `postMessage`;
- intégration avec l’API VS Code pour ouvrir un fichier à une position donnée.

Commandes VS Code minimales :
- `graphify.open`
- `graphify.loadGraph`
- `graphify.reloadGraph`
- `graphify.validateGraph`
- `graphify.openConfiguration`
- `graphify.exportPivotGraph`
- `graphify.runAIAnalysis`
- `graphify.focusNode`
- `graphify.revealInEditor`
- `graphify.registerConverter`

## 2. Webview Frontend

Responsabilités :
- rendu de l’interface utilisateur ;
- affichage Tree View ;
- affichage Network Graph ;
- filtres interactifs ;
- sélection multi-nœuds ;
- overlay de sélection ;
- onglet assistant IA ;
- onglet configuration ;
- rendu Markdown des réponses IA ;
- interactions utilisateur ;
- émission d’événements vers l’extension host.

Le Webview ne doit pas accéder directement au filesystem ni aux clés API. Toutes les opérations sensibles doivent passer par l’Extension Host.

---

# 🔁 Flux de données attendu

Le flux doit être le suivant :

```text
Native Graph Model
        ↓
Native Model Converter / Adapter
        ↓
Pivot Graph Schema
        ↓
Validation + Indexation
        ↓
Filtering / Projection / Clustering
        ↓
Webview Rendering
        ↓
User Interaction
        ↓
Extension Host Commands


Le Webview ne doit jamais dépendre directement d’un format natif spécifique. Il doit uniquement consommer le schéma pivot.
-------------------------

🧩 Pivot Graph Schema

Pour permettre l’intégration de multiples solutions RAG Graph, Graphify doit définir un schéma transverse servant de contrat unique entre les convertisseurs et l’interface.
Ce schéma pivot doit décrire :
- les nodes ;
- les relations ;
- les groupes ;
- les hiérarchies ;
- les sources ;
- les métadonnées ;
- les informations de rendu ;
- les informations de navigation vers le code ou les documents ;
- les informations propres aux graphes RAG.
Interface TypeScript proposée


export interface PivotGraph {
  schemaVersion: string;
  graphId: string;
  name: string;
  description?: string;

  source: GraphSourceDescriptor;

  nodes: PivotNode[];
  relations: PivotRelation[];

  groups?: PivotGroup[];
  hierarchies?: PivotHierarchy[];

  metadata?: Record<string, unknown>;

  createdAt?: string;
  updatedAt?: string;
}


-------------------------

Source du graphe


export interface GraphSourceDescriptor {
  type:
    | "code"
    | "rag"
    | "knowledge_graph"
    | "documentation"
    | "architecture"
    | "runtime"
    | "custom";

  provider?: string;
  format?: string;
  uri?: string;

  workspaceFolder?: string;

  nativeSchemaVersion?: string;
  converterId?: string;

  metadata?: Record<string, unknown>;
}


-------------------------

🟦 PivotNode

Un nœud représente toute entité navigable dans le graphe.
Exemples :
- dossier ;
- fichier ;
- classe ;
- méthode ;
- fonction ;
- module ;
- package ;
- document ;
- chunk ;
- embedding ;
- entité nommée ;
- concept ;
- prompt ;
- réponse ;
- source ;
- citation ;
- endpoint API ;
- service ;
- composant ;
- table ;
- colonne ;
- feature métier.

export interface PivotNode {
  id: string;

  type: PivotNodeType | string;

  label: string;
  qualifiedName?: string;
  description?: string;

  parentId?: string;

  source?: NodeSourceLocation;

  tags?: string[];

  attributes?: Record<string, unknown>;

  rag?: RagNodeMetadata;

  visual?: NodeVisualHints;

  metrics?: NodeMetrics;
}


Types standards de nodes


export type PivotNodeType =
  | "workspace"
  | "folder"
  | "file"
  | "module"
  | "package"
  | "class"
  | "interface"
  | "method"
  | "function"
  | "variable"
  | "service"
  | "component"
  | "api_endpoint"
  | "document"
  | "chunk"
  | "embedding"
  | "entity"
  | "concept"
  | "prompt"
  | "answer"
  | "citation"
  | "source"
  | "database"
  | "table"
  | "column"
  | "unknown";


-------------------------

Localisation source


export interface NodeSourceLocation {
  uri?: string;
  path?: string;

  range?: {
    startLine: number;
    startCharacter?: number;
    endLine?: number;
    endCharacter?: number;
  };

  language?: string;
}


-------------------------

Métadonnées RAG


export interface RagNodeMetadata {
  documentId?: string;
  chunkId?: string;
  embeddingModel?: string;
  vectorStore?: string;

  score?: number;
  tokenCount?: number;

  contentPreview?: string;
  contentHash?: string;

  sourceUrl?: string;
  citationText?: string;
}


-------------------------

🔗 PivotRelation

Les relations sont centrales dans Graphify. Elles doivent être décrites explicitement afin de faciliter leur intégration, leur filtrage, leur rendu et leur interprétation par l’IA.
Une relation doit exprimer :
- un identifiant stable ;
- un type normalisé ;
- une source ;
- une cible ;
- une direction ;
- un label lisible ;
- un poids ;
- un niveau de confiance ;
- une preuve ;
- une origine native ;
- des métadonnées ;
- des hints visuels ;
- une catégorie fonctionnelle.

export interface PivotRelation {
  id: string;

  kind: PivotRelationKind | string;

  label?: string;

  sourceId: string;
  targetId: string;

  direction: "directed" | "undirected" | "bidirectional";

  category?:
    | "structural"
    | "dependency"
    | "execution"
    | "semantic"
    | "rag"
    | "documentation"
    | "data"
    | "custom";

  weight?: number;
  confidence?: number;

  evidence?: RelationEvidence[];

  native?: NativeRelationDescriptor;

  attributes?: Record<string, unknown>;

  visual?: RelationVisualHints;
}


Types standards de relations


export type PivotRelationKind =
  | "CONTAINS"
  | "DECLARES"
  | "IMPLEMENTS"
  | "EXTENDS"
  | "IMPORTS"
  | "DEPENDS_ON"
  | "CALLS"
  | "CALLED_BY"
  | "READS"
  | "WRITES"
  | "USES"
  | "REFERENCES"
  | "OVERRIDES"
  | "RETURNS"
  | "THROWS"
  | "ANNOTATED_BY"

  // Relations RAG / Knowledge Graph
  | "CHUNK_OF"
  | "EMBEDDED_AS"
  | "SIMILAR_TO"
  | "RETRIEVED_BY"
  | "RANKED_FOR"
  | "CITED_BY"
  | "CITES"
  | "MENTIONS"
  | "DESCRIBES"
  | "ANSWERS"
  | "GENERATED_FROM"
  | "SUPPORTED_BY"
  | "CONTRADICTS"
  | "RELATED_TO"

  // Relations architecture
  | "PROVIDES"
  | "CONSUMES"
  | "EXPOSES"
  | "CALLS_API"
  | "PUBLISHES"
  | "SUBSCRIBES_TO"

  | "UNKNOWN";


-------------------------

Preuve d’une relation


export interface RelationEvidence {
  type:
    | "source_range"
    | "text_excerpt"
    | "similarity_score"
    | "retrieval_trace"
    | "runtime_trace"
    | "manual"
    | "inferred";

  uri?: string;
  path?: string;

  range?: {
    startLine: number;
    startCharacter?: number;
    endLine?: number;
    endCharacter?: number;
  };

  excerpt?: string;
  score?: number;

  metadata?: Record<string, unknown>;
}


-------------------------

Relation native


export interface NativeRelationDescriptor {
  nativeType?: string;
  nativeId?: string;
  provider?: string;
  raw?: unknown;
}


-------------------------

🧭 Hiérarchie et groupes

La hiérarchie ne doit pas être confondue avec les relations transverses.
Exemple :
- folder contient file ;
- file contient class ;
- class contient method.
Cette structure peut être représentée par parentId, mais aussi par des relations explicites de type CONTAINS.

export interface PivotHierarchy {
  id: string;
  name: string;

  rootNodeIds: string[];

  relationKind?: "CONTAINS" | string;

  metadata?: Record<string, unknown>;
}



export interface PivotGroup {
  id: string;
  label: string;

  nodeIds: string[];

  type?: "domain" | "module" | "cluster" | "rag_collection" | "custom";

  metadata?: Record<string, unknown>;

  visual?: NodeVisualHints;
}


-------------------------

🎨 Hints visuels


export interface NodeVisualHints {
  color?: string;
  shape?: "dot" | "box" | "ellipse" | "database" | "diamond" | "triangle" | "icon";
  icon?: string;
  size?: number;
  hidden?: boolean;
}



export interface RelationVisualHints {
  color?: string;
  width?: number;
  dashed?: boolean;
  arrows?: "to" | "from" | "both" | "none";
  hidden?: boolean;
}


-------------------------

📊 Métriques


export interface NodeMetrics {
  fanIn?: number;
  fanOut?: number;
  centrality?: number;
  complexity?: number;
  tokenCount?: number;
  retrievalScore?: number;
}


-------------------------

🔄 Interface de conversion Native Model -> Pivot Schema

Graphify doit définir une interface de conversion obligatoire pour intégrer n’importe quel modèle natif.
Chaque connecteur/adaptateur doit implémenter cette interface.

export interface GraphModelConverter<TNativeModel = unknown> {
  id: string;
  label: string;
  description?: string;

  supportedFormats: string[];

  supports(input: GraphInputDescriptor): Promise<boolean> | boolean;

  load(input: GraphInputDescriptor): Promise<TNativeModel>;

  validateNativeModel?(
    nativeModel: TNativeModel,
    context: GraphConversionContext
  ): Promise<GraphValidationReport> | GraphValidationReport;

  toPivotGraph(
    nativeModel: TNativeModel,
    context: GraphConversionContext
  ): Promise<PivotGraph> | PivotGraph;

  validatePivotGraph?(
    pivotGraph: PivotGraph,
    context: GraphConversionContext
  ): Promise<GraphValidationReport> | GraphValidationReport;

  fromPivotGraph?(
    pivotGraph: PivotGraph,
    context: GraphConversionContext
  ): Promise<TNativeModel> | TNativeModel;
}


-------------------------

Input descriptor


export interface GraphInputDescriptor {
  uri?: string;
  filePath?: string;
  workspaceFolder?: string;

  format?: string;
  provider?: string;

  content?: string;
  raw?: unknown;

  config?: GraphifyConfiguration;
}


-------------------------

Context de conversion


export interface GraphConversionContext {
  workspaceRoot?: string;

  config: GraphifyConfiguration;

  logger: GraphifyLogger;

  cancellationToken?: unknown;

  resolveUri?: (relativePath: string) => string;

  createStableId?: (input: string) => string;
}


-------------------------

Rapport de validation


export interface GraphValidationReport {
  valid: boolean;

  errors: GraphValidationIssue[];
  warnings: GraphValidationIssue[];

  stats?: {
    nodeCount?: number;
    relationCount?: number;
    orphanRelationCount?: number;
    duplicatedNodeIds?: number;
    unknownNodeTypes?: number;
    unknownRelationKinds?: number;
  };
}



export interface GraphValidationIssue {
  severity: "error" | "warning" | "info";

  code: string;
  message: string;

  nodeId?: string;
  relationId?: string;

  path?: string;

  details?: Record<string, unknown>;
}


-------------------------

🧬 Mapping déclaratif des nodes et relations

Pour faciliter l’intégration des relations dans le graphe, Graphify doit permettre un mapping déclaratif configurable entre un modèle natif et le schéma pivot.
Ce mapping doit pouvoir être défini dans graphify.config.json.
Exemple de mapping


{
  "graphify": {
    "schemaVersion": "1.0.0",

    "sources": [
      {
        "id": "my-rag-graph",
        "type": "rag",
        "provider": "custom-json",
        "path": "./graph.json",
        "converter": "custom-json-rag-converter"
      }
    ],

    "nodeMappings": [
      {
        "nativeType": "doc",
        "pivotType": "document",
        "idPath": "$.id",
        "labelPath": "$.title",
        "attributesPath": "$"
      },
      {
        "nativeType": "chunk",
        "pivotType": "chunk",
        "idPath": "$.chunk_id",
        "labelPath": "$.heading",
        "parentIdPath": "$.document_id",
        "rag": {
          "contentPreviewPath": "$.text",
          "tokenCountPath": "$.tokens"
        }
      }
    ],

    "relationMappings": [
      {
        "nativeType": "contains",
        "pivotKind": "CONTAINS",
        "sourceIdPath": "$.from",
        "targetIdPath": "$.to",
        "direction": "directed",
        "category": "structural"
      },
      {
        "nativeType": "retrieved",
        "pivotKind": "RETRIEVED_BY",
        "sourceIdPath": "$.chunk_id",
        "targetIdPath": "$.query_id",
        "direction": "directed",
        "category": "rag",
        "weightPath": "$.score",
        "confidencePath": "$.confidence"
      },
      {
        "nativeType": "similarity",
        "pivotKind": "SIMILAR_TO",
        "sourceIdPath": "$.source",
        "targetIdPath": "$.target",
        "direction": "undirected",
        "category": "semantic",
        "weightPath": "$.similarity"
      }
    ]
  }
}


Ce mapping doit permettre de brancher rapidement un nouveau format natif sans réécrire toute l’interface.
-------------------------

⚙️ Configuration améliorée

Graphify doit fournir une configuration robuste à trois niveaux :
- Configuration globale VS Code
  - via contributes.configuration dans package.json.
- Configuration workspace
    - via .vscode/settings.json.
- Configuration projet
      - via un fichier graphify.config.json.
La configuration projet doit être prioritaire sur la configuration workspace, elle-même prioritaire sur la configuration globale.
-------------------------

Exemple de configuration complète


{
  "graphify": {
    "schemaVersion": "1.0.0",

    "defaultSource": "main-graph",

    "sources": [
      {
        "id": "main-graph",
        "type": "code",
        "path": "./graph.json",
        "format": "pivot",
        "converter": "pivot-json"
      },
      {
        "id": "rag-graph",
        "type": "rag",
        "path": "./rag-graph.json",
        "format": "custom-rag-json",
        "converter": "custom-rag-json"
      }
    ],

    "rendering": {
      "themeMode": "vscode",
      "layoutEngine": "vis-network",
      "physics": {
        "enabled": true,
        "solver": "forceAtlas2Based",
        "stabilizationIterations": 200
      },
      "clustering": {
        "enabled": true,
        "threshold": 500
      },
      "nodeStyles": {
        "file": {
          "color": "#4e9af1",
          "shape": "box"
        },
        "class": {
          "color": "#c586c0",
          "shape": "ellipse"
        },
        "method": {
          "color": "#dcdcaa",
          "shape": "dot"
        },
        "document": {
          "color": "#6a9955",
          "shape": "box"
        },
        "chunk": {
          "color": "#b5cea8",
          "shape": "dot"
        },
        "embedding": {
          "color": "#569cd6",
          "shape": "diamond"
        }
      },
      "relationStyles": {
        "CALLS": {
          "color": "#dcdcaa",
          "width": 1,
          "arrows": "to"
        },
        "CONTAINS": {
          "color": "#808080",
          "width": 1,
          "arrows": "to"
        },
        "SIMILAR_TO": {
          "color": "#4ec9b0",
          "width": 2,
          "dashed": true,
          "arrows": "none"
        },
        "RETRIEVED_BY": {
          "color": "#ce9178",
          "width": 2,
          "arrows": "to"
        }
      }
    },

    "filters": {
      "defaultNodeTypes": ["file", "class", "method", "document", "chunk"],
      "defaultRelationKinds": ["CONTAINS", "CALLS", "DEPENDS_ON", "SIMILAR_TO"],
      "searchMode": "contains",
      "caseSensitive": false,
      "applyToTree": true,
      "applyToGraph": true
    },

    "exploration": {
      "defaultDepthCallers": 2,
      "defaultDepthCallees": 2,
      "maxVisibleNodes": 1000,
      "lazyLoadRelations": true
    },

    "ai": {
      "provider": "gemini",
      "model": "gemini-pro",
      "maxContextNodes": 100,
      "includeRelations": true,
      "includeEvidence": true,
      "promptTemplates": {
        "architectureAudit": "Analyse ce sous-graphe et identifie les risques architecturaux.",
        "ragAudit": "Analyse ce graphe RAG, les chunks, les citations et les relations de retrieval."
      }
    },

    "validation": {
      "failOnOrphanRelations": false,
      "warnOnUnknownTypes": true,
      "warnOnMissingSourceLocations": true
    }
  }
}


-------------------------

🧪 Validation obligatoire

Graphify doit valider systématiquement :
- unicité des node IDs ;
- existence des nodes sources et cibles de chaque relation ;
- validité des types de nodes ;
- validité des types de relations ;
- cohérence des hiérarchies ;
- relations orphelines ;
- cycles éventuels dans les hiérarchies ;
- configuration invalide ;
- mapping incomplet ;
- chemin de fichier introuvable ;
- poids ou confidence hors bornes.
La validation doit produire un rapport visible dans :
- l’onglet Configuration ;
- une sortie VS Code dédiée Graphify;
- des notifications non intrusives.
-------------------------

🏗️ Global Webview Container

- Layout: Full-viewport (100vh, 100vw), locked scrolling (overflow: hidden) to behave like a native VS Code editor tab.
- Theming Context: Must seamlessly inherit standard VS Code CSS variables, for example:
  - var(--vscode-editor-background)
  - var(--vscode-foreground)
  - var(--vscode-sideBar-background)
  - var(--vscode-panel-border)
  - var(--vscode-input-background)
  - var(--vscode-button-background)
The UI must avoid hardcoded colors except when explicitly provided by configuration. It must automatically adapt to Light, Dark and High Contrast themes.
The Webview must include a strict Content Security Policy.
-------------------------

🪧 Action Toolbar Top Header

- Layout: Flexbox Row, sticky to the top, vertically centered, mimicking a native VS Code breadcrumb or title bar.
Left Section Branding

- App icon and title, kept minimal to save vertical space.
- Display current graph name.
- Display active source/profile if multiple graph sources are configured.
Right Section Primary Actions

- Theme Toggle: Replaced by native VS Code theme tracking. It can be omitted in a pure native extension as the Webview auto-updates.
- View Selection Button: A primary <vscode-button> to open the detailed selection popup.
- Load Data Action: Instead of a standard file upload, this must trigger a vscode.postMessage to the extension backend to pick the graph.json or another graph file from the active workspace.
- Reload Graph Button: reloads the active graph and reapplies conversion.
- Validate Button: validates native and pivot graph.
- Export Pivot Graph Button: exports the normalized graph.
- Open Config Button: opens the configuration tab or the graphify.config.json.
-------------------------

🔍 Exploration Filters Collapsible Panel

- Layout: A native <details> element or a <vscode-accordion> taking up full width just below the header.
- Content Grid: A responsive 3-column layout.
Column 1 Types

- A multi-select box or a series of <vscode-checkbox> elements for entity types:
  - Classes;
  - Methods;
  - Files;
  - Documents;
  - Chunks;
  - Embeddings;
  - Entities;
  - Services;
  - Components;
  - APIs;
  - Concepts.
Column 2 Search

- A <vscode-text-field> coupled with a <vscode-dropdown> for match conditions:
  - Contains;
  - Exact;
  - Regex toggle;
  - Case sensitive toggle.
Search must be applicable to:
- label;
- qualified name;
- path;
- tags;
- attributes;
- content preview.
Column 3 Targets

- Toggles to dictate whether filters apply to:
  - Tree View;
  - Graph View;
  - both.
Additional Relation Filters

Add a dedicated section for relation filtering:
- relation kind;
- category;
- direction;
- minimum weight;
- minimum confidence;
- show/hide inferred relations;
- show/hide RAG relations;
- show/hide structural relations;
- show/hide dependency relations.
-------------------------

🗂️ Main Workspace VS Code Tabbed Interface

- Layout: A <vscode-panels> component from the Webview UI Toolkit taking up the remaining flex-1 space.
Tabs required:
- Explorer View;
- AI Assistant;
- Configuration;
- Validation / Diagnostics;
- Raw Pivot JSON Viewer.
-------------------------

🕸️ Tab 1: Explorer View Split Layout

- Layout: A resizable split pane, heavily mirroring the VS Code primary sidebar and editor relationship.
Left Pane Hierarchical Tree

- Takes approximately 30% width.
- Resizable horizontally.
- Features a top utility row:
  - grouping dropdown;
  - sort order;
  - clear selection;
  - expand all;
  - collapse all;
  - group by type;
  - group by source;
  - group by module;
  - group by RAG collection.
The Tree View must display:
- folders;
- files;
- classes;
- methods;
- documents;
- chunks;
- entities;
- concepts;
- services;
- API endpoints.
It must use expandable carets and multi-select checkboxes.
Selecting a node in the tree must highlight it in the Network Graph.
Double-clicking a source-backed node must send a message to the Extension Host to open the corresponding file or document location in VS Code.
Right Pane Network Graph

- Takes remaining width.
- Top Toolbar: Small inline inputs for:
  - Depth Appelants;
  - Depth Appelés;
  - relation depth;
  - relation kind filter;
  - confidence threshold;
  - Fit to screen / Recadrer button.
- Canvas: Absolute positioned container for Vis.js or another compatible graph rendering engine to render the interactive physics-based node graph.
- Legend: Absolute positioned overlay in the bottom-left corner mapping node colors and edge styles to their respective types.
The graph must support:
- zoom;
- pan;
- node selection;
- edge selection;
- lasso selection if possible;
- focus node;
- expand neighbors;
- collapse cluster;
- hide selected;
- isolate selected;
- reveal in tree;
- reveal in editor;
- show relation details.
-------------------------

✨ Tab 2: AI Assistant Gemini

- Layout: Two-column grid Sidebar + Main Editor area.
Left Sidebar Controls

Contains:
- context summary: You have X nodes selected;
- number of relations selected;
- graph source;
- selected relation categories;
- token estimation;
- primary <vscode-button> to Lancer l'analyse.
The assistant must support several analysis modes:
- architecture audit;
- RAG retrieval audit;
- dependency explanation;
- impact analysis;
- refactoring recommendations;
- documentation generation;
- relation explanation;
- anomaly detection.
Gemini is the default provider, but the system should be designed with an AIProvider abstraction so that another provider can be added later.

export interface AIProvider {
  id: string;
  label: string;

  analyzeGraphContext(
    context: AIAnalysisContext
  ): Promise<AIAnalysisResult>;
}


Main Area Output

- A stylized output window simulating a read-only VS Code text editor.
- It receives Markdown output from Gemini API.
- It renders Markdown with standard VS Code markdown styling:
  - code blocks;
  - bold text;
  - lists;
  - tables;
  - links;
  - admonitions if supported.
The prompt sent to the AI must include:
- selected nodes;
- selected relations;
- evidence;
- relation kinds;
- graph source;
- metrics;
- optional content previews;
- optional source locations.
-------------------------

⚙️ Tab 3: Configuration

- Layout: Scrollable Flex Column.
- Header: Title and a primary <vscode-button> to Save & Apply.
- Editor: A large text area for JSON editing.
In a native Webview, this should ideally use:
- a lightweight Monaco Editor instance;
- or a highly styled <vscode-text-area> configured for monospaced code.
The configuration tab must allow users to tweak:
- node colors;
- node shapes;
- relation colors;
- relation line styles;
- file extension mappings;
- node type mappings;
- relation mappings;
- source configuration;
- active converter;
- graph rendering physics;
- default filters;
- AI provider options;
- validation rules;
- performance limits.
The configuration editor must validate JSON and display inline diagnostics when possible.
Actions:
- Save;
- Save & Apply;
- Reset;
- Validate;
- Export;
- Import;
- Open graphify.config.json.
-------------------------

🧪 Tab 4: Validation / Diagnostics

This tab must show:
- graph validation report;
- converter diagnostics;
- configuration diagnostics;
- orphan relations;
- duplicated node IDs;
- unknown node types;
- unknown relation kinds;
- missing files;
- invalid source locations;
- malformed mappings.
Each issue should be clickable when possible.
-------------------------

🧾 Tab 5: Raw Pivot JSON Viewer

This tab must allow users to inspect the generated normalized graph.
It should support:
- formatted JSON;
- search;
- copy;
- export;
- diff between native and pivot if possible;
- filtering by node or relation ID.
-------------------------

🪟 Selection Overlay Modal View

- Trigger: Clicked from the top toolbar.
- Layout: A full-screen semi-transparent backdrop containing a centered, elevated modal card using:
  - var(--vscode-notifications-background);
  - var(--vscode-widget-shadow).
Structure

- Header: Title and close icon.
- Filter Strip: Quick-toggle badges to filter the currently selected items by type.
- List View: A scrollable, clean list of every selected node, showing:
  - icon;
  - name;
  - type;
  - underlying file path;
  - source;
  - selected relation count.
- Footer: Action area containing:
    - Close button;
    - Clear selection;
    - Analyze with AI;
    - Export selection;
    - Isolate in graph.
-------------------------

🔐 Sécurité Webview

The Webview must:
- use strict CSP;
- avoid inline scripts;
- avoid unsafe eval;
- use VS Code nonce mechanism;
- never expose API keys to frontend;
- sanitize Markdown output before rendering;
- validate all messages coming from the Webview.
-------------------------

📡 Contrat de communication Webview <-> Extension Host

Define a typed messaging contract.

export type WebviewToExtensionMessage =
  | { type: "LOAD_GRAPH"; payload?: { sourceId?: string } }
  | { type: "RELOAD_GRAPH"; payload?: { sourceId?: string } }
  | { type: "VALIDATE_GRAPH" }
  | { type: "SAVE_CONFIG"; payload: { config: GraphifyConfiguration } }
  | { type: "APPLY_FILTERS"; payload: GraphFilterState }
  | { type: "OPEN_SOURCE_LOCATION"; payload: { nodeId: string } }
  | { type: "RUN_AI_ANALYSIS"; payload: AIAnalysisRequest }
  | { type: "EXPORT_PIVOT_GRAPH" }
  | { type: "FOCUS_NODE"; payload: { nodeId: string } };



export type ExtensionToWebviewMessage =
  | { type: "GRAPH_LOADED"; payload: { graph: PivotGraph } }
  | { type: "GRAPH_UPDATED"; payload: { graph: PivotGraph } }
  | { type: "GRAPH_VALIDATION_RESULT"; payload: GraphValidationReport }
  | { type: "CONFIG_LOADED"; payload: { config: GraphifyConfiguration } }
  | { type: "CONFIG_SAVED"; payload: { config: GraphifyConfiguration } }
  | { type: "AI_ANALYSIS_RESULT"; payload: AIAnalysisResult }
  | { type: "ERROR"; payload: { message: string; details?: unknown } };


-------------------------

⚡ Performance

Graphify must support large graphs.
Required techniques:
- lazy loading;
- graph projection;
- filtering in Extension Host before Webview rendering;
- node/edge limit safeguards;
- clustering;
- progressive rendering;
- virtualized lists;
- debounced search;
- cancellation tokens for long operations.
Default safeguards:
- maximum visible nodes: configurable;
- warning above 1000 nodes;
- clustering above 500 nodes;
- relation lazy loading enabled by default.
-------------------------

🧪 Tests attendus

The implementation should include tests for:
- pivot schema validation;
- node mapping;
- relation mapping;
- converter interface;
- invalid graph input;
- orphan relations;
- UI message contracts;
- configuration loading priority;
- extension commands.
-------------------------

📦 Livrables attendus

The generated VS Code extension should provide:
- Extension VS Code TypeScript.
- Webview UI using VS Code Webview UI Toolkit.
- Pivot Graph Schema interfaces.
- Converter interface.
- Default converter for existing graph.json.
- Example custom RAG converter.
- Configuration schema.
- Validation service.
- Webview messaging contract.
- Graph rendering with Tree View and Network Graph.
- AI Assistant Gemini integration.
- Documentation explaining:
  - how to create a converter;
  - how to define relation mappings;
  - how to configure styles;
  - how to load a graph;
  - how to export the pivot graph.
-------------------------

✅ Critères d’acceptation

The extension is considered successful if:
- it can load an existing graph.json;
- it can convert it to PivotGraph;
- it validates nodes and relations;
- it displays the tree and graph views;
- it supports filtering by node type and relation type;
- it supports RAG-specific relations such as CHUNK_OF, SIMILAR_TO, RETRIEVED_BY, CITES;
- it allows configuration of node and relation styles;
- it allows implementation of new converters without changing the Webview;
- it supports selection and AI analysis;
- it can open source locations in VS Code;
- it provides diagnostics for invalid graph structures;
- it respects VS Code theming and security constraints.


---

## Résumé des ajouts majeurs

J’ai renforcé le prompt sur les axes essentiels :

- ajout d’une vraie **architecture VS Code Extension Host + Webview** ;
- définition d’un **Pivot Graph Schema** complet ;
- ajout d’un modèle explicite pour les **relations** ;
- ajout des relations spécifiques RAG ;
- création d’une interface `GraphModelConverter` ;
- ajout d’un système de mapping déclaratif des nodes et relations ;
- enrichissement massif de la configuration ;
- ajout de diagnostics et validation ;
- amélioration de la partie IA ;
- ajout d’un contrat typé de communication Webview/Extension ;
- ajout de contraintes sécurité et performance ;
- ajout de critères d’acceptation clairs.
