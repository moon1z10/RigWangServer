var net = require('net');

//  TeamRed마이너의 경우, 알고리즘 정보 X
class TeamRedMiner {
    constructor(rig, port, curDateTime = null) {
        this.ip = rig.ip;
        this.port = port;
        this.gpuArr = [];
        this.d = {
            "id": 0,
            "jsonrpc": "2.0",
            "command": "summary+devs"
        };
        this.curDateTime = curDateTime;
    }
    ping = (ip = this.ip, port = this.port, d = this.d) => new Promise((resolve, reject) => {
        var socket = new net.Socket();
        socket.connect({ host: ip, port: port }, function () {
            // console.log('서버 연결 성공');
            socket.write(JSON.stringify(d), function (error) {
                if (error) console.error(error);
            });
        });
        socket.on('data', function (chunk) {
            // console.log('서버 데이터 받기 성공');
            socket.end();
        });
        socket.on('end', function () {
            // console.log('서버 연결 종료');
            resolve();
        });
        socket.on('error', function (err) {
            // console.log("소켓 Error: "+err.message);
            reject(err);
        });
    });
    update = (rig, ip = this.ip, port = this.port, d = this.d, curDateTime = this.curDateTime, gpuArr = this.gpuArr) => new Promise((resolve, reject) => {
        var socket = new net.Socket();
        socket.connect({ host: ip, port: port }, function () {
            socket.write(JSON.stringify(d), function (error) {
                if (error) console.error(error);
            });
        });
        socket.on('data', function (chunk) {
            const data = chunk.toString();
            console.log(`TeamRedMiner(${ip}:${port}) data : ${data}`);
            try {
                var minerData = JSON.parse(data);
                const summary = minerData.summary;
                const devs = minerData.devs;


                rig.miner_ver = (summary.STATUS == undefined || summary.STATUS[0].Description == undefined || summary.STATUS[0].Description.toString().trim().split(" ").length < 2) ? rig.miner_ver : summary.STATUS[0].Description.toString().trim().split(" ")[1];
                rig.uptime = (summary.SUMMARY == undefined || summary.SUMMARY[0] == undefined || summary.SUMMARY[0].Elapsed == undefined) ? 0 : summary.SUMMARY[0].Elapsed; //  seconds
                rig.numOfGpus = (devs.DEVS == undefined) ? 0 : devs.DEVS.length;
                rig.rigname = (rig.rigname == "") ? rig.ip : rig.rigname;

                var curHash = 0, powerSum = 0;
                if (devs.DEVS != undefined) {
                    for (var i = 0; i < devs.DEVS.length; i++) {
                        const device = devs.DEVS[i];
                        var gpuObj = {};
                        gpuObj.rig_id = rig.rig_id;
                        gpuObj.gpu_id = i;
                        gpuObj.hash = (device["MHS 30s"]).toFixed(2);
                        gpuObj.model = `GPU${device.GPU}`;
                        gpuObj.accepted_shares = device.Accepted;
                        gpuObj.rejected_shares = device.Rejected;
                        gpuObj.stale_shares = 0;
                        gpuObj.invalid_shares = device.Rejected;
                        gpuObj.fan = device["Fan Percent"];
                        gpuObj.power = parseInt(device["GPU Power"]);
                        gpuObj.cclock = device["GPU Clock"];
                        gpuObj.mclock = device["Memory Clock"];
                        gpuObj.cvddc = 0;
                        gpuObj.temp = device.Temperature;
                        gpuObj.jtemp = device["TemperatureJnct"];
                        gpuObj.Tj = 0;
                        gpuObj.lastUpdate = curDateTime;
                        gpuObj.lhr_tune = (device.lhr_tune == undefined) ? 0 : parseFloat(device.lhr_tune);

                        curHash += parseFloat(gpuObj.hash);
                        powerSum += gpuObj.power;   //  그래픽카드 별 계산 따로 하기

                        gpuArr.push(gpuObj);
                    }
                }

                if (rig.maxHash < curHash) rig.maxHash = curHash;
                rig.curHash = curHash;
                rig.power = powerSum;

                //  Algorithm
                const defaultAlgo = getAlgorithm("eth");
                rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
            } catch (e) {
                console.error('TeamRedMiner parsing error : ' + data);
                reject(e);
            } finally {
                socket.end();
            }
        });
        socket.on('end', function () {
            // console.log('서버 연결 종료');
            resolve();
        });
        socket.on('error', function (err) {
            // console.log("Error: "+err.message);
            reject(err);
        });
    });
}

module.exports = TeamRedMiner