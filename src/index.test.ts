const { parse, print, transform } = require('../lib');
const { builders } = require('@glimmer/syntax');
const { stripIndent } = require('common-tags');

describe('ember-template-recast', function () {
  test('basic parse + print (no modification)', function () {
    let template = stripIndent`
      {{foo-bar
        baz="stuff"
      }}`;
    let ast = parse(template);

    expect(print(ast)).toEqual(template);
  });

  test('basic parse + print (no modification): void elements', function () {
    let template = `<br><p>Hi!</p>`;
    let ast = parse(template);

    expect(print(ast)).toEqual(template);
  });

  test('basic parse + print (no modification) preserves blank lines', function () {
    let template = stripIndent`
      {{foo-bar
        baz="stuff"
      }}


`;
    let ast = parse(template);

    expect(print(ast)).toEqual(template);
  });

  test('basic parse -> mutation -> print', function () {
    let template = stripIndent`
      {{foo-bar
        baz="stuff"
        other='single quote'
      }}`;
    let ast = parse(template);
    ast.body[0].hash.pairs[0].key = 'derp';

    expect(print(ast)).toEqual(stripIndent`
      {{foo-bar
        derp="stuff"
        other='single quote'
      }}`);
  });

  test('basic parse -> mutation -> print: preserves HTML entities', function () {
    let template = stripIndent`<div>&nbsp;</div>`;
    let ast = parse(template);
    ast.body[0].children.push(builders.text('derp&nbsp;'));

    expect(print(ast)).toEqual(stripIndent`<div>&nbsp;derp&nbsp;</div>`);
  });

  describe('transform', () => {
    test('basic traversal', function () {
      let template = '{{foo-bar bar=foo}}';
      let paths = [];
      transform(template, function () {
        return {
          PathExpression(node) {
            paths.push(node.original);
          },
        };
      });

      expect(paths).toEqual(['foo-bar', 'foo']);
    });

    test('can handle comment append before html node case', function () {
      let template = '<table></table>';
      let seen = new Set();

      const result = transform(template, function ({ syntax }) {
        const b = syntax.builders;

        return {
          ElementNode(node) {
            if (node.tag === 'table' && !seen.has(node)) {
              seen.add(node);

              return [
                b.mustacheComment(' template-lint-disable no-table-tag '),
                b.text('\n'),
                node,
              ];
            }
            return node;
          },
        };
      });

      expect(result.code).toEqual(
        ['{{!-- template-lint-disable no-table-tag --}}', '<table></table>'].join('\n')
      );
    });

    test('can handle comment append between html + newline', function () {
      let template = ['\n', '<table>', '<tbody></tbody>', '</table>'].join('\n');
      let seen = new Set();

      const result = transform(template, function ({ syntax }) {
        const b = syntax.builders;

        return {
          ElementNode(node) {
            if (node.tag === 'table' && !seen.has(node)) {
              seen.add(node);

              return [
                b.mustacheComment(' template-lint-disable no-table-tag '),
                b.text('\n'),
                node,
              ];
            }
            return node;
          },
        };
      });

      expect(result.code).toEqual(
        [
          '\n',
          '{{!-- template-lint-disable no-table-tag --}}',
          '<table>',
          '<tbody></tbody>',
          '</table>',
        ].join('\n')
      );
    });

    test('can accept an AST', function () {
      let template = '{{foo-bar bar=foo}}';
      let paths = [];
      let ast = parse(template);
      transform(ast, function () {
        return {
          PathExpression(node) {
            paths.push(node.original);
          },
        };
      });

      expect(paths).toEqual(['foo-bar', 'foo']);
    });

    test('returns code and ast', function () {
      let template = '{{foo-bar}}';
      let paths = [];
      let { ast, code } = transform(template, function () {
        return {
          PathExpression(node) {
            paths.push(node.original);
          },
        };
      });

      expect(ast).toBeTruthy();
      expect(code).toBeTruthy();
    });

    test('replacement', function () {
      let template = '{{foo-bar bar=foo}}';
      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;
        return {
          MustacheStatement() {
            return b.mustache(b.path('wat-wat'));
          },
        };
      });

      expect(code).toEqual('{{wat-wat}}');
    });

    test('removing the only hash pair on MustacheStatement', function () {
      let template = '{{foo-bar hello="world"}}';
      let { code } = transform(template, () => {
        return {
          MustacheStatement(ast) {
            ast.hash.pairs.pop();
          },
        };
      });

      expect(code).toEqual('{{foo-bar}}');
    });

    test('pushing new item on to empty hash pair on MustacheStatement works', function () {
      let template = '{{foo-bar}}{{#baz}}Hello!{{/baz}}';
      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;
        return {
          MustacheStatement(ast) {
            ast.hash.pairs.push(b.pair('hello', b.string('world')));
          },
        };
      });

      expect(code).toEqual('{{foo-bar hello="world"}}{{#baz}}Hello!{{/baz}}');
    });
  });

  test('Build string from escaped string', function () {
    let template = '{{foo-bar placeholder="Choose a \\"thing\\"..."}}';

    let { code } = transform(template, (env) => ({
      MustacheStatement(node) {
        let { builders: b } = env.syntax;
        node.hash.pairs.push(b.pair('p1', b.string(node.hash.pairs[0].value.original)));
      },
    }));

    expect(code).toEqual(
      '{{foo-bar placeholder="Choose a \\"thing\\"..." p1="Choose a \\"thing\\"..."}}'
    );
  });
});
