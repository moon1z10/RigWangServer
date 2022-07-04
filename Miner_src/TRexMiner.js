const getAlgorithm = require('./MinerUtils');

class TRexMiner {
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        // rig.miner = `T-RexMiner ${minerData.version}`;
        rig.miner_ver = (minerData.version == undefined) ? rig.miner_ver : minerData.version;
        rig.uptime = minerData.uptime; //  seconds
        rig.numOfGpus = this.getNumOfGpus(minerData, rig);
        rig.rigname = this.getRigName(minerData, rig);

        var curHash = 0, powerSum = 0;
        if (rig.miner.indexOf("(D)") < 0) {
            for (var i = 0; i < minerData.gpus.length; i++) {
                const device = minerData.gpus[i];
                var gpuObj = {};
                gpuObj.rig_id = rig.rig_id;
                gpuObj.gpu_id = i;
                gpuObj.hash = (parseInt(device.hashrate) / 1000000).toFixed(2);  //  Convert it to MH/s
                gpuObj.model = device.name;
                gpuObj.accepted_shares = device.shares.accepted_count;
                gpuObj.rejected_shares = device.shares.rejected_count;
                gpuObj.stale_shares = 0;
                gpuObj.invalid_shares = device.shares.invalid_count;
                gpuObj.fan = device.fan_speed;
                gpuObj.power = parseInt(device.power);
                gpuObj.cclock = device.cclock;
                gpuObj.mclock = device.mclock;
                gpuObj.cvddc = 0;
                gpuObj.temp = device.temperature;
                gpuObj.jtemp = (device.memory_temperature == undefined) ? 0 : parseInt(device.memory_temperature); // 정션 온도 확인 데이터 없음
                gpuObj.Tj = 0;
                gpuObj.lastUpdate = curDateTime;
                gpuObj.lhr_tune = (device.lhr_tune == undefined) ? 0 : parseFloat(device.lhr_tune);
    
                curHash += parseFloat(gpuObj.hash);
                powerSum += gpuObj.power;   //  그래픽카드 별 계산 따로 하기
    
                this.gpuArr.push(gpuObj);
            }
        } else if (minerData.dual_stat != undefined) {
            for (var i = 0; i < minerData.gpus.length; i++) {
                const device = minerData.gpus[i], dualDeviceInfo = minerData.dual_stat.gpus[i];
                var gpuObj = {};
                gpuObj.rig_id = rig.rig_id;
                gpuObj.gpu_id = i;
                gpuObj.hash = (parseInt(dualDeviceInfo.hashrate) / 1000000).toFixed(2);  //  Convert it to MH/s
                gpuObj.model = device.name;
                gpuObj.accepted_shares = dualDeviceInfo.shares.accepted_count;
                gpuObj.rejected_shares = dualDeviceInfo.shares.rejected_count;
                gpuObj.stale_shares = 0;
                gpuObj.invalid_shares = dualDeviceInfo.shares.invalid_count;
                gpuObj.fan = device.fan_speed;
                gpuObj.power = parseInt(device.power);
                gpuObj.cclock = device.cclock;
                gpuObj.mclock = device.mclock;
                gpuObj.cvddc = 0;
                gpuObj.temp = device.temperature;
                gpuObj.jtemp = (device.memory_temperature == undefined) ? 0 : parseInt(device.memory_temperature); // 정션 온도 확인 데이터 없음
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
        const algo = this.getAlgo(minerData, rig);
        const defaultAlgo = getAlgorithm(algo);
        rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
    }
    getRigName(minerData, rig) {
        var user = null;
        if (rig.miner.indexOf("(D)") < 0) {
            user = minerData.active_pool.worker;
        } else if (minerData.dual_stat != undefined) {
            user = minerData.dual_stat.active_pool.worker;
        }

        if (user == null || user == undefined) {
            if (rig.rigname == "") return rig.ip;
            else return rig.rigname;
        } else {
            return user;
        }
    }
    getNumOfGpus(minerData, rig) {
        var ret = 0;
        if (rig.miner.indexOf("(D)") < 0) {
            ret = minerData.gpus.length;
        } else if (minerData.dual_stat != undefined) {
            ret = minerData.dual_stat.gpus.length;
        }
        return ret;
    }
    getAlgo(minerData, rig) {
        var ret = rig.algo;
        if (rig.miner.indexOf("(D)") < 0) {
            ret = minerData.algorithm.toString().trim().toLowerCase();
        } else if (minerData.dual_stat != undefined) {
            ret = minerData.dual_stat.algorithm.toString().trim().toLowerCase();
        }
        return ret;
    }
}

module.exports = TRexMiner