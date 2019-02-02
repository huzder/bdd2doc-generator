const cli = require("../bin/cli"), fs = require("fs"), path = require("path");

describe("utils", function () {
    var testContainerPath, testFiles, testDirectories, cacheFile;

    function createTrashFiles(folder, level = 0) {
        var paths = [];
        for (let i = 0; i < 10; i++)
            paths.push(path.join(folder, i + (i % 2 === 0 ? "CustomPrefix.js" : "TrashFile.txt")));
        paths.forEach((p, ii) =>
            fs.writeFileSync(p, `describe("class UIComponent` + level.toString() + ii + ` extends Base", function () {
        });`));
        testFiles = testFiles.concat(paths);
        if (level === 1)
            return;
        createTrashFiles(createRandomDir(folder), level + 1);
    }
    function createRandomDir(rootDir) {
        var d = path.join(rootDir, "container_" + Math.round(Math.random() * 10000));
        fs.mkdirSync(d);
        return testDirectories[testDirectories.length] = d;
    }
    function deleteFolderRecursive(path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function (file, index) {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    }
    beforeEach(function () {
        testFiles = [];
        testDirectories = [];
        testContainerPath = createRandomDir(__dirname);
        createTrashFiles(testContainerPath, 0);
        cacheFile = path.join(cli.getWorkingDirectory(), "cache.bdd2doc");
    });
    afterEach(function () {
        deleteFolderRecursive(testContainerPath);
        if (fs.existsSync(cacheFile))
            fs.unlinkSync(cacheFile);
    });
    describe("calcContentHash", function () {
        it("calculates based on last modification date of file", function (done) {
            var files = [testFiles[0], testFiles[1]];
            var hash = cli.calcContentHash(files);
            expect(cli.calcContentHash(files)).toBe(hash, "immutable");
            expect(cli.calcContentHash(files.concat([testFiles[3]]))).not.toBe(hash, "count is changed!");

            setTimeout(function () {
                fs.writeFileSync(files[0], "some data");
                expect(cli.calcContentHash(files)).not.toBe(hash, "1 file changed");
                done();
            }, 2000);
        });
    });
    describe("getCache", function () {
        it("creates file with JSON after sync if first run in new folder", function () {
            var filePath = path.join(testDirectories[0], "cache.bdd2doc");
            expect(fs.existsSync(filePath)).toBe(false);

            var c = cli.getCache(testDirectories[0], "somekey");

            expect(fs.existsSync(filePath)).toBe(false);

            c.data.property1 = 2;
            c.sync();

            expect(fs.readFileSync(filePath).toString("utf8")).toBe('{"somekey":{"property1":2}}');
        });
    });
    describe("discoverApiModel", function () {
        it("creates correct structure and uses cache after first create", function () {
            var result = cli.discoverApiModel(testContainerPath, "CustomPrefix.js");
            expect(result.namespaces[0].classes[0].name).toBe("UIComponent00");

            var filePath = path.join(cli.getWorkingDirectory(), "cache.bdd2doc");
            var content = fs.readFileSync(filePath).toString("utf8");
            content = content.split("namespaces")[0];
            content += 'namespaces":[{"classes":[{"name":"ChangeCacheName"}]}]}}}';
            fs.writeFileSync(filePath, content);

            result = cli.discoverApiModel(testContainerPath, "CustomPrefix.js");
            expect(result.namespaces[0].classes[0].name).toBe("ChangeCacheName", "changed from cache");

            createTrashFiles(testContainerPath);
            result = cli.discoverApiModel(testContainerPath, "CustomPrefix.js");
            expect(result.namespaces[0].classes[0].name).toBe("UIComponent00", "should be recreated coz more files will be found");
        });
    });
});