// ==UserScript==
// @name         Luna-WS
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  通过WebSocket连接LunaTranslator实现浏览器上的原文的分词、翻译和查词功能 
// @author       Raindrop213
// @match        *://**/*
// @updateURL    https://raw.githubusercontent.com/raindrop213/Luna-WS/main/luna-ws.js
// @downloadURL  https://raw.githubusercontent.com/raindrop213/Luna-WS/main/luna-ws.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /* 打包脚本 方便后面注入到Iframe */
    const getLunaWSCode = function() {
        return function initFunction() {

        /* ========== 控制面板（面板只在主页面中创建） ========== */
        // 默认用户设置
        const LUNA_DEFAULT_SETTINGS = {
            language: 'zh', // 默认使用中文
            wsUrl: 'ws://localhost:6619',
            floatingTranslation: true,
            verticalPreference: false,
            scrollToParagraph: true,
            autoReadParagraph: false,
            autoReadWord: true,
            offlineModeToggle: false,
            copyToClipboard: false,
            MessageToggle: true,
            // 面板位置和状态设置 - 固定在右上角，默认折叠且自动收缩
            panelPosition: { top: '20px', right: '20px', left: 'auto', panelCollapsed: true, panelRetracted: true },

            sentenceDelimiters: '。．.!?！？…',
            sentenceThreshold: 20,
            minContentLength: 2,
            maxContentLength: 1000,
            removeRuby: true,

            keyBindings: {
                nextParagraph: 'ArrowDown, 1',
                prevParagraph: 'ArrowUp, 2',
                autoPlayMode: 'P, 0',
                closeActive: 'Escape'
            },

            includeSelectors: 'p, h1, h2, h3, h4, h5, h6',
            excludeSelectors: '',
            includeClassIds: '',
            excludeClassIds: '',
            stopContainers: 'article, main, section, div.content, div.main-content'
        };

        // 定义设置验证函数 - 确保关键属性存在且类型正确
        function validateUserSettings(settings) {
            if (!settings || typeof settings !== 'object') {
                console.error('[LunaWS] 设置格式无效，使用默认设置');
                return JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
            }
            
            // 创建验证后的设置对象
            const validatedSettings = {};
            
            // 先复制默认设置
            const defaults = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
            
            // 验证所有基本属性，确保类型正确
            for (const key in defaults) {
                if (key === 'keyBindings') continue; // 键绑定单独处理
                if (key === 'panelPosition') continue; // 面板位置单独处理
                
                // 特殊处理语言设置
                if (key === 'language') {
                    // 验证language必须为'zh'或'en'
                    validatedSettings[key] = (settings[key] === 'zh' || settings[key] === 'en') 
                        ? settings[key] 
                        : defaults[key];
                    
                    if (settings[key] && validatedSettings[key] !== settings[key]) {
                        console.warn(`[LunaWS] 语言设置无效: "${settings[key]}"，使用默认值: "${defaults[key]}"`);
                    }
                    continue;
                }
                
                // 验证面板折叠和收缩状态
                if (key === 'panelCollapsed' || key === 'panelRetracted') {
                    validatedSettings[key] = settings.hasOwnProperty(key) ? !!settings[key] : defaults[key];
                    continue;
                }
                
                // 验证其他属性的类型
                const expectedType = typeof defaults[key];
                const actualType = typeof settings[key];
                
                // 如果属性存在且类型符合预期，使用存储值，否则使用默认值
                if (settings.hasOwnProperty(key) && actualType === expectedType) {
                    validatedSettings[key] = settings[key];
                } else {
                    validatedSettings[key] = defaults[key];
                    
                    if (settings.hasOwnProperty(key)) {
                        console.warn(`[LunaWS] 设置"${key}"类型不匹配 (期望${expectedType}，实际${actualType})，使用默认值`);
                    }
                }
            }
            
            // 处理面板位置属性
            if (settings.panelPosition && typeof settings.panelPosition === 'object') {
                validatedSettings.panelPosition = {
                    top: settings.panelPosition.top || defaults.panelPosition.top,
                    left: settings.panelPosition.left || defaults.panelPosition.left,
                    right: settings.panelPosition.right || defaults.panelPosition.right
                };
            } else {
                validatedSettings.panelPosition = defaults.panelPosition;
            }
            
            // 处理键绑定
            validatedSettings.keyBindings = {}; 
            const defaultBindings = defaults.keyBindings;
            const userBindings = settings.keyBindings || {};
            
            for (const bindingKey in defaultBindings) {
                if (userBindings.hasOwnProperty(bindingKey) && typeof userBindings[bindingKey] === 'string') {
                    // 保留原始结构但标准化大小写（将空格处理为'Space'）
                    validatedSettings.keyBindings[bindingKey] = userBindings[bindingKey]
                        .split(',')
                        .map(key => {
                            // 处理空格键的特殊情况
                            const trimmed = key.trim();
                            if (trimmed.toLowerCase() === 'space') return 'Space';
                            // 其他按键保持不变，大小写的处理由matchUserKey函数负责
                            return trimmed;
                        })
                        .join(', ');
                } else {
                    validatedSettings.keyBindings[bindingKey] = defaultBindings[bindingKey];
                }
            }
            
            return validatedSettings;
        }

        // 声明全局变量
        let userSettings = {};

        // 用于跟踪iframe和主页连接状态的对象
        const connectionTracker = {
            main: { isConnected: false },
            iframes: {}
        };
        
        // 文本翻译映射
        const PANEL_TEXT = {
            "en": {
                lunaWsEnabled: "Connected",
                lunaWsDisabled: "Disconnected",
                collapse: "Collapse",
                settings: "Set",
                saveSettings: "Save",
                resetSettings: "Reset",
                general: "General",
                handle: "Handle",
                shortcuts: "Shortcuts",
                advanced: "Advanced",
                language: "Interface Language:",
                serverUrl: "WebSocket URL:",
                WindowStyle: "Window Style:",
                useFloatingWindow: "Use floating translation window",
                verticalPreference: "Vertical Writing Mode",
                scrollToParagraph: "Auto scroll to paragraph",
                nextParagraph: "Next Paragraph:",
                previousParagraph: "Previous Paragraph:",
                autoReadMode: "Auto Read Mode:",
                autoPlayMode: "Auto Play Mode:",
                closeActive: "Close Active:",
                sentenceDelimiters: "Sentence Delimiters:",
                sentenceThreshold: "Sentence Threshold:",
                minContentLength: "Min Content Length:",
                maxContentLength: "Max Content Length:",
                removeRuby: "Remove Ruby Annotations (rt, rp):",
                autoReadSettings: "Read Settings:",
                autoReadParagraph: "Auto read paragraph",
                autoReadWord: "Auto read word",
                offlineMode: "※Offline Mode (no URL)",
                offlineModeToggle: "Offline Mode Toggle",
                copyToClipboard: "Copy to Clipboard",
                others: "Others",
                MessageToggle: "Show Message",
                settingsSaved: "Settings saved √",
                refreshNow: "Refresh Now",
                refreshLater: "Later",
                confirmReset: "Are you sure you want to reset all settings and refresh?",
                confirmYes: "Yes",
                confirmNo: "No",
                autoPlayStatus: "↻",
                shortcutsHelp: "Please refer to: <a href='https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_key_values' target='_blank'>key values</a><br>Left click to look up<br>Right click to select word<br>Middle click to read sentence or paragraph",
                includeSelectors: "Include HTML Tags:",
                includeSelectorsHelp: "e.g: p, h1, h2, h3, h4, h5, h6, div",
                excludeSelectors: "Exclude HTML Tags:",
                excludeSelectorsHelp: "e.g: a, img, em, dd, code, button",
                includeClassIds: "Include CSS class / id:",
                includeClassIdsHelp: "e.g: .article-content, #main-content",
                excludeClassIds: "Exclude CSS class / id:",
                excludeClassIdsHelp: "e.g: .sidebar, #ads, .popup, #comments",
                stopContainers: "Stop Containers:",
                stopContainersHelp: "e.g: article, main, section, div.content, div.main-content",
                selectorHelp: "Note the writing of class and id<br><kbd>class</kbd> before adding <kbd>.</kbd><br><kbd>id</kbd> before adding <kbd>#</kbd><br>Use commas to separate<br>※ If you don't understand, add multiple <kbd>div</kbd> in the first column to increase the selection rate",
                
            },
            "zh": {
                lunaWsEnabled: "已连接",
                lunaWsDisabled: "未连接",
                collapse: "收起",
                settings: "设置",
                saveSettings: "保存设置",
                resetSettings: "重置设置",
                general: "基本",
                handle: "处理",
                shortcuts: "快捷键",
                advanced: "高级",
                serverUrl: "WebSocket URL:",
                language: "界面语言:",
                WindowStyle: "窗口样式:",
                useFloatingWindow: "使用浮动翻译窗口",
                verticalPreference: "垂直排版模式",
                scrollToParagraph: "自动滚动到段落位置",
                nextParagraph: "下一段落:",
                previousParagraph: "上一段落:",
                autoReadMode: "自动朗读模式:",
                autoPlayMode: "自动播放模式:",
                closeActive: "关闭当前激活:",
                sentenceDelimiters: "句子分隔符:",
                sentenceThreshold: "最小句子长度:",
                minContentLength: "最小内容长度:",
                maxContentLength: "最大内容长度:",
                removeRuby: "去掉注音标记(rt, rp):",
                autoReadSettings: "朗读设置:",
                autoReadParagraph: "自动朗读段落",
                autoReadWord: "自动朗读单词",
                offlineMode: "※离线模式设置（无 URL）",
                offlineModeToggle: "离线模式开关",
                copyToClipboard: "复制到剪贴板",
                others: "其他:",
                MessageToggle: "显示消息",
                settingsSaved: "设置已保存√",
                refreshNow: "立即刷新",
                refreshLater: "稍后刷新",
                confirmReset: "确定要重置所有设置然后刷新吗？",
                confirmYes: "确定",
                confirmNo: "取消",
                autoPlayStatus: "↻",
                shortcutsHelp: "请参考：<a href='https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_key_values' target='_blank'>按键名</a><br>鼠标左键查词<br>右键加选单词<br>鼠标中朗读句子或者段落",
                includeSelectors: "包含HTML标签:",
                includeSelectorsHelp: "例如：p, h1, h2, h3, h4, h5, h6, div",
                excludeSelectors: "排除HTML标签:",
                excludeSelectorsHelp: "例如： a, img, em, dd, code, button",
                includeClassIds: "包含CSS class / id:",
                includeClassIdsHelp: "例如：.article-content, #main-content",
                excludeClassIds: "排除CSS class / id:",
                excludeClassIdsHelp: "例如：.sidebar, #ads, .popup, #comments",
                stopContainers: "停止容器:",
                stopContainersHelp: "例如：article, main, section, div.content, div.main-content",
                selectorHelp: "注意class和id的写法<br><kbd>class</kbd> 前加 <kbd>.</kbd><br><kbd>id</kbd> 前加 <kbd>#</kbd><br>用逗号分隔<br>※ 如果你看不懂请在第一栏加多个加上 <kbd>div</kbd> 提高选中率",
            }
        };

        // 立即初始化用户设置
        initializeUserSettings();
        function initializeUserSettings() {
            try {
                // 先设置默认值
                userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                
                // 尝试读取存储的设置
                const savedSettings = localStorage.getItem('lunaws-settings');
                if (savedSettings) {
                    try {
                        // 解析并验证设置
                        const parsedSettings = JSON.parse(savedSettings);
                        // 保留固定位置设置，不从localStorage读取
                        const panelPosition = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS.panelPosition));
                        
                        // 先验证设置
                        userSettings = validateUserSettings(parsedSettings);
                        
                        // 强制覆盖位置设置
                        userSettings.panelPosition = panelPosition;
                        
                        console.log('[LunaWS] 已加载并验证设置:', userSettings);
                        
                        // 特别检查verticalPreference设置
                        console.log(`[LunaWS] 垂直偏好设置加载状态: ${userSettings.verticalPreference}`);
                    } catch (e) {
                        console.error('[LunaWS] 解析保存的设置失败:', e);
                        // 保持默认设置
                    }
                } else {
                    console.log('[LunaWS] 未找到保存的设置，使用默认设置');
                }
            } catch (e) {
                console.error('初始化用户设置时出错:', e);
                // 确保即使出错也使用默认设置
                userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
            }
        }

        // 控制面板内容设计
        function createControlPanel() {
            // 避免重复创建
            if (document.getElementById('lunaws-panel')) return;

            // 创建控制面板元素
            const panel = document.createElement('div');
            panel.id = 'lunaws-panel';
            panel.className = 'lunaws-control-panel collapsed';
            
            // 根据用户设置应用面板状态
            if (userSettings.panelPosition.panelCollapsed) {
                panel.classList.add('collapsed');
            }
            
            // 应用收缩状态
            if (userSettings.panelPosition.panelRetracted) {
                panel.classList.add('retracted');
            }
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .lunaws-control-panel {
                    position: fixed; z-index: 9999999; overflow: visible !important;
                    top: ${userSettings.panelPosition?.top || '20px'};
                    left: ${userSettings.panelPosition?.left || 'auto'};
                    right: ${userSettings.panelPosition?.right || '20px'};
                    background-color: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    width: 246px; font-size: 14px; max-height: 80vh; color: #333333;
                    overflow-y: auto; transition: all 0.3s ease; writing-mode: horizontal-tb;
                }
                .lunaws-control-panel.collapsed { width: 136px; }
                .lunaws-control-panel.retracted { 
                    transform: translateY(calc(-100% + 28px));
                    border-bottom-left-radius: 10px;
                    border-bottom-right-radius: 10px;
                    box-shadow: 0 3px 5px rgba(0,0,0,0.1);
                }
                .lunaws-control-panel.retracted:hover {
                    transform: translateY(0);
                }
                .lunaws-header {
                    padding: 8px 8px 6px 8px; font-size: 15px; border-bottom: 1px solid #eee;
                    display: flex; justify-content: space-between; align-items: center;
                    cursor: move; /* 添加移动光标样式 */
                }
                .lunaws-setup-panel { padding: 0 8px; }
                .lunaws-title { font-weight: bold; margin-right: 5px; }
                .lunaws-expand-button {
                    cursor: pointer; padding: 2px 6px; font-size: 10px; color: #777; white-space: nowrap;
                    border: 1px solid #ddd; border-radius: 3px; background-color: #f5f5f5; user-select: none;
                }
                .lunaws-expand-button:hover { background-color: #e0e0e0; }
                .lunaws-button {
                    padding: 3px 8px; margin: 0 5px 5px 0; border: none; border-radius: 3px;
                    background-color: #4CAF50; color: white; cursor: pointer;
                }
                .lunaws-button:hover { background-color: #45a049; }
                .lunaws-button:disabled { background-color: #ccc; }
                .lunaws-button.secondary { background-color: #607d8b; }
                .lunaws-button.secondary:hover { background-color: #546e7a; }
                .lunaws-settings-row { margin-bottom: 4px; }
                .lunaws-settings-row label { display: block; font-size: 12px; color: #555; margin: 8px 0px 2px 0px;}
                .lunaws-settings-row input[type="text"], .lunaws-settings-row textarea {
                    width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px;
                    box-sizing: border-box; font-size: 12px; background-color: #ffffff; color: #333333;
                }
                .lunaws-settings-row input[type="text"]::placeholder {
                    color: #999999;
                }
                .lunaws-select {
                    width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; color: #333333;
                    box-sizing: border-box; font-size: 12px; background-color: white; cursor: pointer;
                }
                .lunaws-settings-row textarea { height: 40px; resize: vertical; }
                .lunaws-toggle { display: flex; align-items: center; }
                .lunaws-toggle input[type="checkbox"] { margin-right: 5px; }
                .lunaws-tabs {
                    display: flex; border-bottom: 1px solid #ddd; margin-top: 10px;
                }
                .lunaws-tab {
                    padding: 4px 10px; cursor: pointer; border-radius: 3px 3px 0 0;
                    font-size: 12px; color: #333333;
                }
                .lunaws-tab.active {
                    border: 1px solid #ddd; border-bottom: 1px solid #fff;
                    margin-bottom: -1px; background-color: #f9f9f9;
                }
                .lunaws-tab-content { display: none; padding: 10px 0; }
                .lunaws-tab-content.active { display: block; }
                .lunaws-settings-saved {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 100000;
                    text-align: center;
                    min-width: 300px;
                    writing-mode: horizontal-tb;
                }
                .lunaws-settings-saved .message { margin-bottom: 15px; color: #333; }
                .lunaws-settings-saved .buttons { display: flex; justify-content: center; gap: 10px; }
                .lunaws-settings-saved .lunaws-button { padding: 5px 15px; font-size: 13px; }
                
                /* 状态指示器样式 */
                .lunaws-status { display: flex; gap: 3px; padding: 4px 8px;}
                .lunaws-status-main { font-size: 11px; }
                .lunaws-status-iframe { font-size: 11px; margin-left: auto; }
                .lunaws-status-autoplay { 
                    position: absolute;
                    bottom: -20px;
                    left: -7px;
                    background: transparent;
                    border: none;
                    font-size: 25px;
                    font-weight: bold;
                    color: #27ae60;
                    box-shadow: none;
                    z-index: 9999;
                    pointer-events: none; /* 使其不接收鼠标事件，点击可穿透 */
                }
                .lunaws-status-red { color: #c0392b; }
                .lunaws-status-orange { color: #d35400; }
                .lunaws-status-green { color: #27ae60; }
                .lunaws-status-gray { color:rgb(122, 122, 122); }
                .lunaws-status-main:hover::after {
                    content: attr(data-status);
                    position: absolute;
                    left: 20px;
                    top: 0;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    white-space: nowrap;
                }
                .lunaws-help { font-size: 12px; color: #666; }
                kbd { background-color: #f0f0f0; border-radius: 3px;
                    color: #333333; padding: 2px 4px; font-size: 12px; 
                }

            `;
            document.head.appendChild(style);
            
            // 确保已经初始化了用户设置并验证语言设置
            if (!userSettings || !userSettings.language || (userSettings.language !== 'zh' && userSettings.language !== 'en')) {
                console.error('[LunaWS] 创建控制面板时用户设置或语言无效，重新验证设置');
                
                // 重新验证或使用默认设置
                if (userSettings && typeof userSettings === 'object') {
                    userSettings = validateUserSettings(userSettings);
                } else {
                    userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                }
            }

            // 获取有效的语言设置
            const lang = userSettings.language || 'zh';

            console.log('[LunaWS] 创建控制面板，当前语言:', lang, 'userSettings:', userSettings);
            panel.innerHTML = `
                <div class="lunaws-header">
                    <div class="lunaws-title">LunaWS</div>
                    <div class="lunaws-expand-button" id="lunaws-toggle-panel">${PANEL_TEXT[lang].settings}</div>
                </div>

                <div class="lunaws-setup-panel" style="display:none;">
                    <div class="lunaws-tabs">
                        <div class="lunaws-tab active" data-tab="general">${PANEL_TEXT[lang].general}</div>
                        <div class="lunaws-tab" data-tab="handle">${PANEL_TEXT[lang].handle}</div>
                        <div class="lunaws-tab" data-tab="shortcuts">${PANEL_TEXT[lang].shortcuts}</div>
                        <div class="lunaws-tab" data-tab="advanced">${PANEL_TEXT[lang].advanced}</div>
                    </div>
                    
                    <!-- 基本设置 -->
                    <div class="lunaws-tab-content active" data-tab="general">
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].language}</label>
                            <select id="lunaws-language" class="lunaws-select">
                                <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
                                <option value="zh" ${lang === 'zh' ? 'selected' : ''}>中文</option>
                            </select>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].serverUrl}</label>
                            <input type="text" id="lunaws-ws-url" value="${userSettings.wsUrl || 'ws://localhost:6619'}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].WindowStyle}</label>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-floating-translation" ${userSettings.floatingTranslation ? 'checked' : ''}>
                                <label for="lunaws-floating-translation">${PANEL_TEXT[lang].useFloatingWindow}</label>
                            </div>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-vertical-preference" ${userSettings.verticalPreference ? 'checked' : ''}>
                                <label for="lunaws-vertical-preference">${PANEL_TEXT[lang].verticalPreference}</label>
                            </div>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-scroll-to-paragraph" ${userSettings.scrollToParagraph ? 'checked' : ''}>
                                <label for="lunaws-scroll-to-paragraph">${PANEL_TEXT[lang].scrollToParagraph}</label>
                            </div>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].autoReadSettings}</label>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-auto-read-paragraph" ${userSettings.autoReadParagraph ? 'checked' : ''}>
                                <label for="lunaws-auto-read-paragraph">${PANEL_TEXT[lang].autoReadParagraph}</label>
                            </div>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-auto-read-word" ${userSettings.autoReadWord ? 'checked' : ''}>
                                <label for="lunaws-auto-read-word">${PANEL_TEXT[lang].autoReadWord}</label>
                            </div>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].offlineMode}</label>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-offline-mode" ${userSettings.offlineModeToggle ? 'checked' : ''}>
                                <label for="lunaws-offline-mode">${PANEL_TEXT[lang].offlineModeToggle}</label>
                            </div>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-copy-mode" ${userSettings.copyToClipboard ? 'checked' : ''}>
                                <label for="lunaws-copy-mode">${PANEL_TEXT[lang].copyToClipboard}</label>
                            </div>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].others}</label>
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-message-toggle" ${userSettings.MessageToggle ? 'checked' : ''}>
                                <label for="lunaws-message-toggle">${PANEL_TEXT[lang].MessageToggle}</label>
                            </div>
                        </div>
                    </div>

                    <!-- 处理设置 -->
                    <div class="lunaws-tab-content" data-tab="handle">
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].sentenceDelimiters}</label>
                            <input type="text" id="lunaws-sentence-delimiters" value="${userSettings.sentenceDelimiters || '。．.!?！？…'}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].sentenceThreshold}</label>
                            <input type="text" id="lunaws-sentence-threshold" value="${userSettings.sentenceThreshold || 20}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].minContentLength}</label>
                            <input type="text" id="lunaws-min-content-length" value="${userSettings.minContentLength || 2}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].maxContentLength}</label>
                            <input type="text" id="lunaws-max-content-length" value="${userSettings.maxContentLength || 1000}">
                        </div>
                        <div class="lunaws-settings-row">
                            <div class="lunaws-toggle">
                                <input type="checkbox" id="lunaws-remove-ruby" ${userSettings.removeRuby !== false ? 'checked' : ''}>
                                <label for="lunaws-remove-ruby">${PANEL_TEXT[lang].removeRuby}</label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 快捷键设置 -->
                    <div class="lunaws-tab-content" data-tab="shortcuts">
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].nextParagraph}</label>
                            <input type="text" id="lunaws-next-para-key" value="${userSettings.keyBindings.nextParagraph || 'ArrowDown, 1'}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].previousParagraph}</label>
                            <input type="text" id="lunaws-prev-para-key" value="${userSettings.keyBindings.prevParagraph || 'ArrowUp, 2'}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].autoPlayMode}</label>
                            <input type="text" id="lunaws-play-para-key" value="${userSettings.keyBindings.autoPlayMode || 'P, 0'}">
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].closeActive}</label>
                            <input type="text" id="lunaws-close-active-key" value="${userSettings.keyBindings.closeActive || 'Escape'}">
                        </div>
                        <div class="lunaws-settings-row">
                            <div class="lunaws-help">${PANEL_TEXT[lang].shortcutsHelp}</div>
                        </div>
                    </div>

                    <!-- 高级设置 -->
                    <div class="lunaws-tab-content" data-tab="advanced">
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].includeSelectors}</label>
                            <textarea id="lunaws-include-selectors" placeholder="${PANEL_TEXT[lang].includeSelectorsHelp}">${userSettings.includeSelectors || 'p, h1, h2, h3, h4, h5, h6'}</textarea>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].excludeSelectors}</label>
                            <textarea id="lunaws-exclude-selectors" placeholder="${PANEL_TEXT[lang].excludeSelectorsHelp}">${userSettings.excludeSelectors || ''}</textarea>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].includeClassIds}</label>
                            <textarea id="lunaws-include-class-ids" placeholder="${PANEL_TEXT[lang].includeClassIdsHelp}">${userSettings.includeClassIds || ''}</textarea>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].excludeClassIds}</label>
                            <textarea id="lunaws-exclude-class-ids" placeholder="${PANEL_TEXT[lang].excludeClassIdsHelp}">${userSettings.excludeClassIds || ''}</textarea>
                        </div>
                        <div class="lunaws-settings-row">
                            <label>${PANEL_TEXT[lang].stopContainers}</label>
                            <textarea id="lunaws-stop-containers" placeholder="${PANEL_TEXT[lang].stopContainersHelp}">${userSettings.stopContainers || 'article, main, section, div.content, div.main-content'}</textarea>
                        </div>
                        <div class="lunaws-settings-row">
                            <div class="lunaws-help">${PANEL_TEXT[lang].selectorHelp}</div>
                        </div>
                    </div>
                    
                    <div class="lunaws-settings-row">
                        <button id="lunaws-save-settings" class="lunaws-button">${PANEL_TEXT[lang].saveSettings}</button>
                        <button id="lunaws-reset-settings" class="lunaws-button secondary">${PANEL_TEXT[lang].resetSettings}</button>
                    </div>
                </div>

                <!-- 保存成功提示 -->
                <div id="lunaws-settings-saved-template" style="display:none;">
                    <div class="lunaws-settings-saved">
                        <div class="message">${PANEL_TEXT[lang].settingsSaved}</div>
                        <div class="buttons">
                            <button class="lunaws-button">${PANEL_TEXT[lang].refreshNow}</button>
                            <button class="lunaws-button secondary">${PANEL_TEXT[lang].refreshLater}</button>
                        </div>
                    </div>
                </div>

                <!-- 重置确认提示 -->
                <div id="lunaws-reset-confirm-template" style="display:none;">
                    <div class="lunaws-settings-saved">
                        <div class="message">${PANEL_TEXT[lang].confirmReset}</div>
                        <div class="buttons">
                            <button class="lunaws-button" id="lunaws-confirm-reset">${PANEL_TEXT[lang].confirmYes}</button>
                            <button class="lunaws-button secondary">${PANEL_TEXT[lang].confirmNo}</button>
                        </div>
                    </div>
                </div>

                <div class="lunaws-status" id="lunaws-status" onclick="updateConnectionStatusDisplay()">
                    <span class="lunaws-status-main lunaws-status-red">main 0/1</span>
                    <span class="lunaws-status-iframe lunaws-status-gray">iframe 0/0</span>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // 添加事件处理
            setupControlPanelEvents();
        }

        // 设置控制面板事件
        function setupControlPanelEvents() {
            try {
                // 验证控件是否已创建
                if (!document.getElementById('lunaws-include-selectors')) {
                    console.log('[LunaWS] 控件尚未创建，无法设置事件');
                    return;
                }
                
                // 添加事件监听器
                document.getElementById('lunaws-toggle-panel').addEventListener('click', toggleControlPanel);
                document.getElementById('lunaws-save-settings').addEventListener('click', saveUserSettings);
                document.getElementById('lunaws-reset-settings').addEventListener('click', resetUserSettings);
                
                // 标签页切换
                document.querySelectorAll('.lunaws-tab').forEach(tab => {
                    tab.addEventListener('click', function() {
                        const tabName = this.getAttribute('data-tab');
                        document.querySelectorAll('.lunaws-tab').forEach(t => t.classList.remove('active'));
                        this.classList.add('active');
                        
                        document.querySelectorAll('.lunaws-tab-content').forEach(content => {
                            content.classList.remove('active');
                        });
                        document.querySelector(`.lunaws-tab-content[data-tab="${tabName}"]`).classList.add('active');
                    });
                });

                // 实现面板拖动功能
                const panel = document.getElementById('lunaws-panel');
                const header = panel.querySelector('.lunaws-header');
                let isDragging = false;
                let dragOffsetX, dragOffsetY;
                
                // 鼠标按下开始拖动
                header.addEventListener('mousedown', function(e) {
                    // 如果点击的是展开/折叠按钮，则不触发拖动
                    if (e.target === document.getElementById('lunaws-toggle-panel')) {
                        return;
                    }
                    
                    isDragging = true;
                    
                    // 记录鼠标位置与面板的相对偏移
                    const rect = panel.getBoundingClientRect();
                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                    
                    // 添加拖动时的样式
                    panel.style.transition = 'none';
                    header.style.cursor = 'grabbing';
                    
                    // 防止选中文本
                    e.preventDefault();
                });
                
                // 移动面板
                document.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    
                    // 计算新位置
                    let left = e.clientX - dragOffsetX;
                    let top = e.clientY - dragOffsetY;
                    
                    // 确保面板不会超出屏幕边界
                    const maxX = window.innerWidth - panel.offsetWidth;
                    const maxY = window.innerHeight - panel.offsetHeight;
                    
                    left = Math.max(0, Math.min(left, maxX));
                    top = Math.max(0, Math.min(top, maxY));
                    
                    // 使用position设置位置
                    panel.style.left = left + 'px';
                    panel.style.top = top + 'px';
                    panel.style.right = 'auto';
                    
                    // 不再更新位置到用户设置，仅更新UI
                    // 如果移到顶部附近，自动收缩面板
                    if (top < 10) {
                        if (!panel.classList.contains('retracted')) {
                            panel.classList.add('retracted');
                        }
                    } else {
                        if (panel.classList.contains('retracted')) {
                            panel.classList.remove('retracted');
                        }
                    }
                });

                // 停止拖动
                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                        isDragging = false;
                        panel.style.transition = '';
                        header.style.cursor = 'move';
                    }
                });
                
                console.log('[LunaWS] 控制面板事件设置完成');
            } catch (e) {
                console.error('[LunaWS] 设置控制面板事件时出错:', e);
            }
        }
    
        // 保存用户设置
        function saveUserSettings() {
            // 获取所有设置值
            if (document.getElementById('lunaws-include-selectors')) {
                const newSettings = {
                    language: document.getElementById('lunaws-language').value,
                    wsUrl: document.getElementById('lunaws-ws-url').value,
                    floatingTranslation: document.getElementById('lunaws-floating-translation').checked,
                    verticalPreference: document.getElementById('lunaws-vertical-preference').checked,
                    scrollToParagraph: document.getElementById('lunaws-scroll-to-paragraph').checked,
                    autoReadParagraph: document.getElementById('lunaws-auto-read-paragraph').checked,
                    autoReadWord: document.getElementById('lunaws-auto-read-word').checked,
                    offlineModeToggle: document.getElementById('lunaws-offline-mode').checked,
                    copyToClipboard: document.getElementById('lunaws-copy-mode').checked,
                    MessageToggle: document.getElementById('lunaws-message-toggle').checked,

                    sentenceDelimiters: document.getElementById('lunaws-sentence-delimiters').value,
                    sentenceThreshold: parseInt(document.getElementById('lunaws-sentence-threshold').value) || 20,
                    minContentLength: parseInt(document.getElementById('lunaws-min-content-length').value) || 2,
                    maxContentLength: parseInt(document.getElementById('lunaws-max-content-length').value) || 1000,
                    removeRuby: document.getElementById('lunaws-remove-ruby').checked,

                    keyBindings: {
                        nextParagraph: document.getElementById('lunaws-next-para-key').value,
                        prevParagraph: document.getElementById('lunaws-prev-para-key').value,
                        autoPlayMode: document.getElementById('lunaws-play-para-key').value,
                        closeActive: document.getElementById('lunaws-close-active-key').value
                    },

                    includeSelectors: document.getElementById('lunaws-include-selectors').value,
                    excludeSelectors: document.getElementById('lunaws-exclude-selectors').value,
                    includeClassIds: document.getElementById('lunaws-include-class-ids').value,
                    excludeClassIds: document.getElementById('lunaws-exclude-class-ids').value,
                    stopContainers: document.getElementById('lunaws-stop-containers').value,
                    
                    // 使用默认面板位置
                    panelPosition: JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS.panelPosition))
                };
                
                // 验证设置并更新全局变量
                userSettings = validateUserSettings(newSettings);
            }
            
            // 保存到localStorage
            localStorage.setItem('lunaws-settings', JSON.stringify(userSettings));
            
            // 显示保存成功提示
            const template = document.getElementById('lunaws-settings-saved-template');
            const notification = template.querySelector('.lunaws-settings-saved').cloneNode(true);
            
            // 添加刷新按钮的事件监听器
            const refreshNowButton = notification.querySelector('.lunaws-button');
            const refreshLaterButton = notification.querySelector('.lunaws-button.secondary');
            
            // 立即刷新按钮
            if (refreshNowButton) {
                refreshNowButton.addEventListener('click', function() {
                    window.location.reload();
                });
            }
            
            // 稍后刷新按钮
            if (refreshLaterButton) {
                refreshLaterButton.addEventListener('click', function() {
                    this.closest('.lunaws-settings-saved').remove();
                });
            }
            
            document.body.appendChild(notification);
        }
        
        // 重置用户设置
        function resetUserSettings() {
            // 显示重置确认提示
            const template = document.getElementById('lunaws-reset-confirm-template');
            const confirmDialog = template.querySelector('.lunaws-settings-saved').cloneNode(true);
            
            // 添加按钮的事件监听器
            // 确认按钮
            confirmDialog.querySelector('#lunaws-confirm-reset').addEventListener('click', function() {
                // 关闭确认对话框
                confirmDialog.remove();
                
                // 保留当前语言，重置其他所有设置
                const currentLanguage = userSettings.language;
                
                // 创建新的设置对象，保留语言设置
                const resetSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                resetSettings.language = currentLanguage;
                
                // 验证重置后的设置并更新
                userSettings = validateUserSettings(resetSettings);
                
                // 保存新设置到localStorage
                localStorage.setItem('lunaws-settings', JSON.stringify(userSettings));
                
                // 直接刷新页面，而不是显示通知
                window.location.reload();
            });
            
            // 取消按钮
            confirmDialog.querySelector('.lunaws-button.secondary').addEventListener('click', function() {
                confirmDialog.remove();
            });
            
            document.body.appendChild(confirmDialog);
        }
        
        // 折叠/展开控制面板
        function toggleControlPanel() {
            try {
                const panel = document.querySelector('.lunaws-control-panel');
                const advancedSettings = document.querySelector('.lunaws-setup-panel');
                const toggleButton = document.getElementById('lunaws-toggle-panel');
                
                // 确保用户设置已初始化且语言设置有效
                if (!userSettings || !userSettings.language || (userSettings.language !== 'zh' && userSettings.language !== 'en')) {
                    console.warn('[LunaWS] 切换面板时发现用户设置无效，重新验证');
                    // 验证设置，确保语言设置有效
                    if (userSettings && typeof userSettings === 'object') {
                        userSettings = validateUserSettings(userSettings);
                    } else {
                        userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                    }
                }
                
                // 获取有效的语言设置
                const lang = userSettings.language;
                
                if (advancedSettings.style.display === 'none') {
                    advancedSettings.style.display = 'block';
                    toggleButton.textContent = PANEL_TEXT[lang].collapse;
                    panel.classList.remove('collapsed');
                    // 更新collapsed状态 - 但不保存位置信息
                    userSettings.panelPosition.panelCollapsed = false;
                    const settings = JSON.parse(localStorage.getItem('lunaws-settings') || '{}');
                    settings.panelPosition = settings.panelPosition || {};
                    settings.panelPosition.panelCollapsed = false;
                    localStorage.setItem('lunaws-settings', JSON.stringify(settings));
                } else {
                    advancedSettings.style.display = 'none';
                    toggleButton.textContent = PANEL_TEXT[lang].settings;
                    panel.classList.add('collapsed');
                    // 更新collapsed状态 - 但不保存位置信息
                    userSettings.panelPosition.panelCollapsed = true;
                    const settings = JSON.parse(localStorage.getItem('lunaws-settings') || '{}');
                    settings.panelPosition = settings.panelPosition || {};
                    settings.panelPosition.panelCollapsed = true;
                    localStorage.setItem('lunaws-settings', JSON.stringify(settings));
                }
                
                console.log('[LunaWS] 面板状态已切换');
            } catch (e) {
                console.error('[LunaWS] 切换控制面板时出错:', e);
            }
        }

        // 创建控制面板（只在主页面中执行）
        function ensureControlPanel() {
            if (window.top !== window.self) {
                console.log("[Luna WS] 当前是iframe，跳过创建控制面板");
                return;
            }
            console.log("[Luna WS] 尝试创建控制面板");
            // 确保用户设置已初始化
            if (!userSettings || !userSettings.language) {
                console.warn('[LunaWS] 创建控制面板前用户设置未正确初始化，重新初始化');
                // 尝试从localStorage加载
                try {
                    const savedSettings = localStorage.getItem('lunaws-settings');
                    if (savedSettings) {
                        try {
                            const parsedSettings = JSON.parse(savedSettings);
                            // 使用验证函数确保设置有效
                            userSettings = validateUserSettings(parsedSettings);
                        } catch (e) {
                            console.error('[LunaWS] 解析设置失败', e);
                            userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                        }
                    } else {
                        // 如果没有保存的设置，使用默认设置
                        userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                    }
                } catch (e) {
                    console.error('[LunaWS] 紧急初始化设置失败', e);
                    userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                }
            }
            
            // 创建面板
            createControlPanel();
            
            // 检查面板是否存在且可见
            setTimeout(() => {
                const panel = document.getElementById('lunaws-panel');
                if (!panel) {
                    console.error('[LunaWS] 控制面板创建失败，未找到面板元素');
                } else {
                    console.log('[LunaWS] 控制面板创建成功');
                }
            }, 500);
        }


        /* ========== 基本功能变量 ========== */
        const STYLES = `
            /* 段落和单词样式 */
            .lunaws-active-paragraph {
                padding: 8px; border-radius: 4px;
                transition: all 0.2s ease-in-out;
                position: relative; z-index: 5; background-color: white;
                box-shadow: 1px 2px 4px 0px rgba(122, 122, 122, 0.2);
            }
            .lunaws-highlighted {
                border-radius: 4px;
                background-color: rgba(173, 216, 230, 0.3);
                outline: 2px dashed rgba(173, 216, 230, 0.7);
                transition: background-color 0.2s ease;
            }
            .lunaws-word {
                display: inline-block; position: relative;
                cursor: pointer; margin: 0 1px;
            }
            .lunaws-word:hover { 
                background-color: rgba(238, 206, 165, 0.7) !important;
                border-radius: 2px;
            }
            .lunaws-word.selected { 
                background-color: #ffeb3b !important;
                border-radius: 2px;
            }

            /* 句子样式 */
            .lunaws-sentence {
                display: inline; position: relative;
                transition: background-color 0.2s ease;
            }
            .lunaws-sentence:hover {
                background-color: rgba(255, 221, 153, 0.5);
                cursor: pointer; border-radius: 3px; box-shadow: 0 0 2px rgba(0,0,0,0.1);
            }

            /* 复制样式 */
            .lunaws-copy {
                outline: 2px solid rgba(76, 175, 80, 0.4);
                transition: outline 0.2s ease-in-out; border-radius: 3px;
            }
            
            /* 朗读样式 */
            .lunaws-reaction {
                background-color: rgba(0, 180, 0, 0.3) !important;
                transition: background-color 0.2s ease; border-radius: 3px;
            }


            /* 弹窗与翻译区域 */
            .lunaws-dictionary-popup {
                position: absolute !important;
                background-color: white !important;
                border-radius: 4px !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
                padding: 10px !important;
                z-index: 9999 !important;
                writing-mode: horizontal-tb !important;
                max-width: 400px !important;
                max-height: 350px !important;
                overflow: hidden !important;
                border: 1px solid rgba(0,0,0,0.1) !important;
                transition: opacity 0.2s ease-in-out !important;
                pointer-events: auto !important;
                font-family: sans-serif !important;
                color: #333 !important;
                line-height: 1.4 !important;
                text-align: left !important;
                box-sizing: border-box !important;
            }
            .lunaws-search-box {
                display: flex; flex-direction: row; align-items: center;
                margin-bottom: 5px; width: 100%;
            }
            .lunaws-search-input {
                flex: 1; padding: 5px 8px; height: 30px;
                box-sizing: border-box; border: 1px solid #ddd;
                border-radius: 3px; font-size: 14px;
            }
            .lunaws-search-input:focus {
                border-color:rgba(66, 153, 225, 0.46); outline: none;
                box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
            }
            .lunaws-close-button {
                margin-left: 5px; width: 30px; height: 30px; color: #575757;
                border: 1px solid #ddd; border-radius: 4px; padding: 0;
                cursor: pointer; display: flex; align-items: center;
                justify-content: center; transition: background-color 0.2s;
                font-size: 18px; background-color: white;
            }
            .lunaws-close-button:hover { background-color: #e74c3c; color: white; }
            .lunaws-dict-iframe {
                margin-top: 5px; width: 100%; height: 280px;
                border: none; overflow: auto; display: block;
                background-color: white; border-radius: 3px;
            }

            .lunaws-translation-area {
                margin-top: 0; padding: 10px; background-color: white;
                border-radius: 4px; position: absolute; max-width: 100%;
                transition: all 0.3s ease; animation: fadeIn 0.3s ease-in-out;
                box-sizing: border-box; box-shadow: 1px 2px 4px 0px rgba(122, 122, 122, 0.2);
            }
            .lunaws-vertical-translation-area { border-top: 2px solid #9c27b0; }
            .lunaws-vertical-active-paragraph { border-top: 2px solid #3498db; }
            .lunaws-horizontal-translation-area { border-left: 2px solid #9c27b0; }
            .lunaws-horizontal-active-paragraph { border-left: 2px solid #3498db; }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .lunaws-translation-area hr { border: 1px solid rgba(157, 157, 157, 0.1); width: 100%; height: 100%; }
            .lunaws-translator-header { color:rgba(126, 87, 194, 0.6); font-size: 10px; }
            .lunaws-translation-content { font-size: 0.9em; }

            /* Ruby标签样式 */
            .lunaws-word rt { text-align: center; font-size: 10px; color: #c33c32; }
        `;

        let socket = null;
        let isConnected = false;
        let isConnecting = false;
        let currentParagraph = null;
        let originalContent = null;
        let selectedWords = [];
        let combinedWord = '';
        let currentWordElement = null;
        let currentWord = '';
        let currentHighlightedSentence = null;
        let isAutoPlayMode = false; // 添加自动播放模式变量
        let heartbeatInterval;
        // 添加一个唯一的客户端ID
        const clientId = 'client_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);

        // 使用共享的默认设置常量
        const defaultUserSettings = LUNA_DEFAULT_SETTINGS;

        // 语言对照文本
        const MESSAGE = {
            "en": {
                "noSegmentationResult": "No segmentation result",
                "previousParagraph": "Previous paragraph",
                "nextParagraph": "Next paragraph",
                "unknownDictionary": "Unknown dictionary",
                "segmenting": "Segmenting...",
                "translating": "Translating...",
                "searching": "Searching: ",
                "inputSearch": "Input search...",
                "connecting": "Connecting...",
                "connected": "Connected",
                "disconnected": "Disconnected",
                "connectingFailed": "Connection failed, retrying...",
                "connectingFailedLong": "Connection failed, will retry in 3 seconds...",
                "notConnectedOfflineDisabled": "Not connected to WebSocket and offline mode is disabled. Trying to connect...",
                "connectingWebSocket": "Connecting: ",
                "connectedWebSocket": "WebSocket connected successfully √",
                "autoPlayModeEnabled": "Auto-play mode enabled ↻",
                "autoPlayModeDisabled": "Auto-play mode disabled"
            },
            "zh": {
                "noSegmentationResult": "无分词结果",
                "previousParagraph": "上一段",
                "nextParagraph": "下一段",
                "unknownDictionary": "未知词典",
                "segmenting": "正在分词...",
                "translating": "正在翻译...",
                "searching": "正在查词：",
                "inputSearch": "输入搜索...",
                "connecting": "正在连接...",
                "connected": "已连接",
                "disconnected": "已断开连接",
                "connectingFailed": "连接失败，正在重试...",
                "connectingFailedLong": "连接失败，将在3秒后尝试重新连接",
                "notConnectedOfflineDisabled": "未连接到WebSocket且非离线模式，无法处理段落。正在尝试连接...",
                "connectingWebSocket": "正在自动连接：",
                "connectedWebSocket": "WebSocket已成功连接 √",
                "autoPlayModeEnabled": "自动播放模式已启用 ↻",
                "autoPlayModeDisabled": "自动播放模式已禁用"
            }
        };
            
        /* ========== 初始化函数 ========== */
        function init() {
            try {
                console.log('[LunaWS] 初始化 Luna-WS...');

                // 从存储中恢复用户设置
                loadUserSettings();

                // 页面加载完成后创建控制面板
                if (document.readyState === 'complete') {
                    ensureControlPanel();
                } else {
                    window.addEventListener('load', ensureControlPanel);
                }
                
                // 重置自动播放模式状态
                isAutoPlayMode = false;

                // 加载样式
                document.head.appendChild(document.createElement('style')).textContent = STYLES;
                
                // 添加全局事件监听
                document.addEventListener('keydown', handleKeyDown);
                document.addEventListener('click', handleDocumentClick);
                document.addEventListener('contextmenu', handleContextMenu);
                
                // 使用选择器管理器初始化段落点击处理
                addParagraphClickHandlers(document);
                

                // 添加iframe状态消息监听
                window.addEventListener('message', function(event) {
                    // 验证消息来源
                    if (event.data && event.data.type === 'lunaws-iframe-status') {
                        // 更新iframe状态追踪
                        const { iframeId, isConnected } = event.data;
                        if (iframeId && window.top === window) { // 只在主页面处理
                            connectionTracker.iframes[iframeId] = {
                                isConnected: isConnected,
                                lastUpdate: Date.now()
                            };
                            
                            // 更新状态显示
                            updateConnectionStatusDisplay();
                        }
                    }
                });
                
                // 清理失效的iframe连接记录(每30秒执行一次)
                if (window.top === window) { // 只在主页面执行
                    setInterval(() => {
                        let hasChanges = false;
                        if (hasChanges) {
                            updateConnectionStatusDisplay();
                        }
                    }, 30000);
                }

                // 初始化时先执行一次，连接状态显示
                setTimeout(updateConnectionStatusDisplay, 1000);
                
                console.log('[LunaWS] 初始化完成');
            } catch (err) {
                console.error('[LunaWS] 初始化失败:', err);
            }
        }

        // 从localStorage加载用户设置
        function loadUserSettings() {
            try {
                // 先设置默认值
                userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
                
                // 尝试读取存储的设置
                const savedSettings = localStorage.getItem('lunaws-settings');
                if (savedSettings) {
                    try {
                        // 解析并验证设置
                        const parsedSettings = JSON.parse(savedSettings);
                        userSettings = validateUserSettings(parsedSettings);
                        console.log('[LunaWS] 已加载并验证设置:', userSettings);
                    } catch (e) {
                        console.error('[LunaWS] 解析保存的设置失败:', e);
                        // 保持默认设置
                    }
                } else {
                    console.log('[LunaWS] 未找到保存的设置，使用默认设置（默认语言：' + userSettings.language + '）');
                }
            } catch (e) {
                console.error('读取设置时出错:', e);
                // 确保即使出错也使用默认设置
                userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
            }
        }


        /* ========== 弹窗相关函数 ========== */
        // 通用元素定位函数 - 用于翻译区域和词典弹窗
        function positionElement(element, targetElement, options = {}) {
            // 确保元素都存在
            if (!element || !targetElement) return;
            
            // 默认选项
            const defaults = {
                matchWidth: false,       // 是否匹配目标元素宽度
                matchHeight: false,      // 是否匹配目标元素高度
                horizontalGap: 5,       // 水平间距
                verticalGap: 5,         // 垂直间距
                maxWidth: null,          // 最大宽度
                maxHeight: null,         // 最大高度
                priorityPosition: null,  // 优先位置，默认根据垂直偏好决定
                forceHideForMeasure: false, // 是否强制隐藏来测量
                applyPosition: true      // 是否直接应用位置（false则只返回计算结果）
            };
            
            // 合并选项
            const settings = {...defaults, ...options};
            
            // 获取目标元素和定位元素的尺寸
            const targetRect = targetElement.getBoundingClientRect();
            
            // 计算滚动位置
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            
            // 应用最大尺寸限制（如果有）
            if (settings.maxWidth && !element.style.maxWidth) {
                element.style.maxWidth = typeof settings.maxWidth === 'string' ? 
                    settings.maxWidth : `${settings.maxWidth}px`;
            }
            
            if (settings.maxHeight && !element.style.maxHeight) {
                element.style.maxHeight = typeof settings.maxHeight === 'string' ? 
                    settings.maxHeight : `${settings.maxHeight}px`;
            }
            
            // 设置元素的基础样式
            element.style.position = 'absolute';
            
            // 根据选项设置宽度和高度
            if (settings.matchWidth) {
                element.style.width = `${targetRect.width}px`;
                element.style.height = 'auto';
            } else if (settings.matchHeight) {
                element.style.width = 'auto';
                element.style.height = `${targetRect.height}px`;
            }
            
            // 如果需要测量，先设置临时位置并隐藏
            if (settings.forceHideForMeasure) {
                element.style.visibility = 'hidden';
                element.style.left = `${scrollX + targetRect.left}px`;
                element.style.top = `${scrollY + targetRect.top}px`;
            }
            
            // 如果需要预定位来获取正确尺寸
            if (!settings.priorityPosition) {
                if (userSettings.verticalPreference) {
                    // 垂直书写模式，优先在右侧
                    if (settings.matchHeight) {
                        element.style.left = `${scrollX + targetRect.right + settings.horizontalGap}px`;
                        element.style.top = `${scrollY + targetRect.top}px`;
                    }
                } else {
                    // 水平书写模式，优先在上方
                    if (settings.matchWidth && !settings.forceHideForMeasure) {
                        element.style.left = `${scrollX + targetRect.left}px`;
                    }
                }
            }
            
            // 获取元素尺寸（预定位后）
            const elementWidth = element.offsetWidth;
            const elementHeight = element.offsetHeight;
            
            // 如果之前隐藏了，现在恢复可见
            if (settings.forceHideForMeasure) {
                element.style.visibility = '';
            }
            
            // 确定优先定位方向
            const priorityPos = settings.priorityPosition || 
                (userSettings.verticalPreference ? 'right' : 'top');
            
            let left, top;
            
            // 根据优先方向计算位置
            switch (priorityPos) {
                case 'right':
                    // 尝试右侧
                    left = scrollX + targetRect.right + settings.horizontalGap;
                    top = scrollY + targetRect.top;
                    
                    // 检查右侧是否超出视窗
                    if (left + elementWidth > scrollX + window.innerWidth - 10) {
                        // 尝试左侧
                        left = scrollX + targetRect.left - elementWidth - settings.horizontalGap;
                        
                        // 如果左侧也超出，尝试上方
                        if (left < scrollX) {
                            left = scrollX + targetRect.left;
                            top = scrollY + targetRect.top - elementHeight - settings.verticalGap;
                            
                            // 如果上方也超出，放在下方
                            if (top < scrollY) {
                                top = scrollY + targetRect.bottom + settings.verticalGap;
                            }
                        }
                    }
                    break;
                    
                case 'left':
                    // 尝试左侧
                    left = scrollX + targetRect.left - elementWidth - settings.horizontalGap;
                    top = scrollY + targetRect.top;
                    
                    // 检查左侧是否超出视窗
                    if (left < scrollX) {
                        // 尝试右侧
                        left = scrollX + targetRect.right + settings.horizontalGap;
                        
                        // 如果右侧也超出，尝试上方
                        if (left + elementWidth > scrollX + window.innerWidth - 10) {
                            left = scrollX + targetRect.left;
                            top = scrollY + targetRect.top - elementHeight - settings.verticalGap;
                            
                            // 如果上方也超出，放在下方
                            if (top < scrollY) {
                                top = scrollY + targetRect.bottom + settings.verticalGap;
                            }
                        }
                    }
                    break;
                    
                case 'top':
                    // 尝试上方
                    left = scrollX + targetRect.left;
                    top = scrollY + targetRect.top - elementHeight - settings.verticalGap;
                    
                    // 检查上方是否超出视窗
                    if (top < scrollY) {
                        // 尝试下方
                        top = scrollY + targetRect.bottom + settings.verticalGap;
                        
                        // 如果下方也超出，尝试右侧
                        if (top + elementHeight > scrollY + window.innerHeight - 10) {
                            // 如果之前匹配了宽度，现在需要调整为匹配高度
                            if (settings.matchWidth) {
                                element.style.width = 'auto';
                                element.style.height = `${targetRect.height}px`;
                                
                                // 重新获取宽度
                                const newWidth = element.offsetWidth;
                                left = scrollX + targetRect.right + settings.horizontalGap;
                                top = scrollY + targetRect.top;
                                
                                // 如果右侧也超出，尝试左侧
                                if (left + newWidth > scrollX + window.innerWidth - 10) {
                                    left = Math.max(scrollX, scrollX + targetRect.left - newWidth - settings.horizontalGap);
                                }
                            } else {
                                left = scrollX + targetRect.right + settings.horizontalGap;
                                top = scrollY + targetRect.top;
                            }
                        }
                    }
                    break;
                    
                case 'bottom':
                    // 尝试下方
                    left = scrollX + targetRect.left;
                    top = scrollY + targetRect.bottom + settings.verticalGap;
                    
                    // 检查下方是否超出视窗
                    if (top + elementHeight > scrollY + window.innerHeight - 10) {
                        // 尝试上方
                        top = scrollY + targetRect.top - elementHeight - settings.verticalGap;
                        
                        // 如果上方也超出，尝试右侧
                        if (top < scrollY) {
                            left = scrollX + targetRect.right + settings.horizontalGap;
                            top = scrollY + targetRect.top;
                            
                            // 如果右侧也超出，尝试左侧
                            if (left + elementWidth > scrollX + window.innerWidth - 10) {
                                left = scrollX + targetRect.left - elementWidth - settings.horizontalGap;
                                
                                // 如果左侧也超出，居中显示
                                if (left < scrollX) {
                                    left = scrollX + Math.max(0, (window.innerWidth - elementWidth) / 2);
                                    top = scrollY + Math.max(0, (window.innerHeight - elementHeight) / 2);
                                }
                            }
                        }
                    }
                    break;
                    
                default:
                    // 默认居中
                    left = scrollX + Math.max(0, (window.innerWidth - elementWidth) / 2);
                    top = scrollY + Math.max(0, (window.innerHeight - elementHeight) / 2);
            }
            
            // 最终安全检查，确保不会超出视窗太多
            const rightEdge = scrollX + window.innerWidth;
            const bottomEdge = scrollY + window.innerHeight;
            
            if (left < scrollX + 10) left = scrollX + 10;
            if (top < scrollY + 10) top = scrollY + 10;
            if (left + elementWidth > rightEdge - 10) {
                left = rightEdge - elementWidth - 10;
            }
            if (top + elementHeight > bottomEdge - 10) {
                top = bottomEdge - elementHeight - 10;
            }
            
            // 应用位置或返回计算结果
            if (settings.applyPosition) {
                element.style.left = `${left}px`;
                element.style.top = `${top}px`;
            }
            
            return { left, top, width: elementWidth, height: elementHeight };
        }

        // 定位字典弹窗 - 使用通用定位函数
        function positionDictionaryPopup(popup, element) {
            // 设置选项
            const options = {
                maxWidth: '400px',
                maxHeight: '350px',
                horizontalGap: 5,
                verticalGap: 5,
                priorityPosition: userSettings.verticalPreference ? 'right' : 'bottom'
            };
            
            // 使用通用定位函数
            positionElement(popup, element, options);
        }

        // 定位翻译区域的函数 1 - 使用通用定位函数
        function positionTranslationArea(translationArea, paragraph) {
            // 根据阅读方向设置选项
            const options = {
                horizontalGap: 5,
                verticalGap: 5,
                forceHideForMeasure: !userSettings.verticalPreference, // 水平模式时强制测量高度
                priorityPosition: userSettings.verticalPreference ? 'right' : 'top'
            };
            
            // 设置宽高匹配
            if (userSettings.verticalPreference) {
                options.matchHeight = true; // 垂直阅读模式匹配高度
            } else {
                options.matchWidth = true;  // 水平阅读模式匹配宽度
            }
            
            // 使用通用定位函数
            positionElement(translationArea, paragraph, options);
        }

        // 定位翻译区域的函数 2
        function addTranslationArea(translationArea, paragraph) {
            
            // 根据方向添加相应的类
            if (userSettings.verticalPreference) {
                translationArea.classList.add('lunaws-vertical-translation-area');
            } else {
                translationArea.classList.add('lunaws-horizontal-translation-area');
            }
            
            // 添加到DOM（先添加再定位，确保尺寸已计算）
            document.body.appendChild(translationArea);
            
            // 设置初始位置
            positionTranslationArea(translationArea, paragraph);
            
            // 内容渲染后再次定位，确保位置正确
            setTimeout(() => {
                positionTranslationArea(translationArea, paragraph);
            }, 100);
            // 内容渲染后再次定位，确保位置正确
            setTimeout(() => {
                positionTranslationArea(translationArea, paragraph);
            }, 500);
        }

        // 关闭所有弹窗
        function restoreOriginalContent() {
            if (currentParagraph && originalContent) {
                
                currentParagraph.innerHTML = originalContent;
                currentParagraph.classList.remove('lunaws-active-paragraph');
                currentParagraph.classList.remove('lunaws-vertical-active-paragraph');
                currentParagraph.classList.remove('lunaws-horizontal-active-paragraph');
                
                // 移除翻译区域
                removeTranslationArea();
                
                currentParagraph = null;
                originalContent = null;
                selectedWords = [];
                combinedWord = '';

                // 移除词典弹窗和选择状态
                clearDictionarySelection();
            }
        }
        
        
        /* ========== 标签选择器相关 ========== */
        // 为段落添加点击事件
        function addParagraphClickHandlers(doc) {
            // 添加点击事件
            doc.addEventListener('click', function(event) { 
                // 直接处理目标元素，让findMatchingParagraph函数决定是否为有效段落
                processSelectedParagraph(event.target);
            });

            // 添加鼠标悬停效果
            doc.addEventListener('mouseover', function(event) {
                // 如果未连接到WebSocket，不添加高亮效果
                if (!isConnected) return;
            
                // 确定当前鼠标悬停的元素是否是选择器匹配的段落
                const target = event.target;
                const matchingParagraph = findMatchingParagraph(target);
                
                if (matchingParagraph && matchingParagraph !== currentParagraph) {
                    // 添加高亮样式
                    matchingParagraph.classList.add('lunaws-highlighted');
                }
            });
            
            // 添加鼠标离开效果
            doc.addEventListener('mouseout', function(event) {
                const target = event.target;
                const matchingParagraph = findMatchingParagraph(target);
                
                if (matchingParagraph && matchingParagraph !== currentParagraph) {
                    // 移除高亮样式
                    matchingParagraph.classList.remove('lunaws-highlighted');
                }
            });
        }

        // 查找匹配段落选择器的元素
        function findMatchingParagraph(element) {
            // 如果元素为空或是文档节点，返回null
            if (!element || element.nodeType === 9) return null;

            // 如果当前元素已经是活动段落，返回null
            if (element.classList && element.classList.contains('lunaws-active-paragraph')) return null;

            // 排除控制面板和其内部的所有元素
            if (element.closest && element.closest('.lunaws-control-panel')) return null;
            
            // 排除设置保存成功提示框
            if (element.closest && element.closest('.lunaws-settings-saved')) return null;

            // 确保选择器不为空
            if (!userSettings.includeSelectors && !userSettings.includeClassIds) return null;

            // 获取包含和排除选择器
            const includeSelectors = (userSettings.includeSelectors || '').split(',').map(s => s.trim()).filter(s => s);
            const excludeSelectors = (userSettings.excludeSelectors || '').split(',').map(s => s.trim()).filter(s => s);
            const includeClassIds = (userSettings.includeClassIds || '').split(',').map(s => s.trim()).filter(s => s);
            const excludeClassIds = (userSettings.excludeClassIds || '').split(',').map(s => s.trim()).filter(s => s);

            // 排除body和html元素
            if (element.tagName && (element.tagName.toLowerCase() === 'body' || element.tagName.toLowerCase() === 'html')) {
                return null;
            }

            // 首先检查是否被排除
            for (const selector of excludeSelectors) {
                try {
                    if (element.matches && element.matches(selector)) {
                        return null; // 如果匹配排除选择器，直接返回null
                    }
                } catch (e) {
                    console.error('[LunaWS] Invalid exclude selector:', selector, e);
                }
            }

            // 检查是否排除特定class和id
            for (const selector of excludeClassIds) {
                try {
                    if (element.matches && element.matches(selector)) {
                        return null; // 如果匹配排除的class或id，直接返回null
                    }
                } catch (e) {
                    console.error('[LunaWS] Invalid exclude class/id selector:', selector, e);
                }
            }

            // 然后检查是否包含
            for (const selector of includeSelectors) {
                try {
                    // 使用选择器进行匹配
                    if (element.matches && element.matches(selector)) {
                        // 验证元素内容不为空
                        if (element.textContent && element.textContent.trim().length > 0) {
                            return element;
                        }
                    }
                } catch (e) {
                    console.error('[LunaWS] Invalid include selector:', selector, e);
                }
            }

            // 检查是否包含特定class和id
            for (const selector of includeClassIds) {
                try {
                    if (element.matches && element.matches(selector)) {
                        // 验证元素内容不为空
                        if (element.textContent && element.textContent.trim().length > 0) {
                            return element;
                        }
                    }
                } catch (e) {
                    console.error('[LunaWS] Invalid include class/id selector:', selector, e);
                }
            }

            // 递归检查父元素 - 但只检查到一定深度以避免性能问题
            // 并且不向上超过特定容器元素
            const stopElements = (userSettings.stopContainers || '').split(',').map(s => s.trim()).filter(s => s);
            if (element.parentElement) {
                for (const stopSelector of stopElements) {
                    try {
                        if (element.matches && element.matches(stopSelector)) {
                            return null; // 停止向上查找
                        }
                    } catch (e) {
                        // 忽略无效选择器错误
                    }
                }
                
                return findMatchingParagraph(element.parentElement);
            }

            return null;
        }

        // 获取下一个或上一个有效的段落
        function getValidTag(currentTag, direction = 'down') {
            // 确保至少有一个包含选择器
            if (!userSettings.includeSelectors && !userSettings.includeClassIds) return null;

            // 构建完整的选择器字符串
            let allSelectors = [];
            
            // 添加标签选择器
            if (userSettings.includeSelectors) {
                const includeSelectors = userSettings.includeSelectors.split(',')
                    .map(sel => sel.trim())
                    .filter(sel => sel.length > 0);
                allSelectors = allSelectors.concat(includeSelectors);
            }
            
            // 添加类和ID选择器
            if (userSettings.includeClassIds) {
                const includeClassIds = userSettings.includeClassIds.split(',')
                    .map(sel => sel.trim())
                    .filter(sel => sel.length > 0);
                allSelectors = allSelectors.concat(includeClassIds);
            }
            
            // 组合所有选择器
            const validSelectors = allSelectors.join(',');
            
            if (!validSelectors) return null; // 如果没有有效选择器，返回null

            // 查找匹配元素
            const tags = Array.from(document.querySelectorAll(validSelectors));
            
            // 过滤排除的元素
            const excludeSelectors = (userSettings.excludeSelectors || '').split(',')
                .map(sel => sel.trim())
                .filter(sel => sel.length > 0);
            
            const excludeClassIds = (userSettings.excludeClassIds || '').split(',')
                .map(sel => sel.trim())
                .filter(sel => sel.length > 0);
            
            const filteredTags = tags.filter(tag => {
                // 检查是否匹配排除选择器
                for (const selector of excludeSelectors) {
                    try {
                        if (tag.matches(selector)) return false;
                    } catch (e) {
                        // 忽略无效选择器错误
                    }
                }
                
                // 检查是否匹配排除的class和id
                for (const selector of excludeClassIds) {
                    try {
                        if (tag.matches(selector)) return false;
                    } catch (e) {
                        // 忽略无效选择器错误
                    }
                }
                
                return true;
            });
            
            const currentIndex = filteredTags.indexOf(currentTag);

            if (currentIndex === -1) return null;

            // 确定目标索引
            const targetIndex = direction === 'down' ? currentIndex + 1 : currentIndex - 1;

            // 检查是否超出范围
            if (targetIndex < 0 || targetIndex >= filteredTags.length) return null;

            // 获取目标标签
            const targetTag = filteredTags[targetIndex];

            // 确保目标标签有文本内容
            if (targetTag.textContent.trim()) {
                return targetTag;
            } else {
                // 如果目标标签没有文本，递归查找下一个
                return getValidTag(targetTag, direction);
            }
        }

        // 导航到下一段落
        function navigateToNextParagraph() {
            if (!currentParagraph) return;
            const nextTag = getValidTag(currentParagraph, 'down');
            if (nextTag) processSelectedParagraph(nextTag);
        }

        // 导航到上一段落
        function navigateToPreviousParagraph() {
            if (!currentParagraph) return;
            const prevTag = getValidTag(currentParagraph, 'up');
            if (prevTag) processSelectedParagraph(prevTag);
        }

        /* ========== WebSocket 连接 ========== */
        function connectWebSocket() {
            try {
                // 如果已连接或正在连接，不要重复连接
                if (isConnected || isConnecting) { return; }
                
                // 标记为正在连接状态
                isConnecting = true;
                
                // 使用用户设置的WebSocket地址
                const url = userSettings.wsUrl;
                
                console.log('[LunaWS] 正在自动连接：', url);
                showMessage(MESSAGE[userSettings.language].connectingWebSocket + url, 'info');

                // 设置连接状态
                updateStatus(MESSAGE[userSettings.language].connecting);
                
                // 创建WebSocket连接
                socket = new WebSocket(url);
                
                socket.onopen = function() {
                    isConnected = true;
                    isConnecting = false;
                    updateStatus(MESSAGE[userSettings.language].connected);
                    console.log('[LunaWS] WebSocket连接成功');
                    showMessage(MESSAGE[userSettings.language].connectedWebSocket, 'success');

                    // 清除可能存在的旧定时器
                    if (heartbeatInterval) {clearInterval(heartbeatInterval);}
                    
                    // 设置定时发送握手请求
                    heartbeatInterval = setInterval(function() {
                        if (socket && isConnected) {
                            try {
                                // 发送心跳消息
                                socket.send(JSON.stringify({
                                    type: 'heartbeat',
                                    clientId: clientId
                                }));
                            } catch (e) {
                                console.error('[LunaWS] 心跳消息发送失败');
                                // 如果发送失败，尝试重连
                                if (isConnected) {
                                    isConnected = false; // 先标记为未连接
                                    isConnecting = false; // 重置连接中状态
                                    updateStatus(MESSAGE[userSettings.language].connectingFailed);
                                    // 显示连接失败提示
                                    showMessage(MESSAGE[userSettings.language].connectingFailed, 'error');
                                    setTimeout(connectWebSocket, 5000);
                                }
                            }
                        } else {
                            clearInterval(heartbeatInterval);
                            heartbeatInterval = null;
                        }
                    }, 3000);
                };
                
                socket.onmessage = function(event) {
                    processMessage(event.data);
                };
                
                socket.onclose = function() {
                    isConnected = false;
                    isConnecting = false;
                    updateStatus(MESSAGE[userSettings.language].disconnected);
                    if (heartbeatInterval) {
                        clearInterval(heartbeatInterval);
                        heartbeatInterval = null;
                    }
                    // 显示断开连接提示
                    showMessage(MESSAGE[userSettings.language].disconnected, 'warning');
                    setTimeout(connectWebSocket, 5000);
                };
                
                socket.onerror = function(error) {
                    isConnected = false;
                    isConnecting = false;
                    updateStatus(MESSAGE[userSettings.language].connectingFailed);
                    if (heartbeatInterval) {
                        clearInterval(heartbeatInterval);
                        heartbeatInterval = null;
                    }
                    // 显示连接错误提示
                    showMessage(MESSAGE[userSettings.language].connectingFailed, 'error');
                    setTimeout(connectWebSocket, 5000);
                };
            } catch (error) {
                console.error('[LunaWS] 连接WebSocket出错');
                isConnected = false;
                isConnecting = false;
                updateStatus(MESSAGE[userSettings.language].connectingFailed);
                console.log('[LunaWS] 将在5秒后重试');
                // 显示连接失败提示
                showMessage(MESSAGE[userSettings.language].connectingFailedLong, 'error');
                setTimeout(connectWebSocket, 5000);
            }
        }

        // 更新连接状态指示器
        function updateStatus(message) {
            const indicator = document.querySelector('lunaws-status-main');
            if (indicator) {
                // 根据消息内容更新指示器状态
                if (isConnected) {
                    indicator.classList.add('connected');
                } else {
                    indicator.classList.remove('connected');
                }
                
                // 更新悬停时显示的状态文本
                indicator.setAttribute('data-status', message);
            }
            
            // 更新连接跟踪器状态
            if (window.top === window) {
                // 这是主页面
                connectionTracker.main.isConnected = isConnected;
            } else {
                // 通知主页面当前iframe的状态
                try {
                    window.parent.postMessage({
                        type: 'lunaws-iframe-status',
                        isConnected: isConnected,
                        iframeId: clientId // 使用clientId作为iframe的唯一标识
                    }, '*');
                } catch (e) {
                    console.error('[LunaWS] 无法向父窗口发送状态:', e);
                }
            }
            
            // 如果是主页面，则更新状态显示
            if (window.top === window) {
                updateConnectionStatusDisplay();
            }
        }
        
        // 更新连接状态显示
        function updateConnectionStatusDisplay() {
            const statusElement = document.getElementById('lunaws-status');
            if (!statusElement) return;
            
            // 计算主页面和iframe的连接状态
            const mainConnected = connectionTracker.main.isConnected ? 1 : 0;
            
            // 计算iframe连接状态
            let connectedIframes = 0;
            let totalIframes = Object.keys(connectionTracker.iframes).length;
            
            for (const iframeId in connectionTracker.iframes) {
                if (connectionTracker.iframes[iframeId].isConnected) {
                    connectedIframes++;
                }
            }
            
            // 计算状态颜色
            let mainStatusClass = 'lunaws-status-red';
            if (mainConnected === 1) {
                mainStatusClass = 'lunaws-status-green';
            }
            
            let iframeStatusClass = 'lunaws-status-red';
            if (totalIframes > 0) {
                const iframeRatio = connectedIframes / totalIframes;
                if (iframeRatio === 1) {
                    iframeStatusClass = 'lunaws-status-green';
                } else if (iframeRatio > 0) {
                    iframeStatusClass = 'lunaws-status-orange';
                }
            }
            
            // 构建HTML
            statusElement.innerHTML = '';
            
            // 添加main状态
            const mainSpan = document.createElement('span');
            mainSpan.className = `lunaws-status-main ${mainStatusClass}`;
            mainSpan.textContent = `main ${mainConnected}/1`;
            statusElement.appendChild(mainSpan);
            
            // 如果自动播放模式开启，显示状态
            if (isAutoPlayMode) {
                const autoplaySpan = document.createElement('span');
                autoplaySpan.className = 'lunaws-status-autoplay';
                autoplaySpan.textContent = PANEL_TEXT[userSettings.language].autoPlayStatus;
                statusElement.appendChild(autoplaySpan);
            }
            
            // 添加iframe状态
            const iframeSpan = document.createElement('span');

            if (totalIframes === 0) {
                iframeSpan.textContent = `iframe 0/0`;
                iframeSpan.className = `lunaws-status-iframe lunaws-status-gray`;
            } else {
                iframeSpan.textContent = `iframe ${connectedIframes}/${totalIframes}`;
                iframeSpan.className = `lunaws-status-iframe ${iframeStatusClass}`;
            }
            statusElement.appendChild(iframeSpan);
        }

        // 发送消息到服务器
        function sendMessage(message) {
            if (socket && isConnected) {
                // 如果传入的是字符串，则将其解析为JSON对象
                let msgObj;
                try {
                    msgObj = typeof message === 'string' ? JSON.parse(message) : message;
                } catch (e) {
                    console.error('[LunaWS] 解析消息时出错:', e);
                    return false;
                }
                
                // 添加客户端ID和请求ID
                msgObj.clientId = clientId;
                msgObj.requestId = Date.now() + '_' + Math.floor(Math.random() * 1000000);
                
                // 将对象转换回字符串并发送
                const finalMessage = JSON.stringify(msgObj);
                socket.send(finalMessage);
                console.log('[LunaWS] 已发送消息:', finalMessage);
                return true;
            } else {
                console.log('[LunaWS] 未连接到服务器，尝试重新连接');
                // 尝试重新连接，但仅在未连接且不在连接过程中时
                if (!isConnected && !isConnecting) {
                    connectWebSocket();
                }
                return false;
            }
        }

        // 处理接收到的消息
        function processMessage(message) {
            try {
                const data = JSON.parse(message);
                
                // 检查消息是否属于当前客户端
                // 如果消息包含clientId且与当前客户端不匹配，则忽略此消息
                if (data.clientId && data.clientId !== clientId) {
                    return;
                }
                
                console.log('[LunaWS] 收到消息类型:', data.type);
                
                switch (data.type) {
                    case 'segment_result':
                        handleSegmentResult(data);
                        break;
                    case 'translation_result':
                        handleTranslationResult(data);
                        break;
                    case 'dictionary_result':
                        handleDictionaryResult(data);
                        break;
                    case 'read_result':
                        handleReadResult(data);
                        break;
                    case 'heartbeat':
                        // 心跳响应不需要处理
                        break;
                    default:
                        console.log('[LunaWS] 未知消息类型:', data.type);
                        break;
                }
            } catch (e) {
                // 不是JSON，按原样传递给翻译处理函数
                console.log('[LunaWS] Received non-JSON message:', message);
            }
        }


        /* ========== 按键事件 ========== */
        // 检查按键是否匹配用户设置
        function matchUserKey(event, keySettingStr) {
            if (!keySettingStr) return false;

            // 解析用户设置的按键组合（不区分大小写）
            const keys = keySettingStr.split(',').map(k => k.trim().toLowerCase());
            
            // 获取当前按键（转为小写以便比较）
            const eventKey = event.key.toLowerCase();
            
            // 创建特殊键映射（为了更好的用户体验）
            const specialKeyMap = {
                ' ': 'space',
                'arrowup': 'up',
                'arrowdown': 'down',
                'arrowleft': 'left',
                'arrowright': 'right',
                'escape': 'esc'
            };
            
            // 检查事件的键是否在用户设置中
            return keys.some(key => {
                // 处理特殊键
                if (specialKeyMap[eventKey] === key) return true;
                // 处理特殊键的逆向映射
                if (specialKeyMap[key] === eventKey) return true;
                // 常规比较
                return eventKey === key;
            });
        }

        // 处理键盘事件
        function handleKeyDown(e) {
            // 检查按键是否匹配关闭激活选项
            if (matchUserKey(e, userSettings.keyBindings.closeActive)) {
                restoreOriginalContent();
                e.preventDefault();
                return;
            }

            if (!currentParagraph) return;

            // 上下段按键
            if (matchUserKey(e, userSettings.keyBindings.nextParagraph)) {
                navigateToNextParagraph();
                e.preventDefault();
            } else if (matchUserKey(e, userSettings.keyBindings.prevParagraph)) {
                navigateToPreviousParagraph();
                e.preventDefault();
            } 
            // 切换自动播放模式
            else if (matchUserKey(e, userSettings.keyBindings.autoPlayMode)) {
                toggleAutoPlayMode();
                e.preventDefault();
            }
        }

        // 切换自动播放模式
        function toggleAutoPlayMode() {
            isAutoPlayMode = !isAutoPlayMode;
            
            // 更新状态显示
            updateConnectionStatusDisplay();
            
            // 显示当前模式状态
            const statusMessage = isAutoPlayMode ? 
                MESSAGE[userSettings.language].autoPlayModeEnabled : 
                MESSAGE[userSettings.language].autoPlayModeDisabled;
            
            // 使用通用消息提示函数显示状态
            showMessage(statusMessage, isAutoPlayMode ? 'success' : 'info');
            
            // 如果开启了自动播放模式且当前段落存在，就开始朗读当前段落
            if (isAutoPlayMode && currentParagraph) {
                // 获取当前段落的纯文本
                const paragraphText = removeRubyText(currentParagraph);
                
                // 停止之前的朗读
                stopReading();
                
                // 开始朗读当前段落
                setTimeout(() => readText(paragraphText, currentParagraph), 300);
            }
        }

        // 点击事件处理函数
        function handleDocumentClick(e) {
            if (!currentParagraph) return;

            // 检查点击是否在以下区域内，如果是则不取消激活状态
            if (e.target.closest('.lunaws-control-panel')) return;
            if (e.target.closest('.lunaws-active-paragraph')) return;
            if (e.target.closest('.lunaws-dictionary-popup')) return;
            if (e.target.closest('.lunaws-translation-area')) return;
            if (e.target.closest('.lunaws-settings-saved')) return;
            if (e.target.closest('.lunaws-status-message')) return;

            // 其他区域点击时，恢复原始内容
            restoreOriginalContent();
        }

        // 右键菜单阻止函数
        function handleContextMenu(event) {
            if (event.target.classList.contains('lunaws-sentence') || 
                event.target.classList.contains('lunaws-word') || 
                event.target.classList.contains('lunaws-highlighted') ||
                event.target.classList.contains('lunaws-active-paragraph')) {
                event.preventDefault();
            }
        }


        /* ========== 段落处理 ========== */
        // 处理选中的段落（Websocket模式 / 离线模式）
        function processSelectedParagraph(element) {
            // 首先检查WebSocket连接状态
            if (!isConnected && !userSettings.offlineModeToggle) {
                showMessage(MESSAGE[userSettings.language].notConnectedOfflineDisabled, 'warning');
                console.log('[LunaWS] 未连接到WebSocket且非离线模式，无法处理段落。正在尝试连接...');
                // 没连接之前不处理段落，除非开启了离线模式
                connectWebSocket();
                return;
            }

            // 通用的段落处理逻辑 - 对在线和离线模式都适用
            // 检查目标元素是否匹配段落选择器，或者是否在已处理的段落内
            const isInsideActiveParagraph = element.closest && element.closest('.lunaws-active-paragraph');
            if (isInsideActiveParagraph) return; // 如果点击的是已处理段落内的元素，直接返回

            // 查找匹配的段落元素
            const matchingParagraph = findMatchingParagraph(element);
            if (!matchingParagraph) return; // 如果没有匹配的段落，直接返回

            // 从这里开始使用匹配到的段落元素
            const paragraph = matchingParagraph;

            // 获取纯文本内容
            const originalText = removeRubyText(paragraph);

            // 检查段落是否有效或有足够的内容
            if (!originalText) {
                console.log('[LunaWS] 跳过空内容段落');
                return;
            }
            
            // 获取去除空白的文本长度
            const textLength = originalText.trim().length;
            
            // 检查内容长度是否符合要求
            const minLength = parseInt(userSettings.minContentLength) || 5;
            const maxLength = parseInt(userSettings.maxContentLength) || 1000;
            
            if (textLength < minLength) {
                console.log(`[LunaWS] 跳过内容长度不足的段落 (${textLength} < ${minLength})`);
                return;
            }
            
            if (textLength > maxLength) {
                console.log(`[LunaWS] 跳过内容过长的段落 (${textLength} > ${maxLength})`);
                return;
            }

            // 如果已有选中段落，恢复它
            if (currentParagraph && currentParagraph !== paragraph) {
                restoreOriginalContent();
            }

            // 如果是同一段落，不重复处理
            if (currentParagraph === paragraph) return;
            
            // 移除预选高亮样式
            paragraph.classList.remove('lunaws-highlighted');

            // 标记当前段落为活动状态
            paragraph.classList.add('lunaws-active-paragraph');
            
            // 根据垂直/水平设置添加对应的样式类
            if (userSettings.verticalPreference) {
                paragraph.classList.add('lunaws-vertical-active-paragraph');
                console.log('[LunaWS] 使用垂直样式模式');
            } else {
                paragraph.classList.add('lunaws-horizontal-active-paragraph');
                console.log('[LunaWS] 使用水平样式模式');
            }
            
            currentParagraph = paragraph;
            originalContent = paragraph.innerHTML;

            // 分支处理：根据是否为离线模式执行不同的处理逻辑
            if (isConnected && !userSettings.offlineModeToggle) {
                // 在线模式处理逻辑
                processOnlineMode(paragraph, originalText);
            } else if (userSettings.offlineModeToggle) {
                // 离线模式处理逻辑
                console.log('[LunaWS] 离线模式下处理段落:', paragraph);
                processOfflineMode(paragraph, originalText);
            }

            // 滚动到视图中（在线和离线模式共有的操作）
            const paragraphRect = paragraph.getBoundingClientRect();
            if (userSettings.scrollToParagraph && (paragraphRect.top < 0 || paragraphRect.bottom > window.innerHeight)) {
                paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // 在线模式的处理逻辑
        function processOnlineMode(paragraph, originalText) {
            // 添加段落点击事件
            attachParagraphEvents(originalText, paragraph);

            // 移除之前的翻译区域
            removeTranslationArea();

            // 显示加载提示
            paragraph.innerHTML = `<em>${MESSAGE[userSettings.language].segmenting}</em>`;

            // 发送分词请求
            if (!sendMessage(JSON.stringify({
                type: 'segment',
                text: originalText
            }))) {
                // 如果发送失败，恢复原始内容
                paragraph.innerHTML = originalContent;
                paragraph.classList.remove('lunaws-active-paragraph');
                currentParagraph = null;
                originalContent = null;
                return;
            }

            // 自动触发翻译请求
            setTimeout(() => translateText(originalText), 300);

            // 如果启用了自动朗读段落，或者自动播放模式已开启，发送朗读请求
            if (userSettings.autoReadParagraph || isAutoPlayMode) {
                // 确保有足够的延迟以防止快速切换段落时的音频冲突
                setTimeout(() => {
                    // 再次检查当前段落是否仍然是正在处理的段落
                    if (currentParagraph === paragraph) {
                        readText(originalText, paragraph);
                    }
                }, 500);
            }
        }

        // 离线模式的处理逻辑
        function processOfflineMode(paragraph, originalText) {
            // 在离线模式下激活段落时自动复制整个文本
            if (userSettings.copyToClipboard) {
                copyTextToClipboard(originalText, paragraph);
            }

            // 为离线模式处理分句
            try {
                // 离线分句
                const sentencesContainer = offlineSplitTextIntoSentences(originalText);
                
                // 设置段落内容
                paragraph.innerHTML = '';
                paragraph.appendChild(sentencesContainer);
                
                // 为句子添加事件（主要是复制功能）
                sentencesContainer.querySelectorAll('.lunaws-sentence').forEach(sentence => {
                    // 添加左键点击复制功能
                    if (userSettings.copyToClipboard) {
                        sentence.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            
                            const sentenceText = sentence.textContent.trim();
                            if (sentenceText) {
                                copyTextToClipboard(sentenceText, sentence);
                            }
                        });
                    }
                });
                
                console.log('[LunaWS] 离线模式下分句处理完成');
            } catch (error) {
                console.error('[LunaWS] 离线模式处理段落时出错:', error);
                paragraph.innerHTML = '处理错误: ' + error.message;
            }
        }

        // 去除文本中的ruby标签振假名
        function removeRubyText(element) {
            const clone = element.cloneNode(true);
            
            // 根据用户设置决定是否去除ruby注音
            if (userSettings.removeRuby !== false) {
                const rubyElements = clone.getElementsByTagName('ruby');
    
                for (let i = rubyElements.length - 1; i >= 0; i--) {
                    const rubyElement = rubyElements[i];
                    const tempContainer = document.createElement('div');
                    
                    Array.from(rubyElement.childNodes).forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE || 
                            (node.nodeType === Node.ELEMENT_NODE && 
                                node.tagName.toLowerCase() !== 'rt' && 
                                node.tagName.toLowerCase() !== 'rp')) {
                            tempContainer.appendChild(node.cloneNode(true));
                        }
                    });
                    
                    rubyElement.parentNode.replaceChild(document.createTextNode(tempContainer.textContent), rubyElement);
                }
            }

            return clone.textContent.trim();
        }

        // 处理分词结果的函数
        function handleSegmentResult(data) {
            try {
                if (!data.segments || data.segments.length === 0) return;
                
                // 生成分词内容
                const segmentedContent = generateSegmentedContent(data.segments);

                // 尝试进行句子划分和处理
                try {
                    processSegmentedContentIntoSentences(segmentedContent);
                } catch (err) {
                    console.error('[LunaWS] 处理句子时出错:', err);
                    // 发生错误时使用简单模式显示结果
                    currentParagraph.innerHTML = segmentedContent;
                }
            } catch (error) {
                console.error('[LunaWS] 处理分词结果时出错:', error);
                if (currentParagraph) {
                    currentParagraph.innerHTML = '分词处理错误: ' + error.message;
                }
            }
        }

        // 生成分词内容
        function generateSegmentedContent(segments) {
            let segmentedContent = '';

            // 添加分词结果
            segments.forEach(segment => {
                const wordSpanHtml = document.createElement('span');
                wordSpanHtml.className = 'lunaws-word';
                wordSpanHtml.setAttribute('data-word', segment.orig);

                // 判断原文和振假名是否实质相同
                function isSameSoundIgnoringKana(original, hiragana) {
                    if (!original || !hiragana) return false;

                    // 罗马字始终显示
                    if (/^[a-zA-Z]+$/.test(hiragana)) return false;

                    function toHiragana(str) {
                        return str.replace(/[\u30A0-\u30FF]/g, char => {
                            return String.fromCharCode(char.charCodeAt(0) - 96);
                        });
                    }

                    return toHiragana(original) === toHiragana(hiragana);
                }
                
                // 使用ruby标签显示振假名
                if (segment.hira && segment.hira.trim() && !isSameSoundIgnoringKana(segment.orig, segment.hira)) {
                    const rubyElement = document.createElement('ruby');
                    rubyElement.appendChild(document.createTextNode(segment.orig));
                    
                    // 确保使用平假名
                    let hiragana = segment.hira;
                    if (/[\u30A0-\u30FF]/.test(hiragana)) {
                        hiragana = hiragana.replace(/[\u30A0-\u30FF]/g, char => {
                            return String.fromCharCode(char.charCodeAt(0) - 96);
                        });
                    }
                    
                    const rtElement = document.createElement('rt');
                    rtElement.textContent = hiragana;
                    rubyElement.appendChild(rtElement);
                    
                    wordSpanHtml.appendChild(rubyElement);
                } else {
                    wordSpanHtml.textContent = segment.orig;
                }
                
                segmentedContent += wordSpanHtml.outerHTML;
            });
            
            return segmentedContent;
        }

        // 处理分词内容并划分句子
        function processSegmentedContentIntoSentences(segmentedContent) {
            // 使用DOM方法处理分词后的内容，确保HTML属性正确性
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = segmentedContent;
            
            // 获取所有分词后的单词元素
            const wordElements = Array.from(tempDiv.querySelectorAll('.lunaws-word'));
            
            // 创建句子并添加到段落中
            const resultContainer = createSentencesFromWords(wordElements);
            
            // 直接设置段落内容，避免HTML字符串解析问题
            currentParagraph.innerHTML = '';
            currentParagraph.appendChild(resultContainer);
            
            // 为单词和句子添加事件
            attachWordEvents(currentParagraph);
            attachSentenceEvents(currentParagraph);
            
            console.log('[LunaWS] 句子处理完成，句子数量:', currentParagraph.querySelectorAll('.lunaws-sentence').length);
        }

        // 从单词创建句子
        function createSentencesFromWords(wordElements) {
            // 创建一个临时容器，用于分组句子
            const resultContainer = document.createElement('div');
            
            // 创建句子分组变量
            let currentSentence = document.createElement('span');
            currentSentence.className = 'lunaws-sentence';
            let currentSentenceLength = 0;
            const sentenceThreshold = userSettings.sentenceThreshold;
            
            // 分隔符
            const delimiterStr = userSettings.sentenceDelimiters;
            
            // 处理每个单词
            for (let i = 0; i < wordElements.length; i++) {
                const wordElement = wordElements[i];
                const wordText = wordElement.getAttribute('data-word') || '';
                
                // 添加到当前句子
                currentSentence.appendChild(wordElement.cloneNode(true));
                
                // 计算当前句子的实际长度（不包括振假名）
                currentSentenceLength += wordText.length;
                
                // 检查是否为句子结束标记
                const isEndOfSentence = delimiterStr.includes(wordText) ||
                                        (i === wordElements.length - 1);
                
                // 如果到达句子结束或超过阈值，完成当前句子
                if (isEndOfSentence && currentSentenceLength >= sentenceThreshold) {
                    resultContainer.appendChild(currentSentence);
                    
                    // 重置句子
                    if (i < wordElements.length - 1) {
                        currentSentence = document.createElement('span');
                        currentSentence.className = 'lunaws-sentence';
                        currentSentenceLength = 0;
                    }
                }
            }
            
            // 如果最后一个句子未添加，则添加它
            if (currentSentence.childNodes.length > 0 && !resultContainer.contains(currentSentence)) {
                resultContainer.appendChild(currentSentence);
            }
            
            return resultContainer;
        }

        // 为单词添加事件处理
        function attachWordEvents(container) {
            container.querySelectorAll('.lunaws-word').forEach(wordSpan => {
                const word = wordSpan.getAttribute('data-word');
                
                // 添加鼠标悬停效果
                wordSpan.addEventListener('mouseover', () => {
                    // 高亮当前单词
                    wordSpan.style.backgroundColor = 'rgba(238, 206, 165, 0.7)';
                });
                
                wordSpan.addEventListener('mouseout', () => {
                    // 如果不是选中的单词，取消高亮
                    if (!wordSpan.classList.contains('selected')) {
                        wordSpan.style.backgroundColor = '';
                    }
                });

                // 处理单词点击事件
                function handleWordClick(event, wordSpan, word) {
                    event.stopPropagation();
                    
                    // 检查单词是否已被选中
                    if (wordSpan.classList.contains('selected')) {
                        // 如果已选中，取消选中并关闭词典窗口
                        clearDictionarySelection();
                        return;
                    }
                    
                    // 清除之前的选择
                    clearDictionarySelection();
                    
                    // 选中当前单词
                    wordSpan.classList.add('selected');
                    wordSpan.style.backgroundColor = '#ffeb3b'; // 设置选中状态的背景色
                    queryWord(wordSpan, word);
                }

                // 处理单词右键菜单事件
                function handleWordContextMenu(event, wordSpan) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    wordSpan.classList.add('selected');
                    wordSpan.style.backgroundColor = '#ffeb3b'; // 设置选中状态的背景色
                    
                    if (selectedWords.length === 0 && currentWordElement) {
                        selectedWords.push(currentWordElement);
                    }
                    
                    if (!selectedWords.includes(wordSpan)) {
                        selectedWords.push(wordSpan);
                    }
                    
                    combinedWord = selectedWords.map(word => word.getAttribute('data-word')).join('');
                    
                    if (currentWordElement) {
                        queryWord(currentWordElement, combinedWord);
                    } else {
                        queryWord(wordSpan, combinedWord);
                    }
                }
                
                // 左键点击查询当前词
                wordSpan.addEventListener('click', (event) => handleWordClick(event, wordSpan, word));
                
                // 右键点击组合词
                wordSpan.addEventListener('contextmenu', (event) => handleWordContextMenu(event, wordSpan));
            });
        }

        // 为句子添加事件处理
        function attachSentenceEvents(container) {
            container.querySelectorAll('.lunaws-sentence').forEach(sentence => {

                // 处理句子鼠标抬起事件
                sentence.addEventListener('mouseup', (event) => {
                    // 检查是否为中键点击 (鼠标滚轮点击)
                    if (event.button === 1) {
                        event.preventDefault();
                        event.stopPropagation();
                        
                        if (sentence.textContent.trim()) {
                            // 获取句子的纯文本
                            const sentenceText = removeRubyText(sentence);
                            readText(sentenceText, sentence);
                        }
                    }
                });
            });
        }

        // 为段落添加中键事件
        function attachParagraphEvents(text, element) {
            // 先移除可能存在的事件监听器
            element.removeEventListener('mousedown', element._lunawsMousedownHandler);
            element.removeEventListener('mouseup', element._lunawsMouseupHandler);

            // 添加中键点击事件
            element._lunawsMousedownHandler = (event) => {
                if (event.button === 1) {
                    // 阻止默认的中键行为
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // 检查是否点击在句子或单词上，如果是则交给它们自己的处理程序
                    if (event.target.closest('.lunaws-sentence') || event.target.closest('.lunaws-word')) {
                        return;
                    }
                }
            };
            element._lunawsMouseupHandler = (event) => {
                if (event.button === 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // 检查是否点击在句子或单词上，如果是则交给它们自己的处理程序
                    if (event.target.closest('.lunaws-sentence') || event.target.closest('.lunaws-word')) {
                        return;
                    }
                    readText(text, element);
                }
            };

            element.addEventListener('mousedown', element._lunawsMousedownHandler);
            element.addEventListener('mouseup', element._lunawsMouseupHandler);

        }
        
        // 复制文本到剪贴板
        function copyTextToClipboard(text, element = null) {
            // 使用navigator.clipboard API（如果可用）
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        console.log('[LunaWS] 文本已复制到剪贴板');
                    })
                    .catch(err => {
                        console.error('[LunaWS] 复制失败:', err);
                        // 如果API不可用，使用传统方法
                        fallbackCopyTextToClipboard(text);
                    });
            } else {
                // 使用传统方法
                fallbackCopyTextToClipboard(text);
            }

            function fallbackCopyTextToClipboard(text) {
                const tempInput = document.createElement('input');
                tempInput.value = text;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
            }

            // 添加视觉反馈
            element.classList.add('lunaws-copy');
            setTimeout(() => { element.classList.remove('lunaws-copy'); }, 500);
        }

        // 离线模式下的简单分句函数
        function offlineSplitTextIntoSentences(text) {
            try {
                console.log('[LunaWS] 正在离线模式下进行分句处理');
                
                // 创建一个临时容器
                const resultContainer = document.createElement('div');
                
                // 获取句子分隔符
                const delimiterStr = userSettings.sentenceDelimiters || '。．.!?！？…';
                const sentenceThreshold = parseInt(userSettings.sentenceThreshold) || 20;
                
                // 先将文本按照分隔符分割成粗略的句子
                let rawSentences = [];
                let currentSentence = '';
                
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    currentSentence += char;
                    
                    // 如果是分隔符或者是最后一个字符
                    if (delimiterStr.includes(char) || i === text.length - 1) {
                        if (currentSentence.trim().length > 0) {
                            rawSentences.push(currentSentence);
                            currentSentence = '';
                        }
                    }
                }
                
                // 确保最后一个句子被添加
                if (currentSentence.trim().length > 0) {
                    rawSentences.push(currentSentence);
                }
                
                // 处理句子长度，将过短的句子合并
                let finalSentences = [];
                let tempSentence = '';
                
                for (let i = 0; i < rawSentences.length; i++) {
                    tempSentence += rawSentences[i];
                    
                    // 如果句子长度超过阈值或者是最后一个句子，则添加到最终结果
                    if (tempSentence.length >= sentenceThreshold || i === rawSentences.length - 1) {
                        finalSentences.push(tempSentence);
                        tempSentence = '';
                    }
                }
                
                // 确保最后一个句子被添加
                if (tempSentence.trim().length > 0) {
                    finalSentences.push(tempSentence);
                }
                
                // 创建句子元素并添加到结果容器
                finalSentences.forEach(sentenceText => {
                    const sentenceElement = document.createElement('span');
                    sentenceElement.className = 'lunaws-sentence';
                    sentenceElement.textContent = sentenceText;
                    resultContainer.appendChild(sentenceElement);
                });
                
                console.log('[LunaWS] 离线分句完成，句子数量:', finalSentences.length);
                return resultContainer;
            } catch (error) {
                console.error('[LunaWS] 离线分句处理时出错:', error);
                const errorContainer = document.createElement('div');
                errorContainer.textContent = '分句处理错误: ' + error.message;
                return errorContainer;
            }
        }

        /* ========== 翻译功能 ========== */
        // 翻译文本
        function translateText(text) {
            try {
                if (!currentParagraph || !text) {
                    console.error('[LunaWS] 无法翻译：无当前段落或文本为空');
                    return;
                }

                console.log('[LunaWS] 开始翻译文本:', text.substring(0, 30) + '...');
                removeTranslationArea();

                const translationArea = document.createElement('div');
                translationArea.className = 'lunaws-translation-area';
                translationArea.setAttribute('data-text', text);
                translationArea.style.display = 'none'; // 先隐藏翻译区域

                // 生成唯一ID用于关联段落和翻译区域
                const translationId = Date.now();
                translationArea.setAttribute('data-paragraph-id', translationId);
                currentParagraph.setAttribute('data-translation-id', translationId);

                // 根据设置使用不同的翻译窗口放置方式
                if (userSettings.floatingTranslation) {
                    addTranslationArea(translationArea, currentParagraph);
                    // 浮动窗口 - 将翻译区域添加到body
                    document.body.appendChild(translationArea);
                } else {
                    // 传统窗口 - 占用排版
                    translationArea.style.position = 'static';
                    translationArea.style.width = 'auto';
                    if (userSettings.verticalPreference) {
                        translationArea.style.marginRight = '4px';
                        translationArea.classList.add('lunaws-vertical-translation-area');
                    } else {
                        translationArea.style.marginTop = '4px';
                        translationArea.classList.add('lunaws-horizontal-translation-area');
                    }
                    
                    // 将翻译区域插入到段落后面
                    currentParagraph.after(translationArea);
                }

                // 添加临时加载指示器
                translationArea.innerHTML = `<div style="padding:10px;color:#666;text-align:center;">${MESSAGE[userSettings.language].translating}</div>`;
                translationArea.style.display = 'block';

                const sent = sendMessage(JSON.stringify({
                    type: 'translate',
                    text: text
                }));

                if (!sent) {
                    console.error('[LunaWS] 翻译请求发送失败');
                    translationArea.innerHTML = '<div style="padding:10px;color:red;text-align:center;">翻译请求发送失败</div>';
                } else {
                    console.log('[LunaWS] 翻译请求已发送');
                }
            } catch (error) {
                console.error('[LunaWS] 翻译过程中出错:', error);
            }
        }

        // 处理翻译结果
        function handleTranslationResult(data) {
            try {
                console.log('[LunaWS] 收到翻译结果:', data);
                
                if (!currentParagraph) {
                    console.error('[LunaWS] 没有当前段落，无法处理翻译结果');
                    return;
                }

                const translationId = currentParagraph ? currentParagraph.getAttribute('data-translation-id') : null;
                const translationArea = translationId ? 
                    document.querySelector(`.lunaws-translation-area[data-paragraph-id="${translationId}"]`) : 
                    document.querySelector('.lunaws-translation-area');
                    
                if (!translationArea) {
                    console.error('[LunaWS] 未找到翻译区域，创建新的翻译区域');
                    // 如果找不到翻译区域，尝试重新创建一个
                    translateText(removeRubyText(currentParagraph));
                    return;
                }

                // 确保数据格式正确
                if (typeof data === 'string') {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        data = {
                            type: 'translation_result',
                            translator: 'Unregulated output',
                            content: data
                        };
                    }
                }

                // 检查原文是否匹配
                if (data.type === 'translation_result' && data.source_text) {
                    const currentText = translationArea.getAttribute('data-text');
                    if (currentText && currentText !== data.source_text) {
                        console.log('[LunaWS] 翻译原文不匹配，跳过此结果');
                        return;
                    }
                }

                // 获取翻译器名称和翻译文本
                const translatorName = data.translator || 'default-translator';
                const translationText = data.content || '';

                // 如果没有翻译内容，则不显示
                if (!translationText.trim()) {
                    console.log('[LunaWS] 翻译内容为空，不显示');
                    return;
                }

                // 准备翻译容器
                let translationsContainer = translationArea.querySelector('.lunaws-translations-container');
                if (!translationsContainer) {
                    translationsContainer = document.createElement('div');
                    translationsContainer.className = 'lunaws-translations-container';
                    translationArea.innerHTML = '';
                    translationArea.appendChild(translationsContainer);
                }

                // 检查现有翻译块
                let translationBlock = translationsContainer.querySelector(`.lunaws-translation-block[data-translator="${translatorName}"]`);

                if (translationBlock) {
                    // 更新现有翻译
                    const contentElement = translationBlock.querySelector('.lunaws-translation-content');
                    if (contentElement) {
                        // 获取或创建翻译器名称span
                        let translatorSpan = contentElement.querySelector('.lunaws-translator-header');
                        if (!translatorSpan) {
                            translatorSpan = document.createElement('span');
                            translatorSpan.className = 'lunaws-translator-header';
                            translatorSpan.textContent = translatorName;
                        }
                        
                        // 清空内容元素但保留翻译器名称
                        contentElement.innerHTML = '';
                        contentElement.appendChild(document.createTextNode(translationText + ' '));
                        contentElement.appendChild(translatorSpan);
                    }
                } else {
                    // 创建新翻译块
                    translationBlock = document.createElement('div');
                    translationBlock.className = 'lunaws-translation-block';
                    translationBlock.setAttribute('data-translator', translatorName);
                    
                    // 添加翻译器标题和内容
                    translationBlock.innerHTML = `
                        <div class="lunaws-translation-content">${translationText} <span class="lunaws-translator-header">${translatorName}</span></div>
                    `;
                    
                    // 添加分隔线到翻译容器中（如果容器中已经有翻译块）
                    if (translationsContainer.children.length > 0) {
                        const separator = document.createElement('hr');
                        translationsContainer.appendChild(separator);
                    }
                    
                    translationsContainer.appendChild(translationBlock);
                }

                // 显示翻译区域
                translationArea.style.display = '';
                console.log(`[LunaWS] 【${translatorName}】翻译显示成功`);
            } catch (error) {
                console.error('[LunaWS] 处理翻译结果时出错:', error);
            }
        }

        // 移除翻译区域
        function removeTranslationArea() {
            const translationId = currentParagraph ? currentParagraph.getAttribute('data-translation-id') : null;

            if (translationId) {
                const translationArea = document.querySelector(`.lunaws-translation-area[data-paragraph-id="${translationId}"]`);
                if (translationArea) translationArea.remove();
                
                if (currentParagraph) {
                    currentParagraph.removeAttribute('data-translation-id');
                }
            } else {
                // 移除所有翻译区域（用于清理任何可能的孤立翻译区域）
                document.querySelectorAll('.lunaws-translation-area').forEach(area => area.remove());
            }
        }

        /* ========== 查词功能 ========== */
        // 查询单词
        function queryWord(wordElement, word) {
            // 更新当前查询词信息
            currentWord = word;
            currentWordElement = wordElement;

            // 关闭已存在的弹窗
            const existingPopup = document.querySelector('.lunaws-dictionary-popup');
            if (existingPopup) existingPopup.remove();

            // 创建新弹窗
            const popup = document.createElement('div');
            popup.className = 'lunaws-dictionary-popup';
            popup.setAttribute('data-query-word', word); // 在弹窗上记录查询词

            // 创建查词输入框
            const searchBox = document.createElement('div');
            searchBox.className = 'lunaws-search-box';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'lunaws-search-input';
            searchInput.value = word;
            searchInput.placeholder = MESSAGE[userSettings.language].inputSearch;

            // 创建关闭按钮
            const closeButton = document.createElement('button');
            closeButton.className = 'lunaws-close-button';
            closeButton.innerHTML = '&times;'; // 使用 × 符号
            closeButton.title = 'close';
            closeButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                popup.remove();
            });

            // 为输入框添加输入事件
            searchInput.addEventListener('input', function() {
                const newWord = this.value.trim();
                if (newWord && newWord !== popup.getAttribute('data-query-word')) {
                    popup.setAttribute('data-query-word', newWord);
                    
                    // 清空现有内容并显示加载提示
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) {
                        const tabsContainer = iframeDoc.querySelector('.dict-tabs');
                        const entriesContainer = iframeDoc.querySelector('.dict-entries');
                        if (tabsContainer) tabsContainer.innerHTML = '';
                        if (entriesContainer) entriesContainer.innerHTML = '';
                        
                        const loadingIndicator = iframeDoc.querySelector('.dict-loading');
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'block';
                            loadingIndicator.textContent = `${MESSAGE[userSettings.language].searching}"${newWord}"`;
                        }
                    }
                    
                    // 发送新的查词请求
                    sendMessage(JSON.stringify({
                        type: 'dictionary',
                        word: newWord
                    }));
                    
                    if (userSettings.autoReadWord) {
                        readText(newWord);
                    }
                }
            });

            searchBox.appendChild(searchInput);
            searchBox.appendChild(closeButton);
            popup.appendChild(searchBox);

            // 创建iframe
            const iframe = document.createElement('iframe');
            iframe.className = 'lunaws-dict-iframe';
            iframe.setAttribute('data-lunaws-dictionary', 'true'); // 添加标识属性以便识别
            popup.appendChild(iframe);

            // 防止事件冒泡和确保点击弹窗不会触发其他事件
            popup.addEventListener('mousedown', e => {
                e.stopPropagation();
            });
            popup.addEventListener('click', e => {
                e.stopPropagation();
            });
            
            // 添加到DOM - 先添加到文档body而不是wordElement
            document.body.appendChild(popup);
            
            // 初始定位
            positionDictionaryPopup(popup, wordElement);

            // 监听窗口大小变化和滚动事件
            const resizeHandler = () => positionDictionaryPopup(popup, wordElement);
            const scrollHandler = () => positionDictionaryPopup(popup, wordElement);
            window.addEventListener('resize', resizeHandler);
            window.addEventListener('scroll', scrollHandler, { passive: true });

            // 创建清理函数，在弹窗关闭时移除事件监听器
            const cleanup = () => {
                window.removeEventListener('resize', resizeHandler);
                window.removeEventListener('scroll', scrollHandler);
            };
            
            // 自定义移除函数以确保清理
            popup.originalRemove = popup.remove;
            popup.remove = function() {
                cleanup();
                if (this.parentNode) {
                    this.parentNode.removeChild(this);
                }
            };

            // 初始化iframe
            iframe.onload = () => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (!iframeDoc) return;
                
                iframeDoc.body.innerHTML = `
                    <style>
                        body { font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; line-height: 1.4; }
                        .dict-loading { text-align: center; color: #666; padding: 20px; }
                        .dict-tabs { position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; z-index: 10; }
                        .dict-tab { display: inline-block;  font-size: 12px; padding: 5px 10px; cursor: pointer; font-size: 12px; border-radius: 3px 3px 0 0; }
                        .dict-tab.active { border: 1px solid #ddd; border-bottom: 1px solid #fff; margin-bottom: -1px; background-color: #f9f9f9; }
                        .dict-entry { display: none; }
                        .dict-header { font-weight: bold; color: #2c5282; margin-bottom: 5px; }
                        .dict-content { max-width: 100%; overflow-wrap: break-word; }
                    </style>
                    <div class="dict-tabs"></div>
                    <div class="dict-loading"> ${MESSAGE[userSettings.language].searching}"${word}"</div>
                    <div class="dict-entries"></div>
                `;
                
                // 调整弹窗位置以适应内容
                setTimeout(() => {
                    positionDictionaryPopup(popup, wordElement);
                    // 使输入框获得焦点以便用户直接输入
                    searchInput.select();
                }, 50);
            };
            iframe.src = 'about:blank';

            // 发送查词请求
            sendMessage(JSON.stringify({
                type: 'dictionary',
                word: word
            }));

            // 如果启用了自动朗读单词，发送朗读请求
            if (userSettings.autoReadWord) {
                readText(word);
            }
            
            // 最后再次进行定位
            setTimeout(() => {
                positionDictionaryPopup(popup, wordElement);
            }, 100);
        }

        // 处理词典结果
        function handleDictionaryResult(data) {
            // 获取词典结果
            const message = data.content;
            const dictName = data.dictionary;
            const searchWord = data.word;

            if (!currentWordElement) return;

            const popup = document.querySelector('.lunaws-dictionary-popup');
            if (!popup) return;

            // 检查当前查询词与返回结果是否匹配
            const queryWord = popup.getAttribute('data-query-word');

            // 如果提供了searchWord且与当前查询的词不符，则忽略此结果
            if (searchWord && searchWord !== queryWord) {
                console.log(`忽略过时的词典结果: ${searchWord} (当前查询: ${queryWord})`);
                return;
            }

            // 检查返回的内容是否为空
            if (!message || message.trim() === '') {
                console.log(`忽略空结果: ${dictName}`);
                return;
            }

            const iframe = popup.querySelector('.lunaws-dict-iframe');
            if (!iframe) return;

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) return;

            // 提取词典名称
            const dictionaryName = dictName || MESSAGE[userSettings.language].unknownDictionary;

            // 隐藏加载提示
            const loadingIndicator = iframeDoc.querySelector('.dict-loading');
            if (loadingIndicator) loadingIndicator.style.display = 'none';

            // 获取词典条目容器
            const entriesContainer = iframeDoc.querySelector('.dict-entries');
            const dictId = `dict-${dictionaryName.replace(/\s+/g, '-')}`;

            // 检查是否已有该词典结果
            let entryDiv = iframeDoc.getElementById(dictId);
            let isNewDictionary = false;

            if (!entryDiv) {
                isNewDictionary = true;
                // 创建新词典条目
                entryDiv = document.createElement('div');
                entryDiv.className = 'dict-entry';
                entryDiv.id = dictId;
                entryDiv.setAttribute('data-dict', dictionaryName);
                
                entryDiv.innerHTML = `
                    <div class="dict-content">${message}</div>
                `;
                
                entriesContainer.appendChild(entryDiv);
                
                // 添加词典标签
                const tabsContainer = iframeDoc.querySelector('.dict-tabs');
                const tab = document.createElement('div');
                tab.className = 'dict-tab';
                tab.textContent = dictionaryName;
                tab.setAttribute('data-dict', dictionaryName);
                
                if (tabsContainer.children.length === 0) {
                    tab.classList.add('active');
                    entryDiv.style.display = 'block';
                }
                
                tab.addEventListener('click', function() {
                    // 更新标签状态
                    iframeDoc.querySelectorAll('.dict-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    // 更新词典显示
                    const dictName = this.getAttribute('data-dict');
                    iframeDoc.querySelectorAll('.dict-entry').forEach(entry => {
                        entry.style.display = entry.getAttribute('data-dict') === dictName ? 'block' : 'none';
                    });

                    // 点击标签页时也重新定位弹窗
                    positionDictionaryPopup(popup, currentWordElement);
                });
                
                tabsContainer.appendChild(tab);
            } else {
                // 更新现有词典内容
                const contentDiv = entryDiv.querySelector('.dict-content');
                if (contentDiv) contentDiv.innerHTML = message;
            }
            
            // 在内容更新后重新定位弹窗
            // 根据是否是新词典条目，使用不同的延迟时间
            setTimeout(() => {
                positionDictionaryPopup(popup, currentWordElement);
            }, isNewDictionary ? 100 : 50);
        }

        // 关闭词典选择和窗口的函数
        function clearDictionarySelection() {
            // 清除所有选中单词的高亮
            document.querySelectorAll('.lunaws-word.selected').forEach(word => {
                word.classList.remove('selected');
                word.style.backgroundColor = ''; // 清除背景色
            });
            
            // 关闭词典窗口
            const dictionaryPopup = document.querySelector('.lunaws-dictionary-popup');
            if (dictionaryPopup) dictionaryPopup.remove();
            
            // 重置选择状态
            selectedWords = [];
            combinedWord = '';
            currentWordElement = null;
        }


        /* ========== 朗读功能 ========== */
        // 当前朗读的元素和音频
        let currentAudio = null;

        // 朗读文本
        function readText(text, element = null) {
            if (!text || !isConnected) return false;

            // 停止之前的朗读
            stopReading();
            
            // 确保有足够的延迟让上一个音频停止
            if (lastAudioStopTime && (Date.now() - lastAudioStopTime < 100)) {
                console.log('等待上一个音频资源完全释放...');
                return setTimeout(() => readText(text, element), 150);
            }

            // 发送朗读请求
            const success = sendMessage(JSON.stringify({
                type: 'read',
                text: text
            }));

            // 添加视觉反馈
            element.classList.add('lunaws-reaction');
            setTimeout(() => { element.classList.remove('lunaws-reaction'); }, 500);

            return success;
        }

        // 处理朗读响应
        function handleReadResult(data) {
            // 有音频数据的情况
            if (data.status === 'success' && data.audio_data) {
                // 确保在处理新音频前，之前的音频已经停止
                if (currentAudio) {
                    stopReading();
                    // 如果刚刚停止了音频，添加小延迟再播放新音频
                    setTimeout(() => playAudio(data), 50);
                } else {
                    playAudio(data);
                }
            } 
            // 服务器直接播放音频的情况
            else if (data.status === 'read_text_success') {
                console.log('服务器已直接播放音频:', data.message || '');
                
                // 一段时间后移除朗读标记
                setTimeout(() => {
                    stopReading();
                }, 10000); // 假设10秒足够播放完成
            }
            // 其他情况
            else {
                console.log('朗读请求完成，但未返回音频数据:', data);
                stopReading();
            }
        }

        // 停止朗读
        let lastAudioStopTime = 0; // 添加上一次停止朗读的时间标记
        
        function stopReading() {
            // 停止当前音频播放
            if (currentAudio) {
                try {
                    currentAudio.pause();
                    
                    // 确保音频资源被释放
                    if (currentAudio.src) {
                        URL.revokeObjectURL(currentAudio.src);
                        currentAudio.src = '';
                        currentAudio.load(); // 强制重新加载以释放资源
                    }
                    
                    currentAudio = null;
                    lastAudioStopTime = Date.now(); // 记录停止时间
                    console.log('已停止之前的音频播放');
                } catch (e) {
                    console.error('停止之前音频时出错:', e);
                }
            }
        }

        // 播放音频
        function playAudio(data) {
            try {
                // 先确保之前的音频已完全停止
                stopReading();
                
                // 获取音频格式
                const format = data.format || 'wav';
                
                // 创建音频Blob
                const audioBlob = base64ToBlob(data.audio_data, `audio/${format}`);
                
                // 创建音频元素
                const audioElement = new Audio();
                
                // 保存音频引用
                currentAudio = audioElement;
                
                // 设置音频源
                const audioUrl = URL.createObjectURL(audioBlob);
                audioElement.src = audioUrl;
                
                // 播放开始
                audioElement.onplay = () => {
                    console.log('音频开始播放');
                };
                
                // 播放结束
                audioElement.onended = () => {
                    stopReading();
                    URL.revokeObjectURL(audioUrl);
                    
                    // 在自动播放模式下，播放结束后自动跳转到下一段
                    if (isAutoPlayMode && currentParagraph) {
                        console.log('自动播放模式：准备跳转到下一段');
                        setTimeout(() => {
                            navigateToNextParagraph();
                            // 确保状态显示保持更新
                            updateConnectionStatusDisplay();
                        }, 500); // 添加短暂延迟再跳转，提供更好的用户体验
                    }
                };
                
                // 播放错误
                audioElement.onerror = (e) => {
                    console.error('音频播放错误:', e);
                    stopReading();
                    URL.revokeObjectURL(audioUrl);
                };
                
                // 开始播放
                audioElement.play().catch(e => {
                    console.error('无法播放音频:', e);
                    stopReading();
                    URL.revokeObjectURL(audioUrl);
                });
            } catch (e) {
                console.error('处理音频数据出错:', e);
                stopReading();
            }
        }

        // base64转换为blob
        function base64ToBlob(base64, mimeType) {
            const byteCharacters = atob(base64);
            const byteArrays = [];
            
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                const slice = byteCharacters.slice(offset, offset + 512);
                
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }
            return new Blob(byteArrays, { type: mimeType });
        }

        // 通用消息提示函数
        function showMessage(message, type = 'info', duration = 1500) {
            if (!userSettings.MessageToggle) return;
            // 确保样式表已添加
            if (!document.querySelector('#lunaws-message-styles')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'lunaws-message-styles';
                styleSheet.textContent = `
                    .lunaws-message-container {
                        position: fixed; top: 20px; left: 20px;
                        max-width: 300px; z-index: 10000; 
                    }
                    .lunaws-status-message {
                        color: white; padding: 8px; border-radius: 8px; font-size: .8em;
                        margin-bottom: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                        display: flex; align-items: center; opacity: 0; transform: translateX(50px);
                        transition: opacity 0.3s, transform 0.3s; cursor: default;
                    }
                    .lunaws-message-icon { margin-right: 10px; font-size: .8em; }
                    .lunaws-message-content { flex: 1; font-weight: 400; }
                    .lunaws-status-message[data-type="info"] { background-color: rgba(33, 150, 243, 0.7); }
                    .lunaws-status-message[data-type="success"] { background-color: rgba(76, 175, 80, 0.7); }
                    .lunaws-status-message[data-type="warning"] { background-color: rgba(255, 152, 0, 0.7); }
                    .lunaws-status-message[data-type="error"] { background-color: rgba(244, 67, 54, 0.7); }
                `;
                document.head.appendChild(styleSheet);
            }
            
            // 创建或获取消息容器
            let messageContainer = document.querySelector('.lunaws-message-container');
            if (!messageContainer) {
                messageContainer = document.createElement('div');
                messageContainer.className = 'lunaws-message-container';
                document.body.appendChild(messageContainer);
            }
            
            // 创建新的消息元素
            const statusDiv = document.createElement('div');
            statusDiv.className = 'lunaws-status-message';
            statusDiv.dataset.type = type;
            
            // 设置图标
            let icon = '💬';
            if (type === 'success') { icon = '✅';
            } else if (type === 'warning') { icon = '⚠️';
            } else if (type === 'error') { icon = '❌'; }
            
            // 创建消息内容结构
            statusDiv.innerHTML = `
                <div class="lunaws-message-icon">${icon}</div>
                <div class="lunaws-message-content">${message}</div>
            `;
            
            // 添加到容器
            messageContainer.appendChild(statusDiv);
            
            // 触发动画显示
            setTimeout(() => {
                statusDiv.style.opacity = '1';
                statusDiv.style.transform = 'translateX(0)';
            }, 10);
            
            // 自动移除状态提示
            setTimeout(() => {
                // 淡出动画
                statusDiv.style.opacity = '0';
                statusDiv.style.transform = 'translateX(50px)';
                
                // 移除元素
                setTimeout(() => {
                    if (messageContainer.contains(statusDiv)) {
                        messageContainer.removeChild(statusDiv);
                        
                        // 如果容器为空，也移除容器
                        if (messageContainer.children.length === 0) {
                            document.body.removeChild(messageContainer);
                        }
                    }
                }, 300);
            }, duration);
        }

        init();
        }
    }

    /* ========== 注入脚本 ========== */
    // 注入到主页
    const lunaWSCode = getLunaWSCode();
    lunaWSCode();
    console.log("[Luna WS] 在主页面初始化完成");

    // 标记已注入的iframe
    const injectedIframes = new WeakSet();

    // 注入到iframe
    function injectToIframes() {
        const iframes = document.querySelectorAll('iframe');
        console.log('找到iframe数量:', iframes.length);

        iframes.forEach((iframe, index) => {
            // 检查是否已经注入过
            if (injectedIframes.has(iframe)) {
                return; // 跳过已注入的iframe
            }

            // 排除查词框iframe
            if (iframe.classList.contains('lunaws-dict-iframe') || 
                iframe.closest('.lunaws-dictionary-popup') || 
                iframe.hasAttribute('data-lunaws-dictionary') ||
                (iframe.parentElement && iframe.parentElement.closest('.lunaws-dictionary-popup'))) {
                console.log('跳过查词框iframe');
                return; // 跳过查词框iframe
            }

            try {
                if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                    console.log(`正在注入到iframe ${index}`);
                    injectScriptToIframe(iframe);
                    // 标记为已注入
                    injectedIframes.add(iframe);
                } else {
                    iframe.addEventListener('load', function() {
                        // 防止重复注入
                        if (injectedIframes.has(iframe)) return;
                        
                        // 再次检查是否为查词框iframe（可能在加载后添加了类名）
                        if (iframe.classList.contains('lunaws-dict-iframe') || 
                            iframe.closest('.lunaws-dictionary-popup') || 
                            iframe.hasAttribute('data-lunaws-dictionary') ||
                            (iframe.parentElement && iframe.parentElement.closest('.lunaws-dictionary-popup'))) {
                            console.log('跳过查词框iframe');
                            return;
                        }
                        
                        console.log(`iframe ${index} 加载完成，正在注入`);
                        injectScriptToIframe(iframe);
                        // 标记为已注入
                        injectedIframes.add(iframe);
                    });
                }
            } catch (e) {
                console.error(`无法访问iframe ${index}:`, e);
            }
        });
    }

    function injectScriptToIframe(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // 检查是否已注入
            if (iframeDoc.querySelector('script[data-lunaws-injected]')) {
                console.log('此iframe已注入过Luna WS，跳过');
                return;
            }
            
            // 获取完整代码
            const lunaWSCode = getLunaWSCode();
            
            // 创建脚本
            const scriptText = `
                (${lunaWSCode})();
                console.log("[Luna WS] 在iframe中初始化完成");
            `;
            
            // 使用Blob URL创建脚本
            const blob = new Blob([scriptText], {type: 'application/javascript'});
            const url = URL.createObjectURL(blob);
            
            // 创建script标签并添加到iframe
            const script = iframeDoc.createElement('script');
            script.src = url;
            script.setAttribute('data-lunaws-injected', 'true'); // 添加标记
            iframeDoc.head.appendChild(script);
            
            // 清理Blob URL
            script.onload = function() {
                URL.revokeObjectURL(url);
            };
            
            console.log('成功注入脚本到iframe');
        } catch (e) {
            console.error('注入脚本到iframe失败:', e);
        }
    }

    // 页面加载完成后执行注入
    if (document.readyState === 'complete') {
        injectToIframes();
    } else {
        window.addEventListener('load', injectToIframes);
    }

    // 对于动态加载的iframe，定期检查并注入
    setInterval(injectToIframes, 3000);
})() 

