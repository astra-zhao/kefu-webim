easemobim.channel = function ( config ) {

    var utils = easemobim.utils;


        //监听ack的timer, 每条消息启动一个
    var ackTS = new easemobim.site(),

        //初始监听xmpp的timer, 如果30s后xmpp没有连接成功则处理按钮变为发送，走api发送消息
        firstTS,

        //发消息队列
        sendMsgSite = new easemobim.site(),

        //收消息队列
        receiveMsgSite = new easemobim.site();


    var api = easemobim.api;



    var _uuid = function () {
        var s = [],
            hexDigits = '0123456789abcdef';

        for ( var i = 0; i < 36; i++ ) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }

        s[14] = '4';
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
        s[8] = s[13] = s[18] = s[23] = '-';
     
        return s.join('');
    };


    var _obj = {

        getConnection: function () {

            return new Easemob.im.Connection({ 
                url: config.xmppServer,
                retry: true,
                multiResources: config.resources,
                heartBeatWait: 30000
            });
        },

        send: function ( type ) {

            var id = _uuid();

            switch ( type ) {

                case 'txt':
                    //不是历史记录开启倒计时, 当前只有文本消息支持降级
                    if ( !arguments[2] ) {
                        _detectSendMsgByApi.call(this, id);
                    }


                    _obj.sendText.call(this, arguments[1], arguments[2], arguments[3], id);
                    break;

                case 'img':
                    _obj.sendImg.call(this, arguments[1], arguments[2], id);
                    break;

                case 'file':
                    _obj.sendFile.call(this, arguments[1], arguments[2], id);
                    break;
            };
        },

        sendText: function ( message, isHistory, ext, id ) {

            var me = this;
                
            var msg = new Easemob.im.EmMessage('txt', isHistory ? null : id);
            msg.set({
                value: message || easemobim.textarea.value,
                to: config.toUser,
                success: function ( id ) {
                    /*utils.$Remove(utils.$Dom(id + '_loading'));
                    utils.$Remove(utils.$Dom(id + '_failed'));
                    me.handleTransfer('sending', null, !isHistory && (msg.value === '转人工' || msg.value === '转人工客服'));*/
                },
                fail: function ( id ) {
                    /*utils.addClass(utils.$Dom(id + '_loading'), 'em-hide');
                    utils.removeClass(utils.$Dom(id + '_failed'), 'em-hide');*/
                }
            });

            if ( ext ) {
                utils.extend(msg.body, ext);
            }

            utils.addClass(easemobim.sendBtn, 'disabled');
            if ( !isHistory ) {
                me.setExt(msg);
                me.conn.send(msg.body);
                sendMsgSite.set(id, msg);
                easemobim.textarea.value = '';
                if ( msg.body.ext && msg.body.ext.type === 'custom' ) { return; }
                me.appendDate(new Date().getTime(), config.toUser);
                me.appendMsg(config.user.username, config.toUser, msg);
            } else {
                me.appendMsg(config.user.username, isHistory, msg, true);
            }
        },

        sendImg: function ( file, isHistory, id ) {

            var me = this,
                msg = new Easemob.im.EmMessage('img', isHistory ? null : id);

            msg.set({
                apiUrl: (utils.ssl ? 'https://' : 'http://') + config.restServer,
                file: file || Easemob.im.Utils.getFileUrl(easemobim.realFile.getAttribute('id')),
                to: config.toUser,
                uploadError: function ( error ) {
                    //显示图裂，无法重新发送
                    if ( !Easemob.im.Utils.isCanUploadFileAsync ) {
                        easemobim.swfupload && easemobim.swfupload.settings.upload_error_handler();
                    } else {
                        var id = error.id,
                            wrap = utils.$Dom(id);

                        utils.html(utils.$Class('a.easemobWidget-noline')[0], '<i class="easemobWidget-unimage">I</i>');
                        utils.addClass(utils.$Dom(id + '_loading'), 'em-hide');
                        me.scrollBottom();
                    }
                },
                uploadComplete: function ( data ) {
                    me.handleTransfer('sending');
                },
                success: function ( id ) {
                    utils.$Remove(utils.$Dom(id + '_loading'));
                    utils.$Remove(utils.$Dom(id + '_failed'));
                },
                fail: function ( id ) {
                    utils.addClass(utils.$Dom(id + '_loading'), 'em-hide');
                    utils.removeClass(utils.$Dom(id + '_failed'), 'em-hide');
                },
                flashUpload: easemobim.flashUpload
            });
            if ( !isHistory ) {
                me.setExt(msg);
                me.conn.send(msg.body);
                easemobim.realFile.value = '';
                if ( Easemob.im.Utils.isCanUploadFileAsync ) {
                    me.appendDate(new Date().getTime(), config.toUser);
                    me.appendMsg(config.user.username, config.toUser, msg);
                }
            } else {
                me.appendMsg(config.user.username, file.to, msg, true);
            }
        },

        sendFile: function ( file, isHistory, id ) {

            var me = this,
                msg = new Easemob.im.EmMessage('file', isHistory ? null : id),
                file = file || Easemob.im.Utils.getFileUrl(easemobim.realFile.getAttribute('id'));

            if ( !file || !file.filetype || !config.FILETYPE[file.filetype.toLowerCase()] ) {
                chat.errorPrompt('不支持此文件');
                easemobim.realFile.value = null;
                return false;
            }

            msg.set({
                apiUrl: (utils.ssl ? 'https://' : 'http://') + config.restServer,
                file: file,
                to: config.toUser,
                uploadError: function ( error ) {
                    //显示图裂，无法重新发送
                    if ( !Easemob.im.Utils.isCanUploadFileAsync ) {
                        easemobim.swfupload && easemobim.swfupload.settings.upload_error_handler();
                    } else {
                        var id = error.id,
                            wrap = utils.$Dom(id);

                        utils.html(utils.$Class('a.easemobWidget-noline')[0], '<i class="easemobWidget-unimage">I</i>');
                        utils.addClass(utils.$Dom(id + '_loading'), 'em-hide');
                        me.scrollBottom();
                    }
                },
                uploadComplete: function ( data ) {
                    me.handleTransfer('sending');
                },
                success: function ( id ) {
                    utils.$Remove(utils.$Dom(id + '_loading'));
                    utils.$Remove(utils.$Dom(id + '_failed'));
                },
                fail: function ( id ) {
                    utils.addClass(utils.$Dom(id + '_loading'), 'em-hide');
                    utils.removeClass(utils.$Dom(id + '_failed'), 'em-hide');
                },
                flashUpload: easemobim.flashUpload
            });
            if ( !isHistory ) {
                me.setExt(msg);
                me.conn.send(msg.body);
                easemobim.realFile.value = '';
                if ( Easemob.im.Utils.isCanUploadFileAsync ) {
                    me.appendDate(new Date().getTime(), config.toUser);
                    me.appendMsg(config.user.username, config.toUser, msg);
                }
            } else {
                me.appendMsg(config.user.username, file.to, msg, true);
            }
        },

        handleReceive: function ( msg, type, isHistory ) {
            if ( config.offDuty ) {
                return;
            }


            var me = this;

            //如果是ack消息，清除ack对应的site item，返回
            if ( msg && msg.ext && msg.ext.weichat && msg.ext.weichat.ack_for_msg_id ) {

                var id = msg.ext.weichat.ack_for_msg_id;

                _clearTS.call(me, id);

                return;
            }



            var msgid = me.getMsgid(msg);

            if ( receiveMsgSite.get(msgid) ) {
                return;
            } else {
                msgid && receiveMsgSite.set(msgid, 1);
            }

            //绑定访客的情况有可能会收到多关联的消息，不是自己的不收
            if ( !isHistory && msg.from && msg.from.toLowerCase() != config.toUser.toLowerCase() && !msg.noprompt ) {
                return;
            }

            var message = null;

            if ( msg.ext && msg.ext.weichat && msg.ext.weichat.ctrlType && msg.ext.weichat.ctrlType == 'inviteEnquiry' ) {
                //满意度评价
                type = 'satisfactionEvaluation';  
            } else if ( msg.ext && msg.ext.msgtype && msg.ext.msgtype.choice ) {
                //机器人自定义菜单
                type = 'robertList';  
            } else if ( msg.ext && msg.ext.weichat && msg.ext.weichat.ctrlType === 'TransferToKfHint' ) {
                //机器人转人工
                type = 'robertTransfer';  
            }

            switch ( type ) {
                //text message
                case 'txt':
                    message = new Easemob.im.EmMessage('txt');
                    message.set({value: msg.data});
                    break;
                //emotion message
                case 'face':
                    message = new Easemob.im.EmMessage('txt');
                    var msgStr = '', brief = '';

                    for ( var i = 0, l = msg.data.length; i < l; i++ ) {
                        brief += msg.data[i].type === 'emotion' ? "[表情]" : msg.data[i].data;
                        msgStr += msg.data[i].type === 'emotion' ? "\<img class=\'em-emotion\' src=\'" + msg.data[i].data + "\' alt=\'表情\'\/\>" : msg.data[i].data;
                    }
                    message.set({value: msgStr, emotion: true, brief: brief});
                    break;
                //image message
                case 'img':
                    message = new Easemob.im.EmMessage('img');
                    message.set({file: {url: msg.url}});
                    break;
                //file message
                case 'file':
                    message = new Easemob.im.EmMessage('file');
                    message.set({file: {url: msg.url, filename: msg.filename}});
                    break;
                //satisfaction evaluation message
                case 'satisfactionEvaluation':
                    message = new Easemob.im.EmMessage('list');
                    message.set({value: '请对我的服务做出评价', list: ['\
                        <div class="easemobWidget-list-btns">\
                            <button class="easemobWidget-list-btn js_satisfybtn" data-inviteid="' + msg.ext.weichat.ctrlArgs.inviteId + '"\
                             data-servicesessionid="'+ msg.ext.weichat.ctrlArgs.serviceSessionId + '">立即评价</button>\
                        </div>']});
                    break;
                //robert list message
                case 'robertList':
                    message = new Easemob.im.EmMessage('list');
                    var str = '',
                        robertV = msg.ext.msgtype.choice.items || msg.ext.msgtype.choice.list;

                    if ( robertV.length > 0 ) {
                        str = '<div class="easemobWidget-list-btns">';
                        for ( var i = 0, l = robertV.length; i < l; i++ ) {
                            str += '<button class="easemobWidget-list-btn js_robertbtn" data-id="' + robertV[i].id + '">' + (robertV[i].name || robertV[i]) + '</button>';
                        }
                        str += '</div>';
                    }
                    message.set({value: msg.ext.msgtype.choice.title, list: str});
                    break;
                //transfer from robert to agent
                case 'robertTransfer':
                    message = new Easemob.im.EmMessage('list');
                    var str = '',
                        robertV = [msg.ext.weichat.ctrlArgs];

                    if ( robertV.length > 0 ) {
                        str = '<div class="easemobWidget-list-btns">';
                        for ( var i = 0, l = robertV.length; i < l; i++ ) {
                            str += '<button class="easemobWidget-list-btn js_robertTransferBtn"\
                             data-sessionid="' + robertV[i].serviceSessionId + '" data-id="' + robertV[i].id + '">' + robertV[i].label + '</button>';
                        }
                        str += '</div>';
                    }
                    message.set({ value: msg.data || msg.ext.weichat.ctrlArgs.label, list: str });
                    break;
                default: break;
            }
            
            if ( !isHistory ) {
                
                //get serssion when receive msg
                msg.noprompt || this.getSession();

                if ( msg.ext && msg.ext.weichat ) {
                    if ( msg.ext.weichat.event 
                    && (msg.ext.weichat.event.eventName === 'ServiceSessionTransferedEvent' 
                    || msg.ext.weichat.event.eventName === 'ServiceSessionTransferedToAgentQueueEvent') ) {
                        //transfer msg, show transfer tip
                        this.handleTransfer('transfer');
                    } else if (  msg.ext.weichat.event && msg.ext.weichat.event.eventName === 'ServiceSessionClosedEvent' ) {
                        //service session closed event
                        //hide tip
                        if ( config.agentList && config.agentList[config.toUser] && config.agentList[config.toUser].firstMsg ) {
                            config.agentList[config.toUser].firstMsg = false;
                        }
                        this.session = null;
                        this.sessionSent = false;
                        this.handleTransfer('reply');
                        utils.root || transfer.send(easemobim.EVENTS.ONSESSIONCLOSED, window.transfer.to);
                    } else if ( msg.ext.weichat.event && msg.ext.weichat.event.eventName === 'ServiceSessionOpenedEvent' ) {
                        //service session opened event
                        //fake
                        this.agentCount < 1 && (this.agentCount = 1);
                        //hide tip
                        this.handleTransfer('reply');
                    } else if ( msg.ext.weichat.event && msg.ext.weichat.event.eventName === 'ServiceSessionCreatedEvent' ) {

                    } else {
                        if ( !msg.ext.weichat.agent ) {
                            //switch off
                            this.handleTransfer('reply');
                        } else {
                            //switch on
                            msg.ext.weichat.agent && msg.ext.weichat.agent.userNickname !== '调度员' 
                            && this.handleTransfer('reply', msg.ext.weichat.agent);
                        }
                    }
                }


                //空消息不显示
                if ( !message || !message.value ) {
                    return;
                }

                if ( !msg.noprompt ) {
                    me.messagePrompt(message);
                }
                me.appendDate(new Date().getTime(), msg.from);
                me.resetSpan();
                me.appendMsg(msg.from, msg.to, message);
                me.scrollBottom(50);

                if ( config.receive ) {
                    easemobim.EVENTS.ONMESSAGE.data = {
                        from: msg.from,
                        to: msg.to,
                        message: message
                    };
                    try {
                        utils.root || transfer.send(easemobim.EVENTS.ONMESSAGE, window.transfer.to);
                    } catch ( e ) {}
                }
            } else {
                if ( !message || !message.value ) {
                    return;
                }
                me.appendMsg(msg.from, msg.to, message, true);
            }
        },

        listen: function () {
            var me = this;
                
            me.conn.listen({
                onOpened: function ( info ) {
                    _clearFirstTS();

                    me.reOpen && clearTimeout(me.reOpen);
                    me.token = info.accessToken;
                    me.conn.setPresence();

                    if ( easemobim.textarea.value ) {
                        utils.removeClass(easemobim.sendBtn, 'disabled');
                    }
                    utils.html(easemobim.sendBtn, '发送');

                    me.handleReady();
                }
                , onTextMessage: function ( message ) {
                    me.receiveMsg(message, 'txt');
                }
                , onEmotionMessage: function ( message ) {
                    me.receiveMsg(message, 'face');
                }
                , onPictureMessage: function ( message ) {
                    me.receiveMsg(message, 'img');
                }
                , onFileMessage: function ( message ) {
                    me.receiveMsg(message, 'file');
                }
                , onCmdMessage: function ( message ) {
                    me.receiveMsg(message, 'cmd');
                }
                , onOnline: function () {
                    utils.isMobile && me.open();
                }
                , onOffline: function () {
                    utils.isMobile && me.conn.close();
                }
                , onError: function ( e ) {
                    if ( e.reconnect ) {
                        me.open();
                    } else if ( e.type === 2 ) {
                        me.reOpen || (me.reOpen = setTimeout(function () {
                            me.open();
                        }, 2000));
                    } else {
                        me.conn.stopHeartBeat(me.conn);
                        typeof config.onerror === 'function' && config.onerror(e);
                    }
                }
            });
        },

        handleHistory: function ( chatHistory ) {
            var me = this;

            if ( chatHistory.length > 0 ) {
                utils.each(chatHistory, function ( k, v ) {
                    var msgBody = v.body,
                        msg,
                        isSelf = msgBody.from === config.user.username;

                    if ( msgBody && msgBody.bodies.length > 0 ) {
                        msg = msgBody.bodies[0];
                        if ( msgBody.from === config.user.username ) {
                            //visitors' msg
                            switch ( msg.type ) {
                                case 'img':
                                    msg.url = /^http/.test(msg.url) ? msg.url : config.base + msg.url;
                                    msg.to = msgBody.to;
                                    me.sendImgMsg(msg, true);
                                    break;
                                case 'file':
                                    msg.url = /^http/.test(msg.url) ? msg.url : config.base + msg.url;
                                    msg.to = msgBody.to;
                                    me.sendFileMsg(msg, true);
                                    break;
                                case 'txt':
                                    me.sendTextMsg(msg.msg, true);
                                    break;
                            }
                        } else {
                            //agents' msg

                            //判断是否为满意度调查的消息
                            if ( msgBody.ext && msgBody.ext.weichat && msgBody.ext.weichat.ctrlType && msgBody.ext.weichat.ctrlType == 'inviteEnquiry'
                            //机器人自定义菜单
                            || msgBody.ext && msgBody.ext.msgtype && msgBody.ext.msgtype.choice
                            //机器人转人工
                            || msgBody.ext && msgBody.ext.weichat && msgBody.ext.weichat.ctrlType === 'TransferToKfHint' ) {
                                me.receiveMsg(msgBody, '', true);
                            } else {
                                me.receiveMsg({
                                    msgId: v.msgId,
                                    data: msg.msg,
                                    url: /^http/.test(msg.url) ? msg.url : config.base + msg.url,
                                    from: msgBody.from,
                                    to: msgBody.to
                                }, msg.type, true);
                            }
                        }
                        if ( msg.type === 'cmd'//1.cmd消息 
                        || (msg.type === 'txt' && !msg.msg)//2.空文本消息
                        || receiveMsgSite.get(v.msgId) ) {//3.重复消息
                            
                        } else {
                            me.appendDate(v.timestamp || msgBody.timestamp, isSelf ? msgBody.to : msgBody.from, true);
                        }
                    }
                });
            }
        }
    };


    //收消息轮训通道
    var _receiveMsgChannle = function () {
        setInterval(function () {
            api('receiveMsgChannel', {
                orgName: config.orgName
                , appName: config.appName
                , imServiceNumber: config.toUser
                , tenantId: config.tenantId
            }, function ( msg ) {
                //处理收消息
            });           
        }, 600000);
    };

    //发消息通道
    var _sendMsgChannle = function ( msg, id ) {
        var me = this;

        api('sendMsgChannel', {
            orgName: config.orgName
            , appName: config.appName
            , imServiceNumber: config.toUser
            , tenantId: config.tenantId
        }, function () {
            //发送成功清除
            _clearTS.call(me, id);
        }, function () {
            //失败继续重试
        });
    };

    //消息发送成功，清除timer
    var _clearTS = function ( id ) {
        clearInterval(ackTS.get(id));
        ackTS.remove(id);

        utils.$Remove(utils.$Dom(id + '_loading'));
        utils.$Remove(utils.$Dom(id + '_failed'));
        this.handleTransfer('sending', null, !isHistory && (sendMsgSite.get(id).value === '转人工' || sendMsgSite.get(id).value === '转人工客服'));


        sendMsgSite.remove(id);
    };

    //30s内连上xmpp后清除timer，暂不开启api通道发送消息
    var _clearFirstTS = function () {
        clearTimeout(firstTS);
    }

    //监听ack，超时则开启api通道, 发消息时调用
    var _detectSendMsgByApi = function ( id ) {
        var me = this;

        ackTS.set(
            id,
            setInterval(function () {
                //30s没收到ack使用api发送
                _sendMsgChannle.call(me, sendMsgSite.get(id), id);
            }, 20000)
        );
    };


    firstTS = setTimeout(function () {

        if ( easemobim.textarea.value ) {
            utils.removeClass(easemobim.sendBtn, 'disabled');
        }
        utils.html(easemobim.sendBtn, '发送');

        chat.handleReady();
    }, 30000);
    
    //收消息轮训通道常驻
    _receiveMsgChannle();

    return _obj;
};
