
var acquit = require('acquit'), fs = require('fs'), path = require('path');


var skipCodeRowMarker = "//#skip#", defaultSpecTestEnding = "SpecTests.js";

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
function getClass(className, ns, baseType, description) {
    return ns.classes[ns.classes.length] = {
        name: className, baseType: baseType, description: description,
        fields: [], eventHandlers: [], methods: [], useCases: [], limitations: []
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
    var classEntity = getClass(classNameParts[0], ns, classNameParts[1], getDescription(block));
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

function findMatchingFiles(dir, fileEnding, filelist) {
    fileEnding = fileEnding || defaultSpecTestEnding;
    files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file) {
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = findMatchingFiles(path.join(dir, file), fileEnding, filelist);
        }
        else if (file.indexOf(fileEnding) > -1) {
            filelist.push(path.join(dir, file));
        }
    });
    return filelist;
};
function fillFromTestCode(currentAPIModel, testCode) {
    acquit.parse(testCode).forEach(b => processRootBlock(getNamespaces(currentAPIModel), b));
}
function fillFromTestFile(currentAPIModel, filePath) {
    fillFromTestCode(currentAPIModel, fs.readFileSync(filePath, { encoding: "UTF-8" }));
}
function createFromDirectory(directory, fileEnding) {
    var currentApiModel = { files: findMatchingFiles(directory, fileEnding) };
    currentApiModel.files.forEach(f => fillFromTestFile(currentApiModel, f));
    return currentApiModel;
}
function findByCompositeKey(apiModel, key) {
    var jsMemberKeyRegex = /js-(\w+)\.?(\w+)?\.?(static)?(\([\w\s\,]*\))?/;
    var matches = jsMemberKeyRegex.exec(key);
    if (matches === null)
        return null;
    var className = matches[1], memberName = matches[2], isStatic = !!matches[3], methodParams = matches[4];
    var classModel = getNamespaces(apiModel)
                    .filter(n => n.isGlobal)
                    .map(n => n.classes.filter(c => c.name === className))
                    .reduce((p, c) => p.concat(c), [])[0];
    if(!classModel)
        return null;

    var foundApiMember = null;
    if(methodParams && memberName) {
        var requiredParams = methodParams.substr(1, methodParams.length - 2).split(',').map(m => m.trim());
        foundApiMember = classModel.methods.filter(m => 
            m.name === memberName && m.isStatic === isStatic && 
            m.params.every(mp => requiredParams.indexOf(mp.name) > -1 || !mp.required)
        )[0];
    }
    else if(memberName) {
        foundApiMember = 
            classModel.eventHandlers.filter(eh => eh.name === memberName)[0] || 
            classModel.fields.filter(f => f.name === memberName)[0];
    }
    else {// class model was requested
        foundApiMember = { 
            name: classModel.name,
            description: classModel.description,
            baseType: classModel.baseType, 
            useCases: classModel.useCases, 
            limitations: classModel.limitations 
        };
    }
    return foundApiMember || null;
}

module.exports = {
    fillFromTestCode: fillFromTestCode,
    fillFromTestFile: fillFromTestFile,
    createFromDirectory: createFromDirectory,
    findByCompositeKey: findByCompositeKey,
    findMatchingFiles: findMatchingFiles
};
