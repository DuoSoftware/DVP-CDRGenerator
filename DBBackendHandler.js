var dbModel = require('dvp-dbmodels');

var getSpecificLegByUuid = function(uuid, callback)
{
    try
    {
        dbModel.CallCDR.find({where :[{Uuid: uuid}]}).then(function(callLeg)
        {
            callback(null, callLeg);
        });

    }
    catch(ex)
    {
        callback(ex, null);
    }
};

var getCallLeg = function(uuid, callback)
{
    try
    {
        dbModel.CallCDR.find({where :[{Uuid: uuid, Direction: 'inbound', ObjCategory: {ne: 'CONFERENCE'}, $or: [{OriginatedLegs: {ne: null}}, {OriginatedLegs: null, $or:[{ObjType: 'HTTAPI'},{ObjType: 'SOCKET'},{ObjType: 'REJECTED'},{ObjCategory: 'DND'}]}]}]}).then(function(callLeg)
        {
            callback(undefined, callLeg);

        }).catch(function(err)
        {
            callback(err, null);
        });


    }
    catch(ex)
    {
        callback(ex, null);
    }
};

var addProcessedCDR = function(cdrObj, callback)
{
    try
    {
        var cdr = dbModel.CallCDRProcessed.build(cdrObj);

        cdr
            .save()
            .then(function (rsp)
            {
                callback(null, true);

            }).catch(function(err)
            {
                callback(err, false);
            })


    }
    catch(ex)
    {
        callback(ex, false);
    }
};

var getBLegsForIVRCalls = function(uuid, callUuid, callback)
{
    try
    {
        dbModel.CallCDR.findAll({where :[{CallUuid: callUuid, Direction: 'outbound', Uuid: {ne: uuid}}]}).then(function(callLegs)
        {
            callback(null, callLegs);
        });

    }
    catch(ex)
    {
        callback(ex, null);
    }
};



module.exports.getCallLeg = getCallLeg;
module.exports.getBLegsForIVRCalls = getBLegsForIVRCalls;
module.exports.getSpecificLegByUuid = getSpecificLegByUuid;
module.exports.addProcessedCDR = addProcessedCDR;

