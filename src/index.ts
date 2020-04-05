import { traverse, builders, Walker } from '@glimmer/syntax';
import ParseResult from './parse-result';

const PARSE_RESULT_FOR = new WeakMap();

export function parse(template: string) {
  let result = new ParseResult(template);

  PARSE_RESULT_FOR.set(result.ast, result);

  return result.ast;
}

export function print(ast: any) {
  let parseResult = PARSE_RESULT_FOR.get(ast);
  return parseResult.print();
}

export function transform(template: string, plugin: any) {
  let ast;
  if (typeof template === 'string') {
    ast = parse(template);
  } else {
    // assume we were passed an ast
    ast = template;
  }
  let syntax = {
    parse,
    builders,
    print,
    traverse,
    Walker,
  };
  let env = { syntax };
  let visitor = plugin(env);
  traverse(ast, visitor);
  return { ast, code: print(ast) };
}

export { builders, traverse } from '@glimmer/syntax';
