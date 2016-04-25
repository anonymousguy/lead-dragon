var request = require('request');
var cheerio = require('cheerio');
var ScrapHelper = require('./ScrapHelper');
var fs = require('fs');
var models = require('./../models/blueprint');
var RateLimiter = require('limiter').RateLimiter;
var scrapRequestLimiter = new RateLimiter(10, 'minute');

exports.scrapeRelevantUrls = function scrapeRelevantUrls(html, cb) {
  var $ = cheerio.load(html);
  var links = $(".r a");

  if (!links) {
    // console.log($('body').html());
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
      // console.log("" + " " + totalResults + url);
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
  request(url, function (error, response, body) {
    console.log("Making request to " + url);
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
//   console.log("Making request to " + sourceUrl);
//   var startTime = new Date().getTime();
//   request({
//     url: sourceUrl
//   }, function (error, response, html) {
//     if (!error && response.statusCode == 200) {
//       console.log("Search page loaded");

//       ScrapHelper.scrapeRelevantUrls(html, function (err, websiteList) {
//         if (!err && websiteList) {
//           //Improvement: check if keyword mapping already available then add to that existing 
//           var KeywordMappingModel = new models.KeywordMapping({title: query, urls: websiteList});
//           KeywordMappingModel.save(function(err, result){
//             if(err) return console.log("keyword mapping not save because of error "+err);
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
//                   if (err) console.log("Error in saving lead in db");
//                 });
//                 if (data.emails) {
//                   console.log("emails " + data.emails);
//                   totalEmailCount = totalEmailCount + data.emails.length;
//                   writeStream.write(data.title + "\t" + data.url + "\t" + data.emails.toString() + "\t" + "" + "\n");
//                 } else {
//                   emailNotFound++;
//                   writeStream.write(data.title + "\t" + data.url + "\t" + "NotAvailable" + "\t" + "" + "\n");
//                 }
//               } else {
//                 linkVisitRequestFailed++;
//                 console.log("Couldn’t get page because of error: " + error);
//                 console.log("Links visited " + linkVisits + "\t" + "Link visits failed " + linkVisitRequestFailed);
//                 var Lead = new models.Lead({url: url, crawled: true, crawlSuccess: false });
//                 Lead.save(function (err, result) {
//                   if (err) console.log("Error in saving lead in db");
//                 });
//               }
//               console.log("Links visited " + linkVisits + "\t" + "Link visits failed " + linkVisitRequestFailed);
//             });
//           });
//         } else {
//           console.log("Error in scraping urls", null);
//         }
//       });
//       cb(null, "Downloading emails for ya");

//     } else {
//       cb({ errorMessage: response.statusCode + " returned " + error, success: false }, null);
//     }

//   });
// }

exports.fireScrapRequest = function fireScrapRequest(scrapRequest, cb) {
  request({
    url: scrapRequest.url
  }, function (error, response, html) {
    if (!error && response.statusCode == 200) {
      console.log("Search page loaded");
      if (scrapRequest.type == "googlesearchresults") {
        ScrapHelper.scrapeRelevantUrls(html, function (err, websiteList) {
          if (!err && websiteList) {
            //update keywordMapping with urls
            models.KeywordMapping.update({ title: scrapRequest.keyword }, { $addToSet: { urls: { $each: websiteList } } }, function (err) {
              if (err) {
                console.error("Error in saving website list to keywordmapping " + err);
              }
              scrapRequest.status = "finished";
              scrapRequest.save(function (err) { console.log("any err in saving scraprequest? " + err) });
              //TODO: fire emailsearch scrapRequest for each url 
              websiteList.forEach(function (scrapUrl) {
                var emailScrapRequestModel = new models.ScrapRequest({ url: scrapUrl, type: "emailsearch" });
                emailScrapRequestModel.save(function (err, emailScrapRequest) {
                  if (err) {
                    console.log("Error in saving email search scrap request for " + scrapUrl);
                    return;
                  }
                  if (!emailScrapRequest) { console.error("EmailSearch scrapRequest model save method failed. TODO: handle such case"); return;}
                  scrapRequestLimiter.removeTokens(1, function (limitErr, remainingAllowedRequests) {
                    if(limitErr) {
                      emailScrapRequestModel.status = "failed";
                      emailScrapRequestModel.save(function (err) { console.log("scraprequest saved? " +limitErr) });
                      return;
                    }
                    ScrapHelper.fireScrapRequest(emailScrapRequest, function (scrapErr, response) {
                      if (scrapErr) {
                        console.log("Error in firing scrap request " + scrapErr);
                        return;
                      }
                      return;
                    });
                  });
                });
              });
            });
          } else {
            console.log("Error in scraping urls", null);
          }
        });
        cb(null, "Scrapping website links for ya");
      } else if (scrapRequest.type == "emailsearch") {
        scrapRequest.status = "finished";
        scrapRequest.save(function (err) { console.log("scraprequest saved? " + err) });
        ScrapHelper.scrapEmailsFromPage(scrapRequest.url, html, function (err, data) {
          if (!err && data) {
            var Lead = new models.Lead({ title: data.title, url: data.url, emails: data.emails, crawled: true, crawlSuccess: true });
            Lead.save(function (err, result) {
              if (err) console.log("Error in saving lead in db");
            });
          } else {
            //low priority to handle this case
          }
        });
      }
    } else {
      cb({ errorMessage: response.statusCode + " returned " + error, success: false }, null);
    }

  });
}
