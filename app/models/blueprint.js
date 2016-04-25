var mongoose = require('mongoose');

var keywordMappingSchema = mongoose.Schema({
    title: { type: String, unique: true } ,
    urls: { type: Array, default: []} 
});

var leadRequestSchema = mongoose.Schema({
    title: String,
    totalCount: Number,
    email: String,
    status: String, //[scheduled, finished, sent]
    expectedCompletionTime: Date,
    sentLeadCount: {type: Number, default: 0} //To keep track of how many leads have been sent  
});


var leadSchema = mongoose.Schema({
    keywords: Array,
    title: String,
    url: String,
    emails: Array,
    crawled: Boolean,
    crawlSuccess: Boolean
});

var scrapRequestSchema = mongoose.Schema({
    url: String,
    type: String, //'emailsearch', 'urlsearch', 'googlesearchresults'
    status: {type: String, default: 'pending'}, //[pending, scheduled, finished, sent, failed]
    scheduledAt: Date,
    keyword : String //relevent for googlesearchresult only, to save websiteList in relevent keywordMapping 
});

var KeywordMapping =  mongoose.model('KeywordMapping', keywordMappingSchema);
var LeadRequest =  mongoose.model('LeadRequest', leadRequestSchema);
var Lead =  mongoose.model('Lead', leadSchema);
var ScrapRequest =  mongoose.model('ScrapRequest', scrapRequestSchema);

exports.KeywordMapping = KeywordMapping;
exports.LeadRequest = LeadRequest;
exports.Lead = Lead;
exports.ScrapRequest = ScrapRequest;
