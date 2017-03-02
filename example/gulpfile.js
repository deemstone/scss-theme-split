var gulp = require('gulp');
var watch = require('gulp-watch');

var gulp_split_theme = require('../');
 
gulp.task('css', function () {
    //TODO: 支持sourcemap
    var sourcemaps = require('gulp-sourcemaps');

    return gulp.src('scss/*.scss')
        //.pipe( sourcemaps.init() )
        .pipe( gulp_split_theme({ themes: 'theme/*.scss'}) )
        //.pipe( sourcemaps.write('.') )
        .pipe( gulp.dest('output/') );
});
