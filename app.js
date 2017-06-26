/**
 * Created by dinusha on 8/17/2016.
 */
var schedule = require('node-schedule');
var moment = require('moment');
var async = require('async');
var redisHandler = require('./RedisHandler.js');
var dbHandler = require('./DBBackendHandler.js');

var rule = new schedule.RecurrenceRule();
rule.second = [0, 15, 30, 45];
var doneProcessing = true;

var GetSpecificLegsForTransfer = function(legUuid, cdrListArr, legInfo, callback)
{
    dbHandler.getSpecificLegByUuid(legUuid, function (err, transferLeg)
    {
        cdrListArr.push(legInfo);

        if(transferLeg)
        {
            var tempTransLeg = transferLeg.toJSON();
            tempTransLeg.IsTransferredParty = true;
            cdrListArr.push(tempTransLeg);
        }

        callback(err, true);
    })
};

var collectBLegs = function(cdrListArr, uuid, callUuid, callback)
{
    dbHandler.getBLegsForIVRCalls(uuid, callUuid, function(err, legInfo)
    {

        /*if(legInfo && legInfo.length > 0)
        {
            cdrListArr.push.apply(cdrListArr, legInfo);
        }*/

        if(legInfo && legInfo.length > 0)
        {
            var len = legInfo.length;
            var current = 0;

            for(i=0; i<legInfo.length; i++)
            {
                var legType = legInfo[i].ObjType;

                if(legType && (legType === 'ATT_XFER_USER' || legType === 'ATT_XFER_GATEWAY'))
                {
                    //check for Originated Legs

                    if(legInfo[i].OriginatedLegs)
                    {
                        var decodedLegsStr = decodeURIComponent(legInfo[i].OriginatedLegs);

                        var formattedStr = decodedLegsStr.replace("ARRAY::", "");

                        var legsUnformattedList = formattedStr.split('|:');

                        if(legsUnformattedList && legsUnformattedList.length > 0)
                        {
                            var legProperties = legsUnformattedList[0].split(';');

                            var legUuid = legProperties[0];

                            GetSpecificLegsForTransfer(legUuid, cdrListArr, legInfo[i], function(err, transInfLegRes)
                            {
                                current++;

                                if(current === len)
                                {
                                    callback(null, cdrListArr);
                                }
                            });
                        }
                        else
                        {
                            current++;

                            cdrListArr.push(legInfo[i]);

                            if(current === len)
                            {
                                callback(null, cdrListArr);
                            }
                        }
                    }
                    else
                    {
                        current++;

                        cdrListArr.push(legInfo[i]);

                        if(current === len)
                        {
                            callback(null, cdrListArr);
                        }
                    }


                }
                else
                {
                    current++;

                    cdrListArr.push(legInfo[i]);

                    if(current === len)
                    {
                        callback(null, cdrListArr);
                    }
                }
            }

        }
        else
        {
            callback(err, cdrListArr);
        }

        /*callback(err, cdrListArr);*/
    })
};

var collectOtherLegsCDR = function(cdrListArr, relatedLegs, callback)
{
    var len = Object.keys(relatedLegs).length;

    var count = 0;

    for(legUuid in relatedLegs)
    {
        dbHandler.getSpecificLegByUuid(legUuid, function(err, legInfo)
        {
            if(legInfo)
            {
                var legType = legInfo.ObjType;

                if(legType && (legType === 'ATT_XFER_USER' || legType === 'ATT_XFER_GATEWAY'))
                {
                    if(legInfo.OriginatedLegs)
                    {
                        var decodedLegsStr = decodeURIComponent(legInfo.OriginatedLegs);

                        var formattedStr = decodedLegsStr.replace("ARRAY::", "");

                        var legsUnformattedList = formattedStr.split('|:');

                        if (legsUnformattedList && legsUnformattedList.length > 0)
                        {
                            var legProperties = legsUnformattedList[0].split(';');

                            var legUuid = legProperties[0];

                            dbHandler.getSpecificLegByUuid(legUuid, function (err, transferLeg)
                            {
                                cdrListArr.push(legInfo);

                                if(transferLeg)
                                {
                                    var tempTransLeg = transferLeg.toJSON();
                                    tempTransLeg.IsTransferredParty = true;
                                    cdrListArr.push(tempTransLeg);
                                }

                                count++;

                                if(count === len)
                                {
                                    callback(null, true);
                                }
                            })
                        }
                        else
                        {
                            cdrListArr.push(legInfo);
                            count++;

                            if(count === len)
                            {
                                callback(null, true);
                            }
                        }
                    }
                    else
                    {
                        cdrListArr.push(legInfo);
                        count++;

                        if(count === len)
                        {
                            callback(null, true);
                        }
                    }
                }
                else
                {
                    cdrListArr.push(legInfo);
                    count++;

                    if(count === len)
                    {
                        callback(null, true);
                    }
                }


            }
            else
            {
                count++;

                if(count === len)
                {
                    callback(null, true);
                }
            }
            /*count++;
            if(legInfo)
            {
                cdrListArr.push(legInfo);

            }

            if(count === len)
            {
                callback(null, true);
            }*/
        })

    }
};

var processCDRLegs = function(processedCdr, cdrList, callback)
{
    cdrList[processedCdr.Uuid] = [];
    cdrList[processedCdr.Uuid].push(processedCdr);

    var relatedLegsLength = 0;

    if(processedCdr.RelatedLegs)
    {
        relatedLegsLength = Object.keys(processedCdr.RelatedLegs).length;
    }

    if(processedCdr.RelatedLegs && relatedLegsLength)
    {
        collectOtherLegsCDR(cdrList[processedCdr.Uuid], processedCdr.RelatedLegs, function(err, resp)
        {
            callback(null, cdrList);

        })
    }
    else
    {
        if(processedCdr.ObjType === 'HTTAPI' || processedCdr.ObjType === 'SOCKET')
        {
            collectBLegs(cdrList[processedCdr.Uuid], processedCdr.Uuid, processedCdr.CallUuid, function(err, resp)
            {

                callback(null, cdrList);
            })

        }
        else
        {
            callback(null, cdrList);
        }


    }

};

var processBatchCDR = function(cdr)
{

    try
    {
        var OriginatedLegs = cdr.OriginatedLegs;

        if(OriginatedLegs){

            //Do HTTP DECODE
            var decodedLegsStr = decodeURIComponent(OriginatedLegs);

            var formattedStr = decodedLegsStr.replace("ARRAY::", "");

            var legsUnformattedList = formattedStr.split('|:');

            cdr.RelatedLegs = {};

            for(j=0; j<legsUnformattedList.length; j++){

                var legProperties = legsUnformattedList[j].split(';');

                var legUuid = legProperties[0];

                if(cdr.Uuid != legUuid && !cdr.RelatedLegs[legUuid]){

                    cdr.RelatedLegs[legUuid] = legUuid;
                }

            }
        }

        return cdr;
    }
    catch(ex)
    {
        return null;
    }
};

var processSingleCdrLeg = function(uuid, callback)
{
    dbHandler.getCallLeg(uuid, function(err, callLeg)
    {
        if(callLeg)
        {
            var cdr = processBatchCDR(callLeg);

            var cdrList = {};

            processCDRLegs(cdr, cdrList, function(err, resp)
            {

                var primaryLeg = cdr;

                if(resp)
                {
                    var cdrAppendObj = {};
                    var curCdr = resp[Object.keys(resp)[0]];
                    var outLegAnswered = false;

                    var callHangupDirectionA = '';
                    var callHangupDirectionB = '';

                    //Need to filter out inbound and outbound legs before processing

                    /*var filteredInb = curCdr.filter(function (item)
                    {
                        if (item.Direction === 'inbound')
                        {
                            return true;
                        }
                        else
                        {
                            return false;
                        }

                    });*/

                    var secondaryLeg = null;

                    var filteredOutb = curCdr.filter(function (item)
                    {
                        return item.Direction === 'outbound';
                    });


                    var transferredParties = '';

                    var transferCallOriginalCallLeg = null;

                    var transferLegB = filteredOutb.filter(function (item)
                    {
                        if ((item.ObjType === 'ATT_XFER_USER' || item.ObjType === 'ATT_XFER_GATEWAY') && !item.IsTransferredParty)
                        {
                            return true;
                        }
                        else
                        {
                            return false;
                        }

                    });

                    var actualTransferLegs = filteredOutb.filter(function (item)
                    {
                        if (item.IsTransferredParty)
                        {
                            return true;
                        }
                        else
                        {
                            return false;
                        }

                    });

                    if(transferLegB && transferLegB.length > 0)
                    {

                        var transferLegBAnswered = filteredOutb.filter(function (item) {
                            return item.IsAnswered === true;
                        });

                        if(transferLegBAnswered && transferLegBAnswered.length > 0)
                        {
                            transferCallOriginalCallLeg = transferLegBAnswered[0];
                        }
                        else
                        {
                            transferCallOriginalCallLeg = transferLegB[0];
                        }
                    }

                    var callCategory = primaryLeg.ObjCategory;

                    if(transferCallOriginalCallLeg)
                    {
                        secondaryLeg = transferCallOriginalCallLeg;

                        for(k = 0; k < actualTransferLegs.length; k++)
                        {
                            transferredParties = transferredParties + actualTransferLegs[k].SipToUser + ',';
                        }
                    }
                    else
                    {
                        if(filteredOutb.length > 1)
                        {
                            var filteredOutbAnswered = filteredOutb.filter(function (item2)
                            {
                                return item2.IsAnswered;
                            });

                            if(filteredOutbAnswered && filteredOutbAnswered.length > 0)
                            {
                                secondaryLeg = filteredOutbAnswered[0];
                            }
                        }
                        else
                        {
                            if(filteredOutb && filteredOutb.length > 0)
                            {
                                secondaryLeg = filteredOutb[0];

                                if(callCategory === 'FOLLOW_ME' || callCategory === 'FORWARDING')
                                {
                                    for (k = 0; k < filteredOutb.length; k++) {
                                        transferredParties = transferredParties + filteredOutb[k].SipToUser + ',';
                                    }

                                }


                            }
                        }
                    }

                    if(cdrAppendObj.ObjType === 'FAX_INBOUND')
                    {
                        cdrAppendObj.IsAnswered = primaryLeg.IsAnswered;
                    }





                    //process primary leg first

                    //process common data

                    cdrAppendObj.Uuid = primaryLeg.Uuid;
                    cdrAppendObj.RecordingUuid = primaryLeg.Uuid;
                    cdrAppendObj.CallUuid = primaryLeg.CallUuid;
                    cdrAppendObj.BridgeUuid = primaryLeg.BridgeUuid;
                    cdrAppendObj.SwitchName = primaryLeg.SwitchName;
                    cdrAppendObj.SipFromUser = primaryLeg.SipFromUser;
                    cdrAppendObj.SipToUser = primaryLeg.SipToUser;
                    cdrAppendObj.CallerContext = primaryLeg.CallerContext;
                    cdrAppendObj.HangupCause = primaryLeg.HangupCause;
                    cdrAppendObj.CreatedTime = primaryLeg.CreatedTime;
                    cdrAppendObj.Duration = primaryLeg.Duration;
                    cdrAppendObj.BridgedTime = primaryLeg.BridgedTime;
                    cdrAppendObj.HangupTime = primaryLeg.HangupTime;
                    cdrAppendObj.AppId = primaryLeg.AppId;
                    cdrAppendObj.CompanyId = primaryLeg.CompanyId;
                    cdrAppendObj.TenantId = primaryLeg.TenantId;
                    cdrAppendObj.ExtraData = primaryLeg.ExtraData;
                    cdrAppendObj.IsQueued = primaryLeg.IsQueued;

                    cdrAppendObj.AgentAnswered = primaryLeg.AgentAnswered;

                    if (primaryLeg.DVPCallDirection)
                    {
                        callHangupDirectionA = primaryLeg.HangupDisposition;
                    }

                    cdrAppendObj.IsAnswered = false;


                    cdrAppendObj.BillSec = 0;
                    cdrAppendObj.HoldSec = 0;
                    cdrAppendObj.ProgressSec = 0;
                    cdrAppendObj.FlowBillSec = 0;
                    cdrAppendObj.ProgressMediaSec = 0;
                    cdrAppendObj.WaitSec = 0;

                    if(primaryLeg.ProgressSec)
                    {
                        cdrAppendObj.ProgressSec = primaryLeg.ProgressSec;
                    }

                    if(primaryLeg.FlowBillSec)
                    {
                        cdrAppendObj.FlowBillSec = primaryLeg.FlowBillSec;
                    }

                    if(primaryLeg.ProgressMediaSec)
                    {
                        cdrAppendObj.ProgressMediaSec = primaryLeg.ProgressMediaSec;
                    }

                    if(primaryLeg.WaitSec)
                    {
                        cdrAppendObj.WaitSec = primaryLeg.WaitSec;
                    }


                    cdrAppendObj.DVPCallDirection = primaryLeg.DVPCallDirection;

                    cdrAppendObj.HoldSec = cdrAppendObj.HoldSec +  primaryLeg.HoldSec;

                    /*if (primaryLeg.DVPCallDirection === 'inbound')
                    {
                        cdrAppendObj.HoldSec = primaryLeg.HoldSec;
                    }*/


                    cdrAppendObj.QueueSec = primaryLeg.QueueSec;
                    cdrAppendObj.AgentSkill = primaryLeg.AgentSkill;

                    cdrAppendObj.AnswerSec = primaryLeg.AnswerSec;
                    cdrAppendObj.AnsweredTime = primaryLeg.AnsweredTime;

                    cdrAppendObj.ObjType = primaryLeg.ObjType;
                    cdrAppendObj.ObjCategory = primaryLeg.ObjCategory;


                    //process outbound legs next

                    if(secondaryLeg)
                    {
                        if(cdrAppendObj.DVPCallDirection === 'outbound')
                        {
                            cdrAppendObj.RecordingUuid = secondaryLeg.Uuid;
                        }

                        callHangupDirectionB = secondaryLeg.HangupDisposition;

                        cdrAppendObj.RecievedBy = secondaryLeg.SipToUser;
                        cdrAppendObj.AnswerSec = secondaryLeg.AnswerSec;

                        cdrAppendObj.AnsweredTime = secondaryLeg.AnsweredTime;


                        cdrAppendObj.HoldSec = cdrAppendObj.HoldSec + secondaryLeg.HoldSec;
                        /*if (primaryLeg.DVPCallDirection === 'outbound')
                        {
                            cdrAppendObj.HoldSec = secondaryLeg.HoldSec;
                        }*/

                        cdrAppendObj.BillSec = secondaryLeg.BillSec;

                        if (!cdrAppendObj.ObjType)
                        {
                            cdrAppendObj.ObjType = secondaryLeg.ObjType;
                        }

                        if (!cdrAppendObj.ObjCategory)
                        {
                            cdrAppendObj.ObjCategory = secondaryLeg.ObjCategory;
                        }

                        if (secondaryLeg.BillSec > 0)
                        {
                            outLegAnswered = true;
                        }

                        if(transferredParties)
                        {
                            transferredParties = transferredParties.slice(0, -1);
                            cdrAppendObj.TransferredParties = transferredParties;
                        }
                    }

                    if(transferCallOriginalCallLeg)
                    {
                        cdrAppendObj.SipFromUser = transferCallOriginalCallLeg.SipFromUser;
                    }


                    cdrAppendObj.IvrConnectSec = cdrAppendObj.Duration - cdrAppendObj.QueueSec - cdrAppendObj.HoldSec - cdrAppendObj.BillSec;


                    cdrAppendObj.IsAnswered = outLegAnswered;


                    if (callHangupDirectionA === 'recv_bye')
                    {
                        cdrAppendObj.HangupParty = 'CALLER';
                    }
                    else if (callHangupDirectionB === 'recv_bye')
                    {
                        cdrAppendObj.HangupParty = 'CALLEE';
                    }
                    else
                    {
                        cdrAppendObj.HangupParty = 'SYSTEM';
                    }


                    dbHandler.addProcessedCDR(cdrAppendObj, function(err, addResp)
                    {
                        callback(null, addResp);
                    });


                }
                else
                {
                    callback(null, null);
                }

            })
        }
        else
        {
            callback(null, null);
        }
    })
};

var processSetData = function(setName, cb)
{

    var isSetEmpty = false;
    async.whilst(
        function() { return !isSetEmpty; },
        function(callback) {

            redisHandler.popFromSet(setName, function(err, uuid){

                if(uuid)
                {
                    //continue
                    processSingleCdrLeg(uuid, function(err, resp)
                    {
                        callback(err, isSetEmpty);
                    })
                }
                else
                {
                    isSetEmpty = true;
                    callback(err, isSetEmpty);
                }
            });
        },
        function (err, n) {
            cb(null, true);
        }
    );
};

var job = schedule.scheduleJob(rule, function(){

    //get current time in utc

    var utcMoment = moment().utc();
    //get all sets

    if(doneProcessing)
    {
        doneProcessing = false;
        redisHandler.getKeys('CDRDISCON:*', function(err, keysArr)
        {
            //process keys arr and remove latest two hours

            var arr = [];

            if(keysArr && keysArr.length > 0)
            {
                for(key = 0; key < keysArr.length; key++)
                {
                    //convert key to utc time

                    var keySplitArr = keysArr[key].split(':');

                    if(keySplitArr && keySplitArr.length === 5)
                    {
                        var keyMoment = moment.utc([keySplitArr[1], keySplitArr[2] - 1, keySplitArr[3], keySplitArr[4]]);

                        var hrsDiff = utcMoment.diff(keyMoment, 'hours');

                        if(hrsDiff > 2)
                        {
                            //get redis set values
                            arr.push(processSetData.bind(this, keysArr[key]));

                        }
                    }


                }

                async.parallel(arr, function(err, results)
                {


                    doneProcessing = true;
                    //do processing done for all sets - should resume loop - set ready to process flag
                });


            }
            else
            {
                doneProcessing = true;
            }



        })
    }
});
