
var models = require('./../models/blueprint');

exports.checkOrCreateKeyworMapping = function checkOrCreateKeyworMapping(title, cb) {
    models.KeywordMapping.findOne({ title: title }, function (err, keywordMapping) {
        if (err) {
            console.log("error in finding keywordMapping " + err);
            cb(err, null);
            return;
        }
        if (keywordMapping) {
            cb(null, keywordMapping);
            return;
        }
        //keywordMapping doesn't exist. create keywordMapping entry
        var KeywordMappingModel = new models.KeywordMapping({ title: title });
        KeywordMappingModel.save(function (err1, result) {
            if (err1) {
                console.error("error in saving keyword mapping " + err1);
                cb(err1, null);
                return;
            }
            cb(null, result);
        });
    });
}