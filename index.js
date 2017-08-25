var tsMetrics = require('tsmetrics-core/MetricsParser');
var tsMetricsConfiguration = require('tsmetrics-core/MetricsConfiguration');
var ts = require("typescript");
var archy = require('archy');
var minimatch = require('minimatch');

function CodeMetricsPlugin(options) {
    this.options = options || { exclude: ["**/node_modules/**/*"] };
}
CodeMetricsPlugin.prototype.apply = function (compiler) {
    var plugin = this;
    var parser = tsMetrics.MetricsParser;
    var config = new tsMetricsConfiguration.MetricsConfiguration();
    compiler.plugin('emit', function (compilation, callback) {
        var fileSet = new Set();

        compilation.chunks.forEach(function (chunk) {
            chunk.modules.forEach(function (_module) {
                _module.fileDependencies && _module.fileDependencies.forEach(function (filepath) {
                    if (filepath.endsWith(".ts") || filepath.endsWith(".js") ||
                        filepath.endsWith(".ts") || filepath.endsWith(".js")) {
                        fileSet.add(filepath);
                    }
                });
            });
        });
        function isExcluded(fileName) {
            const exclusionList = plugin.options.exclude || [];
            return exclusionList.some(pattern => {
                return new minimatch.Minimatch(pattern).match(fileName);
            });
        }
        function toString(model) {
            var complexity = model.getCollectedComplexity() + "";
            var line = model.line + "";
            var column = model.column + "";

            return `${model.text.replace(/\n?\r?/g, "")} - +${complexity} - Ln ${line} Col ${column}`;
        }
        var globalRoot = { label: "", nodes: [] };
        fileSet
            .forEach(function (filepath) {
                if (!isExcluded(filepath)) {
                    var root = { label: filepath, nodes: [] };

                    var metrics = parser.getMetrics(filepath, config, ts.ScriptTarget.Latest);
                    var collect = (model, parent) => {
                        if (model.getCollectedComplexity() > 0) {
                            var current = parent;
                            if (model.visible) {
                                current = { label: toString(model), nodes: [] };
                                parent.nodes.push(current);
                            }

                            model.children.forEach(element => {
                                collect(element, current);
                            });
                        }
                    }
                    metrics.metrics.children.forEach(model => collect(model, root));
                    globalRoot.nodes.push(root);
                }
            });
        var tree = archy(globalRoot);
        compilation.assets['metrics.md'] = {
            source: function () {
                return tree;
            },
            size: function () {
                return tree.length;
            }
        };

        callback();
    });
};

module.exports = CodeMetricsPlugin;