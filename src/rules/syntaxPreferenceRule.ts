import * as Lint from "tslint";
import * as ts from "typescript";

const OPTION_PREFER_STRING_SYNTAX = "string";
const OPTION_PREFER_OBJECT_SYNTAX = "object";

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "syntax-preference",
        description: "Styled function accepts string styles or object styles.",
        descriptionDetails: Lint.Utils.dedent`
            Rule for choosing between styled function syntaxes.
        `,
        optionsDescription: Lint.Utils.dedent`
            Two arguments may be optionally provided:

            * \`"${OPTION_PREFER_STRING_SYNTAX}"\` allows styled function to accept string styles.
            * \`"${OPTION_PREFER_OBJECT_SYNTAX}"\` allows styled function to accept object styles..
        `,
        options: {
            type: "array",
            items: {
                type: "string",
                enum: [OPTION_PREFER_OBJECT_SYNTAX, OPTION_PREFER_STRING_SYNTAX],
            },
            uniqueItems: true,
            minLength: 0,
            maxLength: 1,
        },
        optionExamples: [
            [true, OPTION_PREFER_STRING_SYNTAX],
            [true, OPTION_PREFER_OBJECT_SYNTAX],
        ],
        type: "functionality",
        typescriptOnly: true,
    };

    public static FAILURE_STRING_PREFER_STRING_SYNTAX =
        "Styles should be written using strings.";
    public static FAILURE_PREFER_OBJECT_SYNTAX =
        "Styles should be written using objects.";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(
            new Walker(
                sourceFile,
                this.ruleName,
                this.parseOptions(this.ruleArguments),
            ),
        );
    }

    private parseOptions(ruleArguments: string[]): IOptions {
        return {
            preferStringSyntax: hasOption(OPTION_PREFER_STRING_SYNTAX),
            preferObjectSyntax: hasOption(OPTION_PREFER_OBJECT_SYNTAX),
        };

        function hasOption(name: string): boolean {
            return ruleArguments.indexOf(name) !== -1;
        }
    }
}

interface IOptions {
    preferStringSyntax: boolean;
    preferObjectSyntax: boolean;
}

class Walker extends Lint.AbstractWalker<IOptions> {
    public walk(sourceFile: ts.SourceFile): void {
        const cb = (node: ts.Node): void => {
            if (
                ts.isTaggedTemplateExpression(node) &&
                this.options.preferObjectSyntax
            ) {
                this.checkFunctionExpression(
                    node.tag,
                    Rule.FAILURE_PREFER_OBJECT_SYNTAX,
                );
            }
            if (
                !ts.isTaggedTemplateExpression(node.parent) &&
                this.options.preferStringSyntax
            ) {
                this.checkFunctionExpression(
                    node,
                    Rule.FAILURE_STRING_PREFER_STRING_SYNTAX,
                );
            }

            ts.forEachChild(node, cb);
        };
        ts.forEachChild(sourceFile, cb);
    }

    private checkFunctionExpression(node: ts.Node, failure: string): void {
        if ((ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) &&
            ts.isIdentifier(node.expression) && node.expression.escapedText === "styled") {
            this.addFailure(node.end, node.parent.end, failure);
        }
    }
}
