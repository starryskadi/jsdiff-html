const Diff = require('diff');
const parse5 = require('parse5');

function compareHTML(oldHtml, newHtml) {
    // Normalize whitespace and remove extra spaces
    const normalizeHtml = (html) => {
        return html.replace(/>\s+</g, '><').trim();
    };

    oldHtml = normalizeHtml(oldHtml);
    newHtml = normalizeHtml(newHtml);

    // If they're exactly the same after normalization, return no changes
    if (oldHtml === newHtml) {
        return {
            changed: false,
            differences: []
        };
    }

    // Parse HTML into AST
    const oldAst = parse5.parse(oldHtml);
    const newAst = parse5.parse(newHtml);

    const differences = [];

    compareNodes(oldAst, newAst, differences);

    return {
        changed: differences.length > 0,
        differences
    };
}

function compareNodes(oldNode, newNode, differences, path = '') {
    if (!oldNode || !newNode) {
        differences.push({
            type: !oldNode ? 'added' : 'removed',
            path,
            node: !oldNode ? newNode : oldNode,
            kind: 'structural'
        });
        return;
    }

    // Compare tag names for elements
    if (oldNode.nodeName !== newNode.nodeName && oldNode.nodeName !== '#text') {
        differences.push({
            type: 'changed',
            path,
            oldTag: oldNode.nodeName,
            newTag: newNode.nodeName,
            kind: 'structural'
        });
    }

    // Compare text content
    if (oldNode.nodeName === '#text' && newNode.nodeName === '#text') {
        const oldText = oldNode.value.trim();
        const newText = newNode.value.trim();
        
        if (oldText !== newText) {
            const charDiffs = Diff.diffChars(oldText, newText);
            differences.push({
                path,
                changes: charDiffs.map(part => ({
                    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
                    content: part.value
                })),
                kind: 'text'
            });
        }
    }

    // Compare attributes
    if (oldNode.attrs && newNode.attrs) {
        const oldAttrs = new Map(oldNode.attrs.map(attr => [attr.name, attr.value]));
        const newAttrs = new Map(newNode.attrs.map(attr => [attr.name, attr.value]));

        // Check for changed or removed attributes
        for (const [name, oldValue] of oldAttrs) {
            if (!newAttrs.has(name)) {
                differences.push({
                    type: 'attributeRemoved',
                    path,
                    name,
                    oldValue,
                    kind: 'structural'
                });
            } else if (newAttrs.get(name) !== oldValue) {
                differences.push({
                    type: 'attributeChanged',
                    path,
                    name,
                    oldValue,
                    newValue: newAttrs.get(name),
                    kind: 'structural'
                });
            }
        }

        // Check for added attributes
        for (const [name, value] of newAttrs) {
            if (!oldAttrs.has(name)) {
                differences.push({
                    type: 'attributeAdded',
                    path,
                    name,
                    value,
                    kind: 'structural'
                });
            }
        }
    }

    // Compare children
    const oldChildren = oldNode.childNodes || [];
    const newChildren = newNode.childNodes || [];
    const maxLength = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < maxLength; i++) {
        const childPath = path ? `${path}/${i}` : String(i);
        compareNodes(
            oldChildren[i],
            newChildren[i],
            differences,
            childPath
        );
    }
}

function compareText(oldText, newText) {
    if (oldText === newText) {
        return {
            changed: false,
            differences: []
        };
    }

    const charDiffs = Diff.diffChars(oldText, newText);
    return {
        changed: charDiffs.some(part => part.added || part.removed),
        differences: [{
            changes: charDiffs.map(part => ({
                type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
                content: part.value
            })),
            kind: 'text'
        }]
    };
}

function diff(oldContent, newContent) {
    // Check if content appears to be HTML
    const htmlRegex = /<[a-z][\s\S]*>/i;
    const isHtml = htmlRegex.test(oldContent) || htmlRegex.test(newContent);

    if (isHtml) {
        return compareHTML(oldContent, newContent);
    } else {
        return compareText(oldContent, newContent);
    }
}

module.exports = {
    diff,
    compareHTML,
    compareText
};

// Test example
const result = diff('<table class="old"><tr><td>ello WORLD!</td></tr><tr><td>World!</td></tr></table>', '<table class="new"><tr><th>Hello World!</th></tr><tr><th>A</th></tr></table>');

// console.log(result)
result.differences.map(diff => {
    if (diff.kind === 'text') {
        console.log(diff)
    }
})