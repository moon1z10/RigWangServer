const getAlgorithm = require('./MinerUtils');

class lolMiner {
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        rig.miner_ver = (minerData.Software == undefined || minerData.Software.toString().split(" ").length < 2) ? rig.miner_ver : minerData.Software.toString().split(" ")[1];
        if (rig.miner_ver < "1.43") {
            this.updateLegacy(rig, minerData, curDateTime);
            return;
        }

        rig.uptime = minerData.Session.Uptime; //  seconds
        rig.numOfGpus = minerData.Num_Workers;
        rig.rigname = (rig.rigname == "") ? ((rig.miner.indexOf("(D)") < 0) ? rig.ip : `(D)${rig.ip}`) : rig.rigname;

        var curHash = 0, powerSum = 0;
        var algoData;
        if (rig.miner.indexOf("(D)") < 0) {
            algoData = minerData.Algorithms[0];
        } else if (minerData.Num_Algorithms != undefined && minerData.Num_Algorithms >= 2) {
            algoData = minerData.Algorithms[1];
        }

        for (var i = 0; i < minerData.Num_Workers; i++) {
            var gpuObj = {};
            gpuObj.rig_id = rig.rig_id;
            gpuObj.gpu_id = i;
            gpuObj.hash = algoData.Worker_Performance[i];  //  MH/s
            gpuObj.accepted_shares = algoData.Worker_Accepted[i];
            gpuObj.rejected_shares = algoData.Worker_Rejected[i];
            gpuObj.stale_shares = algoData.Worker_Stales[i];
            gpuObj.invalid_shares = algoData.Worker_Errors[i];

            gpuObj.model = minerData.Workers[i].Name;
            gpuObj.fan = minerData.Workers[i].Fan_Speed;
            gpuObj.power = parseInt(minerData.Workers[i].Power);
            gpuObj.cclock = minerData.Workers[i].CCLK;
            gpuObj.mclock = minerData.Workers[i].MCLK;
            gpuObj.cvddc = 0;
            gpuObj.temp = minerData.Workers[i].Core_Temp;
            gpuObj.jtemp = minerData.Workers[i].Juc_Temp;
            gpuObj.Tj = minerData.Workers[i].Mem_Temp;
            gpuObj.lastUpdate = curDateTime;
            gpuObj.lhr_tune = 0;

            curHash += parseFloat(gpuObj.hash);
            powerSum += gpuObj.power;   //  그래픽카드 별 계산 따로 하기

            this.gpuArr.push(gpuObj);
        }

        if (rig.maxHash < curHash) rig.maxHash = curHash;
        rig.curHash = curHash;
        rig.power = powerSum;

        //  Algorithm
        const defaultAlgo = getAlgorithm(algoData.Algorithm.toString().toLowerCase());
        rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
    }
    
    updateLegacy(rig, minerData, curDateTime) {
        rig.miner_ver = (minerData.Software == undefined || minerData.Software.toString().split(" ").length < 2) ? rig.miner_ver : minerData.Software.toString().split(" ")[1];
        rig.uptime = minerData.Session.Uptime; //  seconds
        rig.numOfGpus = minerData.GPUs.length;
        rig.rigname = (rig.rigname == "") ? rig.ip : rig.rigname;

        var curHash = 0, powerSum = 0;
        for (var i = 0; i < minerData.GPUs.length; i++) {
            const device = minerData.GPUs[i];
            var gpuObj = {};
            gpuObj.rig_id = rig.rig_id;
            gpuObj.gpu_id = i;
            gpuObj.hash = (device.Performance).toFixed(2);  //  Convert it to MH/s
            gpuObj.model = this.getDeviceInfo(device.Name);
            gpuObj.accepted_shares = device.Session_Accepted;
            gpuObj.rejected_shares = device.Session_HWErr;
            gpuObj.stale_shares = device.Session_Stale;
            gpuObj.invalid_shares = device.Session_HWErr;
            gpuObj.fan = device["Fan Speed (%)"];
            gpuObj.power = parseInt(device["Consumption (W)"]);
            gpuObj.cclock = 0;
            gpuObj.mclock = 0;
            gpuObj.cvddc = 0;
            gpuObj.temp = device["Temp (deg C)"];
            gpuObj.jtemp = device["Mem Temp (deg C)"]; // 정션 온도 확인 데이터 없음
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
        const algo = minerData.Mining.Algorithm.toString().trim().toLowerCase();
        const defaultAlgo = getAlgorithm(algo);
        rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
    }

    getDeviceInfo(info) {
        var deviceModelName = info.toString();
        deviceModelName = deviceModelName.replace("NVIDIA GeForce ", "");
        deviceModelName = deviceModelName.replace("Radeon ", "");
        return deviceModelName;
    }
}

module.exports = lolMiner