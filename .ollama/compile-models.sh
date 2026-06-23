#!/bin/bash

# ===================================================================================================
# Ollama Models compiler (2026/06/23)
# ===================================================================================================

# More stable
ollama create sgu-gemma4-26b-claude -f gemma4-26b-claude-coder-ModelFile

# MoE
ollama create sgu-qwen36-a3b-claude -f qwen36-a3b-claude-coder-ModelFile

# For Quick response
ollama create sgu-qwen35-9b-claude -f qwen35-9b-claude-coder-ModelFile
