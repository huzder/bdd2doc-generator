
var acquit = require('acquit'), fs = require('fs'), path = require('path');

function getNamespaces(apiModel) {
    if (!apiModel)
        return [];
    if (!apiModel.namespaces)
        apiModel.namespaces = [];
    return apiModel.namespaces;
}
function getNamespace(namespaces, nsName, isGlobal) {
    var ns = namespaces.filter(n => n.name === nsName)[0];
    return ns || (namespaces[namespaces.length] = { name: nsName, isGlobal: !!isGlobal, classes: [] });
}
function getClass(className, ns, baseType) {
    return ns.classes[ns.classes.length] = {
        name: className, baseType: baseType, fields: [], eventHandlers: [], methods: [], useCases: [], limitations: []
    };
}
function getMethod(classEntity, name, returnType, description, params, isStatic) {
    return classEntity.methods[classEntity.methods.length] = {
        name: name, description: description,
        returnType: returnType, params: params, isStatic: isStatic,
        useCases: [], limitations: []
    };
}
function getEvent(classEntity, name, handlerType, description) {
    return classEntity.eventHandlers[classEntity.eventHandlers.length] = {
        name: name, description: description, handlerType: handlerType.trim(), useCases: [], limitations: []
    };
}
function getField(classEntity, name, type, description, defaultValue) {
    return classEntity.fields[classEntity.fields.length] = {
        name: name, description: description, type: type, defaultValue: defaultValue, useCases: [], limitations: []
    };
}
function getDescription(block) {
    return block.comments.map(c => c.trim()).filter(c => !!c).join("\n");
}
function processCodeString(codeString) {
    var rows = codeString.split("\n");
    return rows.filter(r =>
        r.indexOf(skipCodeRowMarker) === -1 &&
        r.indexOf("done()") === -1 &&
        r.indexOf("expect(") === -1).join("\n");
}
function processLimitationBlock(block, classEntity) {
    var title = block.contents.substring(1);
    var code = processCodeString(block.code);
    classEntity.limitations.push({ title: title, description: getDescription(block), code: code });
}
function processUseCaseBlock(block, classEntity) {
    var title = block.contents.substring(1);
    var code = processCodeString(block.code);
    classEntity.useCases.push({ title: title, description: getDescription(block), code: code });
}
function processClassMemberBlock(block, classEntity) {
    var entity = null;
    var methodRegex = /(\w+)\s*\(([^\(]+)\):\s*(\w+)/, eventOrFieldRegex = /(\w+)\s*:\s*(\w+)/;
    var matches = methodRegex.exec(block.contents);
    if (matches !== null) {
        var params = matches[2]
            .split(',')
            .map(p => {
                var parts = p.split(':');
                var mParam = {
                    name: (parts[0] || "").trim(),
                    type: (parts[1] || "object").trim()
                };
                mParam.required = !mParam.name.endsWith("?");
                if(!mParam.required)
                    mParam.name = mParam.name.substr(0, mParam.name.length - 1);
                return mParam;
            });
        entity =
            getMethod(classEntity, matches[1], matches[3], getDescription(block),
                params, block.contents.indexOf("static ") > -1);
    } else if ((matches = eventOrFieldRegex.exec(block.contents)) !== null) {
        var returnType = matches[2];
        if (returnType.indexOf("EventHandler") > -1) {
            entity = getEvent(classEntity, matches[1], returnType, getDescription(block));
        } else {
            entity = getField(classEntity, matches[1], returnType, getDescription(block), "%default%");
        }
    }
    if (entity)
        block.blocks.filter(b => b.type === "it").forEach(b => processStatementBlock(b, entity));
}
function processStatementBlock(block, classOrMemberEntity) {
    if (block.contents.indexOf("!") === 0)
        processLimitationBlock(block, classOrMemberEntity);
    if (block.contents.indexOf("?") === 0)
        processUseCaseBlock(block, classOrMemberEntity);
}
function processClassContentBlock(block, classEntity) {
    if (block.type === "it") {
        processStatementBlock(block, classEntity);
    } else {
        if (block.contents.indexOf("public ") === 0)
            processClassMemberBlock(block, classEntity);
    }
}
function processClassBlock(block, ns) {
    var classNameParts = block.contents.replace("class ", "").split(" extends ");
    var classEntity = getClass(classNameParts[0], ns, classNameParts[1]);
    block.blocks.forEach(b => processClassContentBlock(b, classEntity));
}
function processNamespaceContentBlock(block, ns) {
    if (block.type === "describe" && block.contents.indexOf("class ") === 0) {
        processClassBlock(block, ns);
    }
}
function processNamespaceBlock(namespaces, nsBlock) {
    var namespaceName = nsBlock.contents.replace("namespace ", "");
    var ns = getNamespace(namespaces, namespaceName, false);
    nsBlock.blocks.forEach(b => processNamespaceContentBlock(b, ns));
}
function processRootBlock(namespaces, block) {
    if (block.type === "describe" && block.contents.indexOf("namespace ") === 0)
        processNamespaceBlock(namespaces, block);
    else
        processNamespaceContentBlock(block, getNamespace(namespaces, "Global", true));
}

var skipCodeRowMarker = "//#skip#";

function findAllFiles(dir, filelist, fileEnding) {
    files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file) {
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = findAllFiles(path.join(dir, file), filelist, fileEnding);
        }
        else if (file.indexOf(fileEnding) > -1) {
            filelist.push(path.join(dir, file));
        }
    });
    return filelist;
};
function fillFromTestCode(currentAPIModel, testCode) {
    var rootBlocks = acquit.parse(testCode);
    var namespaces = getNamespaces(currentAPIModel);
    rootBlocks.forEach(b => processRootBlock(namespaces, b));
}
function fillFromTestFile(currentAPIModel, filePath) {
    var content = fs.readFileSync(filePath, { encoding: "UTF-8" });
    fillFromTestCode(currentAPIModel, content);
}
function createFromDirectory(directory, fileEnding) {
    fileEnding = fileEnding || "Tests.js";
    var files = findAllFiles(directory, [], fileEnding);
    var currentApiModel = {};
    files.forEach(f => fillFromTestFile(currentApiModel, f));
    return currentApiModel;
}
function findByCompositeKey(apiModel, key) {
    if (!apiModel || !key || key.indexOf("js-") === -1)
        return null;
    var partsRegex = /js-(\w+)\.(\w+)/;
    var matches = partsRegex.exec(key);
    if (matches === null)
        return null;
    var className = matches[1];
    var memberName = matches[2];
    var classModels = apiModel.namespaces
                        .map(n => n.classes.filter(c => c.name === className))
                        .reduce(function(p, c) { return p.concat(c); }, []);
    if(classModels.length === 0)
        return null;
    return classModels[0].methods.filter(m => m.name === memberName)[0];
}

module.exports = {
    fillFromTestCode: fillFromTestCode,
    fillFromTestFile: fillFromTestFile,
    createFromDirectory: createFromDirectory,
    findByCompositeKey: findByCompositeKey
};
