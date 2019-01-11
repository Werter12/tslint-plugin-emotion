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
        description: "Rule ensures that jsx from @emotion/core is imported",
        descriptionDetails: Lint.Utils.dedent`
             This rule add pragma with proper import if there is an attribute css
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
interface IImport extends IHasSetExpression {
    node?: ts.Node;
}
interface ICssAttribute extends IHasSetExpression {
    node?: ts.Node;
}
interface IPragma extends IHasSetExpression {
    comment?: ts.CommentRange;
}

class Walker extends Lint.AbstractWalker<void> {
    public walk(sourceFile: ts.SourceFile): void {
        const cssImport: IImport = {
            has: false,
        };
        const jsxImport: IImport = {
            has: false,
        };
        const pragma: IPragma = {
            has: false,
        };
        const cssAttribute: ICssAttribute = {
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
                        this.addFailureAtNode(initializer, Rule.FAILURE_STRING_LITERAL);
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
            if (match && match[1] === "jsx" && !pragma.has) {
                pragma.has = true;
                pragma.comment = comment;
            }
        });
        sourceFile.statements.forEach((statement: ts.Node) => {
            if (isImportDeclaration(statement)) {
                if (this.checkImportDeclaration(statement, "@emotion/core", "jsx") && !jsxImport.has) {
                    jsxImport.has = true;
                    jsxImport.node = statement;
                }
                if ((this.checkImportDeclaration(statement, "@emotion/core", "css") ||
                this.checkImportDeclaration(statement, "emotion", "css")) && !cssImport.has) {
                    cssImport.has = true;
                    cssImport.node = statement;
                }
            }
        });
        const pragmaCommentString: string = `/** @jsx jsx **/\n`;
        const importString: string = `import { jsx } from '@emotion/core';`;
        if (!jsxImport.has || !pragma.has) {
            if (jsxImport.has && jsxImport.node) {

                return this.addFailureAtNode(jsxImport.node, Rule.FAILURE_STRING,
                    Lint.Replacement.appendText(jsxImport.node.pos, `${pragmaCommentString}`));
            }
            if (pragma.has && pragma.comment) {

                return this.addFailure(pragma.comment.pos, pragma.comment.end,
                    Rule.FAILURE_STRING, Lint.Replacement.appendText(pragma.comment.end, `\n${importString}`));
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
}
