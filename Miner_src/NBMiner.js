const getAlgorithm = require('./MinerUtils');

class NBMiner {
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        // rig.miner = `NBMiner ${minerData.version}`;
        rig.miner_ver = (minerData.version == undefined) ? rig.miner_ver : minerData.version;
        rig.uptime = parseInt((Date.now() - minerData.start_time*1000)/1000); //  seconds
        rig.numOfGpus = minerData.miner.devices.length;
        rig.rigname = this.getRigName(minerData.stratum.user, rig);

        var curHash = 0, powerSum = 0;
        for (var i = 0; i < minerData.miner.devices.length; i++) {
            const device = minerData.miner.devices[i];
            var gpuObj = {};
            gpuObj.rig_id = rig.rig_id;
            gpuObj.gpu_id = i;
            gpuObj.hash = (parseInt(device.hashrate_raw) / 1000000).toFixed(2);  //  Convert it to MH/s
            gpuObj.model = this.getDeviceInfo(device.info);
            gpuObj.accepted_shares = device.accepted_shares;
            gpuObj.rejected_shares = device.rejected_shares;
            gpuObj.stale_shares = 0;
            gpuObj.invalid_shares = device.rejected_shares;
            gpuObj.fan = device.fan;
            gpuObj.power = parseInt(device.power);
            gpuObj.cclock = device.core_clock;
            gpuObj.mclock = device.mem_clock;
            gpuObj.cvddc = 0;
            gpuObj.temp = device.temperature;
            gpuObj.jtemp = (device.memTemperature < 0) ? 0 : device.memTemperature;
            gpuObj.Tj = 0;
            gpuObj.lastUpdate = curDateTime;
            gpuObj.lhr_tune = (device.lhr_tune == undefined) ? 0 : parseFloat(device.lhr_tune);

            curHash += parseFloat(gpuObj.hash);
            powerSum += gpuObj.power;   //  그래픽카드 별 계산 따로 하기

            this.gpuArr.push(gpuObj);
        }

        if (rig.maxHash < curHash) rig.maxHash = curHash;
        rig.curHash = curHash;
        rig.power = powerSum;

        //  Algorithm
        const algo = minerData.stratum.algorithm.toString().trim().toLowerCase();
        const defaultAlgo = getAlgorithm(algo);
        rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
    }
    getDeviceInfo(info) {
        var deviceModelName = info.toString();
        deviceModelName = deviceModelName.replace("NVIDIA GeForce ", "");
        deviceModelName = deviceModelName.replace("AMD Radeon ", "");
        return deviceModelName;
    }
    getRigName(user, rig) {
        if (user == null || user == undefined || user.toString().indexOf(".") < 0) {
            //  worker 파싱 실패
            if (rig.rigname == "") return rig.ip;
            else return rig.rigname;
        } else {
            return user.toString().split(".")[1].trim();
        }
    }
}

module.exports = NBMiner