describe("class MyComponent extends ComponentBase", function () {
    var componentInst;
    beforeEach(function () {
        componentInst = createComponentForTests();
    });
    /*
    User story description
    */
    it("?User story title - eg 'How to get editor selection'", function (done) {
        // some common use case / best practice
        // some code that should work
        // some asserts
    });
    /*
    Limitation full description
    */
    it("!Limitation description - eg To create on client side use SomeFactory instead of new()", function () {
        // show how to use this factory...
    });
    /*
    Common info about event for member list
    */
    describe("public OptionChanged: SomeTypedEventHandler", function () {
        /*
        Some more description about this event...
        */
        it("?Various info provided in args...", function (done) {
            componentInst.OptionChanged.AddHandler(function (s, e) {
                if (e.previousValue) {
                    // comment that should be visible in snippet
                    expect(e.previousValue).toBe(true);//#skip#
                }
                done();
            });
            componentInst.RaiseOrChangeSomethingToGetHandlerInvoked();//#skip#
        });
    });
    /*
    some description for method SetDataSource
    */
    describe("public SetDataSource(dataSource?: object): void", function () {
        it("?Accepts JSON", function () {
            componentInst.SetDataSource({ seria1: [] });
            expect(componentInst.Series[0].Name).toBe("someName");//#skip#
        });
        it("!Does not work if SomeRelatedProperty is set to the 12345 value", function () {

        });
        it("?Track series changes after binding to remote API", function (done) {
            var url = getTestDataSourceApiUrl();
            componentInst.SeriesUpdated.AddHandler(function (s, e) {
                expect(componentInst.Series[0].Name).toBe("someName");
                done();
            });
            componentInst.SetDataSource(url);
        });
    });
    /*
     Just some test for private methods - no need to keep 2 test files
     */
    describe("private SetSomethingWrong(dataSource: object): void", function () {
        it("Accepts JSON", function () {
            componentInst.SetDataSource({ seria1: [] });
            expect(componentInst.Series[0].Name).toBe("someName");//#skip#
        });
        it("Accepts remote source URI and updates async", function (done) {
            var url = getTestDataSourceApiUrl();
            componentInst.SeriesUpdated.AddHandler(function (s, e) {
                expect(componentInst.Series[0].Name).toBe("someName");
                done();
            });
            componentInst.SetDataSource(url);
        });
    });
});