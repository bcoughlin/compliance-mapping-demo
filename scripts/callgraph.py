"""Build a coarse call graph from a Python codebase.

Walks every .py file under a root, and for each function definition,
records calls of the shape `module.function(...)` or `function(...)`.
The output is a JSON edge list at the file granularity:

    [
      {
        "source_file": "sample_codebase/api/payment_handler.py",
        "source_function": "checkout",
        "source_line": 22,
        "target_module": "tokenization",
        "target_function": "tokenize",
        "target_file": "sample_codebase/services/tokenization.py" | null
      },
      ...
    ]

This is deliberately not a precise call graph — it doesn't resolve
dynamic dispatch, doesn't follow attribute chains beyond one level,
and approximates module → file mapping by scanning imports. That is
enough to render the structural skeleton the mapping demo needs.

Usage:
    python -m scripts.callgraph sample_codebase/ > callgraph.json
"""

from __future__ import annotations

import ast
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class Edge:
    source_file: str
    source_function: str
    source_line: int
    target_module: str
    target_function: str
    target_file: str | None


def _collect_imports(tree: ast.AST) -> dict[str, str]:
    """Map local alias -> dotted module path for the current file."""
    aliases: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for n in node.names:
                aliases[n.asname or n.name.split(".")[-1]] = n.name
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for n in node.names:
                aliases[n.asname or n.name] = (module + "." + n.name).strip(".")
    return aliases


def _module_from_path(path: Path, root: Path) -> str:
    rel = path.relative_to(root.parent if root.name else root).with_suffix("")
    return ".".join(rel.parts)


def _resolve_target_file(
    target_module: str, all_modules: dict[str, str]
) -> str | None:
    if not target_module:
        return None
    if target_module in all_modules:
        return all_modules[target_module]
    parent = ".".join(target_module.split(".")[:-1])
    if parent in all_modules:
        return all_modules[parent]
    return None


def _enclosing_function(node: ast.AST, ancestors: dict[ast.AST, ast.AST]) -> str:
    cur = ancestors.get(node)
    while cur is not None:
        if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return cur.name
        cur = ancestors.get(cur)
    return "<module>"


def _ancestor_map(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent
    return parents


def build_callgraph(root: Path) -> list[Edge]:
    edges: list[Edge] = []
    all_modules: dict[str, str] = {}

    py_files = sorted(p for p in root.rglob("*.py") if "__pycache__" not in p.parts)
    for path in py_files:
        module = _module_from_path(path, root)
        all_modules[module] = str(path)

    for path in py_files:
        try:
            tree = ast.parse(path.read_text(), filename=str(path))
        except SyntaxError:
            continue

        aliases = _collect_imports(tree)
        ancestors = _ancestor_map(tree)

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            func = node.func
            target_module = ""
            target_function = ""

            if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
                local = func.value.id
                target_function = func.attr
                target_module = aliases.get(local, local)
            elif isinstance(func, ast.Name):
                target_function = func.id
                target_module = aliases.get(func.id, "")
            else:
                continue

            target_file = _resolve_target_file(target_module, all_modules)
            edges.append(
                Edge(
                    source_file=str(path),
                    source_function=_enclosing_function(node, ancestors),
                    source_line=node.lineno,
                    target_module=target_module,
                    target_function=target_function,
                    target_file=target_file,
                )
            )

    return edges


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2

    root = Path(argv[1]).resolve()
    if not root.exists() or not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 1

    edges = build_callgraph(root)
    json.dump([asdict(e) for e in edges], sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
