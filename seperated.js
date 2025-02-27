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
            structuralDifferences: [],
            textDifferences: []
        };
    }

    // Parse HTML into AST
    const oldAst = parse5.parse(oldHtml);
    const newAst = parse5.parse(newHtml);

    const structuralDifferences = [];
    const textDifferences = [];

    compareNodes(oldAst, newAst, structuralDifferences, textDifferences);

    return {
        changed: structuralDifferences.length > 0 || textDifferences.length > 0,
        structuralDifferences,
        textDifferences
    };
}

function compareNodes(oldNode, newNode, structuralDifferences, textDifferences, path = '') {
    if (!oldNode || !newNode) {
        structuralDifferences.push({
            type: !oldNode ? 'added' : 'removed',
            path,
            node: !oldNode ? newNode : oldNode
        });
        return;
    }

    // Compare tag names for elements
    if (oldNode.nodeName !== newNode.nodeName && oldNode.nodeName !== '#text') {
        structuralDifferences.push({
            type: 'changed',
            path,
            oldTag: oldNode.nodeName,
            newTag: newNode.nodeName
        });
    }

    // Compare text content
    if (oldNode.nodeName === '#text' && newNode.nodeName === '#text') {
        const oldText = oldNode.value.trim();
        const newText = newNode.value.trim();
        
        if (oldText !== newText) {
            const charDiffs = Diff.diffChars(oldText, newText);
            textDifferences.push({
                path,
                differences: charDiffs.map(part => ({
                    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
                    content: part.value
                }))
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
                structuralDifferences.push({
                    type: 'attributeRemoved',
                    path,
                    name,
                    oldValue
                });
            } else if (newAttrs.get(name) !== oldValue) {
                structuralDifferences.push({
                    type: 'attributeChanged',
                    path,
                    name,
                    oldValue,
                    newValue: newAttrs.get(name)
                });
            }
        }

        // Check for added attributes
        for (const [name, value] of newAttrs) {
            if (!oldAttrs.has(name)) {
                structuralDifferences.push({
                    type: 'attributeAdded',
                    path,
                    name,
                    value
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
            structuralDifferences,
            textDifferences,
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

    const differences = Diff.diffChars(oldText, newText);
    return {
        changed: differences.some(part => part.added || part.removed),
        differences: differences.map(part => ({
            type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
            content: part.value
        }))
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
const result = diff('<table class="old"><tr><td>ello WORLD!</td></tr></table>', '<table class="new"><tr><th>Hello World!</th></tr></table>');
console.log('Structural differences:', result.structuralDifferences);
console.log('Text differences:', JSON.stringify(result.textDifferences));
