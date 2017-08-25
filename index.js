"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var MetricsParser_1 = require("tsmetrics-core/MetricsParser");
var MetricsConfiguration_1 = require("tsmetrics-core/MetricsConfiguration");
var archy = require("archy");
var minimatch_1 = require("minimatch");
var chalk = require("chalk");
var CodeMetricsOptions = (function (_super) {
    __extends(CodeMetricsOptions, _super);
    function CodeMetricsOptions() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.exclude = ["**/node_modules/**/*"];
        _this.reportThreshold = 5;
        _this.significantReportThreshold = 10;
        return _this;
    }
    return CodeMetricsOptions;
}(MetricsConfiguration_1.MetricsConfiguration));
var CodeMetricsPlugin = (function () {
    function CodeMetricsPlugin(options) {
        if (options === void 0) { options = new CodeMetricsOptions(); }
        this.options = Object.assign(new CodeMetricsOptions(), options || {});
        this.options.significantReportThreshold = Math.max(this.options.significantReportThreshold, this.options.reportThreshold);
    }
    CodeMetricsPlugin.prototype.apply = function (compiler) {
        var _this = this;
        compiler.plugin('emit', function (compilation, callback) { return _this.collectMetricsReport(compilation, callback); });
    };
    CodeMetricsPlugin.prototype.collectMetricsReport = function (compilation, callback) {
        var _this = this;
        var fileSet = this.collectRelevantFiles(compilation);
        var roots = [];
        fileSet.forEach(function (filepath) {
            var root = { label: filepath, nodes: [] };
            var parseResult = MetricsParser_1.MetricsParser.getMetrics(filepath, _this.options, ts.ScriptTarget.Latest);
            parseResult.metrics.children.forEach(function (model) { return _this.collectReport(model, root); });
            if (root.nodes.length > 0) {
                roots.push(root);
            }
        });
        console.log("Complexity analysis:");
        console.log(roots.map(function (root) { return archy(root, "", { unicode: false }); }).join("\n"));
        callback();
    };
    CodeMetricsPlugin.prototype.collectRelevantFiles = function (compilation) {
        var _this = this;
        var fileSet = new Set();
        compilation.chunks.forEach(function (chunk) {
            chunk.modules.forEach(function (_module) {
                _module.fileDependencies && _module.fileDependencies.forEach(function (filepath) {
                    if (filepath.endsWith(".ts") || filepath.endsWith(".js") ||
                        filepath.endsWith(".tsx") || filepath.endsWith(".jsx")) {
                        if (!_this.isExcluded(filepath)) {
                            fileSet.add(filepath);
                        }
                    }
                });
            });
        });
        return Array.from(fileSet).sort();
    };
    CodeMetricsPlugin.prototype.isExcluded = function (fileName) {
        var exclusionList = this.options.exclude || [];
        return exclusionList.some(function (pattern) {
            return new minimatch_1.Minimatch(pattern).match(fileName);
        });
    };
    CodeMetricsPlugin.prototype.modelToString = function (model) {
        var complexity = model.getCollectedComplexity();
        var line = model.line;
        var column = model.column;
        var text = model.text.replace(/\n?\r?/g, "");
        return text + " - +" + complexity + " - Ln " + line + " Col " + column;
    };
    CodeMetricsPlugin.prototype.collectReport = function (model, parent) {
        var _this = this;
        var complexity = model.getCollectedComplexity();
        if (complexity >= this.options.reportThreshold) {
            var current = parent;
            if (model.visible && model.collectorType != "MAX") {
                var label = this.modelToString(model);
                if (complexity >= this.options.significantReportThreshold) {
                    label = chalk.red(label);
                }
                else {
                    label = chalk.yellow(label);
                }
                current = { label: label, nodes: [] };
                parent.nodes.push(current);
            }
            model.children.forEach(function (element) {
                _this.collectReport(element, current);
            });
        }
    };
    return CodeMetricsPlugin;
}());
module.exports = CodeMetricsPlugin;
//# sourceMappingURL=index.js.map