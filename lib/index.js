require('http').OutgoingMessage.prototype.hijack = function (cb) {
    var writeHead = this.writeHead,
        write = this.write,
        end = this.end,
        res = this,
        hijacking = true,
        hijackedResponse = {};

    hijackedResponse.readable = hijackedResponse.writable = true;

    hijackedResponse.write = function (chunk, encoding) {
        write.call(res, chunk, encoding);
    };

    hijackedResponse.end = function (chunk, encoding) {
        if (chunk) {
            write.call(res, chunk, encoding);
        }
        end.call(res);
    };

    hijackedResponse.__defineGetter__('statusCode', function () {
        return res.statusCode;
    });

    hijackedResponse.__defineSetter__('statusCode', function (statusCode) {
        res.statusCode = statusCode;
    });

    hijackedResponse.__proto__ = res;

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

    hijackedResponse.unhijack = function () {
        hijacking = false;
    };

    this.write = function (chunk, encoding) {
        if (!this.headerSent && this.writeHead !== writeHead) this._implicitHeader();
        if (hijacking) {
            hijackedResponse.emit('data', chunk, encoding);
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
        if (hijacking) {
            hijackedResponse.emit('end');
        } else {
            end.call(this);
        }
    };
};
