const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const axios = require("axios");
const cliProgress = require('cli-progress');
const admin = require("firebase-admin");    //  Firebase Cloud Message
const logger = require('./winston');
const requestIp = require('request-ip');
const fs = require('fs');

//  TODO 마이너 추가시 수정 필요
const GMiner = require('./Miner_src/GMiner');
const PhoenixMiner = require('./Miner_src/PhoenixMiner');
const NBMiner = require('./Miner_src/NBMiner');
const TRexMiner = require('./Miner_src/TRexMiner');
const lolMiner = require('./Miner_src/lolMiner');
const TeamRedMiner = require('./Miner_src/TeamRedMiner');
const TeamBlackMiner = require('./Miner_src/TeamBlackMiner');
const CMiner = require('./Miner_src/CMiner');

const moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");

////////////////////////////////////////////////////////////////////
////////////////////////////// CONSTANT ////////////////////////////
////////////////////////////////////////////////////////////////////
const VERSION = "2.5.1";
var TELEGRAM_ENABLED = false;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const db = new sqlite3.Database('rig.db');

// create a new progress bar instance and use shades_classic theme
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

var HASH_DROP_THRESHOLD = 95; //  해시 드롭률 체크 %
var SENDING_MESSAGE_INTERVAL = 5; //  5분
var MONITORING_INTERVAL = 60000;

////////////////////////////////////////////////////////////////////
//////////////////////////// VARIABLES /////////////////////////////
////////////////////////////////////////////////////////////////////
//  TODO 마이너 추가시 수정 필요
var PORT_PHOENIX = '3333', PORT_GMINER = '3333', PORT_NBMINER = '22333', PORT_TREXMINER = '4067', PORT_LOLMINER = '4444', PORT_TEAMREDMINER = '4028', PORT_TEAMBLACKMINER = '4068', PORT_CMINER = '7500';
var PORT_TEAMREDMINER_DUAL = '4029';
var serverConfigOptions;

var rigList;
var rigSearchCnt = 0;   //  IP순회하며 마이너 찾기 시도 회수 > 프로그레스바를 위한 변수

var deviceToken = "";
var lastSendMessageTime = {};
var blackListArr = [];

////////////////////////////////////////////////////////////////////
////////////////////////////// ROUTER //////////////////////////////
////////////////////////////////////////////////////////////////////
const express = require('express');
const app = express();

//  헤더 검출 및 검사
const validateRequest = function (req, res, next) {
    const clientIp = requestIp.getClientIp(req);
    if (Array.isArray(blackListArr) && blackListArr.indexOf(clientIp) >= 0) {
        logger.error(`(${clientIp}) tried to acess but RigWang blocked it since it's in the 'Black List'. >> ${req.header('User-Agent')}`);
        return;
    }

    if (req.path == "/") {
        res.status(200).send(VERSION);
    }
    else if (req.path == "/favicon.ico") {}
    else {
        next();
    }
};

app.use(express.json());
app.use(validateRequest);

//  텔레그램 챗 봇 동기화
app.get('/sync', (req, res) => res.status(200));

//  채굴장 데이터 가져오기
app.get('/rigs', (req, res) => {
    selectAllData().then((data) => {
        var ret = {
            'name': serverConfigOptions.server_name,
            'status': '',
            'list': []
        };
        var current_rig_id;
        var aliveCnt = 0, stopCnt = 0;
        for (var i = 0; i < data.length; i++) {
            if (current_rig_id != data[i].rig_id) {
                current_rig_id = data[i].rig_id;
                ret.list.push({
                    "rigId": data[i].rig_id,
                    "ip": data[i].ip,
                    "name": data[i].rigname,
                    "algo": data[i].algo,
                    "miner": `${data[i].miner} ${data[i].miner_ver}`.trim(),
                    "maxHash": data[i].maxHash,
                    "curHash": data[i].curHash,
                    "status": data[i].status,
                    "power": data[i].power,
                    "numOfGpus": data[i].numOfGpus,
                    "uptime": data[i].uptime,
                    "rigLastUpdate": data[i].lastUpdate,
                    "gpu": []
                });
                if (data[i].status == 'alive') aliveCnt++; else stopCnt++;
            }

            if (data[i].gpu_id != null) {
                ret.list[ret.list.length - 1].gpu.push({
                    "gpuId": data[i].gpu_id,
                    "hash": data[i].hash,
                    "model": data[i].model,
                    "fan": (Number(data[i].fan) > 100 ? 100 : data[i].fan),
                    "gpuPower": data[i].gpuPower,
                    "cclock": data[i].cclock,
                    "mclock": data[i].mclock,
                    "cvddc": data[i].cvddc,
                    "temp": data[i].temp,
                    "jtemp": data[i].jtemp,
                    "Tj": data[i].Tj,
                    "acceptedShares": data[i].accepted_shares,
                    "staleShares": data[i].stale_shares,
                    "rejectedShares": data[i].rejected_shares,
                    "invalidShares": data[i].invalid_shares,
                    "gpuLastUpdate": data[i].gpuLastUpdate,
                    "lhr": data[i].lhr_tune
                });
            }
        }

        //  채굴기 정렬
        ret.list.sort(function (a, b) {
            return (a.name > b.name) ? 1 : (a.name < b.name) ? -1 : 0;
        });
        //  채굴기 내 GPU 정렬
        for (var j = 0; j < ret.list.length; j++) {
            ret.list[j].gpu.sort(function (a, b) {
                return (a.gpuId > b.gpuId) ? 1 : (a.gpuId < b.gpuId) ? -1 : 0;
            });
        }
        ret.status = `${aliveCnt} / ${stopCnt}`;
        res.send(JSON.stringify(ret));
    });
});

//  채굴기 추가
app.get('/add/rig', (req, res) => {
    const callFunc = async function () {
        res.status(200).send('Searching. Wait for some minutes.');
        rigList.length = 0;
        await getRigList(false);
    };
    callFunc();
});

//  채굴기 강제 추가
app.get('/addForce/rig/:minerTxt/:ip/:port', (req, res) => {
    const minerTxt = req.params.minerTxt, ip = req.params.ip, port = parseInt(req.params.port);
    ping(minerTxt, ip, port);
    setTimeout(() => logger.info('Add the rig by the user - Wait for 10 seconds'), 10000);
    res.status(200).send('Searching. Wait for some minutes.');
    rigList.length = 0;
    getRigList(false);
});

//  채굴기 모니터링 옵션 조회
app.get('/monitoringOptions', (req, res) => {
    selectMonitoringOptions().then((rows) => {
        res.send(JSON.stringify({
            'list': rows
        }));
    });
});

//  채굴장 삭제
app.delete('/rigs', (req, res) => {
    let sql = `DELETE FROM RIG `, sql2 = `DELETE FROM GPU`;
    var ret = '';
    db.run(sql, (err) => {
        if (err) {
            ret += err.message + '\n'
        } else {
            db.run(sql2, (err) => {
                if (err) {
                    ret += err.message + '\n'
                } else {
                    if (ret.trim().length == 0) {
                        getRigs();
                        res.sendStatus(200);
                    } else {
                        res.sendStatus(500);
                        logger.error(`Error - delete rig data : ${ret}`);
                    }
                }
            })
        }
    });   
});

//  채굴기 삭제(rig_id)
app.delete('/rig/:rig_id', (req, res) => {
    let sql = `DELETE FROM RIG WHERE rig_id = ?`, sql2 = `DELETE FROM GPU WHERE rig_id = ?`;
    var ret = '';
    db.run(sql, [parseInt(req.params.rig_id)], (err) => {
        if (err) {
            ret += err.message + '\n'
        } else {
            db.run(sql2, [parseInt(req.params.rig_id)], (err) => {
                if (err) {
                    ret += err.message + '\n'
                } else {
                    if (ret.trim().length == 0) {
                        res.sendStatus(200);
                        getRigs();
                    } else {
                        res.sendStatus(500);
                        logger.error(`Error - delete rig data : ${ret}`);
                    }
                }
            })
        }
    });
});

//  리그왕 서버 이름 변경
app.patch('/config/serverName/:name', (req, res) => {
    let sql = `UPDATE CONFIG SET value = ? WHERE option = 'serverName'`;
    db.run(sql, [`${req.params.name.toString()}`], (err) => { 
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            serverConfigOptions.server_name = req.params.name.toString();
            res.sendStatus(200);
            getRigs();
        }
    });
});

//  채굴기 이름 변경
app.patch('/rig/:rig_id/rigName/:name', (req, res) => {
    let sql = `UPDATE RIG SET rigname = ? WHERE rig_id = ?`;
    // logger.info(`app.patch('/rig/:rig_id/rigName/:name) : ${sql}`);
    db.run(sql, [`${req.params.name.toString()}`, `${req.params.rig_id}`], (err) => { 
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
            getRigs();
        }
    });
});

//  채굴기 MAX HASH 리셋
app.patch('/rig/:rig_id/maxHash', (req, res) => {
    const rig_id = parseInt(req.params.rig_id);
    let sql = `UPDATE RIG SET maxHash = (SELECT curHash FROM RIG WHERE rig_id = ?) WHERE rig_id = ?`;
    db.run(sql, [rig_id, rig_id], (err) => { 
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            rigList.forEach(rig => {
                if (rig.rig_id == rig_id) {
                    rig.maxHash = rig.curHash;
                }
            });        
            res.sendStatus(200);
        }
    });
});

//  채굴기 알고리즘 변경
app.patch('/rig/:rig_id/algo/:algo', (req, res) => {
    let sql = `UPDATE RIG SET algo = ? WHERE rig_id = ?`;
    // logger.info(`app.patch('/rig/:rig_id/rigName/:name) : ${sql}`);
    db.run(sql, [`${req.params.algo.toString()}`, req.params.rig_id], (err) => { 
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
            getRigs();
        }
    });
});

//  옵션 설정 변경
app.patch('/rig/options', (req, res) => {
    const values = req.body.list;
    if (values == undefined || values == null) {
        res.sendStatus(500);
        return;
    }

    for(var i = 0; i < values.length; i++) {
        //  옵션 변경 값 유효성 검사
        var option = values[i].option, value = values[i].value;
        if ((option != 'monitoringInterval' && option != 'hashDropThreshold' && option != 'sendingMessageInterval') ||
            (option == 'monitoringInterval' && parseInt(value) < 60000) ||
            (option == 'hashDropThreshold' && parseInt(value) > 95) ||
            (option == 'sendingMessageInterval' && parseInt(value) < 5))
        {
            res.sendStatus(403);
            return;
        }
        
        let sql = `UPDATE CONFIG SET value = ? WHERE option = ?`;
        // logger.info("app.patch('/rig/options/ sql : \n" + sql);
        db.run(sql, [`${value}`, `${option}`], (err) => { 
            if (err) {
                logger.error(`${err.message}\nSQL : ${sql}`);
                res.sendStatus(500);
            } else {
                if (option == 'monitoringInterval') MONITORING_INTERVAL = value;
                else if (option == 'hashDropThreshold') HASH_DROP_THRESHOLD = value;
                else if (option == 'sendingMessageInterval') SENDING_MESSAGE_INTERVAL = value;
            }
        });
    }
    res.sendStatus(200);
});

//  디바이스 토큰 저장 - 푸쉬 메시지 발송
app.put('/token', (req, res) => {
    // logger.debug(`app.put > token : ${JSON.stringify(req.body)}`);
    // let sql = `UPDATE CONFIG SET value = '${req.body.token}' WHERE option = 'deviceToken'`;
    let sql = `UPDATE CONFIG SET value = ? WHERE option = 'deviceToken'`;
    db.run(sql, [`${req.body.token}`], (err) => { 
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

//  차트 데이터 관련
//  채굴 서버의 채굴기 목록 가져오기
app.get('/chart/rigList', (req, res) => {
    let sql = 'SELECT rig_id, rigname FROM RIG';
    db.all(sql, (err, rows) => {
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            res.send(rows);
        }
    })
});
//  차트 데이터 가져오기
app.get('/chartData/:rig_id/:hash/:power/:temp/:shares', (req, res) => {
    var sql = `
    SELECT 
        strftime('%s', lastUpdate) as lastUpdate
        ${(req.params.rig_id == 'All') ? '' : ', rig_id'}
        ${(req.params.hash == 'check') ? ', printf("%.2f", SUM(hash)) AS hash' : ''}
        ${(req.params.power == 'check') ? ', SUM(power) AS power' : ''}
        ${(req.params.temp == 'check') ? ', printf("%.0f", AVG(temp)) AS temp' : ''}
        ${(req.params.temp == 'check') ? ', printf("%.0f", AVG(jtemp)) AS jtemp' : ''}
        ${(req.params.temp == 'check') ? ', printf("%.0f", AVG(fan)) AS fan' : ''}
        ${(req.params.shares == 'check') ? ', SUM(accepted_shares) AS accepted_shares' : ''}
        ${(req.params.shares == 'check') ? ', SUM(stale_shares) AS stale_shares' : ''}
        ${(req.params.shares == 'check') ? ', SUM(invalid_shares) AS invalid_shares' : ''}
    FROM GPU
    WHERE 1=1 AND lastUpdate > datetime('now', 'localtime', '-1 day')
        ${(req.params.rig_id == 'All') ? '' : 'AND rig_id='+req.params.rig_id}
    GROUP BY lastUpdate
        ${(req.params.rig_id == 'All') ? '' : ', rig_id'}
    ORDER BY lastUpdate
        ${(req.params.rig_id == 'All') ? '' : ', rig_id'}
    `;

    db.all(sql, (err, rows) => { 
        if (err) {
            logger.error(`${err.message}\nSQL : ${sql}`);
            res.sendStatus(500);
        } else {
            res.send(rows);
        }
    });
});

////////////////////////////////////////////////////////////////////
////////////////////////// Port Number /////////////////////////////
////////////////////////////////////////////////////////////////////
var PORT = 3000;
var reader = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

reader.question("Input the server port number(default 3000) : ", answer => {
    if (answer.trim().length == 0) {
        PORT = 3000;
    } else if (isNaN(parseInt(answer))) {
        console.log(`You inputted ${answer}. The port number must be number. We will use the default(3000) port number instead.`);
    } else {
        PORT = parseInt(answer);
    }
    answered = 'YES';
    reader.close();

    //  Main function 호출
    main();
});

////////////////////////////////////////////////////////////////////
//////////////////////// Main Function /////////////////////////////
////////////////////////////////////////////////////////////////////
function main() {   
    ////////////////////////////////////////////////////////////////////
    ////////////////////////////////// DB //////////////////////////////
    ////////////////////////////////////////////////////////////////////
    initDB();
    
    ////////////////////////////////////////////////////////////////////
    ////////////////////////////////// Main ////////////////////////////
    ////////////////////////////////////////////////////////////////////
    findMyRealIP();
    getBlackList();
    getRigList();
    
    ////////////////////////////////////////////////////////////////////
    /////////////////////////////// Batch //////////////////////////////
    ////////////////////////////////////////////////////////////////////
    setInterval(update, MONITORING_INTERVAL);
    setInterval(checkAcceptedShared, MONITORING_INTERVAL * 30); //  30분
    setInterval(deleteData, 1000 * 60 * 1440);      //  1일
    
    ////////////////////////////////////////////////////////////////////
    ////////////////////////////// Server //////////////////////////////
    ////////////////////////////////////////////////////////////////////
    //  서버 실행
    app.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server is listening at http://localhost:${PORT}`);
    });
}

function findMyRealIP() {
    const cheerio = require("cheerio");
    axios.get('https://www.findip.kr/').then(function (response) {
        let $ = cheerio.load(response.data);
        const text = $('body > header > h2').text();
        const splitText = text.split(":");
        if (splitText < 2 || splitText[1].indexOf('.') < 0) {
            logger.info("Can't find your real IP. Sorry!");
        } else {
            const realIP = splitText[1].trim();
            logger.info(`Your real IP address : ${realIP}`);
        }
    }).catch(function (error) { });
}

function getBlackList() {
    try {
        const b_list = fs.readFileSync("blacklist.txt");
        blackListArr = b_list.toString().split('\n');
    } catch (e) {
        logger.info(`getBlackList() : ${e}`);
    }
}

//  > 파일 존재 X = 초기 설치로 간주 > IP들 조회하며 Rig 목록 생성
//  > 파일 존재 O > Rig 목록 불러오기
async function getRigList(init=true) {
    if (init) getRigs();
    await delay(1000 * 10); //  Wait for 10 seconds
    //  Rig List 가져오기
    while (rigList == undefined || rigList.length == 0) {
        //  If can't get the rig list json data, the server will assume that it's the first time.
        logger.info('Cannot find the rig list. Now we will try to search miners in your network. It will take minutes. Please wait some minutes.');
        await createRigList();

        //  가져오기 실패시 재시도
        getRigs();
        await delay(1000 * 60); //  Wait for 1 minute
    }
}

async function createRigList() {
    logger.info('createRigList() called.');

    const myIP = getIPAddress();
    logger.debug(`Your IP : ${myIP}`);

    rigSearchCnt = 0;
    if (myIP.length > 0) {
        const ipArray = myIP.split(".");
        var ipRange = `${ipArray[0]}.${ipArray[1]}.${ipArray[2]}.`;

        //  TODO 마이너 추가시 수정 필요
        const SEARCH_CNT = 255 * 8;  //  제공 마이너 개수 * 255개 ip

        // start the progress bar with a total value of 200 and start value of 0
        bar1.start(SEARCH_CNT, 0);

        for (var i = 1; i <= 255; i++) {
            const ip = ipRange + i;

            //  TODO 마이너 추가시 수정 필요
            ping('Phoenix', ip, PORT_PHOENIX);
            ping('GMiner', ip, PORT_GMINER);
            ping('NBMiner', ip, PORT_NBMINER);
            ping('T-RexMiner', ip, PORT_TREXMINER);
            ping('lolMiner', ip, PORT_LOLMINER);
            ping('TeamRedMiner', ip, PORT_TEAMREDMINER);
            ping('TeamBlackMiner', ip, PORT_TEAMBLACKMINER);
            ping('CMiner', ip, PORT_CMINER);

            await delay(100);  //  Wait for 0.1 second
            // update the current value in your application..
            bar1.update(rigSearchCnt);
        }

        //  Wait for the searching
        while (rigSearchCnt < SEARCH_CNT) {
            await delay(1000);  //  Wait for 1 second
            bar1.update(rigSearchCnt);
        }

        // stop the progress bar
        bar1.stop();
    }

    logger.debug('createRigList() end.');
}

function getIPAddress() {
    logger.debug('getIPAddress() called.');
    var ipAddr = "";

    const { networkInterfaces } = require("os");

    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === "IPv4" && !net.internal) {
                /*
                if (!results[name]) {
                  results[name] = [];
                }
                results[name].push(net.address);
                */
                const IPs = net.address.split(".");
                if (IPs.length == 4) {
                    ipAddr = net.address;
                    return ipAddr;
                }
            }
        }
    }

    return ipAddr;
}

function ping(miner, ip, port) {
    const api = getMinerApi(miner, ip, port);

    let sql = `INSERT INTO RIG(ip, port, miner, ip_miner, status) VALUES (?, ?, ?, ?, ?) ON CONFLICT(ip_miner) DO UPDATE SET ip=?, port=?, miner=?, ip_miner=?, status=?;`; //  UPSERT
    //  TODO 마이너 추가시 수정 필요
    if (miner == 'TeamRedMiner') {
        var teamRedMinerObj = new TeamRedMiner({"ip": ip}, port);
        teamRedMinerObj.ping().then(() => {
            db.run(sql, [ip, port, miner, `${ip}_${port}_${miner}`, 'alive', ip, port, miner, `${ip}_${port}_${miner}`, 'alive'], (err) => { if (err) { logger.error(`${ip}:${port} ${miner} ${err}`); } });
            
            //  듀얼 마이닝 체크
            const api2 = getMinerApi(miner, ip, PORT_TEAMREDMINER_DUAL);
            var teamRedMinerObj2 = new TeamRedMiner({"ip": ip}, PORT_TEAMREDMINER_DUAL);
            teamRedMinerObj2.ping().then(() => {
                db.run(sql, [ip, PORT_TEAMREDMINER_DUAL, `${miner}(D)`, `${ip}_${PORT_TEAMREDMINER_DUAL}_${miner}(D)`, 'alive', ip, PORT_TEAMREDMINER_DUAL, `${miner}(D)`, `${ip}_${PORT_TEAMREDMINER_DUAL}_${miner}(D)`, 'alive'], (err) => { if (err) { logger.error(`${ip}:${PORT_TEAMREDMINER_DUAL} ${miner}(D) ${err}`); } });
            }).catch(() => {}).finally(() => {});
        }).catch(() => {}).finally(() => {  rigSearchCnt++; });
    } else {
        axios.get(api).then(function (response) {
            const phoenixStartStr = '<html><body bgcolor="#000000" style="font-family: monospace; font-weight: bold;">';
            if (miner == 'Phoenix' && response.data.toString().startsWith(phoenixStartStr))
            {
                db.run(sql, [ip, port, miner, `${ip}_${port}_${miner}`, 'alive', ip, port, miner, `${ip}_${port}_${miner}`, 'alive'], (err) => { if (err) { logger.error(`${ip}:${port} ${miner} ${err}`); } });
            }
            else if ( 
                (miner == 'GMiner' || miner == 'NBMiner' || miner == 'T-RexMiner' || miner == 'lolMiner' || miner == 'TeamBlackMiner' || miner == 'CMiner')
                && JSON.stringify(response.data).toString().startsWith('{'))
            {
                db.run(sql, [ip, port, miner, `${ip}_${port}_${miner}`, 'alive', ip, port, miner, `${ip}_${port}_${miner}`, 'alive'], (err) => { if (err) { logger.error(`${ip}:${port} ${miner} ${err}`); } });
                //  듀얼 마이닝 체크
                if ((miner == 'T-RexMiner' && response.data.dual_stat != undefined) || 
                    (miner == 'lolMiner' && response.data.Num_Algorithms != undefined && response.data.Num_Algorithms >= 2) ||
                    (miner == 'GMiner' && response.data.total_accepted_shares2 != undefined && response.data.algorithm != undefined && response.data.algorithm.indexOf('+') >= 0))
                {
                    db.run(sql, [ip, port, `${miner}(D)`, `${ip}_${port}_${miner}(D)`, 'alive', ip, port, `${miner}(D)`, `${ip}_${port}_${miner}(D)`, 'alive'], (err) => { if (err) { logger.error(`${ip}:${port} ${miner}(D) ${err}`); } });
                }
            }
            rigList.mineTotal++;
        }).catch(function (error) {
        }).then(function () {
            rigSearchCnt++
        });
    }
}

function getMinerApi(miner, ip, port) {
    var api = `http://${ip}:${port}`;

    //  TODO 마이너 추가시 수정 필요
    if (miner.startsWith("GMiner")) {
        api += '/stat';
    } else if (miner.startsWith("NBMiner")) {
        api += '/api/v1/status';
    } else if (miner.startsWith("T-RexMiner") || miner.startsWith("TeamBlackMiner")) {
        api += '/summary';
    }

    return api;
}

function update() {
    if (rigList == undefined || rigList == null || rigList.length == 0) return;

    const curDateTime = moment().format('YYYY-MM-DD HH:mm:ss');//new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    rigList.forEach(rig => {
        getRig(rig, curDateTime);
    });
    console.clear();
    printRigList();
    logger.info("Update rig information");
}

//  TODO 마이너 추가시 수정 필요
function printRigList() {
    if (rigList == undefined || rigList == null || rigList.length == 0) return;

    console.log("\n");
    console.log(` 88888888ba  88           I8,        8        ,8I                                   `);
    console.log(` 88      "8b ""           '8b       d8b       d8'                                   `);
    console.log(` 88      ,8P               "8,     ,8"8,     ,8"                                    `);
    console.log(` 88aaaaaa8P' 88  ,adPPYb,d8 Y8     8P Y8     8P ,adPPYYba, 8b,dPPYba,   ,adPPYb,d8  `);
    console.log(` 88""""88'   88 a8"    'Y88 '8b   d8' '8b   d8' ""     'Y8 88P'   '"8a a8"    'Y88  `);
    console.log(` 88    '8b   88 8b       88  '8a a8'   '8a a8'  ,adPPPPP88 88       88 8b       88  `);
    console.log(` 88     '8b  88 "8a,   ,d88   '8a8'     '8a8'   88,    ,88 88       88 "8a,   ,d88  `);
    console.log(` 88      '8b 88  '"YbbdP"Y8    '8'       '8'    '"8bbdP"Y8 88       88  '"YbbdP"Y8  `);
    console.log(`                 aa,    ,88                                             aa,    ,88  `);
    console.log(`                  "Y8bbdP"                                               "Y8bbdP"   `);
    console.log(`                                                                version : ${VERSION}`);
    console.log("\n");

    var cnt = 0;
    var line = "";
    console.log(`(D) : Dual Mining Mode`);
    console.log(`P: Phoenix\tG: GMiner\tN: NBMiner\tL: lolMiner\tT-R: T-RexMiner`);
    console.log(`TeamRed: TeamRed\tTeamBlack: TeamBlack\tCMiner: C\n`);

    rigList.forEach(rig => {
        var fChar = "";
        cnt++;
        if (rig.miner.trim().length > 0) {
            if (rig.miner.indexOf('Phoenix') >= 0) { fChar = "P"; }
            else if (rig.miner.indexOf('GMiner') >= 0) {
                fChar = (rig.miner.indexOf('(D)') >= 0) ? "(D)G" : "G";
            }
            else if (rig.miner.indexOf('NBMiner') >= 0) { fChar = "N"; }
            else if (rig.miner.indexOf('lolMiner') >= 0) { 
                fChar = (rig.miner.indexOf('(D)') >= 0) ? "(D)L" : "L";
            }
            else if (rig.miner.indexOf('TeamRedMiner') >= 0) {
                fChar = (rig.miner.indexOf('(D)') >= 0) ? "(D)TeamRed" : "TeamRed";
            }
            else if (rig.miner.indexOf('TeamBlackMiner') >= 0) { fChar = "TeamBlack"; }
            else if (rig.miner.indexOf('CMiner') >= 0) { fChar = "C"; }
            else if (rig.miner.indexOf('T-RexMiner') >= 0) {
                fChar = (rig.miner.indexOf('(D)') >= 0) ? "(D)T-R" : "T-R";
            }
        } else {
            fChar = "E"
        }

        if (rig.status == "alive") {
            line += `\x1b[32m${fChar}\x1b[0m:${rig.ip}:${rig.port}\t`
        } else {
            line += `\x1b[31m${fChar}\x1b[0m:${rig.ip}:${rig.port}\t`
        }

        if (cnt%5 == 0) {
            console.log(line);
            line = "";
        }
    });

    if (line !== "") {
        console.log(line+"\n");
    }
    console.log("\n");
}

function getRig(rig, curDateTime) {
    const api = getMinerApi(rig.miner, rig.ip, rig.port);
    const prevAlgo = rig.algo;

    if (rig.miner.startsWith('TeamRedMiner')) {
        var miner = new TeamRedMiner(rig, rig.port, curDateTime);
        miner.update(rig).then(() => {
            if (miner != null && miner.gpuArr != undefined) {
                miner.gpuArr.forEach((gpuObj) => {
                    insertGPU(gpuObj);
                });
            }

            //  현재 해시가 Max보다 낮을 경우 비율 계산해서 푸쉬 발송
            if (rig.maxHash != 0 && rig.curHash != 0 && (parseInt(rig.curHash) / parseInt(rig.maxHash) * 100) < HASH_DROP_THRESHOLD) {
                sendAlarmMessage(rig.rigname, `Hash is dropped. Current : ${rig.curHash}, MaxHash : ${rig.maxHash}`);
            }
            rig.status = 'alive';
        }).catch(error => {
            rig.status = 'stop';
            //  채굴기 멈춤 현상 발생! 푸쉬 발송
            sendAlarmMessage(rig.rigname, "Miner is stopped.");
            logger.error(`rig(${rig.ip}/${rig.rigname}/${rig.miner}) is stopped. ${error.message}`);
            if (error.stack) {
                logger.error(error.stack);
            }
        }).finally(() => {
            //  Update rig
            rig.lastUpdate = curDateTime;
            updateRig(rig);
            //  알고리즘 업데이트
            if (prevAlgo != rig.algo) {
                updateRigAlgo(rig);
            }
        });
    }
    else {
        axios.get(api).then(function (response) {
            var raw = response.data;
            var miner = null;
            if (rig.miner == 'Phoenix') {
                miner = new PhoenixMiner(rig, raw, curDateTime);
                if (miner.searchFailed) {
                    // console.log('PhoenixMiner -> Update failed.');
                    return;
                } else {
                    // console.log('PhoenixMiner -> Update Succeed.');
                }
            } else if (rig.miner.startsWith('GMiner')) {
                miner = new GMiner(rig, raw, curDateTime);
            } else if (rig.miner.startsWith('NBMiner')) {
                miner = new NBMiner(rig, raw, curDateTime);
            } else if (rig.miner.startsWith('T-RexMiner')) {
                miner = new TRexMiner(rig, raw, curDateTime);
            } else if (rig.miner.startsWith('lolMiner')) {
                miner = new lolMiner(rig, raw, curDateTime);
            } else if (rig.miner.startsWith('TeamBlackMiner')) {
                miner = new TeamBlackMiner(rig, raw, curDateTime);
            } else if (rig.miner.startsWith('CMiner')) {
                miner = new CMiner(rig, raw, curDateTime);
            }
            //  TODO 마이너 추가시 수정 필요
            else {
            }
    
            if (miner != null && miner.gpuArr != undefined) {
                miner.gpuArr.forEach((gpuObj) => {
                    insertGPU(gpuObj);
                });
            }
    
            //  현재 해시가 Max보다 낮을 경우 비율 계산해서 푸쉬 발송
            if (rig.maxHash != 0 && rig.curHash != 0 && (parseInt(rig.curHash) / parseInt(rig.maxHash) * 100) < HASH_DROP_THRESHOLD) {
                sendAlarmMessage(rig.rigname, `Hash is dropped. Current : ${rig.curHash}, MaxHash : ${rig.maxHash}`);
            }
            rig.status = 'alive';
        })
        .catch(function (error) {
            rig.status = 'stop';
            //  채굴기 멈춤 현상 발생! 푸쉬 발송
            sendAlarmMessage(rig.rigname, "Miner is stopped.");
            logger.error(`rig(${rig.ip}/${rig.rigname}/${rig.miner}) is stopped. ${error.message}`);
            if (error.stack) {
                logger.error(error.stack);
            }
        }).then(function() {
            //  Update rig
            rig.lastUpdate = curDateTime;
            updateRig(rig);
            //  알고리즘 업데이트
            if (prevAlgo != rig.algo) {
                updateRigAlgo(rig);
            }
        });
    }
}

function initDB() {
    db.all("SELECT * FROM CONFIG;", (err, rows) => {
        if (err) {
            db.run('CREATE TABLE CONFIG(option TEXT PRIMARY KEY, value TEXT NOT NULL);', (err) => {
                if (err) return;
                const defaultServerName = Math.random().toString(36).substr(2,11);
                db.run(`INSERT INTO CONFIG(option, value) VALUES ('serverName', '${defaultServerName}'), ('port', '${PORT}'), ('sendingMessageInterval', '5'),  ('hashDropThreshold', '95'), ('deviceToken', ''), ('monitoringInterval', '60000')`);
                serverConfigOptions = {'server_name': defaultServerName, 'port': PORT};
            });
        } else {
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].option == "serverName") serverConfigOptions = { 'server_name': rows[i].value,  'port': PORT    };
                else if (rows[i].option == "sendingMessageInterval") SENDING_MESSAGE_INTERVAL = parseInt(rows[i].value);
                else if (rows[i].option == "hashDropThreshold") HASH_DROP_THRESHOLD = parseInt(rows[i].value);
                else if (rows[i].option == "monitoringInterval") MONITORING_INTERVAL = parseInt(rows[i].value);
            }
            db.run(`UPDATE CONFIG SET value = '${PORT}' WHERE option = 'port'`);
        }
    });

    db.get("SELECT COUNT(*) FROM RIG;", function (err, row) {
        if (err) {
            db.run('CREATE TABLE RIG(rig_id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, port INTEGER NOT NULL, rigname TEXT DEFAULT "", miner TEXT NOT NULL, ip_miner TEXT NOT NULL, miner_ver TEXT DEFAULT "", algo TEXT NOT NULL DEFAULT "Default", maxHash REAL, curHash REAL, status TEXT, power INTEGER, numOfGpus INTEGER, uptime INTEGER, lastUpdate TEXT, UNIQUE("ip_miner"));');
        }
    });
    db.get("SELECT COUNT(*) FROM GPU", function (err, row) {
        if (err) {
            db.run('CREATE TABLE GPU(rig_id INTEGER NOT NULL, gpu_id INTEGER NOT NULL, hash REAL, model TEXT, fan INTEGER, power INTEGER, cclock INTEGER, mclock INTEGER, cvddc INTEGER, temp INTEGER, jtemp INTEGER, Tj INTEGER, accepted_shares INTEGER, stale_shares INTEGER, rejected_shares INTEGER, invalid_shares INTEGER, lastUpdate TEXT, lhr_tune INTEGER);');
        }
    });
}

async function getRigs() {
    db.all("SELECT * FROM RIG", (err, rows) => { rigList = rows; });
}

function selectMonitoringOptions() {
    return new Promise(function (resolve, reject) {
        let sql = `SELECT * FROM CONFIG WHERE option IN ('sendingMessageInterval', 'hashDropThreshold', 'monitoringInterval')`;
        db.all(sql, async (err, rows) => {
            if (err) { logger.error(err.message); reject(); }
            resolve(rows);
        });
    });
}

function updateRig(rig) {
    let sql = `UPDATE RIG SET rigname = '${rig.rigname}', miner = '${rig.miner}', miner_ver = '${rig.miner_ver}', maxHash = ${rig.maxHash}, curHash = ${rig.curHash}, status = '${rig.status}', power = ${rig.power}, numOfGpus = ${rig.numOfGpus}, uptime = ${rig.uptime}, lastUpdate = '${rig.lastUpdate}' WHERE rig_id = ${rig.rig_id}`;
    db.run(sql, (err) => { if (err) return logger.error(`${err.message}\nSQL : ${sql}`); });
    // logger.info(`updateRig() : ${sql}`);
}

function updateRigAlgo(rig) {
    let sql = `UPDATE RIG SET algo = '${rig.algo}' WHERE rig_id = ${rig.rig_id}`;
    db.run(sql, (err) => { if (err) return logger.error(`${err.message}\nSQL : ${sql}`); });
    // logger.info(`updateRig() : ${sql}`);
}

function insertGPU(gpuObj) {
    let sql = `INSERT INTO GPU(rig_id, gpu_id, hash, model, fan, power, cclock, mclock, cvddc, temp, jtemp, Tj, accepted_shares, stale_shares, rejected_shares, invalid_shares, lastUpdate, lhr_tune) 
    VALUES(${gpuObj.rig_id}, ${gpuObj.gpu_id}, ${gpuObj.hash}, '${gpuObj.model}', ${gpuObj.fan}, ${gpuObj.power}, ${gpuObj.cclock}, ${gpuObj.mclock}, ${gpuObj.cvddc}, ${gpuObj.temp}, ${gpuObj.jtemp}, ${gpuObj.Tj}, ${gpuObj.accepted_shares}, ${gpuObj.stale_shares}, ${gpuObj.rejected_shares}, ${gpuObj.invalid_shares}, '${gpuObj.lastUpdate}', ${gpuObj.lhr_tune})`;
    db.run(sql, (err) => { if (err) return logger.error(`${err.message}\nSQL : ${sql}`); });
    // logger.info(`insertGPU() : ${sql}`);
}

const selectAllData = function () {
    return new Promise(function (resolve, reject) {
        let sql =
        `SELECT * 
        FROM RIG AS A
        JOIN (
            SELECT rig_id, gpu_id, hash, model, fan, power AS gpuPower, cclock, mclock, cvddc, temp, jtemp, Tj, accepted_shares, stale_shares, rejected_shares, invalid_shares, lastUpdate AS gpuLastUpdate, lhr_tune
            FROM (
                SELECT *,
                    RANK() OVER (PARTITION BY rig_id ORDER BY lastUpdate DESC) AS rank_no
                FROM GPU
            )
            WHERE rank_no = 1
        ) AS B
        USING(rig_id)`;
        db.all(sql, async (err, rows) => {
            if (err) { logger.error(err.message); reject(); }
            resolve(rows);
        });
    });
}

function deleteData() {
    let sql = `DELETE FROM GPU WHERE Cast((JulianDay(Date('now')) - JulianDay(lastUpdate)) As Integer) > 1;`;
    db.run(sql, (err) => { if (err) return logger.error(`${err.message}\nSQL : ${sql}`); });   
}

function checkAcceptedShared() {
    let sql = 
    `WITH _LAST AS (
        SELECT MAX(lastUpdate) AS LAST_UPDATE_DATETIME FROM GPU
    ), _BEFORE AS (
        SELECT MAX(lastUpdate) AS BEFORE_UPDATE_DATETIME FROM GPU, _LAST WHERE lastUpdate <= DATETIME(LAST_UPDATE_DATETIME, '-30 minutes')
    ), _LAST_T AS (
        SELECT rig_id, SUM(accepted_shares) AS SUM_LAST_ACCEPTED_SHARED, lastUpdate AS LAST_UPDATE_DATETIME FROM GPU, _LAST WHERE lastUpdate = LAST_UPDATE_DATETIME GROUP BY rig_id, lastUpdate
    ), _BEFORE_T AS (
        SELECT rig_id, SUM(accepted_shares) AS SUM_BEFORE_ACCEPTED_SHARED, lastUpdate AS BEFORE_UPDATE_DATETIME FROM GPU, _BEFORE WHERE lastUpdate = BEFORE_UPDATE_DATETIME GROUP BY rig_id, lastUpdate
    )
    SELECT * 
    FROM _LAST_T
    JOIN _BEFORE_T USING (rig_id)
    JOIN RIG USING (rig_id)
    WHERE status = 'alive'
    AND (SUM_LAST_ACCEPTED_SHARED - SUM_BEFORE_ACCEPTED_SHARED) = 0;`;
    db.all(sql, (err, rows) => {
        if (err) { logger.error(err.message); }
        if (rows.length == 0) return;

        var message = "Rig [";
        for (var i = 0; i < rows.length; i++) {
            message += rows[i].rigname;
            if (i < rows.length - 1) message += ", ";
        }
        message += "] accepted_shares stopped for 30 minutes.";
        // console.log(message);
        sendFCMPushMessage("Warning", message);
        sendTelegramMessage(message);
    });
}

function sendAlarmMessage(title, msg) {
    const curTime = moment().format('YYYY-MM-DD HH:mm:ss');

    // if (lastSendMessageTime[title] != undefined && (curTime - lastSendMessageTime[title]) < SENDING_MESSAGE_INTERVAL) return;
    if (lastSendMessageTime[title] != undefined) {
        const start = moment(lastSendMessageTime[title], 'YYYY-MM-DD HH:mm:ss');
        const end = moment(curTime, 'YYYY-MM-DD HH:mm:ss');
        const diff = moment.duration(end.diff(start)).asMinutes();
        if (diff < SENDING_MESSAGE_INTERVAL) {
            return;
        }
    }

    // logger.info(`sendAlarmMessage(${title}, ${msg}) called`);

    sendFCMPushMessage(title, msg);
    lastSendMessageTime[title] = curTime;
}

function sendFCMPushMessage(title, msg) {
}