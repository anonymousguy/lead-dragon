
var ScrapHelper = require('./ScrapHelper');
var EmailService = require('./EmailService');
var ModelService = require('./ModelService');
var mongoose = require('mongoose');
var models = require('./../models/blueprint');
// var RateLimiter = require('limiter').RateLimiter;
// var searchRateLimiter = new RateLimiter(5, 'hour');
var async = require('async');
var log4js = require('log4js');
var logger = log4js.getLogger('leaddragon');

exports.scheduleSearch = function scheduleSearch(sourceUrl, queryRequest, cb) {
    //check if keywordmapping exist and create if it doesn't
    ModelService.checkOrCreateKeyworMapping(queryRequest.title, function (err, keywordMapping) {
        if (err || !keywordMapping) {
            logger.error("keyword mapping query got an error " + err);
            cb(err, null);
            return;
        }
        //save this search scrapRequest in db
        saveSearchScrapRequest(sourceUrl, queryRequest.title, function (err, data) {
            if (err) {
                logger.error("error in saving scraprequest " + err);
                cb(err, null);
                return;
            }
            if (!data || !data.scrapRequest) {
                if (data && data.message) {
                    logger.error("not scrappin because " + data.message);
                    cb(data.message, null);
                } else {
                    logger.error("not scrapping " + err);
                    cb(err, null);
                }
                return;
            }
            //ready, set for
            planAndFireSearchScrapRequest(data.scrapRequest, function(err1, response) {
                cb(err1, response);
            });
        });
    });
}


function saveSearchScrapRequest(url, keyword, cb) {
    //does similar request exist?
    models.ScrapRequest.find({ url: url, type: "googlesearchresults", status: { $ne: "failed" } }, function (err, results) {
        if (err) {
            logger.error("Warning: google scrap request not saved. because of error " + err);
            cb(err, null);
            return;
        }
        if (results && results.length > 0) {
            logger.info("Yo! google search scraprequest already available. No need to search now.");
            cb(null, { message: "Already search scraprequest has been made", scrapRequest: null });
            return;
        }
        //If search scraprequest not available
        var scrapRequest = new models.ScrapRequest({ url: url, type: 'googlesearchresults', keyword: keyword });
        scrapRequest.save(function (err1, result) {
            if (err1) {
                logger.info("scrapRequest not saved because of error " + err1);
                cb("Error in saving scraprequest", null);
                return;
            }
            logger.info("googlesearchresult scrapRequest saved");
            cb(null, { message: null, scrapRequest: result });
        });
    });
}

function planAndFireSearchScrapRequest(scrapRequest, cb) {
    //Request with ratelimiter
    // Throttle requests
    logger.info("-->Commando, can we fire?");

    ScrapHelper.fireScrapRequest(scrapRequest, function (err, result) {
        cb(err, result);
        // EmailService.sendEmail(email, "Leads for '" + queryRequest.title + "' page #" + (page + 1), "Leads have been generated for your query '" + query + "'. Check it out here " + fullUrl + filename.substring(7), function (err, result) { });
        // res.send(result);
    });
}