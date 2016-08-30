var redis = require("redis");
var Config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

var redisIp = Config.Redis.ip;
var redisPort = Config.Redis.port;
var password = Config.Redis.password;
var db = Config.Redis.db;


var client = redis.createClient(redisPort, redisIp);

client.auth(password, function (error) {
    console.log("Redis Auth Error : "+error);
});

client.select(db, function() {});

var getItemsFromSet = function(setName, callback){

    var emptyArr = [];

    try{

        client.smembers(setName, function(err, response){

            if(err){

                logger.error('[DVP-CDRGenerator.RedisHandler.getItemsFromSet] - REDIS ERROR', err)
            }
            callback(err, response);
        });

    }
    catch(ex){

        callback(ex, emptyArr);
    }

};

var removeKey = function(keyName){

    var emptyArr = [];

    try{

        client.del(keyName, function(err, response){

            if(err){

                logger.error('[DVP-CDRGenerator.RedisHandler.removeKey] - REDIS ERROR', err)
            }
        });

    }
    catch(ex){

    }

};

var getKeys = function(pattern, callback){

    var emptyArr = [];

    try{

        client.keys(pattern, function(err, response){

            if(err){

                logger.error('[DVP-CDRGenerator.RedisHandler.SetObject] - REDIS ERROR', err)
            }
            callback(err, response);
        });

    }
    catch(ex){

        callback(ex, emptyArr);
    }

};

var popFromSet = function(setName, callback){

    try{

        client.spop(setName, function(err, response){

            if(err){

                logger.error('[DVP-CDRGenerator.RedisHandler.popFromSet] - REDIS ERROR', err)
            }
            callback(err, response);
        });

    }
    catch(ex){

        callback(ex, null);
    }

};

client.on('error', function(msg){

});

module.exports.getItemsFromSet = getItemsFromSet;
module.exports.getKeys = getKeys;
module.exports.removeKey = removeKey;
module.exports.popFromSet = popFromSet;