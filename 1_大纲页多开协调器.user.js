// ==UserScript==
// @name         雨课堂多线程批量刷课协调器 (悬浮小窗口防挂起版)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  自动扫描未完成列表，同时开启多达5个独立小窗口挂机，彻底解决后台不加载问题，加入Web Audio活跃守护防休眠
// @author       Antigravity
// @match        *://*.yuketang.cn/m/v2/course/normalcourse/logs/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const MAX_CONCURRENT_TABS = 5; // 最大并发窗口数
    let openTabs = [];
    let isRunning = false;

    // --- Web Audio 活跃守护模块 ---
    let keepAliveAudioContext = null;
    let keepAliveOscillator = null;

    function initKeepAliveAudio() {
        if (keepAliveAudioContext) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            keepAliveAudioContext = new AudioContext();

            keepAliveOscillator = keepAliveAudioContext.createOscillator();
            let gainNode = keepAliveAudioContext.createGain();
            gainNode.gain.value = 0.0001; // 几乎静音

            keepAliveOscillator.connect(gainNode);
            gainNode.connect(keepAliveAudioContext.destination);
            keepAliveOscillator.start();

            setInterval(() => {
                if (keepAliveAudioContext && keepAliveAudioContext.state !== 'running') {
                    keepAliveAudioContext.resume().then(() => {
                        console.log("[雨课堂大纲主控] Web Audio 活跃守护成功激活！");
                    }).catch(() => {});
                }
            }, 5000);

            console.log("[雨课堂大纲主控] Web Audio 后台活跃守护已初始化");
        } catch (e) {
            console.log("Web Audio 初始化失败", e);
        }
    }
    // ----------------------------

    // 1. 创建悬浮控制面板
    let panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.bottom = '30px';
    panel.style.right = '30px';
    panel.style.zIndex = '999999';
    panel.style.background = 'linear-gradient(135deg, #1890ff, #096dd9)';
    panel.style.color = '#fff';
    panel.style.padding = '14px 22px';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
    panel.style.cursor = 'pointer';
    panel.style.fontWeight = 'bold';
    panel.style.fontSize = '14px';
    panel.style.transition = 'all 0.3s ease';
    panel.style.userSelect = 'none';
    panel.innerHTML = '🚀 点击启动全自动多开挂机 (最多5开)';
    document.body.appendChild(panel);

    panel.onmouseover = () => panel.style.transform = 'scale(1.05)';
    panel.onmouseout = () => panel.style.transform = 'scale(1)';

    // 【终极抓取内核】：Vue 全量数据扫描 + DOM 文本指纹映射
    function getPendingVideoTasks() {
        let tasksMap = new Map();
        let allElements = document.querySelectorAll('*');

        allElements.forEach(el => {
            try {
                if (el.__vue__) {
                    let vm = el.__vue__;

                    // 1. 直接属性匹配
                    if (vm._props && vm._props.unitData) {
                        let unitData = vm._props.unitData;
                        let progressInfo = vm._props.progressInfo;
                        if (unitData.link_url && unitData.type === 0) {
                            let percent = (progressInfo && progressInfo.percent) !== undefined ? progressInfo.percent : 0;
                            if (percent < 1.0) {
                                tasksMap.set(unitData.link_url, {
                                    url: unitData.link_url,
                                    name: unitData.name,
                                    cardElement: el
                                });
                            }
                        }
                    }

                    // 2. 深度扫描 Vue 实例的数据源 (处理原生 v-for 列表渲染)
                    const checkObject = (obj) => {
                        if (obj && typeof obj === 'object') {
                            if (obj.link_url && obj.type === 0) {
                                let percent = 0;
                                if (obj.percent !== undefined) percent = obj.percent;
                                else if (obj.progress !== undefined) percent = obj.progress;
                                else if (obj.progressInfo && obj.progressInfo.percent !== undefined) percent = obj.progressInfo.percent;

                                if (percent < 1.0) {
                                    tasksMap.set(obj.link_url, {
                                        url: obj.link_url,
                                        name: obj.name,
                                        cardElement: el
                                    });
                                }
                            }
                        }
                    };

                    const scan = (target) => {
                        if (!target) return;
                        Object.keys(target).forEach(key => {
                            let val = target[key];
                            if (Array.isArray(val)) {
                                val.forEach(item => checkObject(item));
                            } else if (val && typeof val === 'object') {
                                checkObject(val);
                            }
                        });
                    };

                    scan(vm._data);
                    scan(vm._props);
                    if (vm.$store && vm.$store.state) {
                        scan(vm.$store.state);
                    }
                }
            } catch (e) {}
        });

        // 3. 为所有匹配到的任务绑定最精准的 DOM 卡片节点（做高亮框指示）
        let tasks = Array.from(tasksMap.values());
        tasks.forEach(task => {
            try {
                let matchedEl = null;
                let candidates = Array.from(document.querySelectorAll('div, li, [class*="unit"], [class*="card"]'));
                for (let el of candidates) {
                    if (el.offsetHeight > 0 && el.innerText && el.innerText.includes(task.name)) {
                        if (!matchedEl || el.innerText.length < matchedEl.innerText.length) {
                            matchedEl = el;
                        }
                    }
                }
                if (matchedEl) {
                    task.cardElement = matchedEl;
                }
            } catch(e) {}
        });

        return tasks;
    }

    function updatePanelStatus() {
        if (!isRunning) return;
        let pending = getPendingVideoTasks().filter(t => !t.cardElement.__isProcessing).length;
        panel.innerHTML = `⚡ 挂机中... (当前窗口数: ${openTabs.length}/${MAX_CONCURRENT_TABS}，剩余视频: ${pending})`;
    }

    function launchNextVideo(index) {
        if (!isRunning) return;

        openTabs = openTabs.filter(tab => tab && !tab.closed);
        updatePanelStatus();

        if (openTabs.length >= MAX_CONCURRENT_TABS) {
            return;
        }

        let pendingTasks = getPendingVideoTasks().filter(t => !t.cardElement.__isProcessing);
        if (pendingTasks.length === 0) {
            panel.innerHTML = '🎉 当前页面所有视频均已挂机完成！';
            panel.style.background = '#52c41a';
            isRunning = false;
            return;
        }

        let task = pendingTasks[0];
        task.cardElement.__isProcessing = true;
        if (task.cardElement && task.cardElement.style) {
            task.cardElement.style.border = "3px dashed #52c41a";
        }

        console.log(`[雨课堂大纲主控] 正在启动视频独立窗口：${task.name}`);

        let width = 550;
        let height = 450;
        let left = 100 + (index % 5) * 60;
        let top = 100 + (index % 5) * 50;

        let newTab = window.open(
            task.url,
            `yuketang_window_${Date.now()}_${index}`,
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,scrollbars=yes`
        );

        if (newTab) {
            openTabs.push(newTab);
            updatePanelStatus();
        } else {
            alert("⚠️ 弹窗被浏览器拦截了！\n\n请在浏览器地址栏右侧点击“已拦截的弹窗”图标，选择【始终允许 yuketang.cn 的弹窗】，并刷新页面重新点击悬浮按钮！");
            task.cardElement.__isProcessing = false;
            isRunning = false;
            panel.innerHTML = '🚀 点击启动全自动多开挂机 (最多5开)';
        }
    }

    panel.onclick = () => {
        if (isRunning) return;

        // 🚀 在用户点击启动按钮的瞬间，激活 Web Audio 活跃守护！
        initKeepAliveAudio();
        if (keepAliveAudioContext && keepAliveAudioContext.state !== 'running') {
            keepAliveAudioContext.resume();
        }

        let tasks = getPendingVideoTasks();
        if (tasks.length === 0) {
            alert("当前页面没有检测到未完成的视频课件！");
            return;
        }

        isRunning = true;
        panel.innerHTML = '🔄 正在建立独立窗口挂机通道...';

        for (let i = 0; i < MAX_CONCURRENT_TABS; i++) {
            launchNextVideo(i);
        }
    };

    setInterval(() => {
        launchNextVideo(openTabs.length);
    }, 4000);

})();
