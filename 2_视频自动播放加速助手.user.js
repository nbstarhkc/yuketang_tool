// ==UserScript==
// @name         雨课堂视频自动加速播放助手 (终极跨域秒关自愈版)
// @namespace    http://tampermonkey.net/
// @version      4.7
// @description  自动加速雨课堂视频，支持学堂在线跨域注入，防切屏，完成后秒关，未完成自动刷新自愈
// @author       Antigravity
// @match        *://*.yuketang.cn/*
// @match        *://*.xuetangx.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const FAST_SPEED = 4.0;
    const SLOW_SPEED = 2.0;
    const SLOW_AT_RATIO = 0.8;
    const currentDomain = window.location.hostname;

    function getTargetSpeed(video) {
        const duration = video.duration;
        const current = video.currentTime;

        if (duration && duration > 0) {
            const progress = current / duration;
            return progress >= SLOW_AT_RATIO ? SLOW_SPEED : FAST_SPEED;
        }

        return FAST_SPEED;
    }

    // --- 安全调试面板逻辑 ---
    let logs = [];
    function debug(msg) {
        console.log(`[雨课堂终极助手] ${msg}`);
        logs.push(`${new Date().toLocaleTimeString()}: ${msg}`);
        if (logs.length > 8) logs.shift();

        let debugDiv = document.getElementById('yuketang_debug_log');
        if (!debugDiv) {
            let parent = document.body || document.documentElement;
            if (parent) {
                debugDiv = document.createElement('div');
                debugDiv.id = 'yuketang_debug_log';
                debugDiv.style.position = 'fixed';
                debugDiv.style.top = '10px';
                debugDiv.style.right = '10px';
                debugDiv.style.zIndex = '9999999';
                debugDiv.style.background = 'rgba(0,0,0,0.85)';
                debugDiv.style.color = '#00ff00';
                debugDiv.style.padding = '10px';
                debugDiv.style.borderRadius = '5px';
                debugDiv.style.fontFamily = 'monospace';
                debugDiv.style.fontSize = '12px';
                debugDiv.style.lineHeight = '1.4';
                debugDiv.style.pointerEvents = 'none';
                debugDiv.style.border = '1px solid #00ff00';
                debugDiv.style.maxWidth = '420px';
                parent.appendChild(debugDiv);
            }
        }

        if (debugDiv) {
            let videos = Array.from(document.querySelectorAll('video'));
            let videoStates = videos.map((v, i) => {
                const vt = v.__virtualTime !== undefined ? v.__virtualTime.toFixed(1) : 'N/A';
                const vp = v.__isPlayingVirtually ? '是' : '否';
                const dur = (v.duration && isFinite(v.duration)) ? v.duration.toFixed(1) : '未加载';
                return `视频#${i+1}: 虚拟=${vp}, 进度=${vt}s/${dur}s`;
            }).join('<br>');

            debugDiv.innerHTML = `
                <b>[雨课堂零带宽自愈面板 v4.7]</b><br>
                域名: ${window.location.hostname}<br>
                检测到视频数: ${videos.length}<br>
                ${videoStates}<br>
                -------------------------<br>
                ${logs.join('<br>')}
            `;
        }
    }

    // ================== 网络监控：拦截并显示心跳日志 ==================
    (function() {
        try {
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                this._url = typeof url === 'string' ? url : (url ? url.toString() : '');
                return originalXhrOpen.apply(this, arguments);
            };

            const originalXhrSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(body) {
                if (this._url && (this._url.includes('log') || this._url.includes('video') || this._url.includes('heartbeat'))) {
                    let info = "";
                    try {
                        let c = null, v = null, cc = null;

                        // 1. 尝试从 URL 中获取
                        let params = new URLSearchParams(this._url.includes('?') ? this._url.substring(this._url.indexOf('?')) : '');
                        c = params.get('c');
                        v = params.get('v');
                        cc = params.get('cc');

                        // 2. 如果 URL 没找到，尝试从 POST body 中获取
                        if ((c === null && v === null) && typeof body === 'string') {
                            try {
                                let json = JSON.parse(body);
                                if (json.c !== undefined) c = json.c;
                                if (json.v !== undefined) v = json.v;
                                if (json.cc !== undefined) cc = json.cc;

                                if (json.heart_data && Array.isArray(json.heart_data) && json.heart_data.length > 0) {
                                    // 满足用户强硬要求：在发往服务器的最后一刻，强行劫持并篡改数据包，将 sp 锁定为 2
                                    json.heart_data.forEach(heart => {
                                        if (heart.sp !== undefined) heart.sp = 2;
                                    });
                                    // 将篡改后的数据重新序列化并覆盖真实的发送载荷
                                    body = JSON.stringify(json);
                                    arguments[0] = body;

                                    let lastHeart = json.heart_data[json.heart_data.length - 1];
                                    let cp = lastHeart.cp !== undefined ? lastHeart.cp : '?';
                                    let d = lastHeart.d !== undefined ? lastHeart.d : '?';
                                    let sp = lastHeart.sp !== undefined ? lastHeart.sp : '?';
                                    info = ` [数据: 进度=${cp}/${d}秒, 伪装倍速=${sp}x]`;
                                }
                            } catch(e) {
                                let bodyParams = new URLSearchParams(body);
                                if (bodyParams.has('c')) c = bodyParams.get('c');
                                if (bodyParams.has('v')) v = bodyParams.get('v');
                                if (bodyParams.has('cc')) cc = bodyParams.get('cc');
                            }
                        }

                        if (info === "" && (c !== null || v !== null || cc !== null)) {
                            info = ` [数据: c=${c||'空'}, v=${v||'空'}, cc=${cc||'空'}]`;
                        }
                    } catch(e) {}
                    let endpoint = this._url.split('?')[0];
                    endpoint = endpoint.substring(endpoint.lastIndexOf('/') + 1) || 'API';
                    debug(`[网络心跳] 发送 -> ${endpoint}${info}`);
                }
                return originalXhrSend.apply(this, arguments);
            };

            const originalFetch = window.fetch;
            window.fetch = function() {
                const url = arguments[0] instanceof Request ? arguments[0].url : arguments[0];
                if (typeof url === 'string' && (url.includes('log') || url.includes('video') || url.includes('heartbeat'))) {
                    debug(`[网络心跳] Fetch -> ${url.substring(url.lastIndexOf('/') + 1)}`);
                }
                return originalFetch.apply(this, arguments);
            };
        } catch (e) {
            debug("网络监控模块挂载失败");
        }
    })();

    // ================== 核心：无懈可击的后台定时器与保持活跃机制 ==================
    const scheduler = {
        tasks: [],
        add(fn, interval) {
            this.tasks.push({
                fn,
                interval,
                lastRun: Date.now()
            });
        },
        tick() {
            const now = Date.now();
            this.tasks.forEach(task => {
                if (now - task.lastRun >= task.interval) {
                    task.lastRun = now;
                    try {
                        task.fn();
                    } catch (e) {
                        console.error("Scheduler task error: ", e);
                    }
                }
            });
        }
    };

    // 启动 Web Worker 驱动定时器，彻底防止 Chrome/Edge 后台休眠
    try {
        const workerCode = `
            setInterval(() => {
                self.postMessage('tick');
            }, 100);
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = () => {
            scheduler.tick();
        };
        debug("Web Worker 活跃驱动器启动成功！");
    } catch (e) {
        debug("Web Worker 启动失败，退回到原生定时器：" + e.message);
        setInterval(() => {
            scheduler.tick();
        }, 100);
    }

    // 启动 Web Audio 活跃守护（欺骗浏览器，让其认为该标签页正在播放音频，从而豁免后台挂起）
    let audioContextInstance = null;
    function initKeepAliveAudio() {
        if (audioContextInstance) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            audioContextInstance = new AudioContext();

            // 构造静音音频缓冲区
            const buffer = audioContextInstance.createBuffer(1, 44100, 44100);
            const source = audioContextInstance.createBufferSource();
            source.buffer = buffer;
            source.loop = true;

            const gainNode = audioContextInstance.createGain();
            gainNode.gain.value = 0.001; // 极低音量（静音）

            source.connect(gainNode);
            gainNode.connect(audioContextInstance.destination);
            source.start(0);

            debug("Web Audio 后台活跃守护已初始化");

            // 监听用户点击以激活音频上下文
            const resumeAudio = () => {
                if (audioContextInstance && audioContextInstance.state === 'suspended') {
                    audioContextInstance.resume().then(() => {
                        debug("Web Audio 活跃守护成功激活！");
                        cleanup();
                    });
                } else {
                    cleanup();
                }
            };
            const cleanup = () => {
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
            };
            document.addEventListener('click', resumeAudio);
            document.addEventListener('touchstart', resumeAudio);
            document.addEventListener('keydown', resumeAudio);
        } catch (e) {
            debug("初始化 Web Audio 失败: " + e.message);
        }
    }

    // 启动终极无交互静音保活（利用 Chrome 对包含已播放媒体标签页的豁免机制，哪怕是静音也有效）
    function initMutedKeepAlive() {
        try {
            const audio = document.createElement('audio');
            audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            audio.loop = true;
            audio.muted = true; // 强制静音，浏览器允许无交互自动播放静音媒体
            audio.style.display = 'none';
            document.body.appendChild(audio);
            audio.play().then(() => {
                debug("静音媒体保活机制已启动 (免疫深度休眠)");
            }).catch(() => {});
        } catch(e) {}
    }

    // 立即执行静音媒体保活（无需点击）
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initMutedKeepAlive();
    } else {
        document.addEventListener('DOMContentLoaded', initMutedKeepAlive);
    }

    // ================== 核心：终极防切屏/后台暂停/失焦绕过机制 ==================
    try {
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        document.hasFocus = () => true;

        Object.defineProperty(document, 'onvisibilitychange', { get: () => null, set: () => {}, configurable: true });
        Object.defineProperty(document, 'onblur', { get: () => null, set: () => {}, configurable: true });
        Object.defineProperty(window, 'onblur', { get: () => null, set: () => {}, configurable: true });
        Object.defineProperty(window, 'onfocusout', { get: () => null, set: () => {}, configurable: true });
    } catch (e) {}

    // 核心事件代理机制：屏蔽失焦事件，并强行代理视频事件
    try {
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type === 'blur' || type === 'visibilitychange' || type === 'focusout') {
                return;
            }

            // 【核心黑科技】：如果网页试图监听视频的 pause（暂停）事件，我们对其进行拦截包装
            if (type === 'pause' && this instanceof HTMLVideoElement) {
                const videoEl = this;
                const wrappedListener = function(event) {
                    if (videoEl.__isPlayingVirtually) {
                        debug("成功拦截分发给网页的 pause 事件！");
                        return;
                    }
                    return listener.apply(this, arguments);
                };
                return originalAddEventListener.call(this, type, wrappedListener, options);
            }

            return originalAddEventListener.call(this, type, listener, options);
        };
    } catch (e) {}
    // ===========================================================================

    // 直接提取原生 API
    const realSpeedSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate').set;
    const realMutedSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted').set;
    const realVolumeSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').set;
    const realCurrentTimeSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').set;
    const realCurrentTimeGetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').get;
    const realPausedGetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused').get;
    const realPlay = HTMLMediaElement.prototype.play;
    const realPause = HTMLMediaElement.prototype.pause;

    // 强行拦截网页直接调用 pause()
    HTMLMediaElement.prototype.pause = function() {
        const isEnded = this.ended || (this.duration && realCurrentTimeGetter.call(this) >= this.duration - 0.5);
        if (isEnded || !this.__isPlayingVirtually) {
            return realPause.call(this);
        }
        debug("成功拦截网页调用的 pause()，强行维持后台播放状态！");
    };

    debug("脚本纯净初始化成功！");

    // ===================== 1. 雨课堂主域专属逻辑 (yuketang.cn) =====================
    if (currentDomain.includes('yuketang.cn')) {
        let isHandlingEnd = false;

        window.onVideoEnded = function() {
            if (isHandlingEnd) return;
            isHandlingEnd = true;
            debug("[终极核验] 虚拟进度触达末尾！开始轮询页面状态 (最多等待 45 秒)...");

            let checkCount = 0;
            const checkTimer = setInterval(() => {
                checkCount++;
                const pageText = document.body ? (document.body.innerText || "") : "";
                const match = pageText.match(/\d{4}-\d{2}-\d{2}[\s\S]{0,20}?(?:ui已完成|已完成|100%)/);

                if (match) {
                    clearInterval(checkTimer);
                    debug(`[状态核验] 核验成功：进度已达100% ("${match[0].replace(/\n/g, ' ')}")！立即关闭窗口...`);
                    window.close();
                } else if (checkCount >= 8) { // 8 * 2s = 16s，不用等那么久
                    clearInterval(checkTimer);
                    debug(`[状态核验] 异常：等待超时进度仍未100%！触发自愈机制，正在刷新重来...`);
                    window.location.reload();
                } else {
                    debug(`[状态核验] 等待平台确认中... (第 ${checkCount} 次心跳等待)`);
                }
            }, 2000);
        };

        window.addEventListener('message', (event) => {
            if (event.data === 'yuketang_video_ended') {
                window.onVideoEnded();
            }
        });

        function checkCompletionAndClose() {
            try {
                const pageText = document.body ? (document.body.innerText || "") : "";
                const match = pageText.match(/\d{4}-\d{2}-\d{2}[\s\S]{0,20}?(?:ui已完成|已完成|100%)/);
                if (match) {
                    debug(`检测到页面已完成: "${match[0].replace(/\n/g, ' ')}"！正在立即秒关...`);
                    window.close();
                    return true;
                }
            } catch (e) {}
            return false;
        }

        scheduler.add(() => {
            checkCompletionAndClose();
        }, 500);
    }

    // ===================== 2. 视频控制与自动答题通用逻辑 (全局执行) =====================

    function handleQuizPopup(doc) {
        try {
            let options = doc.querySelectorAll('.answer-option, .option, .el-radio, .el-checkbox, [class*="option"]');
            if (options.length > 0) {
                let firstOpt = options[0];
                if (firstOpt && !firstOpt.classList.contains('is-checked') && !firstOpt.checked) {
                    firstOpt.click();
                    debug("自动勾选了习题选项。");
                }
            }

            let buttons = Array.from(doc.querySelectorAll('button, .btn, .button, [class*="btn"]'));
            buttons.forEach(btn => {
                let text = btn.innerText || "";
                if (text.includes("提交") || text.includes("确定") || text.includes("确认") || text.includes("继续")) {
                    if (btn.offsetHeight > 0) {
                        btn.click();
                        debug(`自动点击了交互按钮: ${text}`);
                    }
                }
            });
        } catch (e) {}
    }

    // ======================== 自动播放启动器 ========================

    function tryClickPlayButton(doc) {
        try {
            const selectors = [
                '.xt_video_player_play_btn',
                '.vjs-big-play-button',
                '.play-btn',
                '.player-btn-play',
                '.prism-big-play-btn',
                '.video-play',
                '[class*="play-btn"]',
                '[class*="play_btn"]',
                '[class*="playBtn"]',
                '[class*="PlayBtn"]',
                'button[aria-label="Play"]',
                'button[aria-label="play"]',
                'button[aria-label="播放"]',
                '.video-js .vjs-big-play-button',
                '[class*="big-play"]',
                '[class*="bigPlay"]',
            ];
            for (const sel of selectors) {
                const btn = doc.querySelector(sel);
                if (btn && btn.offsetHeight > 0) {
                    btn.click();
                    debug("自动点击了播放器按钮: " + sel);
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function tryClickStartButton(doc) {
        try {
            let buttons = Array.from(doc.querySelectorAll('button, .btn, .button, a, [class*="btn"], [role="button"]'));
            for (let btn of buttons) {
                let text = (btn.innerText || "").trim();
                if (text.includes("开始学习") || text.includes("开始观看") ||
                    text.includes("播放") || text.includes("继续学习") ||
                    text.includes("继续观看") || text.includes("开始播放")) {
                    if (btn.offsetHeight > 0) {
                        btn.click();
                        debug(`自动点击了启动按钮: "${text}"`);
                        return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    function clickVideoCenter(video) {
        if (video.__isPlayingVirtually) return;
        try {
            const rect = video.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const doc = video.ownerDocument;
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const el = doc.elementFromPoint(x, y);
                if (el) {
                    el.click();
                    debug("坐标穿透点击中心元素: " + el.tagName + "." + el.className);
                    if (el.parentElement) {
                        el.parentElement.click();
                    }
                }
            }
        } catch (e) {}
    }

    // ======================== 零带宽虚拟挂机控制核心 ========================

    function startVirtualPlayback(video, realDuration) {
        if (video.__isPlayingVirtually) return;

        video.__isPlayingVirtually = true;
        // 强制从 0 开始扫荡，彻底解决“由于中段遗漏导致卡在 80% 无限循环”的致命 Bug
        video.__virtualTime = 0;
        video.__lastVirtualUpdate = Date.now(); // [新增] 初始化虚拟时钟基准
        video.__isEndingChecked = false;
        video.__virtualFinished = false;

        debug(`[零带宽黑科技] 激活成功！真实时长: ${realDuration.toFixed(1)}s，从 ${video.__virtualTime.toFixed(1)}s 开始虚拟狂飙...`);

        applyVirtualShadowProperties(video);

        try {
            realPause.call(video);
            realMutedSetter.call(video, true);
            realVolumeSetter.call(video, 0);
        } catch (e) {}

        // 尝试唤醒 Web Audio 保持活跃状态
        initKeepAliveAudio();
        if (audioContextInstance && audioContextInstance.state === 'suspended') {
            audioContextInstance.resume().catch(() => {});
        }

        setTimeout(() => {
            try {
                video.dispatchEvent(new Event('play'));
                video.dispatchEvent(new Event('playing'));
                debug("主动向网页派发了 play/playing 唤醒事件！");
            } catch(e) {}
        }, 1000);
    }

    // [新增] 替换原来的定时器更新，采用 Delta-Time 模式更新虚拟时间，彻底无视浏览器限频/降频
    scheduler.add(() => {
        let docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument) {
                    docs.push(iframe.contentDocument);
                }
            } catch (e) {}
        });

        let videos = [];
        docs.forEach(doc => {
            try {
                doc.querySelectorAll('video').forEach(v => videos.push(v));
            } catch (e) {}
        });

        videos.forEach(video => {
            if (video.__isPlayingVirtually) {
                const realDuration = video.duration;
                if (realDuration && isFinite(realDuration) && realDuration > 0) {
                    if (!video.__virtualFinished) {
                        const now = Date.now();
                        // 计算自上次更新以来的真实流逝时间
                        const elapsedRealSeconds = (now - (video.__lastVirtualUpdate || now)) / 1000;
                        video.__lastVirtualUpdate = now;

                        // 【核心后台自适应】：放宽防跳跃保护至 300 秒 (5分钟)
                        let dt = elapsedRealSeconds;
                        if (dt > 300.0) dt = 300.0;

                        const speed = getTargetSpeed(video);
                        video.__virtualTime += (speed * dt);

                        if (video.__virtualTime >= realDuration - 0.5) {
                            video.__virtualTime = realDuration;
                            video.__virtualFinished = true;
                            debug(`虚拟播放到达末尾！保持发送心跳，等待平台服务器确认...`);
                            triggerEndCheck(video);
                            video.dispatchEvent(new Event('ended'));
                        }
                    }

                    // 只要处于虚拟播放模式（即使已经触达末尾并在等待平台确认），
                    // 都必须持续派发 timeupdate！因为平台防作弊系统可能需要最新的 timeupdate 才能触发最终心跳！
                    try {
                        realPause.call(video);
                    } catch(e) {}
                    video.dispatchEvent(new Event('timeupdate'));
                }
            }
        });
    }, 250);

    function triggerEndCheck(video) {
        if (video.__isEndingChecked) return;
        video.__isEndingChecked = true;

        if (currentDomain.includes('yuketang.cn')) {
            if (typeof window.onVideoEnded === 'function') {
                window.onVideoEnded();
            }
        } else {
            debug("视频播放结束！向父窗口上报关闭/自愈信号...");
            window.top.postMessage('yuketang_video_ended', '*');
        }
    }

    function createFakeTimeRanges(duration) {
        return {
            length: 1,
            start: (index) => 0,
            end: (index) => duration
        };
    }

    // ======================== 影子属性 - 分阶段应用 ========================

    function applyPhase1Hack(video) {
        if (!video || video.__phase1Hacked) return;
        video.__phase1Hacked = true;

        video.__virtualTime = 0;
        video.__isPlayingVirtually = false;
        video.__isEndingChecked = false;
        video.__virtualFinished = false;
        video.__playAttempts = 0;

        debug(`[阶段1] 对视频应用最小化劫持（仅隐藏倍速）`);

        try {
            delete video.playbackRate;
            Object.defineProperty(video, 'playbackRate', {
                get: () => 2.0,
                set: () => {},
                configurable: true,
                enumerable: true
            });
        } catch (e) {}

        video.addEventListener('loadedmetadata', () => {
            const dur = video.duration;
            if (dur && isFinite(dur) && dur > 0 && !video.__isPlayingVirtually) {
                debug(`[loadedmetadata] 元数据已就绪，启动虚拟播放...`);
                startVirtualPlayback(video, dur);
            }
        });

        video.addEventListener('canplay', () => {
            const dur = video.duration;
            if (dur && isFinite(dur) && dur > 0 && !video.__isPlayingVirtually) {
                debug(`[canplay] 视频可播放，启动虚拟播放...`);
                startVirtualPlayback(video, dur);
            }
        });
    }

    function applyVirtualShadowProperties(video) {
        if (video.__phase2Applied) return;
        video.__phase2Applied = true;

        debug("[阶段2] 虚拟播放已激活，应用全部影子属性...");

        try {
            delete video.paused;
            delete video.currentTime;
            delete video.muted;
            delete video.volume;
            delete video.buffered;
            delete video.readyState;
        } catch (e) {}

        try {
            Object.defineProperty(video, 'paused', {
                get: () => video.__isPlayingVirtually ? false : realPausedGetter.call(video),
                configurable: true,
                enumerable: true
            });
        } catch (e) {}

        try {
            Object.defineProperty(video, 'currentTime', {
                get: () => video.__isPlayingVirtually ? video.__virtualTime : realCurrentTimeGetter.call(video),
                set: (val) => {
                    if (video.__isPlayingVirtually) {
                        // 彻底无视任何网页端对 currentTime 的篡改（包括恢复播放时的向前跳跃）
                        // 保证必定从 0 秒开始，一寸不落地扫过整个视频，完美填补任何历史遗漏的空洞！
                        return;
                    } else {
                        realCurrentTimeSetter.call(video, val);
                    }
                },
                configurable: true,
                enumerable: true
            });
        } catch (e) {}

        try {
            Object.defineProperty(video, 'muted', { get: () => true, set: () => {}, configurable: true });
            Object.defineProperty(video, 'volume', { get: () => 0, set: () => {}, configurable: true });
        } catch (e) {}

        try {
            Object.defineProperty(video, 'buffered', {
                get: () => createFakeTimeRanges(video.duration || 10000),
                configurable: true,
                enumerable: true
            });
            Object.defineProperty(video, 'played', {
                get: () => {
                    return {
                        length: 1,
                        start: () => 0,
                        end: () => video.__virtualTime || 0
                    };
                },
                configurable: true,
                enumerable: true
            });
            Object.defineProperty(video, 'seeking', { get: () => false, configurable: true, enumerable: true });
            Object.defineProperty(video, 'ended', { get: () => !!video.__virtualFinished, configurable: true, enumerable: true });
        } catch (e) {}

        try {
            Object.defineProperty(video, 'readyState', {
                get: () => 4,
                configurable: true,
                enumerable: true
            });
        } catch (e) {}
    }

    // ======================== 主循环：500ms 扫描 ========================
    let loopCount = 0;
    scheduler.add(() => {
        loopCount++;
        let docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument) {
                    docs.push(iframe.contentDocument);
                }
            } catch (e) {}
        });

        docs.forEach(doc => {
            handleQuizPopup(doc);
        });

        let videos = [];
        docs.forEach(doc => {
            try {
                doc.querySelectorAll('video').forEach(v => videos.push(v));
            } catch (e) {}
        });

        if (videos.length === 0 && loopCount <= 40) {
            docs.forEach(doc => {
                tryClickStartButton(doc);
                tryClickPlayButton(doc);
            });
        }

        videos.forEach(video => {
            applyPhase1Hack(video);

            let duration = video.duration;
            let hasDuration = duration && isFinite(duration) && duration > 0;

            if (hasDuration && !video.__isPlayingVirtually && !video.__virtualFinished) {
                startVirtualPlayback(video, duration);
            }

            if (video.__virtualFinished) {
                try {
                    realPause.call(video);
                } catch(e) {}
                return;
            }

            if (video.__isPlayingVirtually) {
                try {
                    realPause.call(video);
                } catch(e) {}
            } else {
                video.__playAttempts = (video.__playAttempts || 0) + 1;

                try {
                    realMutedSetter.call(video, true);
                    realVolumeSetter.call(video, 0);
                    realSpeedSetter.call(video, FAST_SPEED);

                    if (realPausedGetter.call(video)) {
                        realPlay.call(video).then(() => {
                            debug("realPlay() 调用成功！视频开始播放");
                        }).catch((err) => {
                            if (err.name === 'AbortError') {
                                debug("[自动播放] 物理视频已暂停，已成功切换至虚拟挂机模式");
                            } else {
                                debug(`realPlay() 失败: ${err.name} - ${err.message}`);
                            }
                        });

                        if (video.preload !== 'auto') {
                            try { video.preload = 'auto'; } catch(e) {}
                        }

                        // 不要只尝试 20 次就放弃，改成每隔 2 秒尝试一次模拟点击，直到成功加载出时长为止
                        if (video.__playAttempts % 4 === 1) {
                            let doc = video.ownerDocument || document;
                            clickVideoCenter(video);
                            tryClickPlayButton(doc);
                            tryClickStartButton(doc);
                        }
                    }
                } catch (e) {}
            }

            const realTime = realCurrentTimeGetter.call(video);
            const isEnded = video.ended || (video.duration && realTime >= video.duration - 0.5);
            if (isEnded && !video.__isEndingChecked) {
                triggerEndCheck(video);
            }
        });

    }, 500);

})();
