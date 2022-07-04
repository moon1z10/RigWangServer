const getAlgorithm = require('./MinerUtils');

class PhoenixMiner {
    constructor(rig, minerData, curDateTime) {
        this.gpuArr = [];
        this.update(rig, minerData, curDateTime);
    }
    update(rig, minerData, curDateTime) {
        const arr = minerData.split('\n');
        var searchDone = 0x000, curHash = 0, powerSum = 0;

        //  1. Gpu가 몇 개인지 찾기
        for (var i = 0; i < arr.length; i++) {
            const searchStr = 'Available GPUs for mining:';   //  for getting gpu model name, index no, gpu count
            if (arr[i].indexOf(searchStr) < 0) continue;

            const BEFORE_SEARCHING = 0, SEARCHING = 1, DONE_SEARCHING = 2;
            var _status = BEFORE_SEARCHING;
            i++;

            var row;
            while (arr[i] != undefined) {
                row = arr[i].replace('<font color="#55FF55">', '').replace('<font color=\"#55FF55\">', '')
                    .replace('<font color="#FF55FF">', '').replace('<font color=\"#FF55FF\">', '')
                    .replace('</font>', '').replace('<br>', '')
                    .trim();
                const gpuNo = row.split(":")[0];
                //  Validation
                if (gpuNo == undefined || gpuNo == null || gpuNo.indexOf('GPU') < 0) break;

                if (gpuNo == "GPU1") {
                    if (_status == BEFORE_SEARCHING) {
                        _status = SEARCHING;
                    } else if (_status == SEARCHING) {
                        _status = DONE_SEARCHING;
                    }
                }

                const deviceIdx = parseInt(gpuNo.replace('GPU', '').trim()) - 1;
                if (_status == SEARCHING) {
                    const model = row.split(":")[1].split("(pcie")[0].trim();
                    //  Create GPU object
                    this.gpuArr.push({
                        'rig_id': rig.rig_id,
                        'gpu_id': deviceIdx,
                        'hash': 0,
                        'model': this.getDeviceInfo(model),
                        'accepted_shares': 0,
                        'rejected_shares': 0,
                        'stale_shares': 0,
                        'invalid_shares': 0,
                        'fan': 0,
                        'power': 0,
                        'cclock': 0,
                        'mclock': 0,
                        'cvddc': 0,
                        'temp': 0,
                        'jtemp': 0,
                        'Tj': 0,
                        'lastUpdate': curDateTime,
                        'lhr_tune': 0
                    });
                } else if (_status == DONE_SEARCHING) {
                    if (row.indexOf('%') >= 0) {
                        //  GPU1: 46C 85% 240W, GPU2: 36C 85% 237W, GPU3: 38C 85% 229W
                        const d = row.split(",");
                        for (var k = 0; k < d.length; k++) {
                            if (this.gpuArr[k] == undefined) { continue; }
                            const gpuData = d[k].split(' ');
                            for (var l = 0; l < gpuData.length; l++) {
                                if (gpuData[l].trim().indexOf('C') > 0)         {   this.gpuArr[k].temp  = parseInt(gpuData[l].replace('C', '')); }
                                else if (gpuData[l].trim().indexOf('%') > 0)    {   this.gpuArr[k].fan   = parseInt(gpuData[l].replace('%', '')); }
                                else if (gpuData[l].trim().indexOf('W') > 0)    {   
                                    this.gpuArr[k].power = parseInt(gpuData[l].replace('W', ''));
                                    powerSum = parseInt(parseInt(powerSum) + parseInt(this.gpuArr[k].power));    //  TODO : 파워 계산법 적용 필요
                                }
                            }
                        }
                    } else {
                        //  GPU1: cclock 1200 MHz, cvddc 775 mV, mclock 10501 MHz, Tj 61C, Tmem 92C, p-state P2, pcap power, 418 kH/J
                        const d = row.replace(`${gpuNo}:`, '').trim().split(",");
                        if (d == undefined) continue;
                        for (var k = 0; k < d.length; k++) {
                            const gpuData = d[k].trim().split(' ');
                            if (gpuNo[0] == undefined) continue;
                            if (gpuData[0].trim().indexOf('cclock') >= 0)       {   this.gpuArr[deviceIdx].cclock    = parseInt(gpuData[1]); }
                            else if (gpuData[0].trim().indexOf('cvddc') >= 0)   {   this.gpuArr[deviceIdx].cvddc     = parseInt(gpuData[1]); }
                            else if (gpuData[0].trim().indexOf('mclock') >= 0)  {   this.gpuArr[deviceIdx].mclock    = parseInt(gpuData[1]); }
                            else if (gpuData[0].trim().indexOf('Tj') >= 0)      {   this.gpuArr[deviceIdx].Tj        = parseInt(gpuData[1].replace('C', '')); }
                            else if (gpuData[0].trim().indexOf('Tmem') >= 0)    {   this.gpuArr[deviceIdx].jtemp     = parseInt(gpuData[1].replace('C', '')); }
                        }
                    }
                }

                i++;

                //  Finished to search
                if (arr[i] != undefined && (arr[i].indexOf('GPUs') >= 0 || arr[i].indexOf('Current') >= 0)) {
                    searchDone |= 0x001;
                    break;
                }
            }

            //  검색 완료. 루프 종료.
            if (searchDone == 0x001) break;
        }
        
        //  2. 조회
        for (var i = 0; i < arr.length; i++) {
            if (this.gpuArr.length == 0) break;
            if ((searchDone & 0x010) == 0x010 && (searchDone & 0x100) == 0x100) break;  //  Searching done

            const searchStr = 'Eth speed', searchStr2 = '***';
            if ((searchDone & 0x010) == 0x000 && arr[i].indexOf(searchStr) >= 0) {
                //  <font color="#55FFFF">Eth speed: 300.269 MH/s, shares: 36/0/0, time: 0:08</font><br>
                //  <font color="#55FFFF">GPUs: 1: 100.226 MH/s (12) 2: 100.070 MH/s (10) 3: 100.063 MH/s (15)</font><br>
                row = arr[i].replace(`${searchStr}:`, '').replace('<font color="#55FFFF">', '').replace('<font color=\"#55FFFF\">', '').replace('</font>', '').replace('<br>', '').trim();
                if (this.gpuArr.length == 1) {
                    //  만약 GPU가 1개인 경우, GPUs 행 데이터가 없다.
                    const item = row.split(',');
                    const hash = parseFloat(item[0].trim().split(' ')[0].trim());
                    const shares = item[1].trim().split(' ')[1].split('/');
                    const accepted_shares = (shares[0] == undefined) ? 0 : parseInt(shares[0]);
                    const stale_shares = (shares[1] == undefined) ? 0 : parseInt(shares[1]);
                    const invalid_shares = (shares[2] == undefined) ? 0 : parseInt(shares[2]);
                    
                    this.gpuArr[0].hash = hash;
                    this.gpuArr[0].accepted_shares = accepted_shares;
                    this.gpuArr[0].stale_shares = stale_shares;
                    this.gpuArr[0].rejected_shares = invalid_shares;
                    this.gpuArr[0].invalid_shares = invalid_shares;
                        curHash = parseFloat(hash).toFixed(2);
                } else if (arr[i+1] != undefined && arr[i+1].indexOf('GPUs: ') >= 0) {
                    row = arr[i+1].replace('GPUs: ', '').replace('<font color="#55FFFF">', '').replace('<font color=\"#55FFFF\">', '').replace('</font>', '').replace(/<br>/gi, '').replace('</br>', '').trim();
                    const d = row.split(')');
                    for (var k = 0; k < d.length; k++) {
                        const item = d[k].trim().split(' ');
                        if (item.length < 4) continue;
                        const hash = parseFloat(item[1]).toFixed(2);
                        const shares = item[3].substring(1, item[3].length).split('/');
                        const accepted_shares = (shares[0] == undefined) ? 0 : parseInt(shares[0]);
                        const stale_shares = 0;//(shares[1] == undefined) ? 0 : parseInt(shares[1]);
                        const invalid_shares = (shares[1] == undefined) ? 0 : parseInt(shares[1]);

                        this.gpuArr[k].hash = hash;
                        this.gpuArr[k].accepted_shares = accepted_shares;
                        this.gpuArr[k].stale_shares = stale_shares;
                        this.gpuArr[k].rejected_shares = invalid_shares;
                        this.gpuArr[k].invalid_shares = invalid_shares;

                        curHash = parseFloat(parseFloat(curHash) + parseFloat(hash)).toFixed(2);
                    }
                }

                //  검색 완료. 루프 종료.
                searchDone |= 0x010;
            } else if ((searchDone & 0x100) == 0x000 && arr[i].indexOf(searchStr2) >= 0) {
                row = arr[i].replace('<font color="#FFFFFF">', '').replace('<font color=\"#FFFFFF\">', '').replace('</font>', '').replace('<br>', '').trim();
                const splitted = row.split(searchStr2);
                if (splitted[1] != undefined) {
                    const time = splitted[1].trim().split(':');
                    const hour = parseInt(time[0]) * 3600, minute = parseInt(time[1]) * 60;
                    const uptime = hour + minute;
                    rig.uptime = uptime; //  seconds
                    searchDone |= 0x100;
                }
            }
        }

        if (searchDone != 0x111) {
            this.searchFailed = true;
            return;
        } else {
            this.searchFailed = false;
            rig.numOfGpus = this.gpuArr.length;
            if (rig.maxHash < curHash) rig.maxHash = parseFloat(curHash).toFixed(2);
            rig.curHash = parseFloat(curHash).toFixed(2);
            rig.power = powerSum;
            rig.rigname = (rig.rigname == "") ? rig.ip : rig.rigname;

            //  Algorithm
            const defaultAlgo = getAlgorithm("eth");
            rig.algo = (rig.algo == "Default") ? defaultAlgo : ( (rig.algo != defaultAlgo) ? rig.algo : defaultAlgo);
        }
    }
    getDeviceInfo(info) {
        var deviceModelName = info.toString();
        deviceModelName = deviceModelName.replace("NVIDIA GeForce ", "");
        deviceModelName = deviceModelName.replace("AMD Radeon ", "");
        return deviceModelName;
    }
}

module.exports = PhoenixMiner