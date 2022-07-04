/*
 * for the backup
const { json } = require("express");
const getAlgorithm = require('./MinerUtils');

class TeamBlackMiner {
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        if (minerData == undefined) return;

        try {
            //  Parsing data
            minerData = minerData.replace(/}{/gi, '},{');
            var minerDataArr = minerData.split("},{");
            var data = {};
            for (var i = 0; i < minerDataArr.length; i++) {
                if (i != minerDataArr.length - 1) {
                    minerDataArr[i] = minerDataArr[i].concat("}");
                }
                if (i > 0) {
                    minerDataArr[i] = "{" + minerDataArr[i];
                }

                var jsonObj = JSON.parse(minerDataArr[i]);
                if (jsonObj.name != undefined && jsonObj.name === "TBMiner") data.miner = jsonObj;
                else if (jsonObj.url != undefined) data.pool = jsonObj;
                else data.threads = jsonObj;
            }
    
            // rig.miner = (minerData.miner == undefined) ? rig.miner : minerData.miner;
            rig.miner_ver = (data.miner == undefined) ? rig.miner_ver : data.miner.version;
            rig.uptime = (data.miner == undefined) ? 0 : Number(data.miner.uptime_minutes) * 60; //  seconds
            rig.numOfGpus = (data.miner == undefined) ? 0 : Number(data.miner.num_gpu_threads);
            rig.rigname = this.getRigName(data.pool.worker, rig);
            //  Algorithm
            const algo = (data.pool == undefined || data.pool.alg == "zil") ? "ethash" : data.pool.algo.toString().trim().toLowerCase();
            const defaultAlgo = getAlgorithm(algo);
            rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
    
            var curHash = 0, powerSum = 0;
            if (data.threads != undefined && rig.numOfGpus > 0) {
                for (var i = 0; i < rig.numOfGpus; i++) {
                    const device = data.threads["" + i];
                    if (device == undefined) continue;  //  defensive code
                    
                    var gpuObj = {};
                    gpuObj.rig_id = rig.rig_id;
                    gpuObj.gpu_id = i;
                    gpuObj.hash = Number(device.hashrate).toFixed(2);  //  MH/s
                    gpuObj.model = device.board_name;
                    gpuObj.accepted_shares = device.accepted;
                    gpuObj.rejected_shares = device.rejected;
                    gpuObj.stale_shares = device.stale;
                    gpuObj.invalid_shares = device.rejected;
                    gpuObj.fan = device.fan;
                    gpuObj.power = parseInt(device.watt);
                    gpuObj.cclock = device.core_clock;
                    gpuObj.mclock = device.mem_clock;
                    gpuObj.cvddc = 0;
                    gpuObj.temp = device.gpu_temp;
                    gpuObj.jtemp = device.mem_temp;
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
        } catch (e) {
            console.error('TeamBlackMiner parsing error : ' + minerData);
        }
    }
    getRigName(user, rig) {
        if (user == null || user == undefined) {
            if (rig.rigname == "") return rig.ip;
            else return rig.rigname;
        } else {
            return user;
        }
    }
}

module.exports = TeamBlackMiner
*/