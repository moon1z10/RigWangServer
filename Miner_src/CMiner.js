const getAlgorithm = require('./MinerUtils');

class CMiner {
    //  https://github.com/ComputeLabsLTD/CMiner
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        if (minerData == undefined) return;

        // rig.miner = (minerData.miner == undefined) ? rig.miner : minerData.miner;
        rig.miner_ver = (minerData.ver == undefined) ? rig.miner_ver : minerData.ver;
        rig.uptime = (minerData.uptime == undefined) ? 0 : minerData.uptime; //  seconds
        rig.numOfGpus = (minerData.hs == undefined) ? 0 : minerData.hs.length
        rig.rigname = (rig.rigname == "") ? rig.ip : rig.rigname;

        var curHash = 0, powerSum = 0;
        if (minerData.hs != undefined) {
            for (var i = 0; i < minerData.hs.length; i++) {
                var gpuObj = {};
                gpuObj.rig_id = rig.rig_id;
                gpuObj.gpu_id = i;
                gpuObj.hash = (parseInt(minerData.hs[i]) / 1000).toFixed(2);  //  CMiner returns 'khs'. Need to convert it to MH/s
                gpuObj.model = "";
                gpuObj.accepted_shares = 0;
                gpuObj.rejected_shares = 0;
                gpuObj.stale_shares = 0;
                gpuObj.invalid_shares = 0;
                gpuObj.fan = minerData.fan[i];
                gpuObj.power = 0;
                gpuObj.cclock = 0;
                gpuObj.mclock = 0;
                gpuObj.cvddc = 0;
                gpuObj.temp = minerData.temp[i];
                gpuObj.jtemp = 0;
                gpuObj.Tj = 0;
                gpuObj.lastUpdate = curDateTime;
                gpuObj.lhr_tune = (device.lhr_tune == undefined) ? 0 : parseFloat(device.lhr_tune);
    
                curHash += parseFloat(gpuObj.hash);
                powerSum += gpuObj.power;   //  그래픽카드 별 계산 따로 하기
    
                this.gpuArr.push(gpuObj);
            }
        }

        if (rig.maxHash < curHash) rig.maxHash = curHash;
        rig.curHash = curHash;
        rig.power = powerSum;

        //  Algorithm
        const defaultAlgo = getAlgorithm("eth");
        rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
    }
}

module.exports = CMiner