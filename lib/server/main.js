(function() {
    'use strict';
    
    /* Global var accessible from any loaded module */
    global.cloudcmd     = {};
    
    var DIR, LIBDIR, SRVDIR, JSONDIR, HTMLDIR,
        Util,
        UTIL = 'util',
        
        SLASH,
        ISWIN32,
        ext,
        path, fs, zlib, url, pipe, CloudFunc, diffPatch,
        
        OK, FILE_NOT_FOUND, MOVED_PERMANENTLY,
        REQUEST, RESPONSE,
        
        Config = {
            server  : true,
            socket  : true,
            port    : 80
        };
    
    /* Consts */
    
    exports.OK                  = OK                = 200;
                                  MOVED_PERMANENTLY = 301;
    exports.FILE_NOT_FOUND      = FILE_NOT_FOUND    = 404;
    
    exports.REQUEST     = REQUEST           = 'request';
    exports.RESPONSE    = RESPONSE          = 'response';
    
    /* Native Modules*/
    exports.crypto                          = require('crypto'),
    exports.child_process                   = require('child_process'),
    exports.fs          = fs                = require('fs'),
    exports.http                            = require('http'),
    exports.https                           = require('https'),
    exports.path        = path              = require('path'),
    exports.url         = url               = require('url'),
    exports.querystring                     = require('querystring'),
    
    /* Constants */
    /* current dir + 2 levels up */
    exports.WIN32       = ISWIN32           = isWin32();
    exports.SLASH       = SLASH             = '/',
    
    exports.SRVDIR      = SRVDIR            = __dirname + SLASH,
    exports.LIBDIR      = LIBDIR            = path.normalize(SRVDIR + '../'),
    exports.DIR         = DIR               = path.normalize(LIBDIR + '../'),
    exports.HTMLDIR     = HTMLDIR           = DIR + 'html' + SLASH,
    exports.JSONDIR     = JSONDIR           = DIR + 'json' + SLASH,
    
    /* Functions */
    exports.require                         = mrequire,
    exports.librequire                      = librequire,
    exports.srvrequire                      = srvrequire,
    exports.rootrequire                     = rootrequire,
    exports.quietrequire                    = quietrequire,
    
    exports.generateHeaders                 = generateHeaders,
    exports.getQuery                        = getQuery,
    exports.isGZIP                          = isGZIP,
    exports.mainSetHeader                   = mainSetHeader,
    
    exports.sendFile                        = sendFile,
    exports.sendResponse                    = sendResponse,
    exports.sendError                       = sendError,
    exports.redirect                        = redirect,
    
    exports.checkParams                     = checkParams,
    exports.checkCallBackParams             = checkCallBackParams,
    
    /* compitability with old versions of node */
    exports.fs.exists                       = exports.fs.exists || exports.path.exists,
    
    /* Needed Modules */
    
    /* we can not use librequare here */
    exports.util        = Util              = require(LIBDIR + UTIL),
    
    exports.zlib        = zlib              = mrequire('zlib'),
    
    /* Main Information */
    exports.modules                         = jsonrequire('modules');
    exports.ext         = ext               = jsonrequire('ext');
    exports.mainpackage                     = rootrequire('package');
    /* base configuration */
    exports.config                          = Config,
    
    
    /* 
     * Any of loaded below modules could work with global var so
     * it should be initialized first. Becouse of almost any of
     * moudles do not depends on each other all needed information
     * for all modules is initialized hear.
     */
    global.cloudcmd.main                    = exports;
    
    exports.VOLUMES                         = getVolumes(),
    
    /* Additional Modules */
    exports.cloudfunc   = CloudFunc         = librequire('cloudfunc'),
    exports.pipe        = pipe              = srvrequire('pipe'),
    exports.socket                          = srvrequire('socket'),
    exports.express                         = srvrequire('express'),
    exports.auth                            = srvrequire('auth').auth,
    exports.appcache                        = srvrequire('appcache'),
    exports.dir                             = srvrequire('dir'),
    exports.hash                            = srvrequire('hash'),
    diffPatch                               = librequire('diff/diff-match-patch').diff_match_patch,
    exports.diff                            = new (librequire('diff').DiffProto)(diffPatch),
    exports.time                            = srvrequire('time');
    exports.rest                            = srvrequire('rest').api,
    exports.update                          = srvrequire('update'),
    exports.ischanged                       = srvrequire('ischanged');
    exports.commander                       = srvrequire('commander');
    exports.files                           = srvrequire('files');
    
    exports.minify                          = srvrequire('minify').Minify;
    
    /* second initializing after all modules load, so global var is   *
     * totally filled of all information that should know all modules */
    global.cloudcmd.main            = exports;
    
    /**
     * function do safe require of needed module
     * @param {Strin} pSrc
     */
    function mrequire(pSrc) {
        var lModule, msg,
            lError = Util.tryCatch(function() {
                lModule = require(pSrc);
            });
        
        if (lError)
            msg = CloudFunc.formatMsg('require', pSrc, 'no');
        
        Util.log(msg);
        
        return lModule;
    }
    
    function quietrequire(pSrc) {
        var lModule;
        
        Util.tryCatch(function() {
            lModule = require(pSrc);
        });
        
        return lModule;
    }
    
    function rootrequire(pSrc) { return mrequire(DIR + pSrc); }
    
    function librequire(pSrc) { return mrequire(LIBDIR + pSrc); }
    
    function srvrequire(pSrc) { return mrequire(SRVDIR + pSrc); }
    
    function jsonrequire(pSrc) { return mrequire(JSONDIR + pSrc);}
    
    /**
     * function check is current platform is win32
     */
    function isWin32() { return process.platform === 'win32'; }
    
    /**
     * get volumes if win32 or get nothing if nix
     */
    function getVolumes() {
        var lRet = ISWIN32 ? [] : '/';
                
        if (ISWIN32)
            srvrequire('win').getVolumes(function(pVolumes) {
                Util.log(pVolumes);
                exports.VOLUMES = pVolumes;
            });
        
        return lRet;
    }
    
    /**
     * Функция создаёт заголовки файлов
     * в зависимости от расширения файла
     * перед отправкой их клиенту
     * @param pParams
     *  name - имя файла
     * gzip - данные сжаты gzip'ом
     * query
     * https://developers.google.com/speed/docs/best-practices/caching?hl=ru#LeverageProxyCaching
     */
    function generateHeaders(pParams) {
        var lRet    = Util.checkObjTrue(pParams, ['name']);
        
        if (lRet) {
            var p                   = pParams,
                lExt                = Util.getExtension(p.name),
                lType               = ext[lExt] || 'text/plain',
                lContentEncoding    = '';
            
            /* if type of file any, but img - then we shoud specify charset */
            if (!Util.isContainStr(lType, 'img'))
                lContentEncoding = '; charset=UTF-8';
            
            if (Util.isContainStr(p.query, 'download'))
                lType = 'application/octet-stream';
            
            lRet = {
                'Access-Control-Allow-Origin'   : '*',
                'Content-Type'                  : lType + lContentEncoding,
                'last-modified'                 : new Date().toString(),
                'Vary'                          : 'Accept-Encoding'
            };
            
            if (!Util.strCmp(lExt, '.appcache') && p.cache)
                lRet['cache-control']       = 'max-age=' + 31337 * 21;
            
            if (p.gzip)
                lRet['content-encoding']    = 'gzip';
        }
        
        return lRet;
    }
    
    function mainSetHeader(pParams) {
        var p, header, lGzip,
            lRet = checkParams(pParams);
        
        if (lRet) {
            p       = pParams;
            lGzip   = isGZIP(p.request) && p.gzip;
            
            header  = generateHeaders({
                name    : p.name,
                cache   : p.cache,
                gzip    : lGzip,
                query   : getQuery(p.request)
            });
            
            setHeader(header, p.response);
            p.response.statusCode = p.status || OK;
        }
    }
    
    /**
     * send file to client thru pipe
     * and gzip it if client support
     * 
     * @param pName - имя файла
     * @param pGzip - данные сжаты gzip'ом
     */
    function sendFile(pParams) {
        var header, lRet = checkParams(pParams);
        
        if (lRet) {
            var p       = pParams,
                lGzip   = isGZIP(p.request) && p.gzip;
            
            mainSetHeader(pParams);
            
            pipe.create({
                from    : p.name,
                write   : p.response,
                gzip    : lGzip,
                callback: function(error) {
                    if (error)
                        sendError(pParams, error);
                }
            });
        }
        
        return lRet;
    }
     
     
    /**
     * Функция высылает ответ серверу
     * @param pHead     - заголовок
     * @param Data      - данные
     * @param pName     - имя отсылаемого файла
     */
    function sendResponse(pParams, pData, pNotLog) {
        var p, lQuery, lGzip, lHead, data,
            lRet = checkParams(pParams);
        
        if (lRet) {
            p           = pParams;
            data        = p.data || pData;
            lGzip       = isGZIP(p.request);
            
            lHead       = generateHeaders({
                name    : p.name,
                cache   : p.cache,
                gzip    : lGzip,
                query   : lQuery
            });
            
            setHeader(lHead, p.response);
            
            if (!pNotLog)
                Util.log(data);
            
            /* если браузер поддерживает gzip-сжатие - сжимаем данные*/
            Util.ifExec(!lGzip,
                function(pParams) {
                    var lRet = Util.checkObj(pParams, ['data']);
                    
                    if (lRet) {
                        p.status    = pParams.status || p.status;
                        p.data      = pParams.data;
                    }
                    
                    p.response.statusCode = p.status || OK;
                    p.response.end(p.data);
                },
                
                function(pCallBack) {
                    zlib.gzip (data, Util.call(gzipData, {
                        callback    : pCallBack
                    }));
                });
        }
    }
    
    
    /** 
     * redirect to another URL
     */
    function redirect(pParams) {
        var p, header,
            lRet    = Util.checkObjTrue(pParams, [RESPONSE]);
        
        if (lRet) {
            p       = pParams;
            
            header  = {
                'Location': p.url
            };
            
            setHeader(header, p.response);
            p.response.statusCode = MOVED_PERMANENTLY;
            p.response.end();
        }
    }
    
    
    /**
     * send error response
     */
    function sendError(pParams, pError) {
        var p, lRet     = checkParams(pParams);
        
        if (lRet) {
            p           = pParams;
            p.status    = FILE_NOT_FOUND;
            
            if (!p.data && pError)
              p.data    = pError.toString();
            
            sendResponse(p);
        }
    }
    
    /**
     * Функция получает сжатые данные
     * @param pHeader - заголовок файла
     * @pName
     */
    function gzipData(pParams) {
        var lRet    = checkCallBackParams(pParams),
            p       = pParams;
        
        if (lRet)
            lRet = Util.checkObj(pParams.params, ['callback']);
        
        if (lRet) {
            var lCallBack   = p.params.callback,
                lParams       = {};
            
            if (!p.error)
                lParams.data      = p.data;
            else {
                lParams.status    = FILE_NOT_FOUND;
                lParams.data      = p.error.toString();
            }
            
            Util.exec(lCallBack, lParams);
        }
    }
    
    
    function checkCallBackParams(pParams) {
        return Util.checkObj(pParams, ['error', 'data', 'params']);
    }
    
    function checkParams(pParams, pAdditional) {
        var lRet = Util.checkObjTrue( pParams, ['name', REQUEST, RESPONSE] );
        
        if (lRet && pAdditional)
            lRet = Util.checkObjTrue( pParams, pAdditional);
        
        return lRet;
    }
    
    function getQuery(pReq) {
        var lQuery, lParsedUrl;
        
        if (pReq) {
            lParsedUrl  = url.parse(pReq.url);
            lQuery      = lParsedUrl.query;
        }
        
        return lQuery;
    }
    
    function isGZIP(pReq) {
        var lEnc, lGZIP;
        if (pReq) {
            lEnc        = pReq.headers['accept-encoding'] || '';
            lGZIP       = lEnc.match(/\bgzip\b/);
        }
        
        return lGZIP;
    }
    
    function setHeader(header, response) {
        var name;
        
        if (!response.headersSent && Util.isObject(header))
            for (name in header)
                response.setHeader(name, header[name]);
    }
    
})();
