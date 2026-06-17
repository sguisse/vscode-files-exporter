#!/bin/bash
set -e

echo "📁 Current folder: $(pwd)"

#uv pip install networkx

# Passing the --system flag tells uv, "Yes, I know what I am doing, go ahead and install this tool globally onto my machine profile so I can use it anywhere."
uvx --refresh "graphifyy[all]"


# Create .graphifyignore
cat << 'EOF' > .graphifyignore
out
dist
node_modules
.vscode/
.idea/
.vscode-test/
*.vsix
.history
exported-files
*.bak*
*.lock
graphify-out/
EOF

echo "🔍 Analyzing structure via uvx..."
# This tells uvx to fetch the graphifyy package, but execute the 'graphify' binary inside it
uvx --from "graphifyy[all]" graphify update .

# -------------------------------------------------------------------------------------------------------
echo "AST Parsing Completed, it has generated a graphify-out/ directory containing:"
echo "graph.json: The queryable knowledge graph your AI agent reads."
echo "GRAPH_REPORT.md: A summary outlining high-degree \"god nodes\" and code architectural clusters."
echo "graph.html: An interactive, visual dashboard utilizing vis.js so you can manually explore, pan, and zoom through your workspace architecture."
echo "✅ Graphify installation and execution completed successfully!"
echo "Click the following link to open the interactive graph visualization in your default web browser:"
echo "🌐 $(pwd)/graphify-out/graph.html"
