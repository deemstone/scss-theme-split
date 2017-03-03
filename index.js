/*
 * gulp-theme-split
 *
 * 将主题相关语句拆分出独立scss文件
 * 
 * {
 *   name: 'dark',
 *   entry: 'dark/data.scss',
 *   output: '{name}-theme.scss'
 * }
 *
 * 处理过程：
 * 0. scss有改动，触发编译过程，在split_theme这一步发现 @import-theme 声明
 * 1. 逐个主题加载entry，处理@import
 * 2. 从scss中提取涉及主题变量的语句、rule，用主题分别注入变量值，分别保存
 * 3. 最后，重新合并出新的 theme-{name}.css 主题样式
 * 
 * 分离过程：源文件C  主题T -> Tcss
 */
var fs = require("fs")
var path = require('path');
var Q = require("q");

var postcss = require('postcss')
var syntax = require('postcss-scss');
var atImport = require("postcss-import")
//var scssVariables = require('postcss-advanced-variables');

//var applySourceMap = require('vinyl-sourcemaps-apply')
var through = require('through2');
var gutil = require('gulp-util');

var loadTdata = require('./lib/tdata-loader.js');
//处理分离的核心库
var split_theme = require('./lib/postcss-theme-split.js');

var debug = require('debug')('bdp:scss:split');

//插件部分 会向文件流中push一个新生成的文件
module.exports = function gulp_split_theme(options) {

    var default_config = {
        themes: './theme/*.scss',
        //themeEntry: 'data.scss',
    };


    //TODO: 根据opts加载指定的几个theme.entry

    //加载主题文件
    //var Tdata_src = fs.readFileSync("theme/data.scss", "utf8")

    var Tdata_promise = loadTdata(options.themes);

    //stream转换
    return through.obj(function(file, enc, callback) {

        debug('file got :', file);

        if (file.isNull()) {
            debug("file is null");
            return callback(null, file);
        }
        if (file.isStream()) {
            debug("file is stream");
            return callback(null, file);
        }

        var stream = this;

        // Protect `from` and `map` if using gulp-sourcemaps
        var isProtected = file.sourceMap
            ? { from: true, map: true }
            : {}

        var options = {
            from: file.path
            , to: file.path
        // Generate a separate source map for gulp-sourcemaps
            , map: file.sourceMap ? { annotation: false } : false
        }

        //TODO: 处理更多postcss配置 比如解释变量之前需要提前处理的语法
        //var configOpts = config.options || {}
        //// Extend the default options if not protected
        //for (var opt in configOpts) {
        //  if (configOpts.hasOwnProperty(opt) && !isProtected[opt]) {
        //    options[opt] = configOpts[opt]
        //  } else {
        //    gutil.log(
        //      'gulp-postcss:',
        //      file.relative + '\nCannot override ' + opt +
        //      ' option, because it is required by gulp-sourcemaps'
        //    )
        //  }
        //}

        //解析源文件
        var scss_promise = postcss()
          //.use(atImport())  //TODO: 可配置 暂不支持import文件的识别
          .process(file.contents, {
            syntax: syntax,
          });

        return Q.all([scss_promise, Tdata_promise])
          .then(handleResult, handleError)
          .catch(function(error) {
              console.error(error.stack);
          })
        function handleResult (results) {
            //debug('Q.all => ',results);

            var result = results[0];
            var Tdata = results[1];

            var map
            var warnings = result.warnings().join('\n');

            //开始分离
            var spliter = split_theme({ Tdata: Tdata.root });
            var Tcss_result = spliter(result.root, result);

            //debug('file callback:', file.path);

            //gulp生成的Vinyl file竟然不带extname/stem/...
            var filename = path.parse(file.path).name;
            var extname = path.parse(file.path).ext;
            //新生成的主题样式文件
            var Tcss_file = new gutil.File({
                cwd: __dirname,
                base: path.join(__dirname, '.'),
                path: path.join(__dirname, filename + '-theme' + extname)
            });
            Tcss_file.contents = new Buffer(Tcss_result.css);
            stream.push(Tcss_file);

            //更新源文件（剔除theme样式之后的内容）
            file.contents = new Buffer(result.root.toResult().css);

            //TODO: 支持sourceMap
            //// Apply source map to the chain
            //if (file.sourceMap) {
            //    map = result.map.toJSON()
            //    map.file = file.relative
            //    map.sources = [].map.call(map.sources, function (source) {
            //        return path.join(path.dirname(file.relative), source)
            //    })
            //    applySourceMap(file, map)
            //}

            if (warnings) {
                gutil.log('gulp-postcss:', file.relative + '\n' + warnings)
            }


            setImmediate(function () {
                callback(null, file)
            })
        }

        function handleError (error) {
            var errorOptions = { fileName: file.path, showStack: true }
            if (error.name === 'CssSyntaxError') {
                error = error.message + '\n\n' + error.showSourceCode() + '\n'
                errorOptions.showStack = false
            }
            // Prevent stream’s unhandled exception from
            // being suppressed by Promise
            setImmediate(function () {
                callback(new gutil.PluginError('gulp-postcss', error, errorOptions))
            })
        }

    });

};
