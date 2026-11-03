#!/usr/bin/env bash
set -e

# Update data-workflow.json to set the file:// icon URL on the 'others' node
cat << 'EOF' > webview/src/features/explorer/workflow/data-workflow.json
{
  "workflow": {
    "title": "Context Engineering Pipeline",
    "description": "Interactive multi-branch document validation flow with automated decision checks.",
    "initialStepId": "files_selection",
    "nodes": [
      {
        "id": "start",
        "label": "Context Engineering Pipeline",
        "desc": "BPMN Start Event: Trigger point of the pipeline.",
        "type": "start",
        "x": 6,
        "y": 101,
        "status": "pending",
        "clickEnabled": false
      },
      {
        "id": "files_selection",
        "label": "Files Selection",
        "desc": "Select target source files in VS-Code Explorer.",
        "type": "step",
        "x": 139,
        "y": 99,
        "status": "current",
        "clickEnabled": true
      },
      {
        "id": "anonymizer",
        "label": "Anonymize",
        "desc": "Replaces sensitive information in the files.",
        "type": "step",
        "x": 237,
        "y": 18,
        "status": "pending",
        "clickEnabled": true
      },
      {
        "id": "prompt",
        "label": "Prompt",
        "desc": "Define what is expected.",
        "type": "step",
        "x": 339,
        "y": 99,
        "status": "pending",
        "clickEnabled": true
      },
      {
        "id": "llm",
        "label": "Local LLM",
        "desc": "Display LLM view prefilled with files context and prompt.",
        "type": "step",
        "x": 768,
        "y": 35,
        "status": "pending",
        "clickEnabled": true
      },
      {
        "id": "request_flow",
        "label": "🚀 execution ?",
        "desc": "Select the request flow to use files context and prompt.",
        "type": "decision",
        "x": 488,
        "y": 97,
        "status": "pending",
        "clickEnabled": false
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "desc": "Display Gemini site in browser, with files context in clipboard ready to paste in the prompt.",
        "type": "step",
        "x": 645,
        "y": 103,
        "status": "pending",
        "clickEnabled": true
      },
      {
        "id": "gems_01",
        "label": "Gems 01",
        "desc": "Display Gemini Gems dedicated to Extension site in browser, with files context in clipboard ready to paste in the prompt.",
        "type": "step",
        "x": 768,
        "y": 104,
        "status": "pending",
        "clickEnabled": true
      },
      {
        "id": "notebookLM",
        "label": "NotebookLM",
        "desc": "Display NotebookLM site in browser, with files context in clipboard ready to paste in the prompt.",
        "type": "step",
        "x": 883,
        "y": 104,
        "status": "pending",
        "clickEnabled": true
      },
      {
        "id": "others",
        "label": "Others",
        "desc": "To be defined by customizing ...",
        "type": "step",
        "x": 768,
        "y": 179,
        "status": "pending",
        "clickEnabled": true,
        "icon": "file:///Users/mac-SGUISS21/01-work/01-projects/10-tools/01-plugins/01-vscode/vscode-files-exporter/assets/logo-50x50.png"
      },
      {
        "id": "end",
        "label": "Pipeline<br/>Completed",
        "desc": "BPMN End Event: Context generated and ready.",
        "type": "end",
        "x": 1070,
        "y": 95,
        "status": "pending",
        "clickEnabled": false
      }
    ],
    "edges": [
      {
        "id": "e0",
        "source": "start",
        "target": "files_selection",
        "label": "Start",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e1",
        "source": "files_selection",
        "target": "anonymizer",
        "label": "Recommended",
        "lineStyle": "dashed",
        "curveStyle": "bezier",
        "arrowShape": "triangle",
        "color": "#10b981"
      },
      {
        "id": "e1.1",
        "source": "files_selection",
        "target": "prompt",
        "label": "",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e2",
        "source": "anonymizer",
        "target": "prompt",
        "label": "",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e3",
        "source": "prompt",
        "target": "request_flow",
        "label": "files\n+\nprompt",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e4",
        "source": "request_flow",
        "target": "llm",
        "label": "standard",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e5",
        "source": "request_flow",
        "target": "gemini",
        "label": "external",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e5.1",
        "source": "gemini",
        "target": "gems_01",
        "label": "Or",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e5.2",
        "source": "gems_01",
        "target": "notebookLM",
        "label": "Or",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e6",
        "source": "request_flow",
        "target": "others",
        "label": "???",
        "lineStyle": "dashed",
        "curveStyle": "bezier",
        "arrowShape": "triangle",
        "color": "#f59e0b",
        "textColor": "#d97706"
      },
      {
        "id": "e10",
        "source": "llm",
        "target": "end",
        "label": "Finish",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e11",
        "source": "notebookLM",
        "target": "end",
        "label": "Finish",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      },
      {
        "id": "e12",
        "source": "others",
        "target": "end",
        "label": "Finish",
        "lineStyle": "solid",
        "curveStyle": "bezier",
        "arrowShape": "triangle"
      }
    ]
  }
}
EOF

# Rebuild workspace
npm run build
