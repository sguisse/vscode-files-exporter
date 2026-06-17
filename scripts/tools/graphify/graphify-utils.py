import sys
import json
import networkx as nx

def analyze_component_impact(relative_file_path, component_name):
    """
    Analyzes and prints the upstream (parents) and downstream (children)
    impact for a given file path or component name using Graphify data.
    """
    # Load the graph
    try:
        with open("graphify-out/graph.json", "r") as f:
            graph_data = json.load(f)
    except FileNotFoundError:
        print("❌ Error: Could not find 'graphify-out/graph.json'. Please run your Graphify build first.")
        return

    G = nx.node_link_graph(graph_data)

    # Check the graph using the relative file path first
    target = relative_file_path

    if not G.has_node(target):
        # Fallback to the component name parameter if the file path wasn't used as the ID
        target = component_name

    if G.has_node(target):
        print(f"=== IMPACT ANALYSIS FOR: {target} ===\n")

        # 1. Find Parents (Upstream Impact)
        print("🚨 PARENTS / UPSTREAM (Things that import/use this component):")
        parents = list(G.predecessors(target))
        if parents:
            for p in parents:
                print(f"  └── {p}")
        else:
            print("  (None - This might be a top-level entry point component)")

        print("\n" + "-"*50 + "\n")

        # 2. Find Children (Downstream Impact)
        print("📦 CHILDREN / DOWNSTREAM (Things this component imports/uses):")
        children = list(G.successors(target))
        if children:
            for c in children:
                print(f"  └── {c}")
        else:
            print("  (None - This is a leaf node component with no external internal imports)")
    else:
        print(f"Could not find matching node for path '{relative_file_path}' or component '{component_name}' in graph.json.")


def main():
    # Read parameters from the command line
    # sys.argv[0] is the script name itself, so parameters start at index 1
    if len(sys.argv) < 3:
        print("❌ Error: Missing parameters!")
        print("Usage: python script.py <relativeFilePath> <component>")
        print("Example: python script.py src/webview/components/tree-view-tab.js TreeViewTab")
        sys.exit(1)

    file_path_param = sys.argv[1]
    component_param = sys.argv[2]

    # Invoke the method with the 2 parameters
    analyze_component_impact(file_path_param, component_param)


if __name__ == "__main__":
    main()
