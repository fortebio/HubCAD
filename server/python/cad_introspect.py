"""
Introspect a CadQuery model script for HubCAD's CAD Source page.

Two passes over the same entry file:

  AST pass    - every module-level assignment, with the *byte* range of each
                numeric literal so the server can splice the file without
                reparsing it; the trailing `# comment` as the field label; an
                index of part names to source lines; and the export() call that
                says which STEP/STL the script writes.

  live pass   - imports the module (its `if __name__ == "__main__"` guard means
                no geometry is built) to learn the real import graph, the
                runtime value of derived parameters, and which modules declare
                the same name. Shadowed constants cannot be found any other way:
                a function imported from another module resolves globals in
                *its* module, not in the caller's.

Output is a single line prefixed with a sentinel, because the project's own
modules print during import and that chatter must not corrupt the payload.

stdlib only, so the AST half still runs under an interpreter without cadquery.
"""

import argparse
import ast
import io
import json
import os
import sys
import time
import traceback

SENTINEL = "#HUBCAD-JSON#"

NUMERIC = (int, float)


# --------------------------------------------------------------------------- util
def rel_to(root, path):
    try:
        return os.path.relpath(path, root).replace("\\", "/")
    except ValueError:  # different drive
        return path.replace("\\", "/")


def line_comment(line_text):
    """The trailing `# ...` of a source line, if any, ignoring '#' inside strings."""
    in_s = None
    i = 0
    while i < len(line_text):
        c = line_text[i]
        if in_s:
            if c == "\\":
                i += 2
                continue
            if c == in_s:
                in_s = None
        elif c in "\"'":
            in_s = c
        elif c == "#":
            return line_text[i + 1 :].strip()
        i += 1
    return ""


def is_number_node(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, NUMERIC) and not isinstance(node.value, bool):
        return True
    return (
        isinstance(node, ast.UnaryOp)
        and isinstance(node.op, (ast.USub, ast.UAdd))
        and is_number_node(node.operand)
    )


def number_of(node):
    if isinstance(node, ast.Constant):
        return node.value
    v = number_of(node.operand)
    return -v if isinstance(node.op, ast.USub) else v


# --------------------------------------------------------------------------- AST pass
class FileScan:
    """Everything the AST can tell us about one source file."""

    def __init__(self, abs_path, root):
        self.abs = abs_path
        self.rel = rel_to(root, abs_path)
        with open(abs_path, "rb") as fh:
            self.raw = fh.read()
        self.text = self.raw.decode("utf-8")
        self.tree = ast.parse(self.text, filename=abs_path)
        # Lines as BYTES: ast columns are utf-8 byte offsets within a line, and
        # these files carry  ±  °  →  and Vietnamese.
        self.byte_lines = self.text.split("\n")
        self.params = []
        self.part_sites = []
        self.exports = []

    def literal_text(self, lineno, col, end_col):
        line_bytes = self.byte_lines[lineno - 1].encode("utf-8")
        return line_bytes[col:end_col].decode("utf-8")

    # -- parameters ---------------------------------------------------------
    def emit_number(self, name, value_node, stmt, index=None):
        lineno = value_node.lineno
        col = value_node.col_offset
        end_col = value_node.end_col_offset
        self.params.append(
            {
                "id": "%s:%d:%d" % (self.rel, lineno, col),
                "name": name,
                "file": self.rel,
                "lineno": lineno,
                "colByte": col,
                "endColByte": end_col,
                "index": index,
                "literal": self.literal_text(lineno, col, end_col),
                "value": number_of(value_node),
                "role": "literal",
                "editable": True,
                "expr": None,
                "comment": line_comment(self.byte_lines[stmt.lineno - 1]),
            }
        )

    def emit_other(self, name, value_node, stmt, role):
        try:
            expr = ast.get_source_segment(self.text, value_node)
        except Exception:
            expr = None
        self.params.append(
            {
                "id": "%s:%d:%d" % (self.rel, value_node.lineno, value_node.col_offset),
                "name": name,
                "file": self.rel,
                "lineno": value_node.lineno,
                "colByte": value_node.col_offset,
                "endColByte": value_node.end_col_offset,
                "index": None,
                "literal": None,
                "value": None,
                "role": role,
                "editable": False,
                "expr": expr,
                "comment": line_comment(self.byte_lines[stmt.lineno - 1]),
            }
        )

    def classify_value(self, name, value, stmt):
        if is_number_node(value):
            self.emit_number(name, value, stmt)
            return
        if isinstance(value, (ast.Tuple, ast.List)) and value.elts and all(
            is_number_node(e) for e in value.elts
        ):
            for i, elt in enumerate(value.elts):
                self.emit_number(name, elt, stmt, index=i)
            return
        role = "opaque" if isinstance(value, (ast.Call, ast.Lambda, ast.Dict, ast.Set)) else "derived"
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            role = "opaque"
        self.emit_other(name, value, stmt, role)

    def scan_assignments(self):
        for stmt in self.tree.body:
            if not isinstance(stmt, ast.Assign) or len(stmt.targets) != 1:
                continue
            target = stmt.targets[0]
            if isinstance(target, ast.Name):
                self.classify_value(target.id, stmt.value, stmt)
            elif isinstance(target, ast.Tuple):
                names = [t.id for t in target.elts if isinstance(t, ast.Name)]
                if isinstance(stmt.value, ast.Tuple) and len(stmt.value.elts) == len(target.elts):
                    for tgt, val in zip(target.elts, stmt.value.elts):
                        if isinstance(tgt, ast.Name):
                            self.classify_value(tgt.id, val, stmt)
                else:
                    for n in names:
                        self.emit_other(n, stmt.value, stmt, "derived")

    # -- part names ---------------------------------------------------------
    # Ranked, because a name like PCB_ESP32P4 appears at several sites and only
    # one of them is where the body is actually defined.
    def scan_part_sites(self):
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Subscript):
                key = node.slice
                if isinstance(key, ast.Constant) and isinstance(key.value, str):
                    store = isinstance(getattr(node, "ctx", None), ast.Store)
                    self.part_sites.append(
                        {
                            "name": key.value,
                            "file": self.rel,
                            "lineno": node.lineno,
                            "col": node.col_offset,
                            "rank": 1 if store else 4,
                        }
                    )
            elif isinstance(node, ast.Dict):
                for k, v in zip(node.keys, node.values):
                    if isinstance(k, ast.Constant) and isinstance(k.value, str):
                        rich = isinstance(v, (ast.Tuple, ast.Call))
                        self.part_sites.append(
                            {
                                "name": k.value,
                                "file": self.rel,
                                "lineno": k.lineno,
                                "col": k.col_offset,
                                "rank": 2 if rich else 3,
                            }
                        )

    # -- export() calls -----------------------------------------------------
    def scan_exports(self):
        for node in ast.walk(self.tree):
            if not isinstance(node, ast.Call):
                continue
            fn = node.func
            fname = fn.attr if isinstance(fn, ast.Attribute) else getattr(fn, "id", None)
            if fname != "export" or not node.args:
                continue
            first = node.args[0]
            if not (isinstance(first, ast.Constant) and isinstance(first.value, str)):
                continue
            printable = []
            candidates = list(node.args[2:]) + [kw.value for kw in node.keywords if kw.arg == "printable"]
            for cand in candidates:
                if isinstance(cand, (ast.Tuple, ast.List, ast.Set)):
                    printable = [
                        e.value for e in cand.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)
                    ]
                    break
            self.exports.append(
                {
                    "prefix": first.value,
                    "printable": printable,
                    "file": self.rel,
                    "lineno": node.lineno,
                }
            )

    def run(self):
        self.scan_assignments()
        self.scan_part_sites()
        self.scan_exports()
        return self


# --------------------------------------------------------------------------- live pass
def live_import(entry_abs, root):
    """
    Import the entry module the way it imports itself, and report the project
    modules that came along. Returns (info, error).
    """
    here = os.path.dirname(entry_abs)
    mod_name = os.path.splitext(os.path.basename(entry_abs))[0]
    for p in (here, os.path.join(os.path.dirname(here), "common")):
        if os.path.isdir(p) and p not in sys.path:
            sys.path.insert(0, p)

    before = set(sys.modules)
    # Module-level print() from the project must not reach our stdout.
    stdout, sys.stdout = sys.stdout, io.StringIO()
    try:
        import importlib

        entry_mod = importlib.import_module(mod_name)
    except Exception as exc:
        sys.stdout = stdout
        return None, {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc()[-4000:],
        }
    finally:
        sys.stdout = stdout

    root_low = os.path.normcase(os.path.abspath(root))
    graph = []
    values = {}
    declared = {}

    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None)
        if not f:
            continue
        f_abs = os.path.normcase(os.path.abspath(f))
        if not f_abs.startswith(root_low):
            continue
        if ".venv" in f_abs or "site-packages" in f_abs:
            continue
        graph.append({"module": name, "rel": rel_to(root, f), "new": name not in before})
        for attr, val in vars(mod).items():
            if attr.startswith("__"):
                continue
            if isinstance(val, NUMERIC) and not isinstance(val, bool):
                values.setdefault(name, {})[attr] = val
                declared.setdefault(attr, []).append({"module": name, "rel": rel_to(root, f), "value": val})
            elif isinstance(val, tuple) and val and all(
                isinstance(x, NUMERIC) and not isinstance(x, bool) for x in val
            ):
                values.setdefault(name, {})[attr] = list(val)

    graph.sort(key=lambda g: g["rel"])
    shadows = {k: v for k, v in declared.items() if len(v) > 1}

    # Which module's globals a cross-module function actually reads. This is the
    # mechanism behind a shadowed constant having no effect where you edited it.
    resolvers = {}
    for attr, val in vars(entry_mod).items():
        g = getattr(val, "__globals__", None)
        if g is not None and g.get("__name__") and g["__name__"] != mod_name:
            resolvers[attr] = g["__name__"]
        elif hasattr(val, "__dict__") and getattr(val, "__name__", None) and val is not entry_mod:
            for fn_name, fn in vars(val).items():
                fg = getattr(fn, "__globals__", None)
                if fg is not None and fg.get("__name__"):
                    resolvers.setdefault(getattr(val, "__name__", fn_name), fg["__name__"])

    return (
        {
            "entryModule": mod_name,
            "graph": graph,
            "values": values,
            "shadows": shadows,
            "resolvers": resolvers,
        },
        None,
    )


# --------------------------------------------------------------------------- assembly
def build_payload(entry_abs, root, do_live=True):
    t0 = time.time()
    scan = FileScan(entry_abs, root).run()
    ast_ms = int((time.time() - t0) * 1000)

    live, live_err = (None, None)
    live_ms = 0
    if do_live:
        t1 = time.time()
        live, live_err = live_import(entry_abs, root)
        live_ms = int((time.time() - t1) * 1000)

    # Scan every other project file the live pass found, so parameters from
    # f_common.py and joint_rb009.py appear too.
    scans = {scan.rel: scan}
    if live:
        for g in live["graph"]:
            abs_path = os.path.join(root, g["rel"].replace("/", os.sep))
            if g["rel"] in scans or not os.path.isfile(abs_path):
                continue
            try:
                scans[g["rel"]] = FileScan(abs_path, root).run()
            except Exception:
                continue

    params = []
    for s in scans.values():
        params.extend(s.params)

    # Attach runtime values and shadow sites.
    if live:
        by_rel_module = {g["rel"]: g["module"] for g in live["graph"]}
        for p in params:
            mod = by_rel_module.get(p["file"])
            if mod and p["role"] != "literal":
                v = live["values"].get(mod, {}).get(p["name"])
                if v is not None:
                    p["value"] = v
            sites = live["shadows"].get(p["name"], [])
            if len(sites) > 1:
                p["shadowedIn"] = [
                    {"file": s["rel"], "value": s["value"]} for s in sites if s["rel"] != p["file"]
                ]

    # Part-name index: best site first, the rest as alsoAt.
    sites = []
    for s in scans.values():
        sites.extend(s.part_sites)
    depth = {}
    if live:
        for i, g in enumerate(live["graph"]):
            depth[g["rel"]] = i
    by_name = {}
    for site in sites:
        by_name.setdefault(site["name"], []).append(site)
    parts = []
    for name, group in by_name.items():
        group.sort(key=lambda s: (s["rank"], depth.get(s["file"], 99), s["lineno"]))
        best = group[0]
        parts.append(
            {
                "name": name,
                "file": best["file"],
                "lineno": best["lineno"],
                "rank": best["rank"],
                "alsoAt": [
                    {"file": g["file"], "lineno": g["lineno"], "rank": g["rank"]} for g in group[1:]
                ],
            }
        )
    parts.sort(key=lambda p: p["name"])

    # Predicted outputs, then checked against the filesystem.
    script_dir = os.path.dirname(entry_abs)
    exports = []
    for ex in scan.exports:
        prefix = ex["prefix"]

        def artefact(stem, suffix):
            path = os.path.join(script_dir, stem + suffix)
            return {"rel": rel_to(root, path), "exists": os.path.isfile(path)}

        printable = []
        for key in ex["printable"]:
            tail = key.split("_", 1)[1].lower() if "_" in key else key.lower()
            stem = "%s_%s" % (prefix, tail)
            printable.append({"key": key, "step": artefact(stem, ".step"), "stl": artefact(stem, ".stl")})

        predicted = {a["rel"] for p in printable for a in (p["step"], p["stl"])}
        assembly = artefact(prefix + "_assembly", ".step")
        predicted.add(assembly["rel"])
        unmatched = []
        for fn in sorted(os.listdir(script_dir)):
            if not fn.lower().endswith((".step", ".stp", ".stl")):
                continue
            if not fn.startswith(prefix):
                continue
            r = rel_to(root, os.path.join(script_dir, fn))
            if r not in predicted:
                unmatched.append(r)

        exports.append(
            {
                "prefix": prefix,
                "call": {"file": ex["file"], "lineno": ex["lineno"]},
                "assembly": assembly,
                "printable": printable,
                "unmatched": unmatched,
                "source": "ast",
            }
        )

    return {
        "entry": scan.rel,
        "graph": live["graph"] if live else [{"module": None, "rel": scan.rel}],
        "params": params,
        "parts": parts,
        "exports": exports,
        "resolvers": live["resolvers"] if live else {},
        "importError": live_err,
        "timing": {"astMs": ast_ms, "importMs": live_ms},
    }


# --------------------------------------------------------------------------- constraints
class _NS:
    """Attribute access over one module's numeric constants, nothing else."""

    def __init__(self, values):
        self.__dict__.update(values)


def check_constraints(entry_abs, root, constraints, overrides):
    """
    Evaluate each constraint before and after the proposed edits.

    `overrides` is {rel_path: {NAME: value}}. Expressions are written as
    `module.NAME` so a name declared in two files is never ambiguous, and are
    evaluated against plain numbers with no builtins — they are shop rules from
    a config file, not code we are willing to run.
    """
    live, err = live_import(entry_abs, root)
    if err:
        return {"error": err, "results": []}

    rel_to_module = {g["rel"]: g["module"] for g in live["graph"]}
    before_ns = {mod: dict(vals) for mod, vals in live["values"].items()}
    after_ns = {mod: dict(vals) for mod, vals in before_ns.items()}
    for rel, names in (overrides or {}).items():
        mod = rel_to_module.get(rel)
        if not mod:
            continue
        after_ns.setdefault(mod, {}).update(names)

    entry_mod = live["entryModule"]

    def evaluate(expr, table):
        env = {mod: _NS(vals) for mod, vals in table.items()}
        env.update(table.get(entry_mod, {}))      # bare NAME falls back to the entry
        return eval(compile(expr, "<constraint>", "eval"), {"__builtins__": {}}, env)

    results = []
    for c in constraints or []:
        row = {"id": c.get("id"), "severity": c.get("severity", "warning"), "expr": c.get("expr")}
        for key, table in (("before", before_ns), ("after", after_ns)):
            try:
                row[key] = bool(evaluate(c["expr"], table))
            except Exception as exc:
                row[key] = None
                row.setdefault("errors", []).append("%s: %s" % (key, exc))
        if c.get("report"):
            for key, table in (("beforeValue", before_ns), ("afterValue", after_ns)):
                try:
                    row[key] = evaluate(c["report"], table)
                except Exception:
                    row[key] = None
        row["holds"] = row.get("after")
        results.append(row)
    return {"error": None, "results": results}


def emit(payload):
    """One sentinel-prefixed ASCII line — the project's own prints sit above it."""
    sys.stdout.write(SENTINEL + json.dumps(payload, ensure_ascii=True) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="introspect")
    ap.add_argument("--root", required=True)
    ap.add_argument("--entry", required=True)
    ap.add_argument("--no-live", action="store_true")
    args = ap.parse_args()

    if args.mode == "constraints":
        try:
            request = json.loads(sys.stdin.read() or "{}")
            payload = check_constraints(
                args.entry, args.root, request.get("constraints"), request.get("overrides")
            )
        except Exception as exc:
            payload = {"error": "FAILED", "message": str(exc), "traceback": traceback.format_exc()[-4000:]}
        emit(payload)
        return

    try:
        payload = build_payload(args.entry, args.root, do_live=not args.no_live)
    except SyntaxError as exc:
        payload = {
            "error": "SYNTAX",
            "message": str(exc.msg),
            "lineno": exc.lineno,
            "offset": exc.offset,
        }
    except Exception as exc:
        payload = {"error": "FAILED", "message": str(exc), "traceback": traceback.format_exc()[-4000:]}

    emit(payload)


if __name__ == "__main__":
    main()
