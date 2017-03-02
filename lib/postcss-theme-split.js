/*
 * 分离scss的核心库
 *
 * 从一个scss文件中分离出引用data.scss的语句到单独的postcss.root
 *
 * 注：
 * 不支持url()路径转换 ? 源文件拆分到theme目录下的语句不可能带有 url() 资源引用
 * 不支持selector中使用变量 ？ 可能需要连带拆分的样式太多（从属于此rule下的所有子rule和decl）
 */
var postcss = require('postcss');
var debug = require('debug')('bdp:scss:split');


/*
 * @param opts{Object} {Tdata: 主题文件，经过postcss解析的result.root }
 */
module.exports = function(opts){
  opts = opts || {};

  //console.dir('>>>plugin-config: ', opts)

  var isVariableDeclaration = /^\$[\w-]+$/;
  var variablesInString = /(^|[^\\])\$(?:\(([A-z][\w-]*)\)|([A-z][\w-]*))/g;
  var wrappingParen = /^\((.*)\)$/g;
  var isDefaultValue = /\s+!default$/;

  // Helpers
  // -------

  // '(hello), (goodbye)' => [[hello], [goodbye]]
  function getArrayedString(string, first) {
      var array = postcss.list.comma(String(string)).map(function (substring) {
          return wrappingParen.test(substring) ? getArrayedString(substring.replace(wrappingParen, '$1')) : substring;
      });

      return first && array.length === 1 ? array[0] : array;
  }

  // $NAME => VALUE
  function getVariable(node, name) {
      var value = node.variables && name in node.variables ? node.variables[name] : node.parent && getVariable(node.parent, name);

      return value;
  }

  // node.variables[NAME] => 'VALUE'
  function setVariable(node, name, value) {
      node.variables = node.variables || {};

      if (isDefaultValue.test(value)) {
          if (getVariable(node, name)) return;
          else value = value.replace(isDefaultValue, '');
      }

      node.variables[name] = getArrayedString(value, true);
  }

  // 'Hello $NAME' => 'Hello VALUE'
  function getVariableTransformedString(node, string) {
      return string.replace(variablesInString, function (match, before, name1, name2) {
          var value = getVariable(node, name1 || name2);

          //当前文件内没找到变量的定义，尝试去Tdata中查找
          if(value === undefined){
              value = getVariable(opts.Tdata, name1 || name2);
              //TODO: debug level
              //debug(`string=${string},match=${match},before=${before},name1=${name1},name2=${name2}`);
              debug(`${name1} | ${name2} = ${value}`);
          }

          return value === undefined ? match : before + value;
      });
  }

  //检查是否引用了Tdata的数据
  //@return Boolen{true|undefined};
  function checkTdataUse (node, string) {
      variablesInString.lastIndex = 0;
      // /regex/g 在replace和match中的差别 带了/g参数，match只返回match[0] 忽略其他(group)
      var match = variablesInString.exec(string);
      if(!match) return;

      var before = match[1];
      var name1 = match[2];
      var name2 = match[3];
      match = match[0];

      //当前文件中是否有定义
      var value = getVariable(node, name1 || name2);

      //当前文件内没找到变量的定义，尝试去Tdata中查找
      if(value === undefined){
          value = getVariable(opts.Tdata, name1 || name2);
          //debug(`string=${string},match=${match},before=${before},name1=${name1},name2=${name2}`);
          debug(`${name1} | ${name2} = ${value}`);
          //确实属于主题样式
          if(value){
              return true;
          }
      }

  }

  // Loopers
  // -------

  // run over every node
  function each(parent) {
      var index = -1;
      var node;

      var Tnodes = [];  //目标theme.scss的AST
      var transformed;

      while (node = parent.nodes[++index]) {
          if (node.type === 'decl')        index = eachDecl(node, parent, index, Tnodes);
          //else if (node.type === 'rule')   index = eachRule(node, parent, index);
          //else if (node.type === 'atrule') index = eachAtRule(node, parent, index);

          if (node.nodes){
            transformed = each(node);
            if(transformed){
                Tnodes.push(transformed);
            }
          }
      }

      if(Tnodes.length){
          //TODO: 清除拆空了的rule
          //if(parent.nodes.length == 0) parent.remove();
          return parent.clone({nodes: Tnodes});
      }
  }

  // PROPERTY: VALUE
  // 发现theme相关decl，直接clone到Tnodes
  function eachDecl(node, parent, index, Tnodes) {
      // $NAME: VALUE
      if (isVariableDeclaration.test(node.prop)) {
          node.value = getVariableTransformedString(parent, node.value);

          setVariable(parent, node.prop.slice(1), node.value);

          //不删除：不修改原代码
          //node.remove();
          //--index;
      } else {
          //node.prop = getVariableTransformedString(parent, node.prop);

          //node.value = getVariableTransformedString(parent, node.value);
          
          if(checkTdataUse(parent, node.value)){
            var transformed = node.clone();  //decl节点没有child
            Tnodes.push(transformed);
            node.remove();
            --index;
          }
      }

      // return index
      return index;
  }

  //跟postcss插件一样的参数格式
  return (css, result) => {
      //debug('>>>css, result: ', css, result);
      var transformed = each(css);

      //如果没找到任何主题样式语句
      if(!transformed){
          return postcss.root().toResult();
      }
      return transformed.toResult();
  };
};
