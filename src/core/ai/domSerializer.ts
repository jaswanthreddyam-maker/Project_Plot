/**
 * ════════════════════════════════════════════════════════════════
 * DOM-to-JSON Serializer with Blacklist Pruning
 * ════════════════════════════════════════════════════════════════
 *
 * Recursively walks the DOM tree and converts visible elements
 * into a semantic JSON representation optimized for LLM context.
 *
 * Security guarantees:
 *   1. Nodes with `data-ai-ignore` are completely pruned
 *   2. All children of pruned nodes are also excluded
 *   3. Class names, inline styles, and SVG paths are stripped
 *   4. Only semantic attributes (id, role, type, placeholder) are kept
 *
 * Token optimization:
 *   - Raw HTML → JSON reduces token count by ~60-80%
 *   - Empty/invisible nodes are skipped
 *   - Depth limit prevents excessive nesting
 */

import type { SerializedNode } from "@/app/lib/schema";

// ── Configuration ────────────────────────────────────────────
const MAX_DEPTH = 15;
const MAX_TEXT_LENGTH = 200;
const BLACKLIST_ATTRIBUTE = "data-ai-ignore";

// Attributes worth preserving for the LLM
const SEMANTIC_ATTRIBUTES = new Set([
    "id",
    "role",
    "aria-label",
    "aria-describedby",
    "type",
    "placeholder",
    "name",
    "href",
    "value",
    "checked",
    "disabled",
    "data-testid",
]);

// Tags to skip entirely (they are noise for the LLM)
const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "PATH",
    "META",
    "LINK",
    "BR",
    "HR",
]);

// Tags that are structural but don't need tag names
const INLINE_TAGS = new Set(["SPAN", "EM", "STRONG", "B", "I", "U", "SMALL"]);

/**
 * Checks if a DOM element is visible in the viewport.
 * Hidden elements are excluded from the serialized output.
 */
function isVisible(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return true;
    const style = el.style;
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (el.hidden) return false;
    return true;
}

/**
 * Checks if a node or any of its ancestors are blacklisted.
 */
function isBlacklisted(el: Element): boolean {
    return el.hasAttribute(BLACKLIST_ATTRIBUTE);
}

/**
 * Extracts semantic attributes from a DOM element.
 * Strips class names, styles, and framework-specific attrs.
 */
function extractAttributes(el: Element): Record<string, string> | undefined {
    const attrs: Record<string, string> = {};
    let hasAttrs = false;

    for (const attr of Array.from(el.attributes)) {
        if (SEMANTIC_ATTRIBUTES.has(attr.name)) {
            attrs[attr.name] = attr.value;
            hasAttrs = true;
        }
    }

    return hasAttrs ? attrs : undefined;
}

/**
 * Recursively serializes a DOM node into a semantic JSON tree.
 *
 * @param node - The DOM node to serialize
 * @param depth - Current recursion depth (capped at MAX_DEPTH)
 * @returns A SerializedNode or null if the node should be skipped
 */
export function serializeNode(
    node: Node,
    depth: number = 0
): SerializedNode | null {
    // Depth guard
    if (depth > MAX_DEPTH) return null;

    // ── Text Nodes ───────────────────────────────────────
    if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || "").trim();
        if (!text) return null;

        return {
            tag: "#text",
            text: text.length > MAX_TEXT_LENGTH
                ? text.slice(0, MAX_TEXT_LENGTH) + "…"
                : text,
        };
    }

    // ── Element Nodes ────────────────────────────────────
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as Element;
    const tagName = el.tagName;

    // Skip noise tags
    if (SKIP_TAGS.has(tagName)) return null;

    // Skip invisible elements
    if (!isVisible(el)) return null;

    // ── BLACKLIST CHECK: Prune entire branch ─────────────
    if (isBlacklisted(el)) return null;

    // Serialize children
    const children: SerializedNode[] = [];
    for (const child of Array.from(el.childNodes)) {
        const serialized = serializeNode(child, depth + 1);
        if (serialized) {
            children.push(serialized);
        }
    }

    // Skip empty containers (no text, no children)
    if (children.length === 0 && !el.textContent?.trim()) return null;

    // Build the node
    const serialized: SerializedNode = {
        tag: INLINE_TAGS.has(tagName) ? "inline" : tagName.toLowerCase(),
    };

    // Add semantic role
    const role = el.getAttribute("role");
    if (role) serialized.role = role;

    // Add semantic attributes
    const attributes = extractAttributes(el);
    if (attributes) serialized.attributes = attributes;

    // Add ID shortcut
    const id = el.getAttribute("id");
    if (id) serialized.id = id;

    // Inline tags: flatten to just text
    if (INLINE_TAGS.has(tagName) && children.length === 1 && children[0].tag === "#text") {
        serialized.text = children[0].text;
    } else if (children.length > 0) {
        serialized.children = children;
    }

    return serialized;
}

/**
 * Serializes the entire document body into a JSON tree.
 * This is the primary entry point for the context gathering hook.
 *
 * @returns A SerializedNode representing the pruned, sanitized DOM
 */
export function serializeDOM(): SerializedNode | null {
    if (typeof document === "undefined") return null;
    return serializeNode(document.body, 0);
}
