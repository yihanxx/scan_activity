/*
[task_local]
# 积分兑换京豆
7 7 7 7 7  jfhd.js, tag=积分兑换京豆, enabled=true
 */
const $ = new Env('积分兑换京豆');
const notify = $.isNode() ? require('./sendNotify') : '';
//Node.js用户请在jdCookie.js处填写京东ck;
const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
let jdNotify = false;//是否关闭通知，false打开通知推送，true关闭通知推送
$.activityUrl = process.env.jfhd ? process.env.jfhd : "";
$.activityId = getQueryString($.activityUrl, 'giftId')
$.Token = "";
$.openCard = false
$.exportActivityIds = ""
$.friendUuid = ""
$.friendUuids = []
$.message = ""
$.helpTimes = -1
$.hasHelpedTimes = 0
$.restartNo = 1
$.LZ_AES_PIN = ""
$.friendUuidId = 0
$.retryCookies = []
//IOS等用户直接用NobyDa的jd cookie
let cookiesArr = [], cookie = '', message;
let lz_jdpin_token_cookie = ''
let activityCookie = ''

const redis = require('redis');
$.redisStatus = process.env.USE_REDIS ? process.env.USE_REDIS : false;
$.signUrl = process.env.JD_SIGN_URL ? process.env.JD_SIGN_URL : '';
if ($.signUrl == '') {
    console.log(`请自行搭建sign接口，并设置环境变量-->\n  export JD_SIGN_URL="你的接口地址"`)
    return
}
let TokenKey = "TOKEN_KEY:"
redisClient = null
if ($.redisStatus) {
    redisClient = redis.createClient({
        url: 'redis://127.0.0.1:6379'
    });
} else {
    console.log(`禁用Redis缓存Token，开启请设置环境变量-->\n  export USE_REDIS=true `)
}

if ($.isNode()) {
    Object.keys(jdCookieNode).forEach((item) => {
        cookiesArr.push(jdCookieNode[item])
    })
    if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {
    };
} else {
    cookiesArr = [$.getdata('CookieJD'), $.getdata('CookieJD2'), ...jsonParse($.getdata('CookiesJD') || "[]").map(item => item.cookie)].filter(item => !!item);
}
!(async () => {

    if ($.redisStatus) {
        redisClient.on('ready', () => {
            console.log('redis已准备就绪')
        })

        redisClient.on('error', err => {
            console.log("redis异常：" + err)

        })
        await redisClient.connect()
        console.log('redis连接成功')
    }

    console.log(`活动链接：${$.activityUrl}`)
    if (!cookiesArr[0]) {
        $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/bean/signIndex.action', { "open-url": "https://bean.m.jd.com/bean/signIndex.action" });
        return;
    }
    for (let i = 0; i < cookiesArr.length; i++) {
        $.Token = ""
        if (cookiesArr[i]) {
            cookie = cookiesArr[i];
            $.UserName = decodeURIComponent(cookie.match(/pt_pin=([^; ]+)(?=;?)/) && cookie.match(/pt_pin=([^; ]+)(?=;?)/)[1])
            $.key = TokenKey + cookie.match(/pt_pin=([^; ]+)(?=;?)/) && cookie.match(/pt_pin=([^; ]+)(?=;?)/)[1]
            $.index = i + 1;
            $.isLogin = true;
            $.nickName = '';
            console.log(`\n******开始【京东账号${$.index}】${$.nickName || $.UserName}*********\n`);
            if (!$.isLogin) {
                $.msg($.name, `【提示】cookie已失效`, `京东账号${$.index} ${$.nickName || $.UserName}\n请重新登录获取\nhttps://bean.m.jd.com/bean/signIndex.action`, { "open-url": "https://bean.m.jd.com/bean/signIndex.action" });

                if ($.isNode()) {
                    await notify.sendNotify(`${$.name}cookie已失效 - ${$.UserName}`, `京东账号${$.index} ${$.UserName}\n请重新登录获取cookie`);
                }
                continue
            }
            await jdmodule();
            if ($.stop) {
                break;
            }
            console.log(`休息一下别被403了`)
            await $.wait(parseInt(Math.random() * 5000 + 1000, 10))
        }
    }
    if ($.isNode()) {
        if ($.message != '') {
            await notify.sendNotify("积分兑换京豆", `${$.message}\n跳转链接\n${$.activityUrl}`)
        }
    }
})()
    .catch((e) => {
        $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
    })
    .finally(() => {
        $.done();
        if ($.redisStatus) {
            redisClient.quit()
            console.log('redis关闭成功')
        }
    })

async function jdmodule() {
    $.domain = $.activityUrl.match(/https?:\/\/([^/]+)/) && $.activityUrl.match(
        /https?:\/\/([^/]+)/)[1] || ''
    $.UA = `jdapp;iPhone;10.2.2;13.1.2;${uuid()};M/5.0;network/wifi;ADID/;model/iPhone8,1;addressid/2308460611;appBuild/167863;jdSupportDarkMode/0;Mozilla/5.0 (iPhone; CPU iPhone OS 13_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1;`
    $.flag = 0
    await getCK();
    console.log("lzToken=" + activityCookie)
    // await takePostRequest("isvObfuscator");
    // console.log('Token:' + $.Token)
    // if ($.Token == '') {
    //     console.log(`获取Token失败`);
    //     return
    // }

    if ($.redisStatus) {
        $.Token = await redisClient.get($.key)
        if ($.Token == '' || $.Token == null) {
            console.log(`未找到缓存的Token，调用Sign接口`)
            await getSign($.domain)
            await takePostRequest("isvObfuscator");
            console.log('Token-->:' + $.Token)
        } else {
            console.log('缓存Token-->:' + $.Token)
        }
    } else {
        await getSign($.domain)
        await takePostRequest("isvObfuscator");
        console.log('Token-->:' + $.Token)
    }

    await takePostRequest("getSimpleActInfoVo");

    await takePostRequest("getMyPing");

    await takePostRequest("accessLog")

    await takePostRequest("activityContent")

    await takePostRequest("getBuyerPoints")
    if ($.exist < $.canExgByPeopDay) {
        console.log(`剩余豆子不足以兑换，退出！`)
        $.message += `剩余豆子不足以兑换，退出！`
        $.stop = true
        return
    }
    if ($.canExgByPeopDay != null && $.canExgByPeopDay == 0) {
        console.log(`今日已兑换过！！`)
        $.message += `京东账号${$.index} ${$.UserName} 今日已兑换过！\n`
        return
    }
    if ($.canExgByActivity != null && $.canExgByActivity == 0) {
        console.log(`本次活动京豆已全部兑换`)
        $.message += `京东账号${$.index} ${$.UserName} 本次活动京豆已全部兑换！\n`
        return
    }
    if ($.canExgTime != null && $.canExgTime == 0) {
        $.message += `京东账号${$.index} ${$.UserName} 本次活动没有兑换次数！\n`
    }

    $.pointRate = $.point1
    if ($.userGrade == 2) {
        $.pointRate = $.point2
    } else if ($.userGrade == 3) {
        $.pointRate = $.point3
    } else if ($.userGrade == 4) {
        $.pointRate = $.point4
    } else if ($.userGrade == 5) {
        $.pointRate = $.point5
    }
    if ($.canExgByPeopDay != null) {
        if ($.userGrade > 0) {
            $.maxExgBeans = Math.floor($.buyerPoints / $.pointRate)
            $.canExgBeans = Math.min($.canExgByPeopDay, $.maxExgBeans)
            console.log(`可兑换的京豆为${$.canExgBeans}`)
            if ($.canExgBeans <= 0) {
                console.log(`积分不足`)
                return
            }
            if ($.userGrade > 0 && $.buyerPoints > 0) {
                await takePostRequest("exgBeans")
                if ($.exchangeError.indexOf(`火爆`) != -1) {
                    console.log(`活动火爆，重新兑换1次`)
                    await takePostRequest("exgBeans")
                }
                if ($.exchangeError.indexOf(`火爆`) != -1) {
                    console.log(`活动火爆，重新兑换2次`)
                    await takePostRequest("exgBeans")
                }
                if ($.exchangeError.indexOf(`火爆`) != -1) {
                    console.log(`活动火爆，重新兑换3次`)
                    await takePostRequest("exgBeans")
                }
                if ($.exchangeError.indexOf(`火爆`) != -1) {
                    console.log(`活动火爆，重新兑换4次`)
                    await takePostRequest("exgBeans")
                }
                if ($.exchangeError.indexOf(`火爆`) != -1) {
                    console.log(`活动火爆，重新兑换5次`)
                    await takePostRequest("exgBeans")
                }
                if ($.exchangeError.indexOf(`火爆`) != -1) {
                    console.log(`活动火爆，重新兑换失败！`)
                }
            }
        }

    }
    if ($.beanLevelCount != null) {
        if ($.userGrade > 0) {
            $.maxExgBeans = Math.floor($.buyerPoints / $.pointRate)
            $.canExgBeans = Math.min($.maxExgBeans, $.beanLevelCount)
            if ($.canExgBeans < $.beanLevelCount) {
                console.log(`积分不足`)
                return
            }
            $.exgTimes = Math.floor($.canExgBeans / $.beanLevelCount)
            $.exgTimes = Math.min($.exgTimes, $.canExgTime)
            console.log(`可兑换${$.exgTimes}次`)
            for (let i = 0; i < $.exgTimes; i++) {
                if ($.userGrade > 0 && $.buyerPoints > 0) {
                    await takePostRequest("exgBeansWithLevel")
                    if ($.exchangeError.indexOf(`火爆`) != -1) {
                        console.log(`活动火爆，重新兑换1次`)
                        await takePostRequest("exgBeansWithLevel")
                    }
                    if ($.exchangeError.indexOf(`火爆`) != -1) {
                        console.log(`活动火爆，重新兑换2次`)
                        await takePostRequest("exgBeansWithLevel")
                    }
                    if ($.exchangeError.indexOf(`火爆`) != -1) {
                        console.log(`活动火爆，重新兑换3次`)
                        await takePostRequest("exgBeansWithLevel")
                    }
                    if ($.exchangeError.indexOf(`火爆`) != -1) {
                        console.log(`活动火爆，重新兑换4次`)
                        await takePostRequest("exgBeansWithLevel")
                    }
                    if ($.exchangeError.indexOf(`火爆`) != -1) {
                        console.log(`活动火爆，重新兑换5次`)
                        await takePostRequest("exgBeansWithLevel")
                    }
                    if ($.exchangeError.indexOf(`火爆`) != -1) {
                        console.log(`活动火爆，重新兑换失败！`)

                    }
                }
            }
        }
    }
    $.exchangeError = ''

}

//运行
function getSign(domain) {
    let myRequest = getSignRequest(domain);
    // console.log(type + '-->'+ JSON.stringify(myRequest))
    return new Promise(async resolve => {
        $.post(myRequest, (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${$.toStr(err, err)}`)
                    console.log(`sign API请求失败，请检查网路重试`)
                } else {
                    dataObj = JSON.parse(data)
                    $.sign = dataObj.data.convertUrlNew
                }
            } catch (e) {
                // console.log(data);
                console.log(e, resp)
            } finally {
                resolve();
            }
        })
    })
}

function getSignRequest(domain, method = "POST") {
    let headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-cn",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie,
        "User-Agent": $.UA,
        "X-Requested-With": "XMLHttpRequest"
    }
    prefixUrl = "https://" + domain
    bodyInner = `{"url":"${prefixUrl}", "id":""}`
    let body = `body=${encodeURIComponent(bodyInner)}&functionId=isvObfuscator`
    // console.log(headers)
    // console.log(headers.Cookie)
    let url = $.signUrl
    return { url: url, method: method, headers: headers, body: body, timeout: 30000 };
}

async function takePostRequest(type) {
    if ($.outFlag) return
    let domain = $.domain;
    let body = ``;
    let method = 'POST'
    let admJson = ''
    switch (type) {
        case 'isvObfuscator':
            url = `https://api.m.jd.com/client.action?functionId=isvObfuscator`;
            body = $.sign
            // console.log("body:" + body)
            break;
        case 'getSimpleActInfoVo':
            url = `https://${$.domain}/customer/getSimpleActInfoVo`;
            body = `activityId=${$.activityId}`;
            break;
        case 'getMyPing':
            url = `https://${$.domain}/customer/getMyPing`;
            body = `userId=${$.venderId}&token=${$.Token}&fromType=APP`;
            break;
        case 'accessLog':
            url = `https://${$.domain}/common/accessLog`;
            let pageurl = `${$.activityUrl}`
            body = `venderId=${$.venderId}&code=${$.activityType}&pin=${encodeURIComponent(encodeURIComponent($.Pin))}&activityId=${$.activityId}&pageUrl=${encodeURIComponent(pageurl)}&subType=`
            break;
        case 'getBuyerPoints':
            url = `https://${$.domain}/mc/wxPointShop/getBuyerPoints`;
            body = `buyerPin=${encodeURIComponent(encodeURIComponent($.Pin))}&venderId=${$.venderId}`;
            break;
        case 'activityContent':
            url = `https://${$.domain}/mc/beans/selectBeansForC`;
            body = `giftId=${$.activityId}&venderId=${$.venderId}&buyerPin=${encodeURIComponent(encodeURIComponent($.Pin))}&beansLevel=`
            break;
        case 'activityContentWithLevel':
            url = `https://${$.domain}/mc/beans/selectBeansForC`;
            body = `giftId=${$.activityId}&venderId=${$.venderId}&buyerPin=${encodeURIComponent(encodeURIComponent($.Pin))}&beansLevel=1`
            break;
        case 'exgBeans':
            url = `https://${$.domain}/mc/wxPointShop/exgBeans`;
            body = `giftId=${$.activityId}&venderId=${$.venderId}&buyerNick=${encodeURIComponent($.nickname)}&buyerPin=${encodeURIComponent(encodeURIComponent($.Pin))}&beansLevel=&exgBeanNum=${$.canExgBeans}`
            break;
        case 'exgBeansWithLevel':
            url = `https://${$.domain}/mc/wxPointShop/exgBeans`;
            body = `giftId=${$.activityId}&venderId=${$.venderId}&buyerNick=${encodeURIComponent($.nickname)}&buyerPin=${encodeURIComponent(encodeURIComponent($.Pin))}&beansLevel=1&exgBeanNum=${$.canExgBeans}`
            break;
        default:
            console.log(`错误${type}`);
    }
    // console.log("body-----:" + body)
    let myRequest = getPostRequest(url, body, method);
    // console.log(type + '-->'+ JSON.stringify(myRequest))
    return new Promise(async resolve => {
        $.post(myRequest, (err, resp, data) => {
            try {
                setActivityCookie(resp)
                if (err) {
                    if (resp && typeof resp.statusCode != 'undefined') {
                        if (resp.statusCode == 493) {
                            console.log('此ip已被限制，请过10分钟后再执行脚本\n')
                            $.outFlag = true
                        }
                    }
                    console.log(`${$.toStr(err, err)}`)
                    console.log(`${type} API请求失败，请检查网路重试`)
                } else {
                    // console.log(data);
                    dealReturn(type, data);
                }
            } catch (e) {
                // console.log(data);
                console.log(e, resp)
            } finally {
                resolve();
            }
        })
    })
}


async function dealReturn(type, data) {
    let res = ''
    try {
        if (type != 'accessLog' || type != 'drawContent') {
            if (data) {
                res = JSON.parse(data);
            }
        }
    } catch (e) {
        console.log(`${type} 执行任务异常`);
        console.log(data);
        $.runFalag = false;
    }
    try {
        switch (type) {
            case 'isvObfuscator':
                if (typeof res == 'object') {
                    if (res.errcode == 0) {
                        if (typeof res.token != 'undefined') $.Token = res.token
                    } else if (res.message) {
                        console.log(`isvObfuscator ${res.message || ''}`)
                    } else {
                        console.log(data)
                    }
                } else {
                    console.log(data)
                }
                break;
            case 'getSimpleActInfoVo':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        if (typeof res.data.shopId != 'undefined') $.shopId = res.data.shopId
                        if (typeof res.data.venderId != 'undefined') $.venderId = res.data.venderId
                        $.activityType = res.data.activityType
                    } else if (res.errorMessage) {
                        console.log(`${type} ${res.errorMessage || ''}`)
                    } else {
                        console.log(`${type} ${data}`)
                    }
                } else {
                    console.log(`${type} ${data}`)
                }
                break;
            case 'getMyPing':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        console.log("MyPin " + res.data.secretPin)
                        if (res.data && typeof res.data.secretPin != 'undefined') $.Pin = res.data.secretPin
                        if (res.data && typeof res.data.nickname != 'undefined') $.nickname = res.data.nickname
                    } else if (res.errorMessage) {
                        console.log(`${type} ${res.errorMessage || ''}`)
                    } else {
                        console.log(`${type} ${data}`)
                    }
                } else {
                    console.log(`${type} ${data}`)
                }
                break;
            case 'getBuyerPoints':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        let data = res.data;
                        console.log(JSON.stringify(data))
                        $.userGrade = data.grade
                        $.buyerPoints = data.buyerPoints
                        console.log(`当前用户等级为${$.userGrade}级，可用积分为${$.buyerPoints}`)
                        if ($.userGrade != 0) {
                            $.retyPoint = $.buyerPoints
                        }
                    } else if (res.errorMessage) {
                        console.log(`${type} ${res.errorMessage || ''}`)
                    } else {
                        console.log(`${type} ${data}`)
                    }
                } else {
                    console.log(`${type} ${data}`)
                }
                break;
            case 'activityContent':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        console.log(JSON.stringify(res.data))
                        let data = res.data
                        $.activityName = $.giftName
                        $.total = data.num
                        console.log(`本次活动总共发放京豆数量为 ${$.total}`)
                        $.usedNum = data.usedNum
                        $.exist = $.total - $.usedNum
                        console.log(`本次活动剩余可兑换豆子数量为 ${$.exist}`)
                        $.canExgByActivity = data.canExgByActivity
                        if ($.canExgByActivity != null) {
                            console.log(`该账号剩余可兑换豆子总量为 ${$.canExgByActivity}`)
                        }
                        $.canExgByPeopDay = data.canExgByPeopDay
                        if ($.canExgByPeopDay != null) {
                            console.log(`该账号本日剩余可兑换豆子数量为 ${$.canExgByPeopDay}`)
                        }
                        $.beanLevelCount = data.beansLevelCount
                        if ($.beanLevelCount != null) {
                            console.log(`该账号每次可兑换豆子数量为 ${$.beanLevelCount}`)
                            $.canExgTime = data.canExgTime
                            console.log(`该账号每次可兑换${$.canExgTime}次豆子`)
                        }

                        $.point1 = data.point1 == null ? 2 : data.point1
                        $.point2 = data.point2 == null ? 2 : data.point1
                        $.point3 = data.point3 == null ? 2 : data.point1
                        $.point4 = data.point4 == null ? 2 : data.point1
                        $.point5 = data.point5 == null ? 2 : data.point1
                    } else {
                        if (res.errorMessage) {
                            console.log(`${type} ${res.errorMessage || ''}`)
                        } else {
                            console.log(`${type} ${data}`)
                        }
                        await takePostRequest("activityContentWithLevel")
                    }
                }
                break;
            case 'activityContentWithLevel':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        console.log(JSON.stringify(res.data))
                        let data = res.data
                        $.activityName = $.giftName
                        $.total = data.num
                        console.log(`本次活动总共发放京豆数量为 ${$.total}`)
                        $.usedNum = data.usedNum
                        $.exist = $.total - $.usedNum
                        console.log(`本次活动剩余可兑换豆子数量为 ${$.exist}`)
                        $.canExgByActivity = data.canExgByActivity
                        if ($.canExgByActivity != null) {
                            console.log(`该账号剩余可兑换豆子总量为 ${$.canExgByActivity}`)
                        }
                        $.canExgByPeopDay = data.canExgByPeopDay
                        if ($.canExgByPeopDay != null) {
                            console.log(`该账号本日剩余可兑换豆子数量为 ${$.canExgByPeopDay}`)
                        }
                        $.beanLevelCount = data.beansLevelCount
                        if ($.beanLevelCount != null) {
                            console.log(`该账号每次可兑换豆子数量为 ${$.beanLevelCount}`)
                            $.canExgTime = data.canExgTime
                            console.log(`该账号每次可兑换${$.canExgTime}次豆子`)
                        }

                        $.point1 = data.point1 == null ? 2 : data.point1
                        $.point2 = data.point2 == null ? 2 : data.point1
                        $.point3 = data.point3 == null ? 2 : data.point1
                        $.point4 = data.point4 == null ? 2 : data.point1
                        $.point5 = data.point5 == null ? 2 : data.point1
                    } else {
                        if (res.errorMessage) {
                            console.log(`${type} ${res.errorMessage || ''}`)
                        } else {
                            console.log(`${type} ${data}`)
                        }
                        await takePostRequest("activityContentWithLevel")
                    }
                }
                break;
            case 'exgBeans':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        console.log(`兑换成功！`)
                        $.message += `京东账号${$.index} ${$.UserName} 成功兑换${$.canExgBeans}\n`
                        $.exchangeError = ''
                    } else {
                        console.log(`兑换失败！`)
                        $.flag = 1
                        $.exchangeError = res.errorMessage
                        console.log(`${type} ${data}`)
                    }
                } else {
                    console.log(`${type} ${data}`)
                }
                break;
            case 'exgBeansWithLevel':
                if (typeof res == 'object') {
                    if (res.result && res.result === true) {
                        console.log(`兑换成功！`)
                        $.message += `京东账号${$.index} ${$.UserName} 成功兑换${$.canExgBeans}\n`
                        $.exchangeError = ''
                    } else {
                        console.log(`兑换失败！`)
                        $.exchangeError = res.errorMessage
                        console.log(`${type} ${data}`)
                        await takePostRequest("exgBeansWithLevel")
                    }
                } else {
                    console.log(`${type} ${data}`)
                }
                break;
            default:
                console.log(`${type}-> ${data}`);
        }
        if (typeof res == 'object') {
            if (res.errorMessage) {
                if (res.errorMessage.indexOf('火爆') > -1) {
                    $.hotFlag = true
                }
            }
        }
    } catch (e) {
        console.log(e)
    }
}

function getCK() {
    return new Promise(resolve => {
        let get = {
            url: `${$.activityUrl}&giftType=4&sid=&un_area=13_1007_4909_59742`,
            followRedirect: false,
            headers: {
                "User-Agent": $.UA,
            },
            timeout: 30000
        }
        // console.log(`${$.activityUrl}&giftType=4&sid=&un_area=13_1007_4909_59742`)
        $.get(get, async (err, resp, data) => {
            try {
                if (err) {
                    if (resp && typeof resp.statusCode != 'undefined') {
                        if (resp.statusCode == 493) {
                            console.log('此ip已被限制，请过10分钟后再执行脚本\n')
                            $.outFlag = true
                        }
                    }
                    console.log(`${$.toStr(err)}`)
                    console.log(`${$.name} cookie API请求失败，请检查网路重试`)
                } else {
                    // console.log(JSON.stringify(data))
                    // let end = data.match(/(活动已经结束)/) && data.match(/(活动已经结束)/)[1] || ''
                    // if (end) {
                    //     $.activityEnd = true
                    //     console.log('活动已结束')
                    // }
                    setActivityCookie(resp)
                }
            } catch (e) {
                $.logErr(e, resp)
            } finally {
                resolve();
            }
        })
    })
}
function timeToTimestamp(time) {
    let timestamp = Date.parse(new Date(time).toString());
    //timestamp = timestamp / 1000; //时间戳为13位需除1000，时间戳为13位的话不需除1000
    console.log(time + "的时间戳为：" + timestamp);
    return timestamp;
    //2021-11-18 22:14:24的时间戳为：1637244864707
}

function getPostRequest(url, body, method = "POST") {
    let headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-cn",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie,
        "User-Agent": $.UA,
        "X-Requested-With": "XMLHttpRequest"
    }
    if (url.indexOf($.domain) > -1) {
        headers["Referer"] = `${$.activityUrl}&sid=&un_area=13_1007_4909_59742`
        headers["Origin"] = `https://${$.domain}`
        headers["Cookie"] = `${lz_jdpin_token_cookie && lz_jdpin_token_cookie || ''}${$.Pin && "AUTH_C_USER=" + $.Pin + ";" || ""}${activityCookie}`
        // headers["Cookie"] = `IsvToken=${$.Token};` + `${lz_jdpin_token_cookie && lz_jdpin_token_cookie || ''}${$.Pin && "AUTH_C_USER=" + $.Pin + ";" || ""}${activityCookie}`
    }
    // console.log(headers)
    // console.log(headers.Cookie)
    return { url: url, method: method, headers: headers, body: body, timeout: 30000 };
}

function setActivityCookie(resp) {
    let LZ_TOKEN_KEY = ''
    let LZ_TOKEN_VALUE = ''
    let lz_jdpin_token = ''
    let setcookies = resp && resp['headers'] && (resp['headers']['set-cookie'] || resp['headers']['Set-Cookie'] || '') || ''
    let setcookie = ''
    if (setcookies) {
        if (typeof setcookies != 'object') {
            setcookie = setcookies.split(',')
        } else setcookie = setcookies
        for (let ck of setcookie) {
            let name = ck.split(";")[0].trim()
            if (name.split("=")[1]) {
                // console.log(name.replace(/ /g,''))
                if (name.indexOf('LZ_TOKEN_KEY=') > -1) LZ_TOKEN_KEY = name.replace(/ /g, '') + ';'
                if (name.indexOf('LZ_TOKEN_VALUE=') > -1) LZ_TOKEN_VALUE = name.replace(/ /g, '') + ';'
                if (name.indexOf('lz_jdpin_token=') > -1) lz_jdpin_token = '' + name.replace(/ /g, '') + ';'
                if (name.indexOf('LZ_AES_PIN=') > -1) $.LZ_AES_PIN = '' + name.replace(/ /g, '') + ';'
            }
        }
    }
    if (LZ_TOKEN_KEY && LZ_TOKEN_VALUE && !$.LZ_AES_PIN) activityCookie = `${LZ_TOKEN_KEY} ${LZ_TOKEN_VALUE}`
    if (LZ_TOKEN_KEY && LZ_TOKEN_VALUE && $.LZ_AES_PIN) activityCookie = `${LZ_TOKEN_KEY} ${LZ_TOKEN_VALUE} ${$.LZ_AES_PIN}`
    if (lz_jdpin_token) lz_jdpin_token_cookie = lz_jdpin_token
    // console.log(activityCookie)
}

function getQueryString(url, name) {
    let reg = new RegExp("(^|[&?])" + name + "=([^&]*)(&|$)");
    let r = url.match(reg);
    if (r != null) {
        return unescape(r[2]);
    }
    return '';
}

async function joinShop() {
    if (!$.joinVenderId) return
    return new Promise(async resolve => {
        $.errorJoinShop = '活动太火爆，请稍后再试'
        let activityId = ``
        if ($.shopactivityId) activityId = `,"activityId":${$.shopactivityId}`
        let body = `{"venderId":"${$.venderId}","shopId":"${$.shopId}","bindByVerifyCodeFlag":1,"registerExtend":{},"writeChildFlag":0${activityId},"channel":406}`
        let h5st = '20220412164634306%3Bf5299392a200d6d9ffced997e5790dcc%3B169f1%3Btk02wc0f91c8a18nvWVMGrQO1iFlpQre2Sh2mGtNro1l0UpZqGLRbHiyqfaUQaPy64WT7uz7E%2FgujGAB50kyO7hwByWK%3B77c8a05e6a66faeed00e4e280ad8c40fab60723b5b561230380eb407e19354f7%3B3.0%3B1649753194306'
        const options = {
            url: `https://api.m.jd.com/client.action?appid=jd_shop_member&functionId=bindWithVender&body=${body}&clientVersion=9.2.0&client=H5&uuid=88888&h5st=${h5st}`,
            headers: {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'cookie': cookie,
                'origin': 'https://shopmember.m.jd.com/',
                'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
            }
        }
        $.get(options, async (err, resp, data) => {
            try {
                data = data && data.match(/jsonp_.*?\((.*?)\);/) && data.match(/jsonp_.*?\((.*?)\);/)[1] || data
                // console.log(data)
                let res = $.toObj(data, data);
                if (res && typeof res == 'object') {
                    if (res && res.success === true) {
                        console.log(res.message)
                        $.errorJoinShop = res.message
                        if (res.result && res.result.giftInfo) {
                            for (let i of res.result.giftInfo.giftList) {
                                console.log(`入会获得:${i.discountString}${i.prizeName}${i.secondLineDesc}`)
                            }
                        }
                    } else if (res && typeof res == 'object' && res.message) {
                        $.errorJoinShop = res.message
                        console.log(`${res.message || ''}`)
                    } else {
                        console.log(data)
                    }
                } else {
                    console.log(data)
                }
            } catch (e) {
                $.logErr(e, resp)
            } finally {
                resolve();
            }
        })
    })
}
function jsonParse(str) {
    if (typeof str == "string") {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.log(e);
            $.msg($.name, '', '请勿随意在BoxJs输入框修改内容\n建议通过脚本去获取cookie')
            return [];
        }
    }
}

function uuid(x = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
    return x.replace(/[xy]/g, function (x) {
        const r = 16 * Math.random() | 0, n = "x" === x ? r : 3 & r | 8;
        return n.toString(36)
    })
}

function randomWord(randomFlag, min, max) {
    var str = "",
        range = min,
        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

    // 随机产生
    if (randomFlag) {
        range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
        pos = Math.round(Math.random() * (arr.length - 1));
        str += arr[pos];
    }
    return str;
}
// prettier-ignore
function Env(t, e) { "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0); class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } isNode() { return "undefined" != typeof module && !!module.exports } isQuanX() { return "undefined" != typeof $task } isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $loon } isLoon() { return "undefined" != typeof $loon } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(h); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null } setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) })) } post(t, e = (() => { })) { if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.post(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) }); else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t)); else if (this.isNode()) { this.initGotEnv(t); const { url: s, ...i } = t; this.got.post(s, i).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } msg(e = t, s = "", i = "", r) { const o = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl; return { "open-url": e, "media-url": s } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t) } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t) } }(t, e) }
