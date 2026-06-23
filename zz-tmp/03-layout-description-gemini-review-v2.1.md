Voici le prompt final consolidé et corrigé. J'ai systématiquement remplacé les références à "Graphify" par **RAG-Graph Explorer** (et adapté les noms de commandes, d'interfaces et de fichiers de configuration en conséquence) tout en conservant l'intégralité du périmètre (scope) extrêmement ambitieux pour ne rien perdre de cette architecture cible.

Tu peux utiliser ce texte directement dans un outil de génération (comme Cline, Cursor, ou une session de chat) pour initier le développement.

---

# 🚀 RAG-Graph Explorer : Architecture d'Extension VS Code & Webview UI

## 🎯 Objectif de l'Application

**RAG-Graph Explorer** est une extension VS Code interactive permettant l’exploration visuelle, structurelle et sémantique de graphes issus de plusieurs sources : code source, architectures logicielles, dépendances, graphes documentaires, graphes RAG, graphes de connaissances, GraphRAG, LangChain, LlamaIndex, Neo4j, jQAssistant, Haystack ou tout format custom.

RAG-Graph Explorer sert de pont entre :

* des modèles natifs hétérogènes ;
* un schéma pivot transverse normalisé ;
* une interface visuelle unifiée dans VS Code.

Son objectif principal est de permettre aux développeurs, architectes et équipes IA/RAG de naviguer dans des graphes complexes directement depuis leur IDE.

RAG-Graph Explorer doit pouvoir ingérer un fichier structurel, par exemple `graph.json`, mais ne doit pas être limité à ce seul format. Il doit accepter plusieurs modèles natifs via des convertisseurs/adapters, puis les transformer vers un **Pivot Graph Schema** commun.

À partir de ce schéma normalisé, RAG-Graph Explorer doit afficher :

* une arborescence hiérarchique ;
* un graphe réseau interactif ;
* des relations filtrables ;
* des sous-graphes contextuels ;
* des chaînes d’impact ;
* des relations RAG entre documents, chunks, embeddings, entités, prompts, réponses, sources et citations ;
* des analyses IA via Gemini ou un provider IA configurable.

RAG-Graph Explorer doit permettre de :

* visualiser les dépendances ;
* isoler des domaines fonctionnels via des filtres robustes ;
* analyser l’impact avant refactoring ;
* explorer les relations parent/enfant ;
* explorer les chaînes appelants/appelés ;
* naviguer entre fichiers, classes, méthodes, documents, chunks, entités RAG ou concepts métiers ;
* inspecter les relations structurelles, sémantiques et documentaires ;
* utiliser un assistant IA intégré pour auditer, expliquer, résumer ou améliorer des clusters architecturaux.

---

# 🧱 Architecture générale de l’extension VS Code

L’extension doit être conçue en deux couches principales :

## 1. Extension Host Backend

Responsabilités :

* enregistrement des commandes VS Code ;
* chargement des fichiers de graphe ;
* sélection de fichiers via l’API VS Code ;
* lecture du workspace ;
* conversion des modèles natifs vers le schéma pivot ;
* validation des données ;
* indexation des nodes et relations ;
* filtrage serveur avant envoi au Webview ;
* gestion de la configuration ;
* stockage des préférences utilisateur ;
* gestion sécurisée des clés API IA ;
* communication avec le Webview via `postMessage`;
* intégration avec l’API VS Code pour ouvrir un fichier à une position donnée.

Commandes VS Code minimales :

* `ragGraphExplorer.open`
* `ragGraphExplorer.loadGraph`
* `ragGraphExplorer.reloadGraph`
* `ragGraphExplorer.validateGraph`
* `ragGraphExplorer.openConfiguration`
* `ragGraphExplorer.exportPivotGraph`
* `ragGraphExplorer.runAIAnalysis`
* `ragGraphExplorer.focusNode`
* `ragGraphExplorer.revealInEditor`
* `ragGraphExplorer.registerConverter`

## 2. Webview Frontend

Responsabilités :

* rendu de l’interface utilisateur ;
* affichage Tree View ;
* affichage Network Graph ;
* filtres interactifs ;
* sélection multi-nœuds ;
* overlay de sélection ;
* onglet assistant IA ;
* onglet configuration ;
* rendu Markdown des réponses IA ;
* interactions utilisateur ;
* émission d’événements vers l’extension host.

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

```

Le Webview ne doit jamais dépendre directement d’un format natif spécifique. Il doit uniquement consommer le schéma pivot.

---

# 🧩 Pivot Graph Schema

Pour permettre l’intégration de multiples solutions RAG Graph, RAG-Graph Explorer doit définir un schéma transverse servant de contrat unique entre les convertisseurs et l’interface.
Ce schéma pivot doit décrire :

* les nodes ;
* les relations ;
* les groupes ;
* les hiérarchies ;
* les sources ;
* les métadonnées ;
* les informations de rendu ;
* les informations de navigation vers le code ou les documents ;
* les informations propres aux graphes RAG.

### Interface TypeScript proposée

```typescript
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

```

### Source du graphe

```typescript
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

```

### 🟦 PivotNode

Un nœud représente toute entité navigable dans le graphe.

```typescript
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

```

#### Types standards de nodes

```typescript
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

```

#### Localisation source

```typescript
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

```

#### Métadonnées RAG

```typescript
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

```

### 🔗 PivotRelation

Les relations sont centrales dans RAG-Graph Explorer. Elles doivent être décrites explicitement afin de faciliter leur intégration, leur filtrage, leur rendu et leur interprétation par l’IA.

```typescript
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

```

#### Types standards de relations

```typescript
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

```

#### Preuve d’une relation

```typescript
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

```

#### Relation native

```typescript
export interface NativeRelationDescriptor {
  nativeType?: string;
  nativeId?: string;
  provider?: string;
  raw?: unknown;
}

```

### 🧭 Hiérarchie et groupes

```typescript
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

```

### 🎨 Hints visuels

```typescript
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

```

### 📊 Métriques

```typescript
export interface NodeMetrics {
  fanIn?: number;
  fanOut?: number;
  centrality?: number;
  complexity?: number;
  tokenCount?: number;
  retrievalScore?: number;
}

```

---

# 🔄 Interface de conversion Native Model -> Pivot Schema

Chaque connecteur/adaptateur doit implémenter cette interface.

```typescript
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

```

### Input descriptor & Context

```typescript
export interface GraphInputDescriptor {
  uri?: string;
  filePath?: string;
  workspaceFolder?: string;

  format?: string;
  provider?: string;

  content?: string;
  raw?: unknown;

  config?: RagGraphConfiguration;
}

export interface GraphConversionContext {
  workspaceRoot?: string;

  config: RagGraphConfiguration;

  logger: RagGraphLogger;

  cancellationToken?: unknown;

  resolveUri?: (relativePath: string) => string;

  createStableId?: (input: string) => string;
}

```

### Rapport de validation

```typescript
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

```

---

# 🧬 Mapping déclaratif des nodes et relations

RAG-Graph Explorer doit permettre un mapping déclaratif configurable entre un modèle natif et le schéma pivot (dans `rag-graph.config.json`).

Exemple :

```json
{
  "ragGraphExplorer": {
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
      }
    ]
  }
}

```

---

# ⚙️ Configuration améliorée

RAG-Graph Explorer doit fournir une configuration robuste à trois niveaux :

1. Configuration globale VS Code (`package.json`)
2. Configuration workspace (`.vscode/settings.json`)
3. Configuration projet (`rag-graph.config.json` - Prioritaire)

Exemple de paramétrage :

```json
{
  "ragGraphExplorer": {
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
        "file": { "color": "#4e9af1", "shape": "box" },
        "chunk": { "color": "#b5cea8", "shape": "dot" }
      },
      "relationStyles": {
        "SIMILAR_TO": { "color": "#4ec9b0", "width": 2, "dashed": true, "arrows": "none" }
      }
    },
    "exploration": {
      "defaultDepthCallers": 2,
      "defaultDepthCallees": 2,
      "maxVisibleNodes": 1000,
      "lazyLoadRelations": true
    },
    "ai": {
      "provider": "gemini",
      "maxContextNodes": 100
    }
  }
}

```

---

# 🏗️ Global Webview Container

* **Layout :** Full-viewport (`100vh`, `100vw`), locked scrolling (`overflow: hidden`).
* **Theming Context :** Doit hériter des variables CSS standard de VS Code (`var(--vscode-editor-background)`, `var(--vscode-foreground)`, etc.).
* **Security :** Strict Content Security Policy (CSP), aucun `unsafe-eval`, utilisation de nonces.

---

# 🗂️ Main Workspace (VS Code Tabbed Interface)

Disposition basée sur un `<vscode-panels>` avec les onglets suivants :

### 🕸️ Tab 1: Explorer View (Split Layout)

* **Left Pane (Hierarchical Tree) :** 30% largeur, vue arborescente (dossiers, fichiers, chunks, entités), multi-sélection, synchronisation avec le graphe. Un double-clic ouvre la source dans VS Code.
* **Right Pane (Network Graph) :** Graphe interactif (Vis.js ou équivalent). Gestion du zoom, pan, focus, profondeur de relation. Légende en bas à gauche.

### ✨ Tab 2: AI Assistant (Agnostic Provider)

* **Interface IA :** Provider par défaut (Gemini), mais abstrait via une interface `AIProvider`.
* Affiche le contexte (X nœuds/relations sélectionnés) et gère le rendu Markdown (code, tables, listes).
* Modes d'analyse : audit architecture, audit RAG, explication des dépendances, refactoring.

### ⚙️ Tab 3: Configuration

* Éditeur JSON (type Monaco) pour modifier à la volée le mapping et le style.

### 🧪 Tab 4 & 5: Validation / Diagnostics & Raw Pivot JSON Viewer

* Rapport de validation du graphe et possibilité d'inspecter l'arbre JSON pivot brut pour debug.

---

# 📡 Contrat de communication Webview <-> Extension Host

```typescript
export type WebviewToExtensionMessage =
  | { type: "LOAD_GRAPH"; payload?: { sourceId?: string } }
  | { type: "RELOAD_GRAPH"; payload?: { sourceId?: string } }
  | { type: "VALIDATE_GRAPH" }
  | { type: "SAVE_CONFIG"; payload: { config: RagGraphConfiguration } }
  | { type: "APPLY_FILTERS"; payload: GraphFilterState }
  | { type: "OPEN_SOURCE_LOCATION"; payload: { nodeId: string } }
  | { type: "RUN_AI_ANALYSIS"; payload: AIAnalysisRequest }
  | { type: "EXPORT_PIVOT_GRAPH" }
  | { type: "FOCUS_NODE"; payload: { nodeId: string } };

export type ExtensionToWebviewMessage =
  | { type: "GRAPH_LOADED"; payload: { graph: PivotGraph } }
  | { type: "GRAPH_UPDATED"; payload: { graph: PivotGraph } }
  | { type: "GRAPH_VALIDATION_RESULT"; payload: GraphValidationReport }
  | { type: "CONFIG_LOADED"; payload: { config: RagGraphConfiguration } }
  | { type: "CONFIG_SAVED"; payload: { config: RagGraphConfiguration } }
  | { type: "AI_ANALYSIS_RESULT"; payload: AIAnalysisResult }
  | { type: "ERROR"; payload: { message: string; details?: unknown } };

```

---

# 📦 Livrables attendus

* Extension VS Code TypeScript complète.
* Webview UI utilisant VS Code Webview UI Toolkit.
* Interfaces du Pivot Graph Schema et du Converter.
* Convertisseur par défaut (JSON classique) et exemple de Custom RAG Converter.
* Schéma de configuration et service de validation.
* Rendu Tree View & Network Graph.
* Intégration AI Assistant (Gemini).
* Documentation (comment créer un converter, mapper les relations, etc.).
