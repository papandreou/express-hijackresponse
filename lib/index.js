var Stream = require('stream').Stream;

require('http').OutgoingMessage.prototype.hijack = function (cb) {
    var writeHead = this.writeHead,
        write = this.write,
        end = this.end,
        originalResponse = this,
        isPaused = false,
        returnedFalseOnWrite = false,
        hijacking = true,
        originalHasEnded = false,
        hijackedResponse = new Stream();

    Stream.call(hijackedResponse);

    hijackedResponse.pause = function () {
        isPaused = true;
        hijackedResponse.emit('pause');
    };

    hijackedResponse.resume = function () {
        process.nextTick(function () {
            isPaused = false;
            if (returnedFalseOnWrite) {
                returnedFalseOnWrite = false;
                hijackedResponse.emit('drain');
            }
            hijackedResponse.emit('resume');
        });
    };

    hijackedResponse.readable = hijackedResponse.writable = true;

    hijackedResponse.write = function (chunk, encoding) {
        return write.call(originalResponse, chunk, encoding);
    };

    hijackedResponse.end = function (chunk, encoding) {
        if (chunk) {
            write.call(originalResponse, chunk, encoding);
        }
        end.call(originalResponse);
    };

    hijackedResponse.__defineGetter__('statusCode', function () {
        return originalResponse.statusCode;
    });

    hijackedResponse.__defineSetter__('statusCode', function (statusCode) {
        originalResponse.statusCode = statusCode;
    });

    hijackedResponse.__proto__ = originalResponse;

    this.writeHead = function (statusCode, headers) {
        if (statusCode) {
            this.statusCode = statusCode;
        }
        if (headers) {
            for (var headerName in headers) {
                this.setHeader(headerName, headers[headerName]);
            }
        }
        this.writeHead = writeHead;
        cb(null, hijackedResponse);
    };

    // Wait for the original response to end, then make the original res.write and res.end work again
    hijackedResponse.unhijack = function (restoreOriginal, cb) {
        if (typeof restoreOriginal === 'function') {
            cb = restoreOriginal;
            restoreOriginal = false;
        }
        if (restoreOriginal) {
            hijacking = false;
        }
        if (originalHasEnded) {
            process.nextTick(function () {
                hijacking = false;
                if (cb) {
                    cb(null, originalResponse);
                }
            });
        } else {
            hijackedResponse.once('originalend', function () {
                hijacking = false;
                if (cb) {
                    cb(null, originalResponse);
                }
            });
        }
    };

    this.write = function (chunk, encoding) {
        if (!this.headerSent && this.writeHead !== writeHead) this._implicitHeader();
        if (hijacking) {
            hijackedResponse.emit('data', chunk, encoding);
            if (isPaused) {
                returnedFalseOnWrite = true;
                return false;
            }
        } else {
            return write.call(this, chunk, encoding);
        }
    };

    this.end = function (chunk, encoding) {
        if (chunk) {
            this.write(chunk, encoding);
        } else if (!this.headerSent && this.writeHead !== writeHead) {
            this._implicitHeader();
        }
        hijackedResponse.emit('originalend');
        originalHasEnded = true;
        if (hijacking) {
            hijackedResponse.emit('end');
        } else {
            end.call(this);
        }
    };
};
