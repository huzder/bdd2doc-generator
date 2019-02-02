var generator = require("../index.js"), fs = require('fs');

describe("Generator", function () {
    describe("parses root DESCRIBE blocks", function () {
        it("into namespaces", function () {
            var model = {};
            generator.fillFromTestCode(model, `describe("namespace UIComponents", function () {
                it("some test", function() {
                    expect(1).toBe(3);
                });
            });`);
            expect(model.namespaces[0].isGlobal).toBe(false);
            expect(model.namespaces[0].name).toBe("UIComponents");
        });
        describe("into classes (place in global namespace)", function () {

            var classModel = null;
            beforeEach(function () {
                var model = {};
                generator.fillFromTestFile(model, __dirname + "/testsample1.js");
                var globalNS = model.namespaces[0];

                expect(globalNS.isGlobal).toBe(true);
                expect(globalNS.name).toBe("Global");

                classModel = globalNS.classes[0];
            });
            it("with name", function () {
                expect(classModel.name).toBe("MyComponent");
            });
            it("with base type", function () {
                expect(classModel.baseType).toBe("ComponentBase");
            });
            it("with useCases defined by it('?...', ", function () {
                var useCase = classModel.useCases[0];
                expect(useCase.title).toBe("User story title - eg 'How to get editor selection'");
                expect(useCase.description).toBe("User story description");
                expect(useCase.code).toBe(`// some common use case / best practice
// some code that should work
// some asserts`);
            });
            it("with limitations defined via it('!...;, ", function () {
                var limitation = classModel.limitations[0];
                expect(limitation.title).toBe("Limitation description - eg To create on client side use SomeFactory instead of new()");
                expect(limitation.description).toBe("Limitation full description");
                expect(limitation.code).toBe("// show how to use this factory...");
            });
            describe("with eventhandlers", function () {
                var memberModel = null;
                beforeEach(function () {
                    memberModel = classModel.eventHandlers[0];
                });
                it("with name", function () {
                    expect(memberModel.name).toBe("OptionChanged");
                });
                it("with handler type", function () {
                    expect(memberModel.handlerType).toBe("SomeTypedEventHandler");
                });
                it("with useCases defined via it('?...', ", function () {
                    var useCase = memberModel.useCases[0];
                    expect(useCase.title).toBe("Various info provided in args...");
                    expect(useCase.description).toBe("Some more description about this event...");
                    expect(useCase.code).toBe(`componentInst.OptionChanged.AddHandler(function (s, e) {
    if (e.previousValue) {
        // comment that should be visible in snippet
    }
});`);
                });
            });
            describe("with methods", function () {
                var memberModel = null;
                beforeEach(function () {
                    memberModel = classModel.methods[0];
                });
                it("with name", function () {
                    expect(memberModel.name).toBe("SetDataSource");
                });
                it("with isStatic flag", function () {
                    expect(memberModel.isStatic).toBe(false);
                });
                it("with parameters list", function () {
                    expect(memberModel.params[0].name).toBe("dataSource");
                    expect(memberModel.params[0].type).toBe("object");
                    expect(memberModel.params[0].required).toBe(false);
                });
                it("with return type", function () {
                    expect(memberModel.returnType).toBe("void");
                });
                it("with useCases defined via it('?...', ", function () {
                    var useCase1 = memberModel.useCases[0];
                    expect(useCase1.title).toBe("Accepts JSON");
                    expect(useCase1.description).toBe("");
                    expect(useCase1.code).toBe(`componentInst.SetDataSource({ seria1: [] });`);
                    var useCase2 = memberModel.useCases[1];
                    expect(useCase2.title).toBe("Track series changes after binding to remote API");
                    expect(useCase2.description).toBe("");
                    expect(useCase2.code).toBe(`var url = getTestDataSourceApiUrl();
componentInst.SeriesUpdated.AddHandler(function (s, e) {
});
componentInst.SetDataSource(url);`);
                });
            });
        });
    });
});
describe("utilities", function() {
    it("createFromDirectory", function() {
        var result = generator.createFromDirectory(__dirname, "sample1.js");
        expect(result.namespaces.length).toBe(1);
        expect(result.namespaces[0].classes[0].name).toBe("MyComponent");
    });
    describe("findByCompositeKey", function() {
        var apiModel = null;
        beforeEach(function() {
            apiModel = generator.createFromDirectory(__dirname, "sample1.js");
        });
        it("by method name", function() {
            expect(generator.findByCompositeKey(apiModel, "js-MyComponent.SetDataSource").name).toBe("SetDataSource");
        });
    });
});