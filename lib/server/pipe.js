(function () {
    'use strict';
    
    if (!global.cloudcmd)
        return console.log(
             '# pipe.js'                                        + '\n'  +
             '# -----------'                                    + '\n'  +
             '# Module is part of Cloud Commander,'             + '\n'  +
             '# used for work with stream.'                     + '\n'  +
             '# If you wont to see at work call'                + '\n'  +
             '# stream.createPipe'                              + '\n'  +
             '# http://cloudcmd.io'                             + '\n');
    
    var main        = global.cloudcmd.main,
        fs          = main.fs,
        Util        = main.util,
        zlib        = main.zlib;
    
    exports.create  = function(pParams) {
        var lZlib, lError, lMsg, lRead, lWrite, lIsFsWrite,
            p               = pParams;
        
        if (p) {
            lRead           = p.read    || fs.createReadStream(p.from, {
                bufferSize: 4 * 1024
            });
            
            if (p.write)
                lWrite      = p.write;
            else {
                lWrite      = fs.createWriteStream(p.to);
                lIsFsWrite  = true;
            }
            
            lError  = function(pError) {
                Util.exec(p.callback, pError);
            };
            
            if (p.gzip) {
                lZlib       = zlib.createGzip();
                lRead.on('error', lError);
                lRead       = lRead.pipe(lZlib);
            }
            
            lWrite.on('error', lError);
            lRead.on('error', lError);
            
            Util.ifExec(!lIsFsWrite, function() {
                lRead.on('data', function(data) {
                    lWrite.write(data);
                });
                
                lRead.on('end', function() {
                    if (!p.notEnd)
                        lWrite.end();
                    
                    Util.exec(p.callback);
                });
            }, function(pCallBack) {
                lWrite.on('open', pCallBack);
            });
        }
    };
    
})();
