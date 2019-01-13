import {
    forEachComment, isIdentifier, isImportDeclaration, isJsxAttribute,
    isJsxExpression, isLiteralExpression,
} from "tsutils";
import * as ts from "typescript";

import * as Lint from "tslint";

const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/;

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "jsx-import",
        description: "Rule ensures that jsx from @emotion/core is imported and pragma comment is present",
        descriptionDetails: Lint.Utils.dedent`
             This rule check if pragma comment added with proper import if there is an attribute css present
        `,
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: [true],
        type: "functionality",
        hasFix: true,
        typescriptOnly: true,
    };

    public static DISALLOWED_IMPORT: string = "emotion";
    // tslint:disable-next-line
    public static FAILURE_STRING: string = "The css prop can only be used if jsx from @emotion/core is imported and it is set as the jsx pragma.";
    // tslint:disable-next-line
    public static FAILURE_STRING_LITERAL: string = "Template literals should be replaced with tagged template literals using `css` when using the css prop.";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.ruleName, undefined));
    }
}

interface IHasSetExpression {
    has: boolean;
}

type ImportNode = ts.Node | null;
type PragmaComment = ts.CommentRange | null;

class Walker extends Lint.AbstractWalker<void> {
    public walk(sourceFile: ts.SourceFile): void {
        let cssImport: ImportNode = null;
        let jsxImport: ImportNode = null;
        let pragmaComment: PragmaComment = null;
        let literalExpressionFixed: boolean = false;
        const cssAttribute: IHasSetExpression = {
            has: false,
        };
        const cb = (node: ts.Node): void => {
            if (isJsxAttribute(node) && isIdentifier(node.name)) {
                if (node.name.escapedText === "css") {
                    if (!cssAttribute.has) {
                        cssAttribute.has = true;
                    }
                    const { initializer } = node;
                    if (initializer && isJsxExpression(initializer) && initializer.expression
                        && isLiteralExpression(initializer.expression)) {
                        this.addFailureAtNode(initializer,
                            Rule.FAILURE_STRING_LITERAL,
                            Lint.Replacement.appendText(initializer.pos + 1, "css"));
                        literalExpressionFixed = true;
                    }
                }
            }
            ts.forEachChild(node, cb);
        };
        ts.forEachChild(sourceFile, cb);
        if (!cssAttribute.has) {
            return;
        }
        forEachComment(sourceFile, (fullText: string, comment: ts.CommentRange) => {
            const match = fullText
                .substring(comment.pos, comment.end)
                .match(JSX_ANNOTATION_REGEX);
            if (match && match[1] === "jsx" && !pragmaComment) {
                pragmaComment = comment;
            }
        });
        sourceFile.statements.forEach((statement: ts.Node) => {
            if (isImportDeclaration(statement)) {
                if (this.checkImportDeclaration(statement, "@emotion/core", "jsx") && !jsxImport) {
                    jsxImport = statement;
                }
                if ((this.checkImportDeclaration(statement, "@emotion/core", "css") ||
                this.checkImportDeclaration(statement, "emotion", "css")) && !cssImport) {
                    cssImport = statement;
                }
            }
        });
        const pragmaCommentString: string = `/** @jsx jsx **/\n`;
        let importString: string = `import { jsx } from '@emotion/core';`;
        if (!jsxImport || !pragmaComment) {
            const needCssImport: boolean = literalExpressionFixed && !this.isNode(cssImport);
            if (needCssImport) {
                importString = `import { jsx, css } from '@emotion/core';`;
            }
            if (this.isNode(jsxImport)) {
                return this.addFailureAtNode(jsxImport, Rule.FAILURE_STRING,
                    Lint.Replacement.appendText(jsxImport.pos, `${pragmaCommentString}`));
            }
            if (this.isComment(pragmaComment)) {
                return this.addFailure(pragmaComment.pos, pragmaComment.end,
                    Rule.FAILURE_STRING, Lint.Replacement.appendText(pragmaComment.end, `\n${importString}`));
            }

            return this.addFailure(0,
                1,
                Rule.FAILURE_STRING,
                Lint.Replacement.appendText(0, `${pragmaCommentString}${importString}\n`));
        }
    }

    private checkImportDeclaration(importDeclaration: ts.ImportDeclaration, importFrom: string, importName: string)
        : boolean {
        if ((importDeclaration.moduleSpecifier as ts.Expression & { text: string }).text === importFrom &&
            importDeclaration.importClause && importDeclaration.importClause.namedBindings) {
            const { elements } = importDeclaration.importClause.namedBindings as ts.NamedImports;
            return elements.some((element: ts.ImportSpecifier) => {
                return (element.name.escapedText === importName);
            });
        }
        return false;
    }

    private isNode(arg: any): arg is ts.Node {
        return arg !== null;
    }

    private isComment(arg: any): arg is ts.CommentRange {
        return arg !== null;
    }
}
