var request = require('request');
var cheerio = require('cheerio');
var ScrapHelper = require('./ScrapHelper');
var fs = require('fs');
var models = require('./../models/blueprint');
// var RateLimiter = require('limiter').RateLimiter;
// var scrapRequestLimiter = new RateLimiter(10, 'minute');
var async = require('async');
var log4js = require('log4js');
var logger = log4js.getLogger('leaddragon');

exports.scrapeRelevantUrls = function scrapeRelevantUrls(html, cb) {
  var $ = cheerio.load(html);
  var links = $(".r a");

  if (!links) {
    // logger.info($('body').html());
    cb(null, $('body').html());

  } else {
    var websiteList = [];
    var totalResults = 0;
    links.each(function (i, link) {
      // get the href attribute of each link
      var url = $(link).attr("href");
      // strip out unnecessary junk
      url = url.replace("/url?q=", "").split("&")[0];
      totalResults++;
      // logger.info("" + " " + totalResults + url);
      if (url.charAt(0) === "/") {
        return;
      }
      websiteList.push(url);
      // download that page
    });
    cb(null, websiteList);
  }
}

exports.scrapEmailsFromPage = function scrapEmailsFromPage(url, html, cb) {
  // load the page into cheerio
  var $page = cheerio.load(html),
    text = $page("body").text(),
    title = $page("title").text();

  var emails = extractEmails(text);
  cb(null, { title: title, url: url, emails: emails });
}

//@deprecated
exports.getEmailsFromPage = function getEmailsFromPage(url, cb) {
  request({url: url, timeout: 9000}, function (error, response, body) {
    logger.info("Making request to " + url);
    if (error || response.statusCode != 200) {
      cb("Error in downloading page", null);
      return;
    }
    // load the page into cheerio
    var $page = cheerio.load(body),
      text = $page("body").text(),
      title = $page("title").text();

    var emails = extractEmails(text);
    cb(null, { title: title, url: url, emails: emails });
  });
}


extractEmails = function extractEmails(text) {
  return text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
}


// exports.scrapePageToGetEmails = function scrapePageToGetEmails(sourceUrl, filename, query, cb) {
//   var totalEmailCount = 0;
//   var emailNotFound = 0;
//   var totalTime = 0;
//   // var searchRequestFailed = 0;
//   var linkVisits = 0;
//   var linkVisitRequestFailed = 0;
//   logger.info("Making request to " + sourceUrl);
//   var startTime = new Date().getTime();
//   request({
//     url: sourceUrl
//   }, function (error, response, html) {
//     if (!error && response.statusCode == 200) {
//       logger.info("Search page loaded");

//       ScrapHelper.scrapeRelevantUrls(html, function (err, websiteList) {
//         if (!err && websiteList) {
//           //Improvement: check if keyword mapping already available then add to that existing 
//           var KeywordMappingModel = new models.KeywordMapping({title: query, urls: websiteList});
//           KeywordMappingModel.save(function(err, result){
//             if(err) return logger.info("keyword mapping not save because of error "+err);
//           });
//           //Create an xls file
//           var writeStream = fs.createWriteStream(filename);
//           writeStream.write("Title" + "\t" + "Website" + "\t" + "Email" + "\n");
//           //Get email from each page
//           websiteList.forEach(function (url) {
//             ScrapHelper.getEmailsFromPage(url, function (err, data) {
//               linkVisits++;
//               if (!err && data) {
//                 var Lead = new models.Lead({ title: data.title, url: data.url, emails: data.emails, crawled: true, crawlSuccess: true });
//                 Lead.save(function (err, result) {
//                   if (err) logger.info("Error in saving lead in db");
//                 });
//                 if (data.emails) {
//                   logger.info("emails " + data.emails);
//                   totalEmailCount = totalEmailCount + data.emails.length;
//                   writeStream.write(data.title + "\t" + data.url + "\t" + data.emails.toString() + "\t" + "" + "\n");
//                 } else {
//                   emailNotFound++;
//                   writeStream.write(data.title + "\t" + data.url + "\t" + "NotAvailable" + "\t" + "" + "\n");
//                 }
//               } else {
//                 linkVisitRequestFailed++;
//                 logger.info("Couldn’t get page because of error: " + error);
//                 logger.info("Links visited " + linkVisits + "\t" + "Link visits failed " + linkVisitRequestFailed);
//                 var Lead = new models.Lead({url: url, crawled: true, crawlSuccess: false });
//                 Lead.save(function (err, result) {
//                   if (err) logger.info("Error in saving lead in db");
//                 });
//               }
//               logger.info("Links visited " + linkVisits + "\t" + "Link visits failed " + linkVisitRequestFailed);
//             });
//           });
//         } else {
//           logger.info("Error in scraping urls", null);
//         }
//       });
//       cb(null, "Downloading emails for ya");

//     } else {
//       cb({ errorMessage: response.statusCode + " returned " + error, success: false }, null);
//     }

//   });
// }

exports.fireScrapRequest = function fireScrapRequest(scrapRequest, cb) {
  logger.info("Start: http request to " + scrapRequest.url);
  request({
    url: scrapRequest.url,
    timeout: 9000
  }, function (error, response, html) {
    if (!error && response && response.statusCode == 200) {
      logger.info("Request success HTTP 200 " + scrapRequest.url);
      if (scrapRequest.type == "googlesearchresults") {
        ScrapHelper.scrapeRelevantUrls(html, function (err, websiteList) {
          if (!err && websiteList) {
            logger.info("Website list " + websiteList.toString());
            //update keywordMapping with urls
            models.KeywordMapping.update({ title: scrapRequest.keyword }, { $addToSet: { urls: { $each: websiteList } } }, function (err) {
              if (err) {
                logger.error("Error in saving website list to keywordmapping " + err);
                cb("Error in saving website list to keywordmapping " + err,null);
                return;
              }
              scrapRequest.status = "finished";
              scrapRequest.save(function (err) { logger.info("Finish: Scrap request finished, updating status for " + scrapRequest.url + "    " + err) });
              var q = async.queue(function (task, callback) {
                var scrapUrl = task.url;
                logger.info('scrapUrl: ' + scrapUrl);
                // ScheduleService.scheduleSearch(sourceUrl, queryRequest);
                var emailScrapRequestModel = new models.ScrapRequest({ url: scrapUrl, type: "emailsearch" });
                emailScrapRequestModel.save(function (err, emailScrapRequest) {
                  if (err) {
                    logger.info("Error in saving email search scrap request for " + scrapUrl);
                    callback();
                    return;
                  }
                  if (!emailScrapRequest) { logger.error("EmailSearch scrapRequest model save method failed. TODO: handle such case"); return; }
                  ScrapHelper.fireScrapRequest(emailScrapRequest, function (scrapErr, response) {
                    if (scrapErr) {
                      logger.info("Error in firing scrap request for " + emailScrapRequest.url + " " + scrapErr);
                    }
                    callback();
                  });
                });
              }, 1);
              // assign a callback
              q.drain = function () {
                logger.info('all email scraps have been processed');
                cb(null, "scrapping done for "+websiteList.toString());
              }
              //fire emailsearch scrapRequest for each url 
              websiteList.forEach(function (scrapUrl) {
                q.push({ url: scrapUrl }, function (err) {
                  logger.info("scrap scheduled for "+scrapUrl);
                });
              });
            });
          } else {
            logger.info("Error in scraping googlesearchresults " + scrapRequest.url, null);
            cb("Error in scraping googlesearchresults " + scrapRequest.url, null);
          }
        });
      } else if (scrapRequest.type == "emailsearch") {
        scrapRequest.status = "finished";
        scrapRequest.save(function (err) { logger.info("Scrap request finished, updating status for " + scrapRequest.url + "    " + err) });
        ScrapHelper.scrapEmailsFromPage(scrapRequest.url, html, function (err, data) {
          if (!err && data) {
            var Lead = new models.Lead({ title: data.title, url: data.url, emails: data.emails, crawled: true, crawlSuccess: true });
            Lead.save(function (err, result) {
              if (err) logger.info("Error in saving lead in db");
              cb(err, result);
            });
          } else {
            cb(null, { scrapRequest: scrapRequest, response: response, html: html });
            //low priority to handle this case
          }
        });
      }
    } else {
      if (response) {
        logger.info("Error in scrapping request HTTP Status " + response.statusCode + " " + scrapRequest.url + " " + error);
        cb({ errorMessage: response.statusCode + " returned " + error, success: false }, null);
      } else {
        logger.info("No response for request " + scrapRequest.url + " " + error);
        cb({ errorMessage: " No response " + error, success: false }, null);
      }
    }

  });
}
