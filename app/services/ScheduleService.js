
var ScrapHelper = require('./ScrapHelper');
var EmailService = require('./EmailService');
var ModelService = require('./ModelService');
var mongoose = require('mongoose');
var models = require('./../models/blueprint');
var RateLimiter = require('limiter').RateLimiter;
var searchRateLimiter = new RateLimiter(5, 'hour');

exports.scheduleSearch = function scheduleSearch(sourceUrl, queryRequest) {
    //check if keywordmapping exist and create if it doesn't
    ModelService.checkOrCreateKeyworMapping(queryRequest.title, function (err, keywordMapping) {
        if (err || !keywordMapping) {
            console.error("keyword mapping query got an error " + err);
            return;
        }
        //save this search scrapRequest in db
        saveSearchScrapRequest(sourceUrl, queryRequest.title, function (err, data) {
            if (err) {
                console.error("error in saving scraprequest " + err);
                return;
            }
            if(!data || !data.scrapRequest){
                if(data && data.message){
                    console.error("not scrappin because "+data.message);
                } else {
                    console.error("not scrapping "+err);
                }
                return;
            }
            //ready, set for
            planAndFireSearchScrapRequest(data.scrapRequest); 
        });
    });
}


function saveSearchScrapRequest(url, keyword, cb) {
    //does similar request exist?
    models.ScrapRequest.find({ url: url, type: "googlesearchresults", status: { $ne: "failed" } }, function (err, results) {
        if (err) {
            console.error("Warning: google scrap request not saved. because of error " + err);
            cb(err, null);
            return;
        }
        if (results && results.length > 0) {
            console.log("Yo! google search scraprequest already available. No need to search now.");
            cb(null, { message: "Already search scraprequest has been made", scrapRequest: null });
            return;
        }
        //If search scraprequest not available
        var scrapRequest = new models.ScrapRequest({ url: url, type: 'googlesearchresults', keyword: keyword });
        scrapRequest.save(function (err1, result) {
            if (err1) {
                console.log("scrapRequest not saved because of error " + err1);
                cb("Error in saving scraprequest", null);
                return;
            }
            console.log("googlesearchresult scrapRequest saved");
            cb(null, { message: null, scrapRequest: result });
        });
    });
}

function planAndFireSearchScrapRequest(scrapRequest) {
    //Request with ratelimiter
    // Throttle requests
    console.log("-->Commando, can we fire?");
    searchRateLimiter.removeTokens(1, function (err, remainingRequests) {
        if(err){
            console.log("please remove token less than the limit");
            // err will only be set if we request more than the maximum number of
        // requests we set in the constructor
            return;
        }
        // remainingRequests tells us how many additional requests could be sent
        // right this moment
        // console.log("request sent, just kidding. it's just for testing. Remaining limit "+remainingRequests);
        ScrapHelper.fireScrapRequest(scrapRequest, function (err, result) {
            if (err) {
                // EmailService.sendEmail(email, "Failed: Leads for '" + queryRequest.title + "' page " + page + 1, "Unfortunately, we were not able to generate leads for you your query '" + query + "' because of following error " + err, function (err, result) { });
                return;
            }
            
            // EmailService.sendEmail(email, "Leads for '" + queryRequest.title + "' page #" + (page + 1), "Leads have been generated for your query '" + query + "'. Check it out here " + fullUrl + filename.substring(7), function (err, result) { });
                // res.send(result);
        });
    });
}