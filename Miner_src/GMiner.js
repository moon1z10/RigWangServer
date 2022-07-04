const getAlgorithm = require('./MinerUtils');

class GMiner {
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        if (minerData == undefined) return;

        if (rig.miner.indexOf("(D)") < 0) {
            // rig.miner = (minerData.miner == undefined) ? rig.miner : minerData.miner;
            rig.miner_ver = (minerData.miner == undefined || minerData.miner.toString().split(" ").length < 2) ? rig.miner_ver : minerData.miner.toString().split(" ")[1];
            rig.uptime = (minerData.uptime == undefined) ? 0 : minerData.uptime; //  seconds
            rig.numOfGpus = (minerData.devices == undefined) ? 0 : minerData.devices.length;
            rig.rigname = this.getRigName(minerData.user, rig);

            var curHash = 0, powerSum = 0;
            if (minerData.devices != undefined) {
                for (var i = 0; i < minerData.devices.length; i++) {
                    const device = minerData.devices[i];
                    var gpuObj = {};
                    gpuObj.rig_id = rig.rig_id;
                    gpuObj.gpu_id = i;
                    gpuObj.hash = (parseInt(device.speed) / 1000000).toFixed(2);  //  GMiner returns 'Hash'. Need to convert it to MH/s
                    gpuObj.model = device.name;
                    gpuObj.accepted_shares = device.accepted_shares;
                    gpuObj.rejected_shares = device.rejected_shares;
                    gpuObj.stale_shares = device.stale_shares;
                    gpuObj.invalid_shares = device.invalid_shares;
                    gpuObj.fan = device.fan;
                    gpuObj.power = parseInt(device.power_usage);
                    gpuObj.cclock = device.core_clock;
                    gpuObj.mclock = device.memory_clock;
                    gpuObj.cvddc = 0;
                    gpuObj.temp = device.temperature;
                    gpuObj.jtemp = device.memory_temperature;
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
            if (minerData.algorithm != undefined) {
                var algo = minerData.algorithm.toString().trim().toLowerCase();
                //  Dual Mining Mode
                if (algo.indexOf('+') >= 0) {
                    algo = algo.split('+')[0].trim();
                }
                const defaultAlgo = getAlgorithm(algo);
                rig.algo = (rig.algo == "Default") ? defaultAlgo : ((rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
            }
        } else {
            // rig.miner = (minerData.miner == undefined) ? rig.miner : minerData.miner;
            rig.miner_ver = (minerData.miner == undefined || minerData.miner.toString().split(" ").length < 2) ? rig.miner_ver : minerData.miner.toString().split(" ")[1];
            rig.uptime = (minerData.uptime == undefined) ? 0 : minerData.uptime; //  seconds
            rig.numOfGpus = (minerData.devices == undefined) ? 0 : minerData.devices.length;
            rig.rigname = (rig.rigname == "") ? `(D)${rig.ip}` : rig.rigname;   //  데이터 없음

            var curHash = 0, powerSum = 0;
            if (minerData.devices != undefined) {
                for (var i = 0; i < minerData.devices.length; i++) {
                    const device = minerData.devices[i];
                    var gpuObj = {};
                    gpuObj.rig_id = rig.rig_id;
                    gpuObj.gpu_id = i;
                    gpuObj.hash = (parseInt(device.speed2) / 1000000).toFixed(2);  //  GMiner returns 'Hash'. Need to convert it to MH/s
                    gpuObj.model = device.name;
                    gpuObj.accepted_shares = device.accepted_shares2;
                    gpuObj.rejected_shares = device.rejected_shares2;
                    gpuObj.stale_shares = device.stale_shares2;
                    gpuObj.invalid_shares = device.invalid_shares2;
                    gpuObj.fan = device.fan;
                    gpuObj.power = parseInt(device.power_usage);
                    gpuObj.cclock = device.core_clock;
                    gpuObj.mclock = device.memory_clock;
                    gpuObj.cvddc = 0;
                    gpuObj.temp = device.temperature;
                    gpuObj.jtemp = device.memory_temperature;
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
            if (minerData.algorithm != undefined) {
                var algo = minerData.algorithm.toString().trim().toLowerCase();
                algo = algo.split('+')[1].trim();
                const defaultAlgo = getAlgorithm(algo);
                rig.algo = (rig.algo == "Default") ? defaultAlgo : ((rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
            }
        }
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

module.exports = GMiner