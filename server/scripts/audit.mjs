import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve("src");
const files = [];

const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else if (entry.name.endsWith(".js")) files.push(absolute);
    }
};

walk(root);

const graph = new Map(files.map((file) => [file, []]));
const importPattern =
    /\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?["']([^"']+)["']/g;

for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) continue;
        const target = path.resolve(path.dirname(file), specifier);
        if (!fs.existsSync(target)) {
            throw new Error(
                `Broken import in ${path.relative(root, file)}: ${specifier}`
            );
        }
        if (graph.has(target)) graph.get(file).push(target);
    }
}

const visited = new Set();
const active = new Set();
const stack = [];

const visit = (file) => {
    visited.add(file);
    active.add(file);
    stack.push(file);

    for (const dependency of graph.get(file)) {
        if (!visited.has(dependency)) {
            visit(dependency);
        } else if (active.has(dependency)) {
            const start = stack.indexOf(dependency);
            const cycle = [...stack.slice(start), dependency]
                .map((item) => path.relative(root, item))
                .join(" -> ");
            throw new Error(`Circular dependency detected: ${cycle}`);
        }
    }

    stack.pop();
    active.delete(file);
};

for (const file of files) {
    if (!visited.has(file)) visit(file);
}

process.env.NODE_ENV = "test";
await import(pathToFileURL(path.join(root, "app.js")).href);

console.log(
    `Audit passed: ${files.length} source files, valid imports, no circular dependencies`
);
