
import { isImportDeclaration } from "tsutils";
import * as ts from "typescript";

import * as Lint from "tslint";

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "import-from-emotion",
        description: "Disallows importing from react-emotion and encourage import from emotion.",
        descriptionDetails: Lint.Utils.dedent`
             Disallows if anything other than styled is imported from react-emotion, because
             emotion's exports are not re-exported from react-emotion in emotion 10 and above.
        `,
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: [true],
        type: "functionality",
        hasFix: true,
        typescriptOnly: true,
    };

    public static DISALLOWED_IMPORT: string = "react-emotion";
    public static FAILURE_STRING: string = "React emotion is disallowed";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.ruleName, undefined));
    }
}

class Walker extends Lint.AbstractWalker<void> {
    public walk({ statements }: ts.SourceFile): void {
        for (const statement of statements) {
            if (!isImportDeclaration(statement)) {
                continue;
            }

            const { importClause } = statement;
            if (importClause === undefined) {
                continue;
            }
            this.checkImportClause(statement, importClause);
        }
    }

    private checkImportClause(
        statement: ts.ImportDeclaration,
        importClause: ts.ImportClause,
    ): void {
        if ((statement.moduleSpecifier as ts.Expression & { text: string }).text !== Rule.DISALLOWED_IMPORT) {
            return;
        }
        const name: ts.Identifier | undefined = importClause.name;
        const namedBindings:
            | ts.NamedImports
            | undefined = importClause.namedBindings as ts.NamedImports;
        const emotionImport =
            namedBindings && Array.isArray(namedBindings.elements) && namedBindings.elements.length
                ? `import { ${namedBindings.elements
                    .map(
                        (element: ts.ImportSpecifier) =>
                            element.propertyName
                                ? `${element.propertyName.escapedText} as ${
                                element.name.escapedText
                                }`
                                : element.name.escapedText,
                    )
                    .join(",")} } from 'emotion';`
                : "";
        const styledImport =
            name && name.escapedText
                ? `import ${name.escapedText} from '@emotion/styled';${emotionImport ? `\n` : ""}`
                : "";
        const fix = `${styledImport}${emotionImport}`;

        this.addFailureAtNode(
            statement.moduleSpecifier,
            Rule.FAILURE_STRING,
            Lint.Replacement.replaceNode(statement, fix),
        );
    }
}
