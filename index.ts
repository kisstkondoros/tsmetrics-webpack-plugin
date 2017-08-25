import * as ts from 'typescript';
import { MetricsParser } from 'tsmetrics-core/MetricsParser';
import { IMetricsModel } from 'tsmetrics-core';
import { MetricsConfiguration } from 'tsmetrics-core/MetricsConfiguration';
import * as archy from 'archy';
import { Minimatch } from 'minimatch';
import { Compiler } from 'webpack';
import * as chalk from 'chalk';

class CodeMetricsOptions extends MetricsConfiguration {
    exclude = ["**/node_modules/**/*"];
    reportThreshold = 5;
    significantReportThreshold = 10;
}
class CodeMetricsPlugin {
    private options: CodeMetricsOptions;

    constructor(options: CodeMetricsOptions = new CodeMetricsOptions()) {
        this.options = Object.assign(new CodeMetricsOptions(), options || {});
        this.options.significantReportThreshold = Math.max(this.options.significantReportThreshold, this.options.reportThreshold);
    }

    public apply(compiler: Compiler) {
        compiler.plugin('emit', (compilation, callback: () => {}) => this.collectMetricsReport(compilation, callback));
    }
    private collectMetricsReport(compilation, callback: () => {}) {
        const fileSet = this.collectRelevantFiles(compilation);
        const roots: Node[] = [];
        fileSet.forEach((filepath) => {
            var root = { label: filepath, nodes: [] };
            var parseResult = MetricsParser.getMetrics(filepath, this.options, <any>ts.ScriptTarget.Latest);
            parseResult.metrics.children.forEach(model => this.collectReport(model, root));
            if (root.nodes.length > 0) {
                roots.push(root);
            }
        });
        console.log("Complexity analysis:")
        console.log(roots.map(root => archy(root, "", { unicode: false })).join("\n"));

        callback();
    }

    private collectRelevantFiles(compilation): string[] {
        const fileSet = new Set<string>();
        compilation.chunks.forEach((chunk) => {
            chunk.modules.forEach((_module) => {
                _module.fileDependencies && _module.fileDependencies.forEach((filepath) => {
                    if (filepath.endsWith(".ts") || filepath.endsWith(".js") ||
                        filepath.endsWith(".tsx") || filepath.endsWith(".jsx")) {
                        if (!this.isExcluded(filepath)) {
                            fileSet.add(filepath);
                        }
                    }
                });
            });
        });
        return Array.from(fileSet).sort();
    }
    private isExcluded(fileName: string) {
        const exclusionList = this.options.exclude || [];
        return exclusionList.some(pattern => {
            return new Minimatch(pattern).match(fileName);
        });
    }

    private modelToString(model: IMetricsModel): string {
        const complexity = model.getCollectedComplexity();
        const line = model.line;
        const column = model.column;
        const text = model.text.replace(/\n?\r?/g, "");

        return `${text} - +${complexity} - Ln ${line} Col ${column}`;
    }

    private collectReport(model: IMetricsModel, parent: Node) {
        const complexity = model.getCollectedComplexity();
        if (complexity >= this.options.reportThreshold) {
            var current = parent;
            if (model.visible && model.collectorType != "MAX") {
                let label = this.modelToString(model);
                if (complexity >= this.options.significantReportThreshold) {
                    label = chalk.red(label);
                }else {
                    label = chalk.yellow(label);
                }
                current = { label: label, nodes: [] };
                parent.nodes.push(current);
            }

            model.children.forEach(element => {
                this.collectReport(element, current);
            });
        }
    }
}
interface Node {
    label: string, nodes: Node[]
}

module.exports = CodeMetricsPlugin;