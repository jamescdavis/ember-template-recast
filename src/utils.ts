import type { AST } from '@glimmer/syntax';

export function sourceForLoc(sourceLines: string[], loc: AST.SourceLocation) {
  let firstLine = loc.start.line - 1;
  let lastLine = loc.end.line - 1;
  let currentLine = firstLine - 1;
  let firstColumn = loc.start.column;
  let lastColumn = loc.end.column;
  let string = [];
  let line;

  while (currentLine < lastLine) {
    currentLine++;
    // for templates that are completely empty the outer Template loc is line
    // 0, column 0 for both start and end defaulting to empty string prevents
    // more complicated logic below
    line = sourceLines[currentLine] || '';

    if (currentLine === firstLine) {
      if (firstLine === lastLine) {
        string.push(line.slice(firstColumn, lastColumn));
      } else {
        string.push(line.slice(firstColumn));
      }
    } else if (currentLine === lastLine) {
      string.push(line.slice(0, lastColumn));
    } else {
      string.push(line);
    }
  }

  return string.join('');
}

export function isSynthetic(node: AST.Node) {
  if (node && node.loc) {
    return node.loc.source === '(synthetic)';
  }

  return false;
}

export function sortByLoc(a: AST.Node, b: AST.Node) {
  // sort b higher than synthetic a
  if (isSynthetic(a)) {
    return 1;
  }

  // sort a higher than synthetic b
  if (isSynthetic(b)) {
    return -1;
  }

  if (a.loc.start.line < b.loc.start.line) {
    return -1;
  }

  if (a.loc.start.line === b.loc.start.line && a.loc.start.column < b.loc.start.column) {
    return -1;
  }

  if (a.loc.start.line === b.loc.start.line && a.loc.start.column === b.loc.start.column) {
    return 0;
  }

  return 1;
}

export function compact(array: unknown[]) {
  const newArray: unknown[] = [];
  array.forEach((a) => {
    if (typeof a !== 'undefined' && a !== null && a !== '') {
      newArray.push(a);
    }
  });
  return newArray;
}

export function compactJoin(array: unknown[], delimeter = '') {
  return compact(array).join(delimeter);
}
