var CloudCmd, Util, DOM;
(function(CloudCmd, Util, DOM){
    'use strict';
    
    CloudCmd.Help = HelpProto;
        
    function HelpProto(CallBack){
        var Key     = CloudCmd.Key,
            Images  = DOM.Images,
            Help    = this;
            
        function init() {
            Util.loadOnLoad([
                Help.show,
                CloudCmd.View,
            ]);
            
            DOM.Events.addKey(listener);
            DOM.setButtonKey('f1', Help.show);
        }
        
        this.show                       = function() {
            Images.showLoad({top:true});
            
            DOM.cssSet({
                    id      : 'help-css',
                    inner   : '#help {'             +
                                'white-space'       + ': normal;'   +
                                'margin'            + ': 25px;'     +
                              '}'                   +
                              
                              '#help li {'          +
                                'list-style-type' + ': disc;'       +
                              '}'
                });
                
            DOM.ajax({
                url: '/HELP.md', 
                success:  function (pData) {
                    var lData = {text: pData};
                    
                    DOM.ajax({
                        method  : 'post',
                        url     : 'https://api.github.com/markdown',
                        data    : Util.stringifyJSON(lData),
                        success:function(pResult){
                            var lDiv = DOM.anyload({
                                name    : 'div',
                                id      : 'help',
                                inner   : pResult.toString()
                            });
                            
                            Images.hideLoad();
                            CloudCmd.View.show(lDiv);
                        },
                    
                        error: Images.showError
                    });
                },
                
                error:Images.showError
            });
        };
        
        this.hide                       = function() {
            CloudCmd.View.hide();
        };
        
        function listener(pEvent) {
            var lF1         = Key.F1,
                lIsBind     = Key.isBind(),
                lKey        = pEvent.keyCode;
            
            /* если клавиши можно обрабатывать */
            if (lIsBind && lKey === lF1)
                Help.show();
        }
        
        init();
    }
    
})(CloudCmd, Util, DOM);
