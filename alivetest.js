var postcss = require('postcss');
var syntax = require('postcss-scss');

//var selectorSource = require('postcss-selector-source');
var split_theme = require('./postcss-theme-split.js');

var fs = require("fs")
var atImport = require("postcss-import")

// css to be processed
var C_src = fs.readFileSync("scss/machine-learning.scss", "utf8")
var Tdata_src = fs.readFileSync("theme/data.scss", "utf8")

//要分离出的主题部分css
var Tcss = postcss.root();
//主题样式使用的变量data.scss
console.log('Tdata_src... :', Tdata_src.substr(0, 200));

postcss().process(Tdata_src, {syntax: syntax}).then(function(result) {
    var Tdata = result.root;

    // process css
    postcss()
      .use(atImport())
      .use(split_theme({
        Tdata: Tdata,
        Tcss: Tcss
      }))
      .process(C_src, {
        syntax: syntax,
        // `from` option is required so relative import can work from input dirname
        //from: "output/machine-learning.scss"
        //TODO: 目前暂不考虑import
      })
      .then(function (result) {
          debugger;
        var output = result.css

        //console.log(output)
      })
});
