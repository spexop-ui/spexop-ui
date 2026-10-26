import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { CSSSnapshot } from "../parse-css.js";
import type { CaptureDiagnostic, CapturedSource } from "./types.js";
const excluded = new Set(["node_modules", ".git", "dist", "build", "coverage", "artifacts", ".spexop"]);
const maxBytes = 1024 * 1024;
const inside = (root: string, file: string) => {
    const relative = path.relative(root, file);
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
/** Read one bounded byte snapshot per CSS file. No imports, scripts or configuration execution. */
export function readSources(projectRoot: string, cssFiles?: readonly string[]) {
    const sources: CapturedSource[] = [], snapshots: CSSSnapshot[] = [], diagnostics: CaptureDiagnostic[] = [];
    const fail = (code: string, message: string, file?: string) => diagnostics.push({
        code, severity: "error", message, ...(file ? { source: { file, line: 1, column: 1 } } : {}),
        fix: "Provide a stable, readable regular CSS file inside the selected project root.",
    });
    let root: string;
    try {
        const selected = path.resolve(projectRoot);
        if (fs.lstatSync(selected).isSymbolicLink())
            throw new Error("Root symlink refused");
        root = fs.realpathSync(selected); // Platform ancestor aliases are canonicalized once.
        if (!fs.statSync(root).isDirectory())
            throw new Error("Not a directory");
    }
    catch {
        fail("ROOT_INVALID", "Project root must be an existing real directory; root symlinks are refused.");
        return { sources, snapshots, diagnostics };
    }
    const selected = new Set<string>();
    const recordSkip = (file: string, reason: string, code: string) => {
        sources.push({ file, status: "excluded", reason });
        diagnostics.push({ code, severity: "unsupported", message: reason, source: { file, line: 1, column: 1 },
            fix: "Review excluded sources separately; capture never follows links or executes project code." });
    };
    if (cssFiles) {
        for (const file of cssFiles) {
            const absolute = path.resolve(root, file);
            if (path.isAbsolute(file) || !inside(root, absolute) || !file.endsWith(".css")) {
                fail("INPUT_OUTSIDE_SCOPE", "CSS inputs must be relative .css paths within the project.", file);
            }
            else
                selected.add(path.relative(root, absolute).split(path.sep).join("/"));
        }
    }
    else {
        let entries = 0;
        const walk = (dir: string, depth: number) => {
            if (depth > 64 || entries > 10000)
                throw new Error("Enumeration bound");
            for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
                if (++entries > 10000)
                    throw new Error("Enumeration bound");
                const absolute = path.join(dir, entry.name), relative = path.relative(root, absolute).split(path.sep).join("/");
                if (excluded.has(entry.name) || entry.name.startsWith(".")) {
                    if (entry.isDirectory() || entry.name.endsWith(".css"))
                        recordSkip(relative, "Hidden/generated/dependency scope excluded.", "SCOPE_EXCLUDED");
                }
                else if (entry.isSymbolicLink())
                    recordSkip(relative, "Symlink not followed.", "SYMLINK_SKIPPED");
                else if (entry.isDirectory()) {
                    // Recheck directory identity before descending; do not follow a changed symlink.
                    if (fs.lstatSync(absolute).isSymbolicLink() || !inside(root, fs.realpathSync(absolute)))
                        throw new Error("Directory changed");
                    walk(absolute, depth + 1);
                }
                else if (entry.name.endsWith(".css"))
                    selected.add(relative);
            }
        };
        try {
            walk(root, 0);
        }
        catch {
            fail("ENUMERATION_FAILED", "Project enumeration failed, changed or exceeded 10,000 entries / 64 directory levels; narrow cssFiles.");
        }
    }
    if (selected.size > 200) {
        fail("SCOPE_LIMIT", "More than 200 CSS files selected; narrow cssFiles. No CSS contents were read.");
        return { sources, snapshots, diagnostics };
    }
    for (const file of [...selected].sort()) {
        let fd: number | undefined;
        try {
            let component = root;
            for (const part of file.split("/")) {
                component = path.join(component, part);
                if (fs.lstatSync(component).isSymbolicLink())
                    throw new Error("Symlink component");
            }
            const absolute = path.join(root, file), real = fs.realpathSync(absolute);
            if (!inside(root, real))
                throw new Error("Outside root");
            const before = fs.lstatSync(absolute);
            if (!before.isFile() || before.nlink !== 1 || before.size > maxBytes)
                throw new Error("Nonregular, linked or oversized file");
            fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
            const opened = fs.fstatSync(fd);
            if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev)
                throw new Error("File changed");
            // Bounded read even if another process grows the file after stat.
            const buffer = Buffer.alloc(maxBytes + 1);
            let bytes = 0, n = 0;
            while (bytes < buffer.length && (n = fs.readSync(fd, buffer, bytes, buffer.length - bytes, null)) > 0)
                bytes += n;
            const after = fs.fstatSync(fd), current = fs.lstatSync(absolute);
            if (bytes > maxBytes || bytes !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs ||
                current.isSymbolicLink() || current.ino !== opened.ino || current.dev !== opened.dev || fs.realpathSync(absolute) !== real)
                throw new Error("Source changed during read");
            const data = buffer.subarray(0, bytes), css = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data);
            sources.push({ file, status: "inspected", bytes, sha256: createHash("sha256").update(data).digest("hex") });
            snapshots.push({ file, css });
        }
        catch {
            sources.push({ file, status: "rejected", reason: "Unreadable, nonregular, symlink/hardlink, oversized, invalid UTF-8 or changing source." });
            fail("SOURCE_REFUSED", "CSS file could not be safely captured; its contents were not included.", file);
        }
        finally {
            if (fd !== undefined)
                fs.closeSync(fd);
        }
    }
    sources.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    return { sources, snapshots, diagnostics };
}
