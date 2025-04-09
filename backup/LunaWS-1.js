// ==UserScript==
// @name         Luna-WS
// @namespace    http://tampermonkey.net/
// @version      0.3.3
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

    // ========== 控制面板 ==========
    function createControlPanel() {
        // 避免重复创建
        if (document.getElementById('lunaws-panel')) return;

        // 创建控制面板元素
        const panel = document.createElement('div');
        panel.id = 'lunaws-panel';
        panel.className = 'lunaws-control-panel collapsed';
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .lunaws-control-panel {
                position: fixed; top: 20px; right: 20px; z-index: 9999999;
                background-color: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                padding: 10px; width: 230px; font-size: 14px; max-height: 80vh;
                overflow-y: auto; transition: all 0.3s ease;
            }
            .lunaws-control-panel.collapsed { width: 105px; }
            .lunaws-header {
                margin: 0 0 8px 0; font-size: 15px; border-bottom: 1px solid #eee;
                padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center;
            }
            .lunaws-title { font-weight: bold; margin-right: 5px; }
            .lunaws-expand-button {
                cursor: pointer; padding: 2px 6px; font-size: 10px; color: #777;
                border: 1px solid #ddd; border-radius: 3px; background-color: #f5f5f5;
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
            .lunaws-settings-row { margin-bottom: 8px; }
            .lunaws-settings-row label {
                display: block; margin-bottom: 3px; font-size: 12px; color: #555;
            }
            .lunaws-settings-row input[type="text"], .lunaws-settings-row textarea {
                width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px;
                box-sizing: border-box; font-size: 12px;
            }
            .lunaws-select {
                width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px;
                box-sizing: border-box; font-size: 12px; background-color: white; cursor: pointer;
            }
            .lunaws-settings-row textarea { height: 60px; resize: vertical; }
            .lunaws-toggle { display: flex; align-items: center; }
            .lunaws-toggle input[type="checkbox"] { margin-right: 5px; }
            .lunaws-tabs {
                display: flex; border-bottom: 1px solid #ddd; margin-top: 10px;
            }
            .lunaws-tab {
                padding: 5px 10px; cursor: pointer; font-size: 12px; border-radius: 3px 3px 0 0;
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
            }
            .lunaws-settings-saved .message {
                margin-bottom: 15px;
                color: #333;
            }
            .lunaws-settings-saved .buttons {
                display: flex;
                justify-content: center;
                gap: 10px;
            }
            .lunaws-settings-saved .lunaws-button {
                padding: 5px 15px;
                font-size: 13px;
            }
        `;
        document.head.appendChild(style);
        
        // 确保已经初始化了用户设置
        if (!userSettings || !userSettings.language) {
            console.error('[LunaWS] 创建控制面板时用户设置未初始化!', userSettings);
            // 如果userSettings未初始化，再次初始化
            userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
        }

        // 控制面板HTML内容 - 默认先英文
        const lang = userSettings.language || 'en';

        console.log('[LunaWS] 创建控制面板，当前语言:', lang, 'userSettings:', userSettings);
        panel.innerHTML = `
            <div class="lunaws-header">
                <div class="lunaws-title">LunaWS</div>
                <div class="lunaws-expand-button" id="lunaws-toggle-panel">${PANEL_TEXT[lang].settings}</div>
            </div>
            <div id="lunaws-status" style="font-size:12px;color:#666;">${PANEL_TEXT[lang].lunaWsDisabled}</div>
            
            <div id="lunaws-advanced-settings" style="display:none;">
                <div class="lunaws-tabs">
                    <div class="lunaws-tab active" data-tab="general">${PANEL_TEXT[lang].general}</div>
                    <div class="lunaws-tab" data-tab="Selector">${PANEL_TEXT[lang].Selector}</div>
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
                        <label>${PANEL_TEXT[lang].translationWindowStyle}</label>
                        <div class="lunaws-toggle">
                            <input type="checkbox" id="lunaws-floating-translation" checked>
                            <label for="lunaws-floating-translation">${PANEL_TEXT[lang].useFloatingWindow}</label>
                        </div>
                    </div>
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].autoReadSettings}</label>
                        <div class="lunaws-toggle">
                            <input type="checkbox" id="lunaws-auto-read-paragraph">
                            <label for="lunaws-auto-read-paragraph">${PANEL_TEXT[lang].autoReadParagraph}</label>
                        </div>
                    </div>
                    <div class="lunaws-settings-row">
                        <div class="lunaws-toggle">
                            <input type="checkbox" id="lunaws-auto-read-word">
                            <label for="lunaws-auto-read-word">${PANEL_TEXT[lang].autoReadWord}</label>
                        </div>
                    </div>
                </div>
                
                <!-- 选择器设置 -->
                <div class="lunaws-tab-content" data-tab="Selector">
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].tagSelector}</label>
                        <textarea id="lunaws-tag-selector">p, h1, h2, h3, h4, h5, h6</textarea>
                    </div>
                </div>
                
                <!-- 快捷键设置 -->
                <div class="lunaws-tab-content" data-tab="shortcuts">
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].nextParagraph}</label>
                        <input type="text" id="lunaws-next-para-key" value="ArrowDown, 2">
                    </div>
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].previousParagraph}</label>
                        <input type="text" id="lunaws-prev-para-key" value="ArrowUp, 8">
                    </div>
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].reloadCurrentParagraph}</label>
                        <input type="text" id="lunaws-reload-para-key" value="Space, 0">
                    </div>
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].closeActive}</label>
                        <input type="text" id="lunaws-close-active-key" value="Escape">
                    </div>
                </div>
                
                <!-- 高级设置 -->
                <div class="lunaws-tab-content" data-tab="advanced">
                    <div class="lunaws-settings-row">
                        <label>${PANEL_TEXT[lang].sentenceDelimiters}</label>
                        <input type="text" id="lunaws-sentence-delimiters" value="。．.!?！？…">
                        <label>${PANEL_TEXT[lang].sentenceThreshold}</label>
                        <input type="text" id="lunaws-sentence-threshold" value="15">
                    </div>
                </div>
                
                <div class="lunaws-settings-row" style="margin-top:10px;">
                    <button id="lunaws-save-settings" class="lunaws-button">${PANEL_TEXT[lang].saveSettings}</button>
                    <button id="lunaws-reset-settings" class="lunaws-button secondary">${PANEL_TEXT[lang].resetSettings}</button>
                </div>
            </div>

            <div id="lunaws-settings-saved-template" style="display:none;">
                <div class="lunaws-settings-saved">
                    <div class="message">${PANEL_TEXT[lang].settingsSaved}</div>
                    <div class="buttons">
                        <button class="lunaws-button" onclick="window.location.reload()">${PANEL_TEXT[lang].refreshNow}</button>
                        <button class="lunaws-button secondary" onclick="this.closest('.lunaws-settings-saved').remove()">${PANEL_TEXT[lang].refreshLater}</button>
                    </div>
                </div>
            </div>

            <div id="lunaws-reset-confirm-template" style="display:none;">
                <div class="lunaws-settings-saved">
                    <div class="message">${PANEL_TEXT[lang].confirmReset}</div>
                    <div class="buttons">
                        <button class="lunaws-button" id="lunaws-confirm-reset">${PANEL_TEXT[lang].confirmYes}</button>
                        <button class="lunaws-button secondary" onclick="this.closest('.lunaws-settings-saved').remove()">${PANEL_TEXT[lang].confirmNo}</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 添加事件处理
        setupControlPanelEvents();
    }
    
    // 默认用户设置
    const defaultUserSettings = {
        wsUrl: 'ws://localhost:6619',
        selector: 'p, h1, h2, h3, h4, h5, h6',
        sentenceDelimiters: '。．.!?！？…',
        sentenceThreshold: 15,
        floatingTranslation: true,
        language: 'zh',
        autoReadParagraph: false,
        autoReadWord: true,
        keyBindings: {
            nextParagraph: 'ArrowDown, 2',
            prevParagraph: 'ArrowUp, 8',
            reloadParagraph: 'Space, 0',
            closeActive: 'Escape'
        }
    };

    // 声明全局变量
    let userSettings = {};
    
    // 立即初始化用户设置
    initializeUserSettings();
    function initializeUserSettings() {
        try {
            // 先设置默认值
            userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
            
            // 尝试读取存储的设置
            const savedSettings = localStorage.getItem('lunaws-settings');
            if (savedSettings) {
                try {
                    // 直接使用对象扩展运算符合并设置
                    const parsedSettings = JSON.parse(savedSettings);
                    userSettings = {...userSettings, ...parsedSettings};
                    
                    // 确保嵌套对象也正确合并
                    if (parsedSettings.keyBindings) {
                        userSettings.keyBindings = {...userSettings.keyBindings, ...parsedSettings.keyBindings};
                    }
                    
                    console.log('[LunaWS] 已加载设置:', userSettings);
                } catch (e) {
                    console.error('[LunaWS] 解析保存的设置失败:', e);
                }
            } else {
                console.log('[LunaWS] 未找到保存的设置');
            }
        } catch (e) {
            console.error('初始化用户设置时出错:', e);
            // 确保即使出错也使用默认设置
            userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
        }
    }
    
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
            Selector: "Selector",
            shortcuts: "Shortcuts",
            advanced: "Advanced",
            language: "Interface Language:",
            translationWindowStyle: "Translation Window Style:",
            useFloatingWindow: "Use floating translation window (preserves layout)",
            tagSelector: "HTML Tags Selector (comma separated):",
            nextParagraph: "Next Paragraph:",
            previousParagraph: "Previous Paragraph:",
            reloadCurrentParagraph: "Reload Current Paragraph:",
            closeActive: "Close Active:",
            sentenceDelimiters: "Sentence Delimiters:",
            sentenceThreshold: "Sentence Threshold:",
            autoReadSettings: "Auto Read Settings",
            autoReadParagraph: "Auto read paragraph",
            autoReadWord: "Auto read word",
            settingsSaved: "Settings saved √",
            refreshNow: "Refresh Now",
            refreshLater: "Later",
            confirmReset: "Are you sure you want to reset all settings and refresh?",
            confirmYes: "Yes",
            confirmNo: "No"
        },
        "zh": {
            lunaWsEnabled: "已连接",
            lunaWsDisabled: "未连接",
            collapse: "收起",
            settings: "设置",
            saveSettings: "保存设置",
            resetSettings: "重置设置",
            general: "基本",
            Selector: "匹配",
            shortcuts: "快捷键",
            advanced: "高级",
            language: "界面语言:",
            translationWindowStyle: "翻译窗口样式:",
            useFloatingWindow: "使用浮动翻译窗口（不嵌入页面）",
            tagSelector: "HTML标签选择器（逗号分隔）:",
            nextParagraph: "下一段落:",
            previousParagraph: "上一段落:",
            reloadCurrentParagraph: "重新加载当前段落:",
            closeActive: "关闭当前激活:",
            sentenceDelimiters: "句子分隔符:",
            sentenceThreshold: "最小句子长度:",
            autoReadSettings: "自动朗读设置",
            autoReadParagraph: "自动朗读段落",
            autoReadWord: "自动朗读单词",
            settingsSaved: "设置已保存√",
            refreshNow: "立即刷新",
            refreshLater: "稍后刷新",
            confirmReset: "确定要重置所有设置然后刷新吗？",
            confirmYes: "确定",
            confirmNo: "取消"
        }
    };
    
    // 设置控制面板事件
    function setupControlPanelEvents() {
        // 加载用户设置
        try {
            // 更新控件状态
            if (document.getElementById('lunaws-tag-selector')) {
                document.getElementById('lunaws-tag-selector').value = userSettings.selector;
                document.getElementById('lunaws-sentence-delimiters').value = userSettings.sentenceDelimiters;
                document.getElementById('lunaws-sentence-threshold').value = userSettings.sentenceThreshold;
                document.getElementById('lunaws-floating-translation').checked = userSettings.floatingTranslation;
                document.getElementById('lunaws-auto-read-paragraph').checked = userSettings.autoReadParagraph;
                document.getElementById('lunaws-auto-read-word').checked = userSettings.autoReadWord;
                document.getElementById('lunaws-language').value = userSettings.language;
                document.getElementById('lunaws-next-para-key').value = userSettings.keyBindings.nextParagraph;
                document.getElementById('lunaws-prev-para-key').value = userSettings.keyBindings.prevParagraph;
                document.getElementById('lunaws-reload-para-key').value = userSettings.keyBindings.reloadParagraph;
                document.getElementById('lunaws-close-active-key').value = userSettings.keyBindings.closeActive;
                console.log('[LunaWS] 控件已加载设置值');
            } else {
                console.log('[LunaWS] 控件尚未创建，无法更新设置值');
            }
        } catch (e) {
            console.error('[LunaWS] 更新控件状态时出错:', e);
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
    }
    
    // 保存用户设置
    function saveUserSettings() {
        // 获取所有设置值
        if (document.getElementById('lunaws-tag-selector')) {
            userSettings = {
                selector: document.getElementById('lunaws-tag-selector').value,
                sentenceDelimiters: document.getElementById('lunaws-sentence-delimiters').value,
                sentenceThreshold: document.getElementById('lunaws-sentence-threshold').value,
                floatingTranslation: document.getElementById('lunaws-floating-translation').checked,
                autoReadParagraph: document.getElementById('lunaws-auto-read-paragraph').checked,
                autoReadWord: document.getElementById('lunaws-auto-read-word').checked,
                language: document.getElementById('lunaws-language').value,
                keyBindings: {
                    nextParagraph: document.getElementById('lunaws-next-para-key').value,
                    prevParagraph: document.getElementById('lunaws-prev-para-key').value,
                    reloadParagraph: document.getElementById('lunaws-reload-para-key').value,
                    closeActive: document.getElementById('lunaws-close-active-key').value
                }
            };
        }
        
        // 保存到localStorage
        localStorage.setItem('lunaws-settings', JSON.stringify(userSettings));
        
        // 显示保存成功提示
        const template = document.getElementById('lunaws-settings-saved-template');
        const notification = template.querySelector('.lunaws-settings-saved').cloneNode(true);
        
        document.body.appendChild(notification);
    }
    
    // 重置用户设置
    function resetUserSettings() {
        // 显示重置确认提示
        const template = document.getElementById('lunaws-reset-confirm-template');
        const confirmDialog = template.querySelector('.lunaws-settings-saved').cloneNode(true);
        
        document.body.appendChild(confirmDialog);
        
        // 添加确认按钮的点击事件
        confirmDialog.querySelector('#lunaws-confirm-reset').addEventListener('click', function() {
            // 关闭确认对话框
            confirmDialog.remove();
            
            // 保留当前语言，重置其他所有设置
            const currentLanguage = userSettings.language;
            
            // 创建新的设置对象
            userSettings = {
                ...JSON.parse(JSON.stringify(defaultUserSettings)),
                language: currentLanguage
            };
            
            // 保存新设置到localStorage
            localStorage.setItem('lunaws-settings', JSON.stringify(userSettings));
            
            // 直接刷新页面，而不是显示通知
            window.location.reload();
        });
    }
    
    // 折叠/展开控制面板
    function toggleControlPanel() {
        try {
            const panel = document.querySelector('.lunaws-control-panel');
            
            const advancedSettings = document.getElementById('lunaws-advanced-settings');
            
            const toggleButton = document.getElementById('lunaws-toggle-panel');
            
            // 确保用户设置已初始化
            if (!userSettings || !userSettings.language) {
                console.warn('[LunaWS] 切换面板时用户设置未初始化，使用默认语言');
                userSettings = userSettings || {};
                userSettings.language = 'zh';
            }
            
            const lang = userSettings.language;
            
            if (advancedSettings.style.display === 'none') {
                advancedSettings.style.display = 'block';
                toggleButton.textContent = PANEL_TEXT[lang].collapse;
                panel.classList.remove('collapsed');
            } else {
                advancedSettings.style.display = 'none';
                toggleButton.textContent = PANEL_TEXT[lang].settings;
                panel.classList.add('collapsed');
            }
            
            console.log('[LunaWS] 面板状态已切换');
        } catch (e) {
            console.error('[LunaWS] 切换控制面板时出错:', e);
        }
    }

    // ========== 核心功能 ==========
    const getLunaWSCode = function() {
        return function initFunction() {
        // ========== 样式 ==========
        const STYLES = `
        /* 段落和单词样式 */
        .lunaws-active-paragraph {
            background-color: #f5f9ff !important;
            padding: 8px;
            border-radius: 4px;
            border-left: 2px solid #3498db;
            margin: 8px 0;
            transition: all 0.2s ease-in-out;
            position: relative;
            z-index: 5;
        }
        .lunaws-highlighted {
            border-radius: 4px;
            background-color: rgba(173, 216, 230, 0.3);
            outline: 2px dashed rgba(173, 216, 230, 0.7);
            transition: background-color 0.2s ease;
        }
        .lunaws-word {
            display: inline-block;
            position: relative;
            cursor: pointer;
            margin: 0 1px;
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
            display: inline;
            position: relative;
            transition: background-color 0.2s ease;
        }
        .lunaws-sentence:hover {
            background-color: rgba(255, 221, 153, 0.5) !important;
            cursor: pointer;
            border-radius: 3px;
            box-shadow: 0 0 3px rgba(0,0,0,0.1);
        }

        /* 连接状态指示点 */
        .lunaws-connection-indicator {
            position: fixed;
            top: 10px;
            left: 10px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: rgb(231, 77, 60); /* 默认红色 - 未连接 */
            box-shadow: 0 0 5px rgba(231, 77, 60, 0.3);
            transition: background-color 0.3s ease;
            z-index: 100000;
            user-select: none;
        }
        .lunaws-connection-indicator.connected {
            background-color: rgb(30, 200, 113); /* 绿色 - 已连接 */
            box-shadow: 0 0 5px rgba(30, 200, 113, 0.3);
        }
        .lunaws-connection-indicator:hover::after {
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

        /* 弹窗与翻译区域 */
        .lunaws-dictionary-popup {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            width: 360px;
            background-color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            padding: 8px;
            z-index: 10000;
        }
        .lunaws-search-box {
            display: flex;
            margin-bottom: 5px;
            width: 100%;
        }
        .lunaws-search-input {
            flex: 1;
            padding: 5px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 14px;
        }
        .lunaws-search-input:focus {
            border-color:rgba(66, 153, 225, 0.46);
            outline: none;
            box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
        }
        .lunaws-close-button {
            margin-left: 2px;
            width: 30px;
            color: #575757;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            background-color: white;
            justify-content: center;
            transition: background-color 0.2s;
        }
        .lunaws-close-button:hover {
            background-color: #e74c3c;
            color: white;
        }
        .lunaws-dict-iframe {
            margin-top: 5px;
            width: 100%;
            height: 280px;
            border: none;
        }

        .lunaws-translation-area {
            margin-top: 0;
            padding: 10px;
            background-color: #f8f8f8;
            border-radius: 4px;
            border-left: 2px solid #9c27b0;
            transition: all 0.3s ease;
            animation: fadeIn 0.3s ease-in-out;
            position: absolute;
            z-index: 9000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            max-width: 100%;
            box-sizing: border-box;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .lunaws-translation-area hr {
            border: 1px solid #ffffff;
        }
        .lunaws-translator-header {
            color:rgba(126, 87, 194, 0.8);
            font-size: 10px;
        }
        .lunaws-translation-content {
            font-size: 0.9em;
        }

        /* 段落导航按钮 */
        .lunaws-paragraph-nav {
            position: fixed;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 9999;
            background-color: rgba(255, 255, 255, 0.8);
            border-radius: 4px;
            animation: fadeInNav 0.3s ease-in-out;
        }
        .lunaws-nav-button {
            width: 32px;
            height: 32px;
            border-radius: 4px;
            background-color: rgba(52, 152, 219, 0.9);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            cursor: pointer;
            border: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        }
        .lunaws-nav-button:hover {
            background-color: rgba(52, 152, 219, 1);
            transform: scale(1.1);
        }
        @keyframes fadeInNav {
            from { opacity: 0; transform: translateX(15px); }
            to { opacity: 1; transform: translateX(0); }
        }

        /* Ruby标签样式 */
        .lunaws-word ruby {
            display: inline-flex;
            flex-direction: column-reverse;
            vertical-align: bottom;
        }
        .lunaws-word rt {
            text-align: center;
            font-size: 10px;
            color: #c33c32;
        }
        
        /* 朗读样式 */
        .lunaws-reading {
            transition: outline 0.2s ease-in-out;
            outline: 2px solid rgba(76, 175, 80, 0.4);
        }
        `;

        // ========== 全局变量 ==========
        let socket = null;
        let isConnected = false;
        let currentParagraph = null;
        let originalContent = null;
        let currentWord = null;
        let currentWordElement = null;
        let selectedWords = [];
        let combinedWord = '';
        let currentHighlightedSentence = null;
        let heartbeatInterval;
        // 添加一个唯一的客户端ID
        const clientId = 'client_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);

        // 默认用户设置
        const defaultUserSettings = {
            wsUrl: 'ws://localhost:6619',
            selector: 'p, h1, h2, h3, h4, h5, h6',
            sentenceDelimiters: '。．.!?！？…',
            sentenceThreshold: 15,
            floatingTranslation: true,
            language: 'zh',
            autoReadParagraph: false,
            autoReadWord: true,
            keyBindings: {
                nextParagraph: 'ArrowDown, 2',
                prevParagraph: 'ArrowUp, 8',
                reloadParagraph: 'Space, 0',
                closeActive: 'Escape'
            }
        };

        // 使用深度复制而不是引用
        let userSettings = JSON.parse(JSON.stringify(defaultUserSettings));

        // 本地化文本
        const MESSAGE = {
            "en": {
                "noSegmentationResult": "No segmentation result",
                "previousParagraph": "Previous paragraph",
                "nextParagraph": "Next paragraph",
                "unknownDictionary": "Unknown dictionary",
                "segmenting": "Segmenting...",
                "translating": "Translating...",
                "searching": "Searching: ",
                "notConnected": "Not connected to LunaTranslator, please ensure the text output is open and the top left dot is green",
                "inputSearch": "Input search...",
                "connecting": "Connecting...",
                "connected": "Connected",
                "disconnected": "Disconnected",
                "connectingFailed": "Connection failed, retrying...",
            },
            "zh": {
                "noSegmentationResult": "无分词结果",
                "previousParagraph": "上一段",
                "nextParagraph": "下一段",
                "unknownDictionary": "未知词典",
                "segmenting": "正在分词...",
                "translating": "正在翻译...",
                "searching": "正在查词：",
                "notConnected": "未连接到LunaTranslator，请确保打开了文本输出，并等待左上角点变绿",
                "inputSearch": "输入搜索...",
                "connecting": "正在连接...",
                "connected": "已连接",
                "disconnected": "已断开连接",
                "connectingFailed": "连接失败，正在重试...",
            }
        };
            
        // ==========初始化函数===========
        function init() {
            try {
                console.log('[LunaWS] 初始化 Luna-WS...');

                // 从存储中恢复用户设置
                loadUserSettings();

                // 加载样式
                document.head.appendChild(document.createElement('style')).textContent = STYLES;
                
                // 创建连接状态指示器
                const connectionIndicator = document.createElement('div');
                connectionIndicator.id = 'lunaws-connection-indicator';
                connectionIndicator.className = 'lunaws-connection-indicator';
                connectionIndicator.setAttribute('data-status', '未连接');
                document.body.appendChild(connectionIndicator);
                
                // 添加全局事件监听
                document.addEventListener('keydown', handleKeyDown);
                document.addEventListener('click', handleDocumentClick);
                document.addEventListener('contextmenu', handleContextMenu);
                document.addEventListener('mousedown', handleMouseDown);
                
                // 添加窗口事件监听
                window.addEventListener('resize', updateTranslationAreaPosition);
                window.addEventListener('scroll', updateTranslationAreaPosition);
                
                // 启动段落点击处理
                addParagraphClickHandlers(document);
                
                // 自动连接WebSocket，稍微延迟以确保页面已完全加载
                console.log('[LunaWS] 正在准备自动连接WebSocket...');
                setTimeout(() => {
                    console.log('[LunaWS] 开始自动连接WebSocket');
                    connectWebSocket();
                }, 1000);
                
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
                        // 直接使用对象扩展运算符合并设置
                        const parsedSettings = JSON.parse(savedSettings);
                        userSettings = {...userSettings, ...parsedSettings};
                        
                        // 确保嵌套对象也正确合并
                        if (parsedSettings.keyBindings) {
                            userSettings.keyBindings = {...userSettings.keyBindings, ...parsedSettings.keyBindings};
                        }
                        
                        console.log('[LunaWS] 已加载设置:', userSettings);
                    } catch (e) {
                        console.error('[LunaWS] 解析保存的设置失败:', e);
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

        // 恢复原始内容
        function restoreOriginalContent() {
            if (currentParagraph && originalContent) {
                // 移除导航按钮
                const navId = currentParagraph.getAttribute('data-nav-id');
                if (navId) {
                    const navContainer = document.querySelector(`.lunaws-paragraph-nav[data-for-paragraph="${navId}"]`);
                    if (navContainer) {
                        // 移除事件监听器
                        if (navContainer._resizeHandler) {
                            window.removeEventListener('resize', navContainer._resizeHandler);
                        }
                        if (navContainer._scrollHandler) {
                            window.removeEventListener('scroll', navContainer._scrollHandler);
                        }
                        navContainer.remove();
                    }
                    currentParagraph.removeAttribute('data-nav-id');
                }
                
                currentParagraph.innerHTML = originalContent;
                currentParagraph.classList.remove('lunaws-active-paragraph');
                
                // 移除翻译区域
                removeTranslationArea();
                
                currentParagraph = null;
                originalContent = null;
                selectedWords = [];
                combinedWord = '';
            }
        }

        // 添加窗口调整大小事件监听
        window.addEventListener('resize', function() {
            updateTranslationAreaPosition();
        });

        // 添加滚动事件监听
        window.addEventListener('scroll', function() {
            updateTranslationAreaPosition();
        });

        // 更新翻译区域位置和大小的辅助函数
        function updateTranslationAreaPosition() {
            if (!currentParagraph || !userSettings.floatingTranslation) return;

            const translationId = currentParagraph.getAttribute('data-translation-id');
            if (translationId) {
                const translationArea = document.querySelector(`.lunaws-translation-area[data-paragraph-id="${translationId}"]`);
                if (translationArea) {
                    const paragraphRect = currentParagraph.getBoundingClientRect();
                    translationArea.style.width = `${paragraphRect.width}px`;
                    translationArea.style.left = `${window.scrollX + paragraphRect.left}px`;
                    translationArea.style.top = `${window.scrollY + paragraphRect.bottom + 5}px`;
                }
            }
        }

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

            // 添加鼠标移出效果
            doc.addEventListener('mouseout', function(event) {
                // 确定鼠标离开的元素是否是选择器匹配的段落
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

        // 确保选择器不为空
        if (!userSettings.selector) return null;

        // 获取选择器列表
        const selectors = userSettings.selector.split(',').map(s => s.trim()).filter(s => s);

        // 排除body和html元素
        if (element.tagName && (element.tagName.toLowerCase() === 'body' || element.tagName.toLowerCase() === 'html')) {
            return null;
        }

        // 检查当前元素是否匹配任一选择器
        for (const selector of selectors) {
            try {
                // 使用选择器进行匹配
                if (element.matches && element.matches(selector)) {
                    // 验证元素内容不为空
                    if (element.textContent && element.textContent.trim().length > 0) {
                        return element;
                    }
                }
            } catch (e) {
                console.error('[LunaWS] Invalid selector:', selector, e);
            }
        }

        // 递归检查父元素 - 但只检查到一定深度以避免性能问题
        // 并且不向上超过特定容器元素，如article、main、section等
        const stopElements = ['article', 'main', 'section', 'div.content', 'div.main-content'];
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

        // ========== WebSocket 连接 ==========
        function connectWebSocket() {
            try {
                // 不再尝试查找连接按钮，直接进行连接操作
                if (isConnected) {
                    // 如果已连接，保持连接状态，不断开
                    return;
                }
                
                // 使用固定的WebSocket地址
                const url = userSettings.wsUrl;
                
                console.log('[LunaWS] 正在自动连接WebSocket:', url);
                
                // 设置连接状态
                updateStatus(MESSAGE[userSettings.language].connecting);
                
                // 创建WebSocket连接
                socket = new WebSocket(url);
                
                socket.onopen = function() {
                    isConnected = true;
                    updateStatus(MESSAGE[userSettings.language].connected);
                    console.log('[LunaWS] WebSocket已成功连接');
                    
                    // 设置定时发送握手请求
                    clearInterval(heartbeatInterval); // 清除可能存在的旧定时器
                    heartbeatInterval = setInterval(function() {
                        if (socket && isConnected) {
                            try {
                                // 发送心跳消息
                                socket.send(JSON.stringify({
                                    type: 'heartbeat',
                                    clientId: clientId
                                }));
                            } catch (e) {
                                console.error('[LunaWS] 发送心跳消息失败:', e);
                                // 如果发送失败，尝试重连
                                if (isConnected) {
                                    isConnected = false; // 先标记为未连接
                                    setTimeout(connectWebSocket, 1000); // 1秒后尝试重连
                                }
                            }
                        } else {
                            clearInterval(heartbeatInterval);
                        }
                    }, 3000);
                };
                
                socket.onmessage = function(event) {
                    processMessage(event.data);
                };
                
                socket.onclose = function() {
                    isConnected = false;
                    updateStatus(MESSAGE[userSettings.language].disconnected);
                    clearInterval(heartbeatInterval);
                    setTimeout(connectWebSocket, 3000);
                };
                
                socket.onerror = function(error) {
                    isConnected = false;
                    updateStatus(MESSAGE[userSettings.language].connectingFailed);
                    clearInterval(heartbeatInterval);
                    setTimeout(connectWebSocket, 3000);
                };
            } catch (error) {
                console.error('[LunaWS] 连接WebSocket时出错:', error);
                isConnected = false;
                updateStatus(MESSAGE[userSettings.language].connectingFailed);
                console.log('[LunaWS] 连接失败，将在3秒后尝试重新连接');
                setTimeout(connectWebSocket, 3000);
            }
        }

        // 更新连接状态指示器
        function updateStatus(message) {
            const indicator = document.getElementById('lunaws-connection-indicator');
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
                console.error('[LunaWS] 未连接到服务器，无法发送消息');
                // 尝试重新连接
                if (!isConnected) {
                    console.log('[LunaWS] 尝试重新连接WebSocket...');
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
                    default:
                        console.log('[LunaWS] 未知消息类型:', data.type);
                        break;
                }
            } catch (e) {
                // 不是JSON，按原样传递给翻译处理函数
                console.log('[LunaWS] Received non-JSON message:', message);
            }
        }

        // 处理朗读响应
        function handleReadResult(data) {
            // 有音频数据的情况
            if (data.status === 'success' && data.audio_data) {
                playAudio(data);
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

        // ========== 段落处理 ==========
        // 处理选中的段落
        function processSelectedParagraph(element) {
            // 首先检查WebSocket连接状态
            if (!isConnected) {
                console.log('[LunaWS] 未连接到WebSocket，无法处理段落。正在尝试连接...');
                // 没连接之前不处理段落
                connectWebSocket();
                return;
            }

            // 首先检查目标元素是否匹配段落选择器，或者是否在已处理的段落内
            const isInsideActiveParagraph = element.closest && element.closest('.lunaws-active-paragraph');
            if (isInsideActiveParagraph) return; // 如果点击的是已处理段落内的元素，直接返回

            // 查找匹配的段落元素
            const matchingParagraph = findMatchingParagraph(element);
            if (!matchingParagraph) return; // 如果没有匹配的段落，直接返回

            // 从这里开始使用匹配到的段落元素
            const paragraph = matchingParagraph;

            // 检查段落是否有效或有足够的内容
            if (!paragraph.textContent || paragraph.textContent.trim().length < 1) {
                console.log('[LunaWS] 跳过内容不足的段落');
                return;
            }

            // 如果已有选中段落，恢复它
            if (currentParagraph && currentParagraph !== paragraph) {
                restoreOriginalContent();
            }

            // 如果是同一段落，不重复处理
            if (currentParagraph === paragraph) return;

            // 添加调试信息
            console.log('[LunaWS] 正在处理段落:', paragraph);

            // 移除预选高亮样式
            paragraph.classList.remove('lunaws-highlighted');

            // 标记当前段落为活动状态
            paragraph.classList.add('lunaws-active-paragraph');
            currentParagraph = paragraph;
            originalContent = paragraph.innerHTML;

            // 获取纯文本并去除振假名
            const originalText = removeRubyText(paragraph);

            // 检查文本内容是否有效
            if (!originalText || originalText.trim().length < 2) {
                console.log('[LunaWS] 跳过空内容段落');
                paragraph.classList.remove('lunaws-active-paragraph');
                currentParagraph = null;
                originalContent = null;
                return;
            }

            // 添加段落导航按钮
            addParagraphNavButtons(paragraph);

            // 添加段落中键点击事件
            addParagraphMiddleClickHandler(paragraph, originalText);

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

            // 如果启用了自动朗读段落，发送朗读请求
            if (userSettings.autoReadParagraph) {
                setTimeout(() => readText(originalText, paragraph), 500);
            }

            // 滚动到视图中
            const paragraphRect = paragraph.getBoundingClientRect();
            if (paragraphRect.top < 0 || paragraphRect.bottom > window.innerHeight) {
                paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // 添加段落导航按钮
        function addParagraphNavButtons(paragraph) {
            // 检查是否已经有导航按钮
            if (paragraph.querySelector('.lunaws-paragraph-nav')) return;

            // 创建导航按钮容器
            const navContainer = document.createElement('div');
            navContainer.className = 'lunaws-paragraph-nav';

            // 创建上一段按钮
            const prevButton = document.createElement('button');
            prevButton.className = 'lunaws-nav-button';
            prevButton.innerHTML = '&#9650;'; // 上箭头符号
            prevButton.title = MESSAGE[userSettings.language].previousParagraph;
            prevButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToPreviousParagraph();
            });

            // 创建下一段按钮
            const nextButton = document.createElement('button');
            nextButton.className = 'lunaws-nav-button';
            nextButton.innerHTML = '&#9660;'; // 下箭头符号
            nextButton.title = MESSAGE[userSettings.language].nextParagraph;
            nextButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToNextParagraph();
            });

            // 添加按钮到容器
            navContainer.appendChild(prevButton);
            navContainer.appendChild(nextButton);

            // 将导航容器添加到body
            document.body.appendChild(navContainer);

            // 给导航容器和段落添加唯一ID进行关联
            const navId = 'nav-' + Date.now();
            paragraph.setAttribute('data-nav-id', navId);
            navContainer.setAttribute('data-for-paragraph', navId);

            // 定位导航按钮
            positionNavButtons(paragraph, navContainer);

            // 添加窗口调整大小和滚动的事件监听器
            const resizeHandler = () => positionNavButtons(paragraph, navContainer);
            const scrollHandler = () => positionNavButtons(paragraph, navContainer);

            window.addEventListener('resize', resizeHandler);
            window.addEventListener('scroll', scrollHandler);

            // 存储事件处理器引用，以便之后清理
            navContainer._resizeHandler = resizeHandler;
            navContainer._scrollHandler = scrollHandler;
        }

        // 定位导航按钮
        function positionNavButtons(paragraph, navContainer) {
            if (!paragraph || !navContainer) return;

            const rect = paragraph.getBoundingClientRect();
            const containerWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

            // 计算合适的位置，确保导航按钮在视口内
            const rightOffset = 10; // 距离段落右侧的距离
            const leftPosition = Math.min(rect.right + rightOffset, containerWidth - navContainer.offsetWidth - 20);

            // 更新导航容器位置
            navContainer.style.left = `${leftPosition}px`;
            navContainer.style.top = `${rect.top + (rect.height / 2) - (navContainer.offsetHeight / 2)}px`;
        }

        // 去除文本中的ruby标签振假名
        function removeRubyText(element) {
            const clone = element.cloneNode(true);
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

            return clone.textContent.trim();
        }


        // 处理分词结果的函数
        function handleSegmentResult(data) {
            try {
                if (!currentParagraph) {
                    console.error('[LunaWS] 没有当前段落，无法处理分词结果');
                    return;
                }

                console.log('[LunaWS] 收到分词结果:', data);

                const segments = data.segments;
                if (!segments || segments.length === 0) {
                    console.error('[LunaWS] 分词结果为空');
                    currentParagraph.textContent = MESSAGE[userSettings.language].noSegmentationResult;
                    return;
                }

                // 清空段落内容并重置选词状态
                currentParagraph.innerHTML = '';
                selectedWords = [];
                combinedWord = '';
                currentHighlightedSentence = null;

                // 分词后的内容构建
                let segmentedContent = '';

                // 添加分词结果
                segments.forEach(segment => {
                    const wordSpanHtml = document.createElement('span');
                    wordSpanHtml.className = 'lunaws-word';
                    wordSpanHtml.setAttribute('data-word', segment.orig);
                    
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

                // 将内容进行句子划分
                try {
                    // 使用DOM方法处理分词后的内容，确保HTML属性正确性
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = segmentedContent;
                    
                    // 获取所有分词后的单词元素
                    const wordElements = Array.from(tempDiv.querySelectorAll('.lunaws-word'));
                    
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
                    
                    // 直接设置段落内容，避免HTML字符串解析问题
                    currentParagraph.innerHTML = '';
                    currentParagraph.appendChild(resultContainer);
                    
                    // 为单词添加点击事件
                    currentParagraph.querySelectorAll('.lunaws-word').forEach(wordSpan => {
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
                        
                        // 左键点击查询当前词
                        wordSpan.addEventListener('click', (event) => {
                            event.stopPropagation();
                            
                            document.querySelectorAll('.lunaws-word.selected').forEach(word => {
                                word.classList.remove('selected');
                                word.style.backgroundColor = ''; // 清除之前选中单词的背景色
                            });
                            
                            selectedWords = [];
                            combinedWord = '';
                            
                            wordSpan.classList.add('selected');
                            wordSpan.style.backgroundColor = '#ffeb3b'; // 设置选中状态的背景色
                            queryWord(wordSpan, word);
                        });
                        
                        // 右键点击组合词
                        wordSpan.addEventListener('contextmenu', (event) => {
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
                            if (userSettings.autoReadWord) {
                                readText(combinedWord);
                            }
                        });
                    });
                    
                    // 为句子添加事件
                    currentParagraph.querySelectorAll('.lunaws-sentence').forEach(sentence => {
                        // 句子鼠标悬停效果 - 使用更明显的高亮效果
                        sentence.addEventListener('mouseover', () => {
                            sentence.style.backgroundColor = 'rgba(255, 221, 153, 0.5)';
                            sentence.style.boxShadow = '0 0 3px rgba(0,0,0,0.1)';
                            sentence.style.borderRadius = '3px';
                            currentHighlightedSentence = sentence;
                        });
                        
                        sentence.addEventListener('mouseout', () => {
                            sentence.style.backgroundColor = '';
                            sentence.style.boxShadow = '';
                            sentence.style.borderRadius = '';
                            if (currentHighlightedSentence === sentence) {
                                currentHighlightedSentence = null;
                            }
                        });
                        
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
                    
                    console.log('[LunaWS] 句子处理完成，句子数量:', currentParagraph.querySelectorAll('.lunaws-sentence').length);
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

        // 恢复原始内容
        function restoreOriginalContent() {
            if (currentParagraph && originalContent) {
                // 移除导航按钮
                const navId = currentParagraph.getAttribute('data-nav-id');
                if (navId) {
                    const navContainer = document.querySelector(`.lunaws-paragraph-nav[data-for-paragraph="${navId}"]`);
                    if (navContainer) {
                        // 移除事件监听器
                        if (navContainer._resizeHandler) {
                            window.removeEventListener('resize', navContainer._resizeHandler);
                        }
                        if (navContainer._scrollHandler) {
                            window.removeEventListener('scroll', navContainer._scrollHandler);
                        }
                        navContainer.remove();
                    }
                    currentParagraph.removeAttribute('data-nav-id');
                }
                
                currentParagraph.innerHTML = originalContent;
                currentParagraph.classList.remove('lunaws-active-paragraph');
                
                // 移除翻译区域
                removeTranslationArea();
                
                currentParagraph = null;
                originalContent = null;
                selectedWords = [];
                combinedWord = '';
            }
        }

        // ========== 翻译功能 ==========
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
                    // 浮动窗口 - 不占用排版
                    // 获取当前段落的位置和尺寸
                    const paragraphRect = currentParagraph.getBoundingClientRect();
                    
                    // 设置翻译区域的样式以匹配段落宽度和位置
                    translationArea.style.width = `${paragraphRect.width}px`;
                    translationArea.style.left = `${window.scrollX + paragraphRect.left}px`;
                    translationArea.style.top = `${window.scrollY + paragraphRect.bottom + 5}px`; // 留出5px间距
                    translationArea.style.position = 'absolute';
                    translationArea.style.zIndex = '9000';
                    translationArea.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    
                    // 将翻译区域添加到body
                    document.body.appendChild(translationArea);
                } else {
                    // 传统窗口 - 占用排版
                    translationArea.style.position = 'static';
                    translationArea.style.width = 'auto';
                    translationArea.style.marginTop = '8px';
                    
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
                    if (contentElement) contentElement.textContent = translationText;
                } else {
                    // 创建新翻译块
                    translationBlock = document.createElement('div');
                    translationBlock.className = 'lunaws-translation-block';
                    translationBlock.setAttribute('data-translator', translatorName);
                    
                    // 添加翻译器标题和内容
                    translationBlock.innerHTML = `
                        <div class="lunaws-translation-content">${translationText} <span class="lunaws-translator-header">${translatorName}</span></div>
                    `;
                    
                    // 添加分隔线
                    if (translationsContainer.children.length > 0) {
                        translationBlock.insertBefore(document.createElement('hr'), translationBlock.firstChild);
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

        // ========== 查词功能 ==========
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

            // 防止事件冒泡
            popup.addEventListener('click', e => e.stopPropagation());

            wordElement.appendChild(popup);

            // 初始化iframe
            iframe.onload = () => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.body.innerHTML = `
                    <style>
                        body { font-family: sans-serif; margin: 0; font-size: 14px; }
                        .dict-loading { text-align: center; color: #666; padding: 20px; }
                        .dict-tab { display: inline-block; padding: 5px 8px; margin: 0 3px 5px 0; border-radius: 3px; 
                                    background: #f0f0f0; cursor: pointer; font-size: 12px; }
                        .dict-tab.active { background: #4299e1; color: white; }
                        .dict-entry { display: none; margin-top: 8px; }
                        .dict-header { font-weight: bold; color: #2c5282; margin-bottom: 5px; }
                    </style>
                    <div class="dict-tabs"></div>
                    <div class="dict-loading"> ${MESSAGE[userSettings.language].searching}"${word}"</div>
                    <div class="dict-entries"></div>
                `;
                
                // 使iframe获得焦点以使用户可以直接输入
                setTimeout(() => {
                    // searchInput.focus();
                    searchInput.select();
                }, 200);
            };
            iframe.src = 'about:blank';

            // 发送查词请求
            sendMessage(JSON.stringify({
                type: 'dictionary',
                word: word
            }));
        }

        // 处理词典结果
        function handleDictionaryResult(data) {
            
            // 获取词典结果
            const message = data.content;
            const dictName = data.dictionary;
            const searchWord = data.word;

            if (!currentWordElement) return;

            const popup = currentWordElement.querySelector('.lunaws-dictionary-popup');
            if (!popup) return;

            // 检查当前查询词与返回结果是否匹配
            const queryWord = popup.getAttribute('data-query-word');

            // 如果提供了searchWord且与当前查询的词不符，则忽略此结果
            if (searchWord && searchWord !== queryWord) {
                console.log(`Ignoring outdated dictionary result: ${searchWord} (current query: ${queryWord})`);
                return;
            }

            // 检查返回的内容是否为空
            if (!message || message.trim() === '') {
                console.log(`Ignoring empty result: ${dictName}`);
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
            if (!entryDiv) {
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
                });
                
                tabsContainer.appendChild(tab);
            } else {
                // 更新现有词典内容
                const contentDiv = entryDiv.querySelector('.dict-content');
                if (contentDiv) contentDiv.innerHTML = message;
            }
        }

        // 检查按键是否匹配用户设置
        function matchUserKey(event, keySettingStr) {
            if (!keySettingStr) return false;

            // 解析用户设置的按键组合
            const keys = keySettingStr.split(',').map(k => k.trim());

            // 检查事件的键是否在用户设置中
            return keys.some(key => {
                if (key === 'Space' && event.key === ' ') return true;
                return event.key === key;
            });
        }

        // 获取下一个或上一个有效的段落
        function getValidTag(currentTag, direction = 'down') {
            // 确保选择器不为空
            if (!userSettings.selector) return null;

            const selector = userSettings.selector;

            // 过滤无效选择器
            const validSelectors = selector.split(',')
                .map(sel => sel.trim())
                .filter(sel => sel.length > 0)
                .join(',');
                
            if (!validSelectors) return null; // 如果没有有效选择器，返回null

            const tags = Array.from(document.querySelectorAll(validSelectors));
            const currentIndex = tags.indexOf(currentTag);

            if (currentIndex === -1) return null;

            // 确定目标索引
            const targetIndex = direction === 'down' ? currentIndex + 1 : currentIndex - 1;

            // 检查是否超出范围
            if (targetIndex < 0 || targetIndex >= tags.length) return null;

            // 获取目标标签
            const targetTag = tags[targetIndex];

            // 确保目标标签有文本内容
            if (targetTag.textContent.trim()) {
                return targetTag;
            } else {
                // 如果目标标签没有文本，递归查找下一个
                return getValidTag(targetTag, direction);
            }
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
            // 重新加载当前段落
            else if (matchUserKey(e, userSettings.keyBindings.reloadParagraph)) {
                reloadCurrentParagraph();
                e.preventDefault();
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

        // 重新加载当前段落
        function reloadCurrentParagraph() {
            if (!currentParagraph) return;

            // 获取当前段落的纯文本
            const originalText = removeRubyText(currentParagraph);

            // 发送分词请求（会触发重新分词和处理）
            sendMessage(JSON.stringify({
                type: 'segment', 
                text: originalText
            }));

            // 自动触发翻译请求
            setTimeout(() => translateText(originalText), 300);

            // 根据用户设置决定是否朗读段落
            if (userSettings.autoReadParagraph) {
                readText(originalText, currentParagraph);
            }
        }

        // 点击事件处理函数
        function handleDocumentClick(e) {
            if (!currentParagraph) return;

            // 检查点击是否在以下区域内，如果是则不取消激活状态
            if (e.target.closest('.lunaws-control-panel')) return;
            if (e.target.closest('.lunaws-active-paragraph')) return;
            if (e.target.closest('.lunaws-dictionary-popup')) return;
            if (e.target.closest('.lunaws-translation-area')) return; // 添加对翻译区域的检查
            if (e.target.closest('.lunaws-paragraph-nav')) return; // 添加对段落导航按钮的检查

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

        // 中键点击禁用及朗读函数
        function handleMouseDown(event) {
            // 检查是否为中键点击 (鼠标滚轮点击)
            if (event.button === 1) {
                // 禁用默认的中键滚动行为
                event.preventDefault();
                
                // 判断点击目标是否是句子，如果是则交给句子的mouseup事件处理
                const sentence = event.target.closest('.lunaws-sentence');
                if (sentence) return;
                
                // 判断是否点击了单词
                const word = event.target.closest('.lunaws-word');
                if (word && userSettings.autoReadWord) {
                    const wordText = word.getAttribute('data-word') || removeRubyText(word);
                    
                    readText(wordText, word);
                }
            }
        }

        // ========== 朗读功能 ==========
        // 当前朗读的元素和音频
        let currentAudio = null;

        // 朗读文本
        function readText(text, element = null) {
            if (!text || !isConnected) return false;

            // 停止之前的朗读
            stopReading();

            // 发送朗读请求
            const success = sendMessage(JSON.stringify({
                type: 'read',
                text: text
            }));

            return success;
        }

        // 停止朗读
        function stopReading() {
            // 停止当前音频播放
            if (currentAudio) {
                try {
                    currentAudio.pause();
                    currentAudio = null;
                    console.log('已停止之前的音频播放');
                } catch (e) {
                    console.error('停止之前音频时出错:', e);
                }
            }
            
            // 移除所有可能的朗读标记
            document.querySelectorAll('.lunaws-reading').forEach(el => {
                el.classList.remove('lunaws-reading');
            });
        }

        // 播放音频
        function playAudio(data) {
            try {
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

        // 添加段落中键点击处理
        function addParagraphMiddleClickHandler(paragraph, originalText) {
            // 先移除可能存在的事件监听器
            paragraph.removeEventListener('mousedown', paragraph._lunawsMousedownHandler);
            paragraph.removeEventListener('mouseup', paragraph._lunawsMouseupHandler);

            // 添加中键点击事件
            paragraph._lunawsMousedownHandler = (event) => {
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
            paragraph._lunawsMouseupHandler = (event) => {
                if (event.button === 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // 检查是否点击在句子或单词上，如果是则交给它们自己的处理程序
                    if (event.target.closest('.lunaws-sentence') || event.target.closest('.lunaws-word')) {
                        return;
                    }
                    readText(originalText, paragraph);
                }
            };

            paragraph.addEventListener('mousedown', paragraph._lunawsMousedownHandler);
            paragraph.addEventListener('mouseup', paragraph._lunawsMouseupHandler);
        }

        init();
        }
    }

    // ========== 注入脚本 ==========
    // 注入到主页
    const lunaWSCode = getLunaWSCode();
    lunaWSCode();
    console.log("[Luna WS] 在主页面初始化完成");
    
    // 创建控制面板
    function ensureControlPanel() {
        console.log("[Luna WS] 尝试创建控制面板");
        // 确保用户设置已初始化
        if (!userSettings || !userSettings.language) {
            console.warn('[LunaWS] 创建控制面板前用户设置未正确初始化，重新初始化');
            // 用默认值重新初始化
            try {
                userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
                // 尝试从localStorage加载
                const savedSettings = localStorage.getItem('lunaws-settings');
                if (savedSettings) {
                    const parsedSettings = JSON.parse(savedSettings);
                    userSettings = {...userSettings, ...parsedSettings};
                    if (parsedSettings.keyBindings) {
                        userSettings.keyBindings = {...userSettings.keyBindings, ...parsedSettings.keyBindings};
                    }
                }
            } catch (e) {
                console.error('[LunaWS] 紧急初始化设置失败', e);
                userSettings = JSON.parse(JSON.stringify(defaultUserSettings));
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
    // 页面加载完成后执行注入
    if (document.readyState === 'complete') {
        ensureControlPanel();
    } else {
        window.addEventListener('load', ensureControlPanel);
    }

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

