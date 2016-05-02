var fs = require('fs');
var express = require('express');
var mongoose = require('mongoose');
var app = express();
var ScrapHelper = require('./app/services/ScrapHelper');
var EmailService = require('./app/services/EmailService');
var ScheduleService = require('./app/services/ScheduleService');
var LeadService = require('./app/services/LeadService');
var models = require('./app/models/blueprint');
var log4js = require('log4js');
var pjson = require('./package.json');

//create  log file
var logFilePath = "logs/leaddragon.log";
var logDir = "./logs";
if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}
var fd = fs.openSync(logFilePath, 'w');
fs.closeSync(fs.openSync(logFilePath, 'w'));

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file(logFilePath), 'leaddragon');
var logger = log4js.getLogger('leaddragon');



app.use(express.static('public'));
app.set('view engine', 'ejs');


// Connect to mongodb
var connect = function () {
  var options = { server: { socketOptions: { keepAlive: 1 } } };
  logger.info(process.env.MONGODB_URI);
  mongoose.connect(process.env.MONGODB_URI, options); //process.env.MONGODB_URI = mongodb://example:example@ds053312.mongolab.com:53312/leaddragon 
};
connect();

mongoose.connection.on('error', logger.info);
mongoose.connection.on('disconnected', connect);
mongoose.connection.once('open', function () {
  // we're connected!
  logger.info("Mongodb connected successfully!");
});


app.get('/', function (req, res) {
  // Let's scrape it
  skip = req.query.skip || 0;
  count = req.query.count || 100;
  query = req.query.q;
  email = req.query.email;
  if (!query) {
    res.render('home', { count: count, email: email, version: "v"+pjson.version });
    return;
  }
  // query = "media agencies gurgaon contact";

  // var fullUrl = req.protocol + '://' + req.get('host') + "/";
  logger.info("Generating leads for " + query);

  //Log: Save request in db first
  var LeadRequestModel = new models.LeadRequest({ title: query, totalCount: count, email: email, startDate: new Date() });
  LeadRequestModel.save(function (err, result) {
    if (err) {
      console.error(err);
      res.render('home', { errorMessage: err, q: query, count: count, email: email, version: "v"+pjson.version });
      return;
    }
    logger.info("saved lead request at " + result.id);
    //Manage lead extraction process combining existing database and scrapping for new data
    LeadService.generateLeads(result, function (err, result1) {
      if (err) {
        res.render('home', { errorMessage: err, q: query, count: count, email: email, version: "v"+pjson.version });
        return;
      }
      res.render('home', { q: query, count: count, email: email, version: "v"+pjson.version });//TODO: check for double entry
    });
  });
});

app.get("/leads", function (req, res) {
  query = req.query.q;
  count = req.query.count || 100;
  page = req.query.page || 0;
  skip = req.query.skip || 0;
  email = req.query.email;
  if (!query) {
    res.render('leads', { count: count, email: email });
    return;
  }

  models.KeywordMapping.findOne({ title: query }, function (err, mapping) {
    if (err) {
      res.render('leads', { errorMessage: err, q: query, count: count, email: email, version: "v"+pjson.version });
      return;
    }
    if (!mapping || !mapping.urls || mapping.urls.length == 0) {
      res.render('leads', { errorMessage: "Leads not available. Please schedule lead generation task.", q: query, count: count, email: email, version: "v"+pjson.version });
      return;
    }

    LeadService.getLeadsFromDb(mapping, function (err1, leads) {
      if (err1) {
        res.render('leads', { errorMessage: "Error occured " + err1, q: query, count: count, email: email, version: "v"+pjson.version });
        return;
      }
      if (!leads || leads.length < 1) {
        res.render('leads', { errorMessage: "Leads not available yet. Come back again after some time.", q: query, count: count, email: email, version: "v"+pjson.version });
        return;
      }
      logger.info("showing " + leads.length + " leads");
      res.render('leads', { leads: leads, q: query, count: count, email: email, version: "v"+pjson.version });
    });

  })

});


app.get("/history", function (req, res) {

  models.LeadRequest.find({},{}, {limit: 15, sort: { $natural: -1 }}, function (err, leadReqs) {
    if (err) {
      res.render('history', { errorMessage: err, q: query, count: count, email: email, version: "v"+pjson.version });
      return;
    }
    if (!leadReqs || leadReqs.length<0) {
      res.render('history', { errorMessage: "No request yet"});
      return;
    }
    res.render('history', { leadRequests: leadReqs, version: "v"+pjson.version});
  }
  );

});

var port = process.env.PORT || 3000;
app.listen(port);
logger.info('Magic happens on port ' + port);
exports = module.exports = app;