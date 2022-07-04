getAlgorithm = function (algo) {
    var ret = algo;
    switch (algo) {
        //  이더리움
        case "eth":
        case "ethash":
            ret = "Ethereum";
            break;
        //  이더리움 클래식
        case "etc":
        case "etchash":
            ret = "ETC";
            break;
        //  레이븐
        case "kawpow":
        case "rvn":
        case "ravencoin":
            ret = "Ravencoin";
            break;
        case "zel":
        case "zelhash":
            ret = "Flux"
            break;
        //  ZelCash 
        case "equihash125_4":
            ret = "ZelCash"
            break;
        //  Aion https://aion.theoan.com/
        case "equihash 210/9":
        case "equihash210_9":
            ret = "Aion"
            break;
        //  Aeternity https://www.aeternity.com/
        case "cuckoo_ae":   //  NBMiner
        case "cuckoo 29":   //  lolMiner
        case "cuckoo29":
        case "aeternity":
            ret = "Aeternity";
            break;
        //  텔래그램 코인
        case "sha256-ton":   //  lolMiner
            ret = "TONCOIN"
            break;
        //  에르고
        case "ergo":
        case "autolykos v2 (ergo)":
            ret = "Ergo";
            break;
        //  Cortex
        case "cuckaroo 30 ctxc":
            ret = "Cortex";
            break;
        //  Grin (C32), Cuckatoo32 algo -> https://wheretomine.io/algorithms/cuckatoo32
        case "cuckaroo 29-32":
            ret = "Grin (C32)";
            break;
        //  Beam
        case "beamv3":
        case "beamhash iii":
            ret = "Beam";
            break;
        //  BitTube, Cuckaroo29b algo -> https://wheretomine.io/algorithms/cuckaroo29b
        case "cuckaroo 29-40":
            ret = "BitTube";
            break;
        //  Ubiq, Ubqhash algo -> https://wheretomine.io/algorithms/ubqhash
        case "ubqhash":
            ret = "Ubiq";
            break;
        //  10 coins -> https://wheretomine.io/algorithms/equihash-144-5
        case "Equihash 144\/5":
        case "equihash144_5":
            ret = "equihash144_5";
            break;
        //  10 coins -> https://wheretomine.io/algorithms/equihash-192-7
        case "equihash 192/7":
        case "equihash192_7":
            ret = "equihash192_7"
            break;
        //  2 coins -> https://wheretomine.io/algorithms/equihash-150-5
        case "equihash 150/5":
        case "equihash150_5":
            ret = "equihash150_5"
            break;
        //  Conflux
        case "octopus": //  NBMiner
            ret = "Conflux"
            break;
    }
    return ret;
}

module.exports = getAlgorithm