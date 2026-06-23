C'est tout à fait juste. Les itérations précédentes ont eu tendance à synthétiser et, par conséquent, à amputer certaines des excellentes spécifications techniques (notamment les schémas TypeScript très détaillés de Sonnet, les métadonnées RAG de GPT, et les spécifications d'UI précises avec les compteurs dynamiques).

Voici le **prompt ultime, exhaustif et non tronqué**, fusionnant **absolument toutes les informations, interfaces, mappings et recommandations** des 3 LLMs (GPT-5.5, Sonnet 4.6 et Gemini).

Tu peux copier l'intégralité du bloc Markdown ci-dessous.

---

# 🚀 RAG-Graph Explorer : Spécification Architecturale et Fonctionnelle Complète (VS Code Extension & Webview UI)

## 🎯 1. Objectif de l'Application

**RAG-Graph Explorer** est un outil d'exploration visuelle et d'analyse structurelle interactif, directement intégré dans l'IDE VS Code.
Son ambition centrale est de constituer un hub de navigation unifié pour des solutions RAG hétérogènes (Neo4j Graph RAG, LlamaIndex Knowledge Graph, LangChain Graph RAG, Weaviate, MemGraph, Amazon Neptune, graphes de code source, etc.).

Il fait abstraction des formats natifs de chaque solution via un **Schéma Pivot Normalisé**. L'extension traduit ces graphes en arbres hiérarchiques synchronisés et en réseaux de nœuds interactifs, permettant :

* La navigation multi-sources transparente dans des graphes disparates.
* La visualisation des relations typées (dépendances, invocations, héritages, références sémantiques, co-occurrences, citations RAG).
* L'analyse d'impact pré-refactoring via les chaînes d'appels parents/enfants.
* L'audit architectural et sémantique par un Assistant IA intégré (LLM configurable) sur des clusters sélectionnés.
* La conversion transparente via un système d'adaptateurs déclarés.

---

## 🏛️ 2. Architecture Globale de l'Extension

L'extension impose une séparation stricte entre le backend (Extension Host) et le frontend (Webview).

### 2.1. VS Code Extension Host (Backend)

**Responsabilités :**

* Enregistrement des commandes VS Code (`ragGraphExplorer.open`, `ragGraphExplorer.loadGraph`, etc.).
* Gestion du `GraphAdapterRegistry` (chargement et exécution des adaptateurs RAG).
* Accès sécurisé au FileSystem, au Workspace, et au `SecretStorage` (clés API).
* Service de validation (`ConfigurationService`) et indexation/filtrage serveur avant envoi au Webview.

### 2.2. Webview Panel (Frontend)

**Responsabilités :**

* Rendu UI (`GraphRenderer`, `FilterEngine`, `AIPanel`, `ConfigEditor`).
* Aucune logique d'accès direct aux fichiers ou aux clés API.

### 2.3. Protocole de Communication (Message Broker)

Contrat strict via l'API `postMessage` :

```typescript
// Types de messages entrants (Extension → Webview)
export type InboundMessage =
  | { type: 'GRAPH_LOADED';    payload: NormalizedGraph }
  | { type: 'CONFIG_UPDATED';  payload: GraphifyConfig }
  | { type: 'AI_RESPONSE';     payload: AIAnalysisResult }
  | { type: 'ADAPTER_LIST';    payload: AdapterDescriptor[] }
  | { type: 'VALIDATION_REPORT'; payload: GraphValidationReport }
  | { type: 'ERROR';           payload: { code: string; message: string } };

// Types de messages sortants (Webview → Extension)
export type OutboundMessage =
  | { type: 'REQUEST_GRAPH';   payload: { source: string; adapterId: string } }
  | { type: 'SAVE_CONFIG';     payload: GraphifyConfig }
  | { type: 'REQUEST_AI';      payload: { nodes: string[]; edges: string[]; prompt: string } }
  | { type: 'OPEN_FILE';       payload: { path: string; line?: number } };

```

---

## 📐 3. Schéma Pivot : NormalizedGraph

**Principe fondateur :** Toute source de données RAG doit être convertie vers ce schéma avant d'être consommée par le Webview. C'est le contrat d'interface.

### 3.1. Graphe et Métadonnées

```typescript
export interface NormalizedGraph {
  metadata: GraphMetadata;
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];

  // Index de navigation rapide (pré-calculé par l'adaptateur)
  index?: {
    nodeById: Record<string, NormalizedNode>;
    edgesBySource: Record<string, string[]>;   // nodeId → edgeIds
    edgesByTarget: Record<string, string[]>;
    nodesByType: Record<NodeType, string[]>;
  };
}

export interface GraphMetadata {
  id: string;           // UUID unique de cette instance
  source: string;       // Nom lisible ("Neo4j Prod", "LlamaIndex v2")
  adapterId: string;    // Identifiant de l'adaptateur
  version: string;      // Version du schéma pivot (semver)
  createdAt: string;    // ISO 8601
  nodeCount: number;
  edgeCount: number;
  tags: string[];       // Labels libres
}

```

### 3.2. Nœuds Normalisés (`NormalizedNode`)

```typescript
export interface NormalizedNode {
  id: string;           // Identifiant unique stable
  label: string;        // Nom d'affichage principal
  type: NodeType;
  subType?: string;     // Type secondaire libre (ex: "Controller")
  parentId?: string;

  // Localisation source
  source?: {
    file: string;       // Chemin relatif au workspace
    line?: number;
    column?: number;
    module?: string;
  };

  // Données sémantiques / RAG
  semantic?: {
    embedding?: number[]; // Vecteur d'embedding
    score?: number;       // Score de pertinence [0-1]
    summary?: string;     // Résumé extrait
    community?: string;   // Cluster/Communauté (ex: Louvain)
    tokenCount?: number;
  };

  // Rendu visuel (peut être surchargé par config)
  visual?: { color?: string; shape?: NodeShape; size?: number; icon?: string; hidden?: boolean; };

  properties: Record<string, unknown>; // Propriétés natives passthrough
  nativeId?: string;                   // Pour débogage
  metrics?: NodeMetrics;
}

export enum NodeType {
  WORKSPACE = 'workspace', FOLDER = 'folder', FILE = 'file', MODULE = 'module', PACKAGE = 'package',
  CLASS = 'class', INTERFACE = 'interface', METHOD = 'method', FUNCTION = 'function', VARIABLE = 'variable',
  SERVICE = 'service', COMPONENT = 'component', API_ENDPOINT = 'api_endpoint',
  DOCUMENT = 'document', CHUNK = 'chunk', EMBEDDING = 'embedding', ENTITY = 'entity', CONCEPT = 'concept',
  PROMPT = 'prompt', ANSWER = 'answer', CITATION = 'citation', SOURCE = 'source',
  DATABASE = 'database', TABLE = 'table', COLUMN = 'column', COMMUNITY = 'community', CUSTOM = 'custom'
}

export type NodeShape = 'circle' | 'box' | 'diamond' | 'triangle' | 'star' | 'hexagon';

export interface NodeMetrics {
  fanIn?: number; fanOut?: number; centrality?: number; complexity?: number;
}

```

### 3.3. Relations Normalisées (`NormalizedEdge`)

```typescript
export interface NormalizedEdge {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
  label?: string;

  direction: EdgeDirection;
  cardinality: EdgeCardinality;

  weight?: number;       // Force/importance [0-1]
  confidence?: number;   // Confiance si inférée [0-1]
  frequency?: number;

  temporal?: { since?: string; until?: string; };

  visual?: { color?: string; width?: number; dashes?: boolean; arrow?: 'to' | 'from' | 'both' | 'none'; hidden?: boolean; };

  evidence?: RelationEvidence[];
  properties: Record<string, unknown>;
  nativeId?: string;
}

export enum EdgeRelation {
  // Structurel
  CALLS = 'CALLS', IMPORTS = 'IMPORTS', INHERITS = 'INHERITS', IMPLEMENTS = 'IMPLEMENTS',
  CONTAINS = 'CONTAINS', REFERENCES = 'REFERENCES', DEFINES = 'DEFINES', OVERRIDES = 'OVERRIDES',
  DEPENDS_ON = 'DEPENDS_ON', READS = 'READS', WRITES = 'WRITES', USES = 'USES',
  // Sémantique & RAG
  RELATED_TO = 'RELATED_TO', SIMILAR_TO = 'SIMILAR_TO', MENTIONS = 'MENTIONS', DERIVED_FROM = 'DERIVED_FROM',
  PART_OF = 'PART_OF', ANSWERS = 'ANSWERS', CONTRADICTS = 'CONTRADICTS', CHUNK_OF = 'CHUNK_OF',
  EMBEDDED_AS = 'EMBEDDED_AS', RETRIEVED_BY = 'RETRIEVED_BY', RANKED_FOR = 'RANKED_FOR', CITED_BY = 'CITED_BY',
  // Architecture / Knowledge Graph
  IS_A = 'IS_A', HAS_PROPERTY = 'HAS_PROPERTY', BELONGS_TO = 'BELONGS_TO', PROVIDES = 'PROVIDES',
  CONSUMES = 'CONSUMES', EXPOSES = 'EXPOSES', CALLS_API = 'CALLS_API', CUSTOM = 'CUSTOM'
}

export enum EdgeDirection { DIRECTED = 'directed', UNDIRECTED = 'undirected', BIDIRECTED = 'bidirected' }
export enum EdgeCardinality { ONE_TO_ONE = '1:1', ONE_TO_MANY = '1:N', MANY_TO_ONE = 'N:1', MANY_TO_MANY = 'N:N' }

export interface RelationEvidence {
  type: "source_range" | "text_excerpt" | "similarity_score" | "retrieval_trace" | "runtime_trace" | "manual" | "inferred";
  uri?: string; excerpt?: string; score?: number;
}

```

---

## 🔌 4. Interface des Adaptateurs (`IGraphAdapter`)

Chaque solution RAG implémente cette interface. L'extension maintient un registre.

```typescript
export interface IGraphAdapter {
  readonly descriptor: AdapterDescriptor;

  validate(config: AdapterConfig): Promise<ValidationError[]>;
  convert(source: string, config: AdapterConfig, options?: ConversionOptions): Promise<NormalizedGraph>;
  getRelationMappings(): RelationMapping[];
  getNodeTypeMappings(): NodeTypeMapping[];
  getCapabilities(): AdapterCapabilities;
}

export interface AdapterDescriptor {
  id: string;          // ex: "neo4j", "llamaindex"
  displayName: string;
  version: string;
  icon?: string;
  configSchema: JSONSchema7; // Pour générer l'UI de config dynamiquement via @rjsf/core
}

export interface RelationMapping {
  nativeType: string;
  normalizedType: EdgeRelation;
  directionHint?: EdgeDirection;
  confidence: number;
  overridable: boolean;
}

export interface NodeTypeMapping {
  nativeType: string;
  normalizedType: NodeType;
  confidence: number;
  overridable: boolean;
}

export interface ConversionOptions {
  maxNodes?: number;
  maxEdges?: number;
  includeEmbeddings?: boolean;
  nodeTypeFilter?: NodeType[];
  edgeTypeFilter?: EdgeRelation[];
  depthLimit?: number;
  rootNodeIds?: string[];
}

export interface AdapterCapabilities {
  supportsStreaming: boolean;
  supportsSubgraph: boolean;
  supportsEmbeddings: boolean;
  supportsLiveSync: boolean;
  supportsQuery: boolean;
  maxRecommendedNodes: number;
}

```

**Adaptateurs pré-embarqués attendus :** `neo4j`, `llamaindex`, `langchain-graph`, `weaviate`, `memgraph`, `json-file` (schéma pivot), `custom`.

---

## 🧬 5. Mapping Déclaratif et Configuration

La configuration (`rag-graph.config.json`) est prioritaire sur les paramètres Workspace/Globaux.

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
        "nativeType": "chunk",
        "pivotType": "chunk",
        "idPath": "$.chunk_id",
        "labelPath": "$.heading",
        "parentIdPath": "$.document_id",
        "semantic": {
          "summaryPath": "$.text",
          "tokenCountPath": "$.tokens"
        }
      }
    ],
    "relationMappings": [
      {
        "nativeType": "retrieved",
        "pivotKind": "RETRIEVED_BY",
        "sourceIdPath": "$.chunk_id",
        "targetIdPath": "$.query_id",
        "direction": "directed",
        "weightPath": "$.score"
      }
    ],
    "rendering": {
      "themeMode": "vscode",
      "layoutEngine": "vis-network",
      "physics": { "enabled": true, "solver": "forceAtlas2Based", "stabilizationIterations": 200 },
      "clustering": { "enabled": true, "threshold": 500 },
      "nodes": {
        "file": { "color": "#569CD6", "shape": "box", "icon": "file" },
        "chunk": { "color": "#b5cea8", "shape": "dot" }
      },
      "edges": {
        "SIMILAR_TO": { "color": "#95E1D3", "width": 1, "dashes": true, "arrows": "none" },
        "CALLS": { "color": "#FF6B6B", "width": 2, "dashes": false, "arrows": "to" }
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
      "maxContextNodes": 100,
      "promptTemplates": {
        "architectureAudit": "Analyse ce sous-graphe et identifie les risques architecturaux.",
        "ragAudit": "Analyse ce graphe RAG, les chunks, les citations et les relations de retrieval."
      }
    }
  }
}

```

---

## 🖥️ 6. UI & UX Webview Layout

L'interface entière doit utiliser `@vscode/webview-ui-toolkit` pour la cohérence native et hériter des variables CSS VS Code (`var(--vscode-editor-background)`, etc.). Zéro couleur hardcodée en dehors de la config de rendu du graphe.

### 6.1 Action Toolbar (Top Header)

* **Layout :** Flexbox Row sticky (hauteur fixe 40px).
* **Gauche :** Icône app + Titre "RAG-Graph Explorer" + Badge de la source active (`[Neo4j: prod]`).
* **Droite :**
* `<vscode-dropdown>` : Sélecteur de Source RAG (alimenté par `ADAPTER_LIST`).
* Bouton "Charger" (émet `REQUEST_GRAPH`). *Jamais un input file direct.*
* Bouton "Voir Sélection" (ouvre la Selection Overlay).
* Indicateur de statut : Spinner + label ("Conversion en cours...", "X nœuds chargés").



### 6.2 Exploration Filters (Collapsible Panel)

* **Layout :** `<vscode-accordion>` sous l'en-tête (Grille 4 colonnes).
* **Col 1 (Nœuds) :** `<vscode-checkbox>` par `NodeType` avec compteurs dynamiques (`Class (12)`, `Document (45)`).
* **Col 2 (Relations) :** `<vscode-checkbox>` par `EdgeRelation` avec indicateur de direction (`→ / ↔ / —`).
* **Col 3 (Recherche) :** `<vscode-text-field>` + `<vscode-dropdown>` (Contains/Exact/Regex). Applicable sur labels, paths, attributs, semantic preview.
* **Col 4 (Cibles) :** Toggles Tree/Graph + Slider pour filtrer par `weight` minimal (pour edges sémantiques RAG).

### 6.3 Main Workspace (`<vscode-panels>`)

#### 🕸️ Tab 1 : Explorer View (Split Layout 30/70)

* **Volet Gauche (Tree View) :**
* Ligne utilitaire : Dropdown de groupement (par Type, Source, Module, Communauté RAG), Tri, Effacer sélection.
* Arborescence avec checkboxes multi-sélection.
* **Crucial :** Indicateur inline du nombre de relations par nœud (`→ 5 | ← 3`).
* Clic simple : Focus dans le Graph View. Double-clic : Envoi `OPEN_FILE` vers VS Code.


* **Volet Droit (Network Graph) :**
* Toolbar : Inputs "Profondeur Appelants/Appelés" (0-10), `<vscode-dropdown>` de Layout (Force-directed, Hierarchical via elkjs/dagre), Bouton "Ajuster".
* Canvas (`vis-network`) : Nœuds et Edges stylisés selon la configuration.
* **Tooltips Riches :** * Edge: `[source] --[RELATION: weight=0.87]--> [target]` + passthrough props.
* Node: Label, Type, Score sémantique, résumé.


* Légende dynamique en bas à gauche se mettant à jour avec les filtres.



#### ✨ Tab 2 : AI Assistant

* **Sidebar :** Résumé contextuel ("X nœuds, Y relations"), `<vscode-dropdown>` Provider LLM (Gemini/GPT-4/Local), `<vscode-text-area>` pour le prompt. Bouton "Lancer l'analyse".
* **Main Area :** Rendu Markdown enrichi (`marked.js` + `highlight.js`). Boutons "Copier" et "Ouvrir dans éditeur".

#### ⚙️ Tab 3 : Configuration

Sections extensibles :

1. **Sources RAG :** Liste des sources. Édition générée dynamiquement depuis le `configSchema` de l'adaptateur (`ajv` / `@rjsf/core`).
2. **Mapping des Relations :** Table HTML éditable pour surcharger `RelationMapping` (Relation Native | Type Pivot | Direction | Couleur | Style).
3. **Rendu Visuel :** Instance `monaco-editor` (mode JSON) pour éditer le bloc `rendering` de la configuration.
4. **LLM & AI :** Config providers (Clés API sauvegardées silencieusement).

#### 🧪 Tab 4 & 5 : Diagnostics & Raw JSON

* Rapports de validation (nœuds orphelins, doublons), alertes de mapping. Visualiseur de l'arbre JSON pivot brut.

### 6.4 Selection Overlay (Modal View)

* **Déclencheur :** Bouton "Voir Sélection" ou `Ctrl+Shift+G`.
* **Layout :** Backdrop semi-transparent centré, carte modale surélevée.
* **Filtres Rapides :** Badges par `NodeType` et par `EdgeRelation` impliqués.
* **Liste :** Affiche icône, label, chemin cliquable, badge de score sémantique, compteurs de relations.
* **Actions (Footer) :** Fermer, Analyser avec IA (raccourci Tab 2), Exporter JSON.

---

## 📦 7. Stack Technique Recommandée

| Composant | Technologie | Justification |
| --- | --- | --- |
| **UI Components** | `@vscode/webview-ui-toolkit` | Cohérence native stricte avec VS Code. |
| **Graph Rendering** | `vis-network` | Physique, interactif, personnalisable. |
| **Layout Avancé** | `elkjs` + `dagre` | Layouts hiérarchiques et structurés pour grands graphes. |
| **Édition Code** | `monaco-editor` | Édition JSON (Tab config) avec validation inline. |
| **Validation Schema** | `ajv` | Validation JSON Schema des configs d'adaptateurs. |
| **Markdown Render** | `marked` + `highlight.js` | Output stylisé de l'AI Assistant. |
| **State Management** | `zustand` ou `valtio` | Léger, parfait pour Webview sans surcharger React/Vue. |

---

## 🔒 8. Sécurité et Performance

* **Webview CSP :** Politique stricte (`default-src 'none'`), utilisation de `nonce`, aucun `unsafe-eval`.
* **Clés API :** Jamais exposées au Webview (stockage backend via `vscode.SecretStorage`).
* **Performance :** Pagination, lazy-loading des edges, clustering serveur si le graphe dépasse le `maxRecommendedNodes` (ex: 500/1000).

---

## ✅ 9. Checklist des Livrables et d'Acceptation

1. Architecture en 2 packages (Extension Host + Webview React/Vite).
2. Définition du package partagé `/shared/schema` (`NormalizedGraph`, IPC Messages).
3. Implémentation du `GraphAdapterRegistry` et de l'adaptateur de référence `json-file`.
4. Validation `ajv` fonctionnelle sur les configurations d'adaptateurs.
5. Intégration complète du `webview-ui-toolkit` et synchronisation Tree View / Vis.js.
6. Support natif des relations RAG (`CHUNK_OF`, `SIMILAR_TO`, `RETRIEVED_BY`).
7. Intégration de l'Assistant IA (Gemini).
8. Tests unitaires des convertisseurs et de la validation pivot.
