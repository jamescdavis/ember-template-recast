const { transform } = require('..');
const { stripIndent } = require('common-tags');

describe('"real life" smoke tests', function () {
  describe('line endings', function () {
    test('preserves mixed line endings', function (assert) {
      let template = `{{foo}}\r\n{{bar}}\n{{qux}}\r\n`;

      let expected = `{{oof}}\r\n{{rab}}\n{{xuq}}\r\n`;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });
    test('preserves \\r\\n line endings', function (assert) {
      let template = `{{foo}}\r\n{{bar}}\r\n`;

      let expected = `{{oof}}\r\n{{rab}}\r\n`;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });

    test('preserves \\n line endings', function (assert) {
      let template = `{{foo}}\n{{bar}}\n`;

      let expected = `{{oof}}\n{{rab}}\n`;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });
  });

  describe('nested else conditionals GH#126', function () {
    test('without mutation', function (assert) {
      let template = `
        {{#if a}}
          {{foo}}
        {{else if b}}
          {{bar}}
        {{else if c}}
          {{baz}}
        {{else}}
          {{qux}}
        {{/if}}
      `;

      let { code } = transform(template, () => {
        return {};
      });

      assert.equal(code, template);
    });

    test('with mutation inside component invocation with `else let` branches', function (
      assert
    ) {
      let template = `
        {{#foo-bar}}
          {{foo}}
        {{else let b as |baz|}}
          {{bar}}
        {{else}}
          {{qux}}
        {{/foo-bar}}
      `;

      let expected = `
        {{#foo-bar}}
          {{oof}}
        {{else let b as |baz|}}
          {{rab}}
        {{else}}
          {{xuq}}
        {{/foo-bar}}
      `;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });

    test('with mutation inside component invocation with `else if` branches', function (
      assert
    ) {
      let template = `
        {{#foo-bar}}
          {{foo}}
        {{else if b}}
          {{bar}}
        {{else if c}}
          {{baz}}
        {{else}}
          {{qux}}
        {{/foo-bar}}
      `;

      let expected = `
        {{#foo-bar}}
          {{oof}}
        {{else if b}}
          {{rab}}
        {{else if c}}
          {{zab}}
        {{else}}
          {{xuq}}
        {{/foo-bar}}
      `;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });

    test('with mutation inside `if`/`else if` branches', function (assert) {
      let template = `
        {{#if a}}
          {{foo}}
        {{else if b}}
          {{bar}}
        {{else if c}}
          {{baz}}
        {{else}}
          {{qux}}
        {{/if}}
      `;

      let expected = `
        {{#if a}}
          {{oof}}
        {{else if b}}
          {{rab}}
        {{else if c}}
          {{zab}}
        {{else}}
          {{xuq}}
        {{/if}}
      `;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });
  });

  describe('hash pair mutation order should not matter GH#86', function () {
    test('change, add, remove', function (assert) {
      let template = stripIndent`
        {{foo-bar-baz
          unchanged="unchanged"
          hello="world"
          foo="bar"
        }}
      `;

      let { code } = transform(template, function (env) {
        let { builders: b } = env.syntax;

        return {
          Hash(node) {
            node.pairs.forEach((curr) => {
              if (curr.key === 'foo') {
                curr.value = b.string('baaaaar');
              }
            });
            node.pairs.push(b.pair('somethingnew', b.number(123)));
            node.pairs = node.pairs.filter((curr) => curr.key !== 'hello');
          },
        };
      });

      assert.equal(
        code,
        stripIndent`
          {{foo-bar-baz
            unchanged="unchanged"
            foo="baaaaar"
            somethingnew=123
          }}
        `
      );
    });

    test('remove, change, add', function (assert) {
      let template = stripIndent`
        {{foo-bar-baz
          unchanged="unchanged"
          hello="world"
          foo="bar"
        }}
      `;

      let { code } = transform(template, function (env) {
        let { builders: b } = env.syntax;

        return {
          Hash(node) {
            node.pairs = node.pairs.filter((curr) => curr.key !== 'hello');
            node.pairs.forEach((curr) => {
              if (curr.key === 'foo') {
                curr.value = b.string('baaaaar');
              }
            });
            node.pairs.push(b.pair('somethingnew', b.number(123)));
          },
        };
      });

      assert.equal(
        code,
        stripIndent`
          {{foo-bar-baz
            unchanged="unchanged"
            foo="baaaaar"
            somethingnew=123
          }}
        `
      );
    });
  });

  describe('whitespace and removed hash pairs', function () {
    test('Multi-line removed hash pair causes line removal', function (assert) {
      let template = stripIndent`
        {{#foo-bar
          prop="abc"
          anotherProp=123
          yetAnotherProp="xyz"
        }}
          Hello!
        {{/foo-bar}}`;

      let { code } = transform(template, function () {
        return {
          Hash(ast) {
            ast.pairs = ast.pairs.filter((pair) => pair.key !== 'anotherProp');
          },
        };
      });

      assert.equal(
        code,
        stripIndent`
          {{#foo-bar
            prop="abc"
            yetAnotherProp="xyz"
          }}
            Hello!
          {{/foo-bar}}`
      );
    });

    test('whitespace is preserved when mutating a positional param', function (assert) {
      let template = stripIndent`
        {{some-helper positional}}
        {{#block positional}}
          empty
        {{/block}}
      `;

      let { code } = transform(template, function (env) {
        let { builders: b } = env.syntax;
        return {
          PathExpression(ast) {
            let token = ast.original;

            if (token === 'positional') {
              return b.path(`this.${token}`);
            }
          },
        };
      });
      assert.equal(
        code,
        stripIndent`
          {{some-helper this.positional}}
          {{#block this.positional}}
            empty
          {{/block}}
        `
      );
    });

    test('Same-line removed hash pair from middle collapses excess whitespace', function (
      assert
    ) {
      let template = stripIndent`
        {{#hello-world}}
          {{#foo-bar prop="abc"  anotherProp=123  yetAnotherProp="xyz"}}
            Hello!
          {{/foo-bar}}
        {{/hello-world}}`;
      let { code } = transform(template, function () {
        return {
          Hash(ast) {
            ast.pairs = ast.pairs.filter((pair) => pair.key !== 'anotherProp');
          },
        };
      });

      assert.equal(
        code,
        stripIndent`
          {{#hello-world}}
            {{#foo-bar prop="abc"  yetAnotherProp="xyz"}}
              Hello!
            {{/foo-bar}}
          {{/hello-world}}`
      );
    });

    test('Whitespace properly collapsed when the removed prop is last', function (assert) {
      let template = stripIndent`
        {{#hello-world}}
          {{#foo-bar prop="abc" yetAnotherProp="xyz" anotherProp=123}}
            Hello!
          {{/foo-bar}}
        {{/hello-world}}`;
      let { code } = transform(template, function () {
        return {
          Hash(ast) {
            ast.pairs = ast.pairs.filter((pair) => pair.key !== 'anotherProp');
          },
        };
      });
      assert.equal(
        code,
        stripIndent`
          {{#hello-world}}
            {{#foo-bar prop="abc" yetAnotherProp="xyz"}}
              Hello!
            {{/foo-bar}}
          {{/hello-world}}`
      );
    });

    test(
      'Whitespace properly collapsed when the removed prop is last and the contents of the tag are spaced',
      function (assert) {
        let template = stripIndent`
          {{#hello-world}}
            {{ foo-bar prop="abc" yetAnotherProp="xyz" anotherProp=123 }}
          {{/hello-world}}`;

        let { code } = transform(template, function () {
          return {
            Hash(ast) {
              ast.pairs = ast.pairs.filter((pair) => pair.key !== 'anotherProp');
            },
          };
        });

        assert.equal(
          code,
          stripIndent`
            {{#hello-world}}
              {{ foo-bar prop="abc" yetAnotherProp="xyz" }}
            {{/hello-world}}`
        );
      }
    );

    test('Whitespace is left alone for replacements with whitespace on both sides', function (
      assert
    ) {
      let template = stripIndent`
          {{#hello-world foo="foo" bar="bar" as |yieldedProp|}}
            {{yieldedProp.something-something}}
          {{/hello-world}}`;
      let { code } = transform(template, function (env) {
        let { builders: b } = env.syntax;
        return {
          BlockStatement(ast) {
            const hashPairs = ast.hash.pairs;
            hashPairs.push(b.pair('somethingNew', b.string('Hello world!')));
            return ast;
          },
        };
      });
      assert.equal(
        code,
        stripIndent`
            {{#hello-world foo="foo" bar="bar" somethingNew="Hello world!" as |yieldedProp|}}
              {{yieldedProp.something-something}}
            {{/hello-world}}`,
        'Code is updated with new hash, and whitespace on both sides is preserved'
      );
    });
  });

  describe('multi-line', function (hooks) {
    let i = 0;
    hooks.beforeEach(() => (i = 0));
    function funkyIf(b) {
      return b.block(
        'if',
        [b.sexpr(b.path('a'))],
        null,
        b.program([b.text('\n'), b.text('  '), b.mustache(`${i++}`), b.text('\n'), b.text('\n')])
      );
    }

    test('supports multi-line replacements', function (assert) {
      let template = stripIndent`
        {{bar}}

        {{foo}}`;
      let { code } = transform(template, function (env) {
        let { builders: b } = env.syntax;
        return {
          MustacheStatement(node) {
            if (node.loc.source === '(synthetic)') return node;
            return funkyIf(b);
          },
        };
      });

      assert.equal(
        code,
        stripIndent`
          {{#if (a)}}
            {{0}}

          {{/if}}

          {{#if (a)}}
            {{1}}

          {{/if}}
        `
      );
    });

    test('`if` branch containing whitespace controls', function (assert) {
      let template = `
        {{#if foo~}}
          {{foo}}
        {{/if}}
      `;

      let expected = `
        {{#if foo~}}
          {{oof}}
        {{/if}}
      `;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            node.path.original = node.path.original.split('').reverse().join('');
          },
        };
      });

      assert.equal(code, expected);
    });

    test('collapsing lines (full line replacment)', function (assert) {
      let template = stripIndent`
        here
        is
        some
        multiline
        string
      `;
      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;

        return {
          TextNode() {
            return b.text(`here is a single line string`);
          },
        };
      });

      assert.equal(code, 'here is a single line string');
    });

    test('collapsing lines when start line has non-replaced content', function (assert) {
      let template = stripIndent`
        <div
           data-foo={{baz}}></div>here
        is
        some
        multiline
        string`;
      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;

        return {
          TextNode() {
            return b.text(`here is a single line string`);
          },
        };
      });

      assert.equal(code, '<div\n   data-foo={{baz}}></div>here is a single line string');
    });

    test('collapsing lines when end line has non-replaced content', function (assert) {
      let template = stripIndent`
        here
        is
        some
        multiline
        string<div
        data-foo={{bar}}></div>`;

      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;

        return {
          TextNode() {
            return b.text(`here is a single line string`);
          },
        };
      });

      assert.equal(code, 'here is a single line string<div\ndata-foo={{bar}}></div>');
    });

    test('collapsing lines when start and end lines have non-replaced content', function (
      assert
    ) {
      let template = stripIndent`{{ foo }}
        here
        is
        some
        multiline
        string{{ bar }}`;
      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;

        return {
          TextNode() {
            return b.text(`here is a single line string`);
          },
        };
      });

      assert.equal(code, '{{ foo }}here is a single line string{{ bar }}');
    });

    test('Can handle multi-line column expansion', function (assert) {
      let template = `
        <div data-foo="bar"></div>here
        is
        some
        multiline
        string
        `;
      let { code } = transform(template, (env) => {
        let { builders: b } = env.syntax;

        return {
          TextNode() {
            return b.text(`${Array(10).join('x')}`);
          },
        };
      });

      assert.equal(
        code,
        `${Array(10).join('x')}<div data-foo="${Array(10).join('x')}"></div>${Array(10).join('x')}`
      );
    });

    test('supports multi-line replacements with interleaving', function (assert) {
      let template = stripIndent`
        <br>
        {{bar}}
        <div></div>
        {{foo}}
        <hr>`;
      let { code } = transform(template, function (env) {
        let { builders: b } = env.syntax;
        return {
          MustacheStatement(node) {
            if (node.loc.source === '(synthetic)') return node;
            return funkyIf(b);
          },
        };
      });

      assert.equal(
        code,
        stripIndent`
          <br>
          {{#if (a)}}
            {{0}}

          {{/if}}
          <div></div>
          {{#if (a)}}
            {{1}}

          {{/if}}
          <hr>
        `
      );
    });
  });

  describe('angle-bracket-codemod mockup', function () {
    function isComponent(node) {
      return ['foo-bar'].includes(node.path.original);
    }

    function transformTagName(key) {
      return key
        .split('-')
        .map((text) => text[0].toUpperCase() + text.slice(1))
        .join('');
    }

    function codemod(env) {
      let b = env.syntax.builders;

      return {
        MustacheStatement(node) {
          if (!isComponent(node)) {
            return;
          }

          let tagName = transformTagName(node.path.original);

          return b.element(
            { name: tagName, selfClosing: true },
            {
              attrs: node.hash.pairs.map((pair) => {
                let value = b.mustache(pair.value);

                if (pair.value.type === 'SubExpression') {
                  pair.value.type = 'MustacheStatement';
                  value = pair.value;
                }

                return b.attr(`@${pair.key}`, value);
              }),
            }
          );
        },
      };
    }

    test('works for simple mustache', function (assert) {
      let template = stripIndent`
        {{foo-bar baz=qux}}
      `;

      let { code } = transform(template, codemod);

      assert.equal(code, `<FooBar @baz={{qux}} />`);
    });

    test('preserves nested invocation whitespace', function (assert) {
      let template = stripIndent`
        {{foo-bar baz=(something
          goes=here
          and=here
        )}}
      `;

      let { code } = transform(template, codemod);

      assert.equal(
        code,
        stripIndent`
        <FooBar @baz={{something
          goes=here
          and=here
        }} />
      `
      );
    });
  });

  test(
    'If/else-if/else chains with edits early in the chain should be fully printed (GH #149)',
    function (assert) {
      let template = `
      {{#if a}}
        {{foo}}
      {{else if b}}
        {{bar}}
      {{else if c}}
        {{baz}}
      {{else}}
        {{#if d}}
          {{qux}}
        {{/if}}
      {{/if}}
    `;

      let expected = `
      {{#if a}}
        {{oof}}
      {{else if b}}
        {{bar}}
      {{else if c}}
        {{baz}}
      {{else}}
        {{#if d}}
          {{qux}}
        {{/if}}
      {{/if}}
    `;

      let { code } = transform(template, () => {
        return {
          MustacheStatement(node) {
            if (node.path.original === 'foo') {
              node.path.original = 'oof';
            }
          },
        };
      });

      assert.equal(code, expected);
    }
  );

  test('If/else-if/else chains with multiple edits are accurate (GH #149)', function (
    assert
  ) {
    let template = `
      {{#if a}}
        {{foo}}
      {{else if b}}
        {{bar}}
      {{else if c}}
        {{baz}}
      {{else}}
        {{#if d}}
          {{qux}}
        {{else}}
          {{quack}}
        {{/if}}
      {{/if}}
      <div class="hello-world">
        Hello!
      </div>
    `;

    let expected = `
      {{#if a}}
        {{oof}}
      {{else if b}}
        {{bar}}
      {{else if c}}
        {{baz}}
      {{else}}
        {{#if d}}
          {{qux}}
        {{else}}
          {{honk}}
        {{/if}}
      {{/if}}
      <div class="hello-world">
        Hello!
      </div>
    `;

    let { code } = transform(template, () => {
      return {
        MustacheStatement(node) {
          if (node.path.original === 'foo') {
            node.path.original = 'oof';
          }
          if (node.path.original === 'quack') {
            node.path.original = 'honk';
          }
        },
      };
    });

    assert.equal(code, expected);
  });

  test('mustache param slicing (GH #149)', function (assert) {
    let template = `
      <SomeComponent
        class=""
        @foo=42
        @bar={{action this.baz}}
      />
    `;

    let expected = template;

    let { code } = transform(template, () => ({
      MustacheStatement(node) {
        node.params = node.params.slice();
      },
    }));

    assert.equal(code, expected);
  });

  test('reusing existing hash preserves spacing', function (assert) {
    let template = '{{foo-bar (query-params foo="baz")}}';

    let { code } = transform(template, (env) => {
      let { builders: b } = env.syntax;

      return {
        MustacheStatement(node) {
          if (node.path && node.path.original === 'foo-bar') {
            let models = node.params.slice();
            let _qpParam = b.attr(
              '@query',
              b.mustache(b.path('hash'), [], models[models.length - 1].hash)
            );
            return b.element({ name: 'FooBar', selfClosing: true }, { attrs: [_qpParam] });
          }
        },
      };
    });

    assert.equal(code, '<FooBar @query={{hash foo="baz"}} />');
  });
});
