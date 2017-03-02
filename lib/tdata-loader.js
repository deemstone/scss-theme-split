/*
 * 整合所有指定的data.scss到一个postcss.root上
 * 解析scss，@import，变量声明
 */
var Q = require("q");

var gulp = require('gulp');
var through = require('through2');

var postcss = require('postcss');
var syntax = require('postcss-scss');
var atImport = require("postcss-import")
var scssVariables = require('postcss-advanced-variables');

var debug = require('debug')('bdp:scss:split');

var getParser = function (onAllContents){
    var allTheme = [];  //contents buffers

    //将多个文件合并到一起，用postcss解析
    return through.obj(function(file, enc, callback) {
        debug('theme-data file!', file.path);
        allTheme.push(file.contents);
        return callback();
    }, function () {
        onAllContents( Buffer.concat(allTheme) );
    });
}

/*
 * @return Promise
 */
module.exports = function(themes) {
    var deferred = Q.defer();
    
    gulp.src(themes).pipe( 
      getParser(function(contents) {
        
        //处理@import + $variables
        postcss([atImport(), scssVariables()])
          .process(contents, {syntax: syntax})
          .then(function(result) {
              debug('theme-data parsed done!')
            deferred.resolve(result);
          }, function(err) {
              debug('theme-data parse error!')
            deferred.reject(err);
          });
        
      }));

    return deferred.promise;
};

