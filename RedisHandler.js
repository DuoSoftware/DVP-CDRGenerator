var redis = require("ioredis");
var Config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

var redisip = Config.Redis.ip;
var redisport = Config.Redis.port;
var redispass = Config.Redis.password;
var redismode = Config.Redis.mode;
var redisdb = Config.Redis.db;



var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    password: redispass,
    db: redisdb,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(Config.Redis.sentinels && Config.Redis.sentinels.hosts && Config.Redis.sentinels.port && Config.Redis.sentinels.name){
        var sentinelHosts = Config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){

                sentinelConnections.push({host: item, port:Config.Redis.sentinels.port})

            })

            redisSetting = {
                sentinels:sentinelConnections,
                name: Config.Redis.sentinels.name,
                password: redispass
            }

        }else{

            console.log("No enough sentinel servers found .........");
        }

    }
}

var client = undefined;

if(redismode != "cluster") {
    client = new redis(redisSetting);
}else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts)){


        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass});
        });

        var client = new redis.Cluster([redisSetting]);

    }else{

        client = new redis(redisSetting);
    }


}

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
