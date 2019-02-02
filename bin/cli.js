#!/usr/bin/env node
'use strict';
const fs = require("fs"), path = require("path"), crypto = require('crypto'), generator = require('../index'), 
    cacheFileName = "cache.bdd2doc";

function md5(str) { return crypto.createHash('md5').update(str).digest("hex"); }
function getWorkingDirectory() { return __dirname; }
function calcContentHash(filePaths) { return md5(filePaths.map(f => fs.statSync(f).mtime.toISOString()).join("")); }
function getCache(cacheLocationDir, key) {
    var f = path.join(cacheLocationDir, cacheFileName);
    var content = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : JSON.parse('{ "' + key + '": {} }');
    return { file: f, data: (content[key] || (content[key] = {})), sync: function() { fs.writeFileSync(f, JSON.stringify(content)); } };
}
function getUpdatedApi(cacheTable, directory, fileEnding) {
    var apiModel = generator.createFromDirectory(directory, fileEnding);
    cacheTable.data.digest = calcContentHash(apiModel.files);
    cacheTable.data.api = { namespaces: apiModel.namespaces };
    cacheTable.sync();
    return cacheTable.data.api;
}
function discoverApiModel(directory, fileEnding = "", versionTag = "") {
    var cacheTable = getCache(getWorkingDirectory(), md5([directory, fileEnding, versionTag].join("|")));
    if(!cacheTable.data.digest || calcContentHash(generator.findMatchingFiles(directory, fileEnding)) !== cacheTable.data.digest)
        return getUpdatedApi(cacheTable, directory, fileEnding);
    return cacheTable.data.api;
}
function invokeFindByCompositeKey(directory, memberName, fileEnding, versionTag) {
    var api = discoverApiModel(directory, fileEnding, versionTag);
    if(!api)
        return console.warn("No API definitions found! Check your directory!");
    var member = generator.findByCompositeKey(api, memberName);
    if(!member)
        return console.log("Was not found!");
    var strView = JSON.stringify(member);
    console.log(strView);
    return strView;
}
function processInput(args) {
    var inputParams = [
        { name: "--dir", value: [], required: true, info: "specify test files root directory" },
        { name: "--name", value: [], required: true, info: "specify API member name to find" },
        { name: "--fe", value: [] },
        { name: "--tag", value: [] }
    ];
    var currentArg = null;
    for (let i = 2; i < args.length; i++) {
        var a = args[i];
        currentArg = inputParams.filter(p => p.name === a)[0] || currentArg;
        if(currentArg)
            currentArg.value.push(a);
    }
    var required = inputParams.filter(p => p.value.length === 0 && p.required);
    required.forEach(p => {
        console.error(p.info + ": " + p.name);
    });
    if(required.length)
        return null;
    return invokeFindByCompositeKey.apply(this, inputParams.map(p => p.value.join(" ").trim()));
}
module.exports = {
    discoverApiModel: discoverApiModel,
    calcContentHash: calcContentHash,
    getCache: getCache,
    getWorkingDirectory: getWorkingDirectory
};

return processInput(process.argv);