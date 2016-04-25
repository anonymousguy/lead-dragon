var models = require('./../models/blueprint');
var ScheduleService = require('./../services/ScheduleService');
var LeadService = require('./LeadService');

exports.generateLeads = function generateLeads(queryRequest, cb) {
    //Step 1: Does keyword exist in database
    LeadService.lookupExistingData(queryRequest, function (err, result) {
        if (err) {
            cb("error in looking up existing data " + err, null);
            return;
        }
        startPage = 0; //search start page
        endPage = 0; //search endpage
        if (result && result.availableLeadCount && result.availableLeadCount >= queryRequest.totalCount) {
            //Just to be prompt: send email right away and update sentLeadsCount = totalCount; 
            cb("Leads already available in database", null);
            return;
        } else if (result && result.availableLeadCount && result.availableLeadCount < queryRequest.totalCount) {
            //manage how much data you need to search for and scrape
            startPage = Math.ceil(result.availableLeadCount / 100);
            endPage = startPage + Math.floor(queryRequest.totalCount / 100);
            //Anything special for this case goes here
        } else {
            //scrape complete data now
            startPage = 0;
            endPage = Math.floor(queryRequest.totalCount / 100);
            //Anything special for this case goes here
        }
        // var date = new Date();
        //Got to save keywordMapping before starting search. Else multiple save request may be created to save keywordmapping
        for (page = startPage; page <= endPage; page++) {
            // var filename = "public/data/" + queryRequest.title.replace(/[^A-Z0-9]+/ig, "_") + "_leads_" + totalPageCount + "_page_" + page + "_dm" + date.getDate() + date.getMonth() + "h" + date.getHours() + "__" + date.getTime() + ".csv";
            if (process.env.testing) {
                sourceUrl = "http://localhost:8000/mediaAgecniesDubaiSearchResult.html?randomize="+Math.random(); //python -m SimpleHTTPServer
            } else {
                sourceUrl = 'https://www.google.co.in/search?q=' + queryRequest.title + "&start=" + page + "&num=" + 100;
            }
            // sourceUrl = "http://api.ipify.org";
            //TODO: TODODODODOODODODODODOODODDOODODODODODOOD start coding here
            // ScheduleService.scheduleSearch(sourceUrl, filename, queryRequest.title, page, fullUrl);
            ScheduleService.scheduleSearch(sourceUrl, queryRequest);
        }
        cb(null, "Lead generation started");
    });
}

exports.lookupExistingData = function lookupExistingData(queryRequest, cb) {
    models.KeywordMapping.findOne({ title: queryRequest.title }, function (err, keywordMapping) {
        if (err) {
            console.log("Error occured in getting keyword mapping for " + queryRequest.title + " -> " + err);
            cb("Error in querying existing data", null);
            return;
        }
        if (keywordMapping && keywordMapping.urls && keywordMapping.urls.length >= count) {
            cb(null, { availableLeadCount: keywordMapping.urls.length });
        } else {
            cb(null, { availableLeadCount: 0 });
        }
    });
}

exports.getLeadsFromDb = function getLeadsFromDb(keywordMapping, cb){
    var leads =[];
    var  count = 1;
    keywordMapping.urls.forEach(function(url){
        models.Lead.find({url: url, crawlSuccess: true}, function(err, results){
            if(results && results.length>0 && results[results.length-1].emails) leads.push(results[results.length-1]);
            if(count==keywordMapping.urls.length) {
                cb(null, leads);
                return;
            }
            count++;
        });
    });
}

exports.getScrappedInfoFromDb = function (websiteList, cb) {
    console.log("Todo: implement LeadService.getScrappedInfoFromDb()");
}

exports.emailScrappedInfoFromDb = function (websiteList, cb) {
    console.log("Todo: implement LeadService.emailScrappedInfoFromDb()");
}

exports.saveLeadInDb = function (data, cb) {
    console.log("Todo: implement LeadService.saveLeadInDb()");
}

exports.getScrappedDataForUrl = function (url, cb) {
    console.log("Todo: implement LeadService.getScrappedDataForUrl()");
}
