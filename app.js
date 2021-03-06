//jslint node: true

/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var rdb = require('rethinkdb');
var db = require('./lib/db');

var app = express();

pkg = require('./package.json');

// all environments
app.set('version', pkg.version);
app.set('adminpw', process.env.ADMIN_PW || 'admin');
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
  app.locals.pretty = true;
}

var requireAdmin = express.basicAuth(function(user, pass) {
  return (user == 'admin' && pass == app.get('adminpw'));
});

app.get('/', routes.index);
app.all('/q*', function (req, res, next) { res.locals.query_active = true; next();})
app.get('/q/:name', routes.q);
app.get('/q/:name/distinct', routes.queryDistinct);
app.get('/q/:name/histogram/:key', routes.queryHistogram);

app.all('/manage*', requireAdmin);
app.all('/manage*', function (req, res, next) { res.locals.query_active = true; next();})
app.get('/manage', routes.manage);
app.get('/manage/add', routes.addShow);
app.post('/manage/add', routes.addSaveOrTest);
app.get('/manage/edit/:name', routes.editQuery);
app.post('/manage/edit/:name', routes.saveOrTestEditedQuery);
app.get('/manage/delete/:name', routes.deleteQuery);

app.all('/tables*', function (req, res, next) { res.locals.table_active = true; next();})
app.get('/tables', routes.tables);
app.get('/table/:db/:table', routes.table);
app.get('/table/:db/:table/distinct', routes.tableDistinct)
app.get('/table/:db/:table/histogram/:key', routes.tableHistogram)

app.locals.queryParams = function (order, filters, fields) {
  var p = '';
  if (order) {
    p += '&order=' + order;
  }

  if (filters) {
    for (var filter in filters) {
      p += '&filter_' + filter + '=' + filters[filter];
    }
  }

  if (fields) {
    var fields = typeof(fields) == 'object' ? fields : [fields];
    if (fields.indexOf('multiselect-all') == -1) {
      // Not all of them, show the subset
      fields.forEach(function (field) {
        p += '&fields=' + field;
      });
    }
  }

  return p;
}

var dbConfig = {
  host : process.env.RDB_HOST || 'localhost',
  port : parseInt(process.env.RDB_PORT) || 28015,
  db   : process.env.RDB_DB || 'rethink_miner'
};  

module.exports = app;

if (!module.parent) {
  // start serving requests
  db.setup(dbConfig).then(function() {
    http.createServer(app).listen(app.get('port'), function(){
      console.log('Server listening on port ' + app.get('port'));
    });
  })
  .done();
}
