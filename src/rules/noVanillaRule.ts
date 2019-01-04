import { findImports, ImportKind } from "tsutils";
import * as ts from "typescript";

import * as Lint from "tslint";

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "no-vanilla",
        description: "Ensure vanilla emotion is not using",
        descriptionDetails: Lint.Utils.dedent`
             This rule reports an error if there is an import from the emotion
             package which is not recommended if you are using emotion with React.
        `,
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: [true],
        type: "functionality",
        hasFix: false,
        typescriptOnly: true,
    };

    public static DISALLOWED_IMPORT: string = "emotion";
    public static FAILURE_STRING: string = "Vanilla emotion should not be used";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.ruleName, undefined));
    }
}

class Walker extends Lint.AbstractWalker<void> {
    public walk(sourceFile: ts.SourceFile): void {
        const imports: any[] = findImports(sourceFile, ImportKind.ImportDeclaration);
        imports.forEach((importStatement) => {
            if (importStatement.text === Rule.DISALLOWED_IMPORT) {
                this.addFailureAtNode(
                    importStatement,
                    Rule.FAILURE_STRING,
                );
            }
        });
    }
}
