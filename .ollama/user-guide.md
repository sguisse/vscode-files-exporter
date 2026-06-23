# User Guide: Local LLMs Configuration for Development with Claude Code (macOS M3 Max)

This guide summarizes our discussions on how to optimally configure local language models on a **MacBook Pro M3 Max (64GB RAM)** with a strict memory limit of **35GB RAM** for Ollama. This ensures the remaining memory (~29GB) is kept available for macOS, Docker, VS Code, and your browsers.

---

## 1. Best Models Selection (35GB RAM Limit)

### Standard Models for Coding
These models run via the standard Ollama API and offer top-tier performance for general development tasks:

* **Qwen 2.5 Coder (32B)**: The current undisputed champion for local coding. It rivals the best commercial models on agentic tasks and large file editing.
    * *RAM Required:* ~20GB (Q4_K_M quantization).
    * *Command:* `ollama run qwen2.5-coder:32b`
* **DeepSeek R1 (32B)**: Advanced reasoning model (Chain-of-Thought). Ideal for complex bug fixing or architecture design, as it "thinks" step-by-step before generating code.
    * *RAM Required:* ~20GB.
    * *Command:* `ollama run deepseek-r1:32b`
* **Codestral (22B)** (by Mistral AI): Very fast model, highly optimized for real-time code completion (Fill-in-the-Middle or FIM).
    * *RAM Required:* ~13 to 15GB.
    * *Command:* `ollama run codestral`

### Models Optimized for Agentic Workflows ("rafw007" Series)
These variants (*harness-optimized*) are specifically modified to interact flawlessly with agentic interfaces like **Claude Code** or **Cline/Continue** by removing unnecessary verbosity and enforcing strict behaviors.

* **Key Features:**
    * *No-Think Mode:* Immediate action (tool calling) without intermediate explanatory monologues.
    * *Anti-Hallucination:* Strict refusal to answer if the result of a system command is not provided.
    * *macOS Awareness:* Native use of BSD/macOS system utilities instead of incompatible Linux commands.
* **Recommended Models:**
    1.  `rafw007/gemma4-26b-claude-coder`: The most stable choice. Quantized in Q5_K_M (~21GB RAM) to prevent XML structure corruption during long workflows.
    2.  `rafw007/qwen36-a3b-claude-coder`: Mixture of Experts (MoE) model, offering high reasoning capacity while remaining memory efficient.
    3.  `rafw007/qwen35-claude-coder:9b`: Ultra-fast model (~8GB) for quick, seamless iterations.

---

## 2. Advanced Ollama Configuration (Temperature & Context)

To constrain the temperature to `0.2` (recommended to eliminate unnecessary creativity and stabilize code syntax) and extend the context window to **64K tokens**, you need to create a custom variant via a `Modelfile`.

### Configuration Steps:

1. Create a file named `Modelfile` (no extension) in your working directory:
    ```bash
    nano Modelfile
    ```

2. Add the following content to it (adapt the source model if necessary):
    ```dockerfile
    FROM rafw007/gemma4-26b-claude-coder

    # Set low temperature to stabilize code and XML formatting
    PARAMETER temperature 0.2

    # Extend context window to 64K tokens
    PARAMETER num_ctx 65536
    ```

3. Save the file (`Ctrl+O`, `Enter`, `Ctrl+X`) and compile your custom model (this takes seconds):
    ```bash
    ollama create my-local-claude -f Modelfile
    ```

> ⚠️ **RAM Warning:** If during large queries the overall memory usage exceeds 35GB or triggers system swap, edit your `Modelfile` to reduce the context to 32K tokens (`PARAMETER num_ctx 32768`) and recreate the model.

---

## 3. Claude Code Integration & Launch

Claude Code natively supports Ollama's Messages API. There are two ways to start it:

### Option A: Using the built-in launcher
If your version of the tool includes the launcher utility:

```bash
ollama launch claude --model my-local-claude
```

### Option B: Using Environment Variables (Standard)
To redirect the official Claude CLI to your local Ollama instance, configure your terminal variables and run:

```bash
export ANTHROPIC_BASE_URL=http://localhost:11434
export ANTHROPIC_AUTH_TOKEN=ollama
claude --model my-local-claude
```

*Tip: You can add these export lines to your `~/.zshrc` file as aliases to simplify future launches.*

---

## 4. Configuration for VS Code Extensions (Continue, Cline, etc.)

If you also use GUI extensions in VS Code, apply the following generic settings in their configuration (`settings.json`):

* **API Base URL:** `http://localhost:11434/v1` (Ollama's native OpenAI compatibility)
* **Model ID:** `my-local-claude` (or the name you assigned during `ollama create`)
* **Context Length:** Manually set this between `32000` and `64000` depending on the RAM stability you observe during use.
