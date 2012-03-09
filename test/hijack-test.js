var vows = require('vows'),
    express = require('express'),
    request = require('request'),
    assert = require('assert');

require('../lib');

function runTestServer(app) {
    // Listen on a vacant TCP port and hand back the url + app
    app.listen(0);
    var address = app.address();
    return {
        hostname: address.address,
        port: address.port,
        host: address.address + ':' + address.port,
        url: 'http://' + address.address + ':' + address.port,
        app: app
    };
};

vows.describe('').addBatch({
    'Create a test server that pipes the hijacked response into itself, then do a request against it': {
        topic: function () {
            var appInfo = runTestServer(
                express.createServer()
                    .use(function (req, res, next) {
                        res.hijack(function (err, res) {
                            res.pipe(res);
                        });
                        next();
                    })
                    .use(function (req, res, next) {
                        res.send("foo");
                    })
            );
            request({
                url: appInfo.url
            }, this.callback);
        },
        'should return "foo"': function (err, res, body) {
            assert.equal(body, 'foo');
        }
    },
    'Create a test server that hijacks the response and passes an error to next(), then run a request against it': {
        topic: function () {
            var appInfo = runTestServer(
                express.createServer()
                    .use(function (req, res, next) {
                        res.hijack(function (err, res) {
                            res.unhijack(function (res) {
                                next(new Error('Error!'));
                            });
                        });
                        next();
                    })
                    .use(function (req, res, next) {
                        res.send("foo");
                    })
                    .use(express.errorHandler())
            );
            request({
                url: appInfo.url
            }, this.callback);
        },
        'should return a 500': function (err, res, body) {
            assert.equal(res.statusCode, 500);
        }
    }
})['export'](module);
