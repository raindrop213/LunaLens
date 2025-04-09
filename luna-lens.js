// ==UserScript==
// @name         LunaLens
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  通过HTTP API连接LunaTranslator实现浏览器上的原文的分词、翻译和查词功能 
// @author       Raindrop213
// @match        *://**/*
// @updateURL    https://raw.githubusercontent.com/raindrop213/LunaLens/main/luna-lens.js
// @downloadURL  https://raw.githubusercontent.com/raindrop213/LunaLens/main/luna-lens.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /* 打包脚本 方便后面注入到Iframe */
    const getLunaLensCode = function() {
        return function initFunction() {

        /* ========== 控制面板（面板只在主页面中创建） ========== */
        // 文本翻译映射
        const PANEL_TEXT = {
            "en": {
                collapse: "Collapse",
                settings: "Set",
                saveSettings: "Save",
                resetSettings: "Reset",
                general: "General",
                handle: "Handle",
                shortcuts: "Shortcuts",
                advanced: "Advanced",
                language: "Interface Language:",
                serverUrl: "Server URL:",
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
                collapse: "收起",
                settings: "设置",
                saveSettings: "保存设置",
                resetSettings: "重置设置",
                general: "基本",
                handle: "处理",
                shortcuts: "快捷键",
                advanced: "高级",
                serverUrl: "服务器:",
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

        // 控制面板内容设计
        function createControlPanel() {
            // 避免重复创建
            if (document.getElementById('luna-panel')) return;

            // 创建控制面板元素
            const panel = document.createElement('div');
            panel.id = 'luna-panel';
            panel.className = 'luna-control-panel collapsed';
            
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
                .luna-control-panel {
                    position: fixed; z-index: 9999999; overflow: visible !important;
                    top: ${userSettings.panelPosition?.top || '20px'};
                    left: ${userSettings.panelPosition?.left || 'auto'};
                    right: ${userSettings.panelPosition?.right || '20px'};
                    background-color: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    width: 246px; font-size: 14px; max-height: 80vh; color: #333333;
                    overflow-y: auto; transition: all 0.3s ease; writing-mode: horizontal-tb;
                }
                .luna-control-panel.collapsed { width: 136px; }
                .luna-control-panel.retracted { 
                    transform: translateY(calc(-100% + 28px));
                    border-bottom-left-radius: 10px;
                    border-bottom-right-radius: 10px;
                    box-shadow: 0 3px 5px rgba(0,0,0,0.1);
                }
                .luna-control-panel.retracted:hover {
                    transform: translateY(0);
                }
                .luna-header {
                    padding: 8px 8px 6px 8px; font-size: 15px; border-bottom: 1px solid #eee;
                    display: flex; justify-content: space-between; align-items: center;
                    cursor: move; /* 添加移动光标样式 */
                }
                .luna-setup-panel { padding: 0 8px; }
                .luna-title { font-weight: bold; margin-right: 5px; }
                .luna-expand-button {
                    cursor: pointer; padding: 2px 6px; font-size: 10px; color: #777; white-space: nowrap;
                    border: 1px solid #ddd; border-radius: 3px; background-color: #f5f5f5; user-select: none;
                }
                .luna-expand-button:hover { background-color: #e0e0e0; }
                .luna-button {
                    padding: 3px 8px; margin: 0 5px 5px 0; border: none; border-radius: 3px;
                    background-color: #4CAF50; color: white; cursor: pointer;
                }
                .luna-button:hover { background-color: #45a049; }
                .luna-button:disabled { background-color: #ccc; }
                .luna-button.secondary { background-color: #607d8b; }
                .luna-button.secondary:hover { background-color: #546e7a; }
                .luna-settings-row { margin-bottom: 4px; }
                .luna-settings-row label { display: block; font-size: 12px; color: #555; margin: 8px 0px 2px 0px;}
                .luna-settings-row input[type="text"], .luna-settings-row textarea {
                    width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px;
                    box-sizing: border-box; font-size: 12px; background-color: #ffffff; color: #333333;
                }
                .luna-settings-row input[type="text"]::placeholder {
                    color: #999999;
                }
                .luna-select {
                    width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; color: #333333;
                    box-sizing: border-box; font-size: 12px; background-color: white; cursor: pointer;
                }
                .luna-settings-row textarea { height: 40px; resize: vertical; }
                .luna-toggle { display: flex; align-items: center; }
                .luna-toggle input[type="checkbox"] { margin-right: 5px; }
                .luna-tabs {
                    display: flex; border-bottom: 1px solid #ddd; margin-top: 10px;
                }
                .luna-tab {
                    padding: 4px 10px; cursor: pointer; border-radius: 3px 3px 0 0;
                    font-size: 12px; color: #333333;
                }
                .luna-tab.active {
                    border: 1px solid #ddd; border-bottom: 1px solid #fff;
                    margin-bottom: -1px; background-color: #f9f9f9;
                }
                .luna-tab-content { display: none; padding: 10px 0; overflow-y: auto;}
                .luna-tab-content.active { display: block; max-height: calc(80vh - 100px); overflow-y: auto;}
                .luna-settings-saved {
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
                .luna-settings-saved .message { margin-bottom: 15px; color: #333; }
                .luna-settings-saved .buttons { display: flex; justify-content: center; gap: 10px; }
                .luna-settings-saved .luna-button { padding: 5px 15px; font-size: 13px; }
                
                .luna-help { font-size: 12px; color: #666; }
                kbd { background-color: #f0f0f0; border-radius: 3px;
                    color: #333333; padding: 2px 4px; font-size: 12px; 
                }

            `;
            document.head.appendChild(style);
            
            // 确保已经初始化了用户设置并验证语言设置
            if (!userSettings || !userSettings.language || (userSettings.language !== 'zh' && userSettings.language !== 'en')) {
                console.error('[LunaHTTP] 创建控制面板时用户设置或语言无效，重新验证设置');
                
                // 重新验证或使用默认设置
                if (userSettings && typeof userSettings === 'object') {
                    userSettings = validateUserSettings(userSettings);
                } else {
                    userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                }
            }

            // 获取有效的语言设置
            const lang = userSettings.language || 'zh';

            console.log('[LunaHTTP] 创建控制面板，当前语言:', lang, 'userSettings:', userSettings);
            panel.innerHTML = `
                <div class="luna-header">
                    <div class="luna-title">LunaLens</div>
                    <div class="luna-expand-button" id="luna-toggle-panel">${PANEL_TEXT[lang].settings}</div>
                </div>

                <div class="luna-setup-panel" style="display:none;">
                    <div class="luna-tabs">
                        <div class="luna-tab active" data-tab="general">${PANEL_TEXT[lang].general}</div>
                        <div class="luna-tab" data-tab="handle">${PANEL_TEXT[lang].handle}</div>
                        <div class="luna-tab" data-tab="shortcuts">${PANEL_TEXT[lang].shortcuts}</div>
                        <div class="luna-tab" data-tab="advanced">${PANEL_TEXT[lang].advanced}</div>
                    </div>
                    
                    <!-- 基本设置 -->
                    <div class="luna-tab-content active" data-tab="general">
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].language}</label>
                            <select id="luna-language" class="luna-select">
                                <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
                                <option value="zh" ${lang === 'zh' ? 'selected' : ''}>中文</option>
                            </select>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].serverUrl}</label>
                            <input type="text" id="luna-url" value="${userSettings.apiUrl || 'http://127.0.0.1:2333'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].WindowStyle}</label>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-floating-translation" ${userSettings.floatingTranslation ? 'checked' : ''}>
                                <label for="luna-floating-translation">${PANEL_TEXT[lang].useFloatingWindow}</label>
                            </div>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-vertical-preference" ${userSettings.verticalPreference ? 'checked' : ''}>
                                <label for="luna-vertical-preference">${PANEL_TEXT[lang].verticalPreference}</label>
                            </div>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-scroll-to-paragraph" ${userSettings.scrollToParagraph ? 'checked' : ''}>
                                <label for="luna-scroll-to-paragraph">${PANEL_TEXT[lang].scrollToParagraph}</label>
                            </div>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].autoReadSettings}</label>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-auto-read-paragraph" ${userSettings.autoReadParagraph ? 'checked' : ''}>
                                <label for="luna-auto-read-paragraph">${PANEL_TEXT[lang].autoReadParagraph}</label>
                            </div>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-auto-read-word" ${userSettings.autoReadWord ? 'checked' : ''}>
                                <label for="luna-auto-read-word">${PANEL_TEXT[lang].autoReadWord}</label>
                            </div>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].others}</label>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-message-toggle" ${userSettings.MessageToggle ? 'checked' : ''}>
                                <label for="luna-message-toggle">${PANEL_TEXT[lang].MessageToggle}</label>
                            </div>
                        </div>
                    </div>

                    <!-- 处理设置 -->
                    <div class="luna-tab-content" data-tab="handle">
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].sentenceDelimiters}</label>
                            <input type="text" id="luna-sentence-delimiters" value="${userSettings.sentenceDelimiters || '。．.!?！？…'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].sentenceThreshold}</label>
                            <input type="text" id="luna-sentence-threshold" value="${userSettings.sentenceThreshold || 20}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].minContentLength}</label>
                            <input type="text" id="luna-min-content-length" value="${userSettings.minContentLength || 2}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].maxContentLength}</label>
                            <input type="text" id="luna-max-content-length" value="${userSettings.maxContentLength || 1000}">
                        </div>
                        <div class="luna-settings-row">
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-remove-ruby" ${userSettings.removeRuby !== false ? 'checked' : ''}>
                                <label for="luna-remove-ruby">${PANEL_TEXT[lang].removeRuby}</label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 快捷键设置 -->
                    <div class="luna-tab-content" data-tab="shortcuts">
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].nextParagraph}</label>
                            <input type="text" id="luna-next-para-key" value="${userSettings.keyBindings.nextParagraph || 'ArrowDown, 1'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].previousParagraph}</label>
                            <input type="text" id="luna-prev-para-key" value="${userSettings.keyBindings.prevParagraph || 'ArrowUp, 2'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].autoPlayMode}</label>
                            <input type="text" id="luna-play-para-key" value="${userSettings.keyBindings.autoPlayMode || 'P, 0'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].closeActive}</label>
                            <input type="text" id="luna-close-active-key" value="${userSettings.keyBindings.closeActive || 'Escape'}">
                        </div>
                        <div class="luna-settings-row">
                            <div class="luna-help">${PANEL_TEXT[lang].shortcutsHelp}</div>
                        </div>
                    </div>

                    <!-- 高级设置 -->
                    <div class="luna-tab-content" data-tab="advanced">
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].includeSelectors}</label>
                            <textarea id="luna-include-selectors" placeholder="${PANEL_TEXT[lang].includeSelectorsHelp}">${userSettings.includeSelectors || 'p, h1, h2, h3, h4, h5, h6'}</textarea>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].excludeSelectors}</label>
                            <textarea id="luna-exclude-selectors" placeholder="${PANEL_TEXT[lang].excludeSelectorsHelp}">${userSettings.excludeSelectors || ''}</textarea>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].includeClassIds}</label>
                            <textarea id="luna-include-class-ids" placeholder="${PANEL_TEXT[lang].includeClassIdsHelp}">${userSettings.includeClassIds || ''}</textarea>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].excludeClassIds}</label>
                            <textarea id="luna-exclude-class-ids" placeholder="${PANEL_TEXT[lang].excludeClassIdsHelp}">${userSettings.excludeClassIds || ''}</textarea>
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].stopContainers}</label>
                            <textarea id="luna-stop-containers" placeholder="${PANEL_TEXT[lang].stopContainersHelp}">${userSettings.stopContainers || 'article, main, section, div.content, div.main-content'}</textarea>
                        </div>
                        <div class="luna-settings-row">
                            <div class="luna-help">${PANEL_TEXT[lang].selectorHelp}</div>
                        </div>
                    </div>
                    
                    <div class="luna-settings-row">
                        <button id="luna-save-settings" class="luna-button">${PANEL_TEXT[lang].saveSettings}</button>
                        <button id="luna-reset-settings" class="luna-button secondary">${PANEL_TEXT[lang].resetSettings}</button>
                    </div>
                </div>

                <!-- 保存成功提示 -->
                <div id="luna-settings-saved-template" style="display:none;">
                    <div class="luna-settings-saved">
                        <div class="message">${PANEL_TEXT[lang].settingsSaved}</div>
                        <div class="buttons">
                            <button class="luna-button">${PANEL_TEXT[lang].refreshNow}</button>
                            <button class="luna-button secondary">${PANEL_TEXT[lang].refreshLater}</button>
                        </div>
                    </div>
                </div>

                <!-- 重置确认提示 -->
                <div id="luna-reset-confirm-template" style="display:none;">
                    <div class="luna-settings-saved">
                        <div class="message">${PANEL_TEXT[lang].confirmReset}</div>
                        <div class="buttons">
                            <button class="luna-button" id="luna-confirm-reset">${PANEL_TEXT[lang].confirmYes}</button>
                            <button class="luna-button secondary">${PANEL_TEXT[lang].confirmNo}</button>
                        </div>
                    </div>
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
                if (!document.getElementById('luna-include-selectors')) {
                    console.log('[LunaHTTP] 控件尚未创建，无法设置事件');
                    return;
                }
                
                // 添加事件监听器
                document.getElementById('luna-toggle-panel').addEventListener('click', toggleControlPanel);
                document.getElementById('luna-save-settings').addEventListener('click', saveUserSettings);
                document.getElementById('luna-reset-settings').addEventListener('click', resetUserSettings);
                
                // 标签页切换
                document.querySelectorAll('.luna-tab').forEach(tab => {
                    tab.addEventListener('click', function() {
                        const tabName = this.getAttribute('data-tab');
                        document.querySelectorAll('.luna-tab').forEach(t => t.classList.remove('active'));
                        this.classList.add('active');
                        
                        document.querySelectorAll('.luna-tab-content').forEach(content => {
                            content.classList.remove('active');
                        });
                        document.querySelector(`.luna-tab-content[data-tab="${tabName}"]`).classList.add('active');
                    });
                });

                // 实现面板拖动功能
                const panel = document.getElementById('luna-panel');
                const header = panel.querySelector('.luna-header');
                let isDragging = false;
                let dragOffsetX, dragOffsetY;
                
                // 鼠标按下开始拖动
                header.addEventListener('mousedown', function(e) {
                    // 如果点击的是展开/折叠按钮，则不触发拖动
                    if (e.target === document.getElementById('luna-toggle-panel')) {
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
                
                console.log('[LunaHTTP] 控制面板事件设置完成');
            } catch (e) {
                console.error('[LunaHTTP] 设置控制面板事件时出错:', e);
            }
        }
    
        // 保存用户设置
        function saveUserSettings() {
            // 获取所有设置值
            if (document.getElementById('luna-include-selectors')) {
                const newSettings = {
                    language: document.getElementById('luna-language').value,
                    apiUrl: document.getElementById('luna-url').value,
                    floatingTranslation: document.getElementById('luna-floating-translation').checked,
                    verticalPreference: document.getElementById('luna-vertical-preference').checked,
                    scrollToParagraph: document.getElementById('luna-scroll-to-paragraph').checked,
                    autoReadParagraph: document.getElementById('luna-auto-read-paragraph').checked,
                    autoReadWord: document.getElementById('luna-auto-read-word').checked,
                    MessageToggle: document.getElementById('luna-message-toggle').checked,

                    sentenceDelimiters: document.getElementById('luna-sentence-delimiters').value,
                    sentenceThreshold: parseInt(document.getElementById('luna-sentence-threshold').value) || 20,
                    minContentLength: parseInt(document.getElementById('luna-min-content-length').value) || 2,
                    maxContentLength: parseInt(document.getElementById('luna-max-content-length').value) || 1000,
                    removeRuby: document.getElementById('luna-remove-ruby').checked,

                    keyBindings: {
                        nextParagraph: document.getElementById('luna-next-para-key').value,
                        prevParagraph: document.getElementById('luna-prev-para-key').value,
                        autoPlayMode: document.getElementById('luna-play-para-key').value,
                        closeActive: document.getElementById('luna-close-active-key').value
                    },

                    includeSelectors: document.getElementById('luna-include-selectors').value,
                    excludeSelectors: document.getElementById('luna-exclude-selectors').value,
                    includeClassIds: document.getElementById('luna-include-class-ids').value,
                    excludeClassIds: document.getElementById('luna-exclude-class-ids').value,
                    stopContainers: document.getElementById('luna-stop-containers').value,
                    
                    // 使用默认面板位置
                    panelPosition: JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS.panelPosition))
                };
                
                // 验证设置并更新全局变量
                userSettings = validateUserSettings(newSettings);
            }
            
            // 保存到localStorage
            localStorage.setItem('luna-settings', JSON.stringify(userSettings));
            
            // 显示保存成功提示
            const template = document.getElementById('luna-settings-saved-template');
            const notification = template.querySelector('.luna-settings-saved').cloneNode(true);
            
            // 添加刷新按钮的事件监听器
            const refreshNowButton = notification.querySelector('.luna-button');
            const refreshLaterButton = notification.querySelector('.luna-button.secondary');
            
            // 立即刷新按钮
            if (refreshNowButton) {
                refreshNowButton.addEventListener('click', function() {
                    window.location.reload();
                });
            }
            
            // 稍后刷新按钮
            if (refreshLaterButton) {
                refreshLaterButton.addEventListener('click', function() {
                    this.closest('.luna-settings-saved').remove();
                });
            }
            
            document.body.appendChild(notification);
        }
        
        // 重置用户设置
        function resetUserSettings() {
            // 显示重置确认提示
            const template = document.getElementById('luna-reset-confirm-template');
            const confirmDialog = template.querySelector('.luna-settings-saved').cloneNode(true);
            
            // 添加按钮的事件监听器
            // 确认按钮
            confirmDialog.querySelector('#luna-confirm-reset').addEventListener('click', function() {
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
                localStorage.setItem('luna-settings', JSON.stringify(userSettings));
                
                // 直接刷新页面，而不是显示通知
                window.location.reload();
            });
            
            // 取消按钮
            confirmDialog.querySelector('.luna-button.secondary').addEventListener('click', function() {
                confirmDialog.remove();
            });
            
            document.body.appendChild(confirmDialog);
        }
        
        // 折叠/展开控制面板
        function toggleControlPanel() {
            try {
                const panel = document.querySelector('.luna-control-panel');
                const advancedSettings = document.querySelector('.luna-setup-panel');
                const toggleButton = document.getElementById('luna-toggle-panel');
                
                // 确保用户设置已初始化且语言设置有效
                if (!userSettings || !userSettings.language || (userSettings.language !== 'zh' && userSettings.language !== 'en')) {
                    console.warn('[LunaHTTP] 切换面板时发现用户设置无效，重新验证');
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
                    const settings = JSON.parse(localStorage.getItem('luna-settings') || '{}');
                    settings.panelPosition = settings.panelPosition || {};
                    settings.panelPosition.panelCollapsed = false;
                    localStorage.setItem('luna-settings', JSON.stringify(settings));
                } else {
                    advancedSettings.style.display = 'none';
                    toggleButton.textContent = PANEL_TEXT[lang].settings;
                    panel.classList.add('collapsed');
                    // 更新collapsed状态 - 但不保存位置信息
                    userSettings.panelPosition.panelCollapsed = true;
                    const settings = JSON.parse(localStorage.getItem('luna-settings') || '{}');
                    settings.panelPosition = settings.panelPosition || {};
                    settings.panelPosition.panelCollapsed = true;
                    localStorage.setItem('luna-settings', JSON.stringify(settings));
                }
                
                console.log('[LunaHTTP] 面板状态已切换');
            } catch (e) {
                console.error('[LunaHTTP] 切换控制面板时出错:', e);
            }
        }

        // 创建控制面板（只在主页面中执行）
        function ensureControlPanel() {
            if (window.top !== window.self) {
                console.log("[LunaHTTP] 当前是iframe，跳过创建控制面板");
                return;
            }
            console.log("[LunaHTTP] 尝试创建控制面板");
            // 确保用户设置已初始化
            if (!userSettings || !userSettings.language) {
                console.warn('[LunaHTTP] 创建控制面板前用户设置未正确初始化，重新初始化');
                // 尝试从localStorage加载
                try {
                    const savedSettings = localStorage.getItem('luna-settings');
                    if (savedSettings) {
                        try {
                            const parsedSettings = JSON.parse(savedSettings);
                            // 使用验证函数确保设置有效
                            userSettings = validateUserSettings(parsedSettings);
                        } catch (e) {
                            console.error('[LunaHTTP] 解析设置失败', e);
                            userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                        }
                    } else {
                        // 如果没有保存的设置，使用默认设置
                        userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                    }
                } catch (e) {
                    console.error('[LunaHTTP] 紧急初始化设置失败', e);
                    userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                }
            }
            
            // 创建面板
            createControlPanel();
            
            // 检查面板是否存在且可见
            setTimeout(() => {
                const panel = document.getElementById('luna-panel');
                if (!panel) {
                    console.error('[LunaHTTP] 控制面板创建失败，未找到面板元素');
                } else {
                    console.log('[LunaHTTP] 控制面板创建成功');
                }
            }, 500);
        }


        /* ========== 基本功能变量 ========== */

        // 默认用户设置
        const LUNA_DEFAULT_SETTINGS = {
            language: 'zh', // 默认使用中文
            apiUrl: 'http://127.0.0.1:2333',
            floatingTranslation: true,
            verticalPreference: false,
            scrollToParagraph: true,
            autoReadParagraph: false,
            autoReadWord: true,
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

        // 声明全局变量
        let userSettings = {};

        // 定义设置验证函数 - 确保关键属性存在且类型正确
        function validateUserSettings(settings) {
            if (!settings || typeof settings !== 'object') {
                console.error('[LunaHTTP] 设置格式无效，使用默认设置');
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
                        console.warn(`[LunaHTTP] 语言设置无效: "${settings[key]}"，使用默认值: "${defaults[key]}"`);
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
                        console.warn(`[LunaHTTP] 设置"${key}"类型不匹配 (期望${expectedType}，实际${actualType})，使用默认值`);
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

        const STYLES = `
            /* 段落和单词样式 */
            .luna-active-paragraph {
                padding: 8px; border-radius: 4px;
                transition: all 0.2s ease-in-out;
                position: relative; z-index: 5; background-color: white;
                box-shadow: 1px 2px 4px 2px rgba(122, 122, 122, 0.2);
            }
            .luna-highlighted {
                border-radius: 4px;
                background-color: rgba(173, 216, 230, 0.3);
                outline: 2px dashed rgba(173, 216, 230, 0.7);
                transition: background-color 0.2s ease;
            }
            .luna-word {
                display: inline-block; position: relative;
                cursor: pointer; margin: 0 1px;
            }
            .luna-word:hover { 
                background-color: rgba(238, 206, 165, 0.7) !important;
                border-radius: 2px;
            }
            .luna-word.selected { 
                background-color: #ffeb3b !important;
                border-radius: 2px;
            }

            /* 句子样式 */
            .luna-sentence {
                display: inline; position: relative;
                transition: background-color 0.2s ease;
            }
            .luna-sentence:hover {
                background-color: rgba(255, 221, 153, 0.5);
                cursor: pointer; border-radius: 3px; box-shadow: 0 0 2px rgba(0,0,0,0.1);
            }

            /* 复制样式 */
            .luna-copy {
                outline: 2px solid rgba(76, 175, 80, 0.4);
                transition: outline 0.2s ease-in-out; border-radius: 3px;
            }
            
            /* 朗读样式 */
            .luna-reaction {
                background-color: rgba(0, 180, 0, 0.3) !important;
                transition: background-color 0.2s ease; border-radius: 3px;
            }


            /* 弹窗与翻译区域 */
            .luna-dictionary-popup {
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
            .luna-search-box {
                display: flex; flex-direction: row; align-items: center;
                margin-bottom: 5px; width: 100%;
            }
            .luna-search-input {
                flex: 1; padding: 5px 8px; height: 30px;
                box-sizing: border-box; border: 1px solid #ddd;
                border-radius: 3px; font-size: 14px;
            }
            .luna-search-input:focus {
                border-color:rgba(66, 153, 225, 0.46); outline: none;
                box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
            }
            .luna-close-button {
                margin-left: 5px; width: 30px; height: 30px; color: #575757;
                border: 1px solid #ddd; border-radius: 4px; padding: 0;
                cursor: pointer; display: flex; align-items: center;
                justify-content: center; transition: background-color 0.2s;
                font-size: 18px; background-color: white;
            }
            .luna-close-button:hover { background-color: #e74c3c; color: white; }
            .luna-dict-iframe {
                margin-top: 5px; width: 100%; height: 280px;
                border: none; overflow: auto; display: block;
                background-color: white; border-radius: 3px;
            }

            .luna-translation-area {
                margin-top: 0; padding: 10px; background-color: white;
                border-radius: 4px; position: absolute; max-width: 100%;
                transition: all 0.3s ease; animation: fadeIn 0.3s ease-in-out;
                box-sizing: border-box; box-shadow: 1px 2px 4px 2px rgba(122, 122, 122, 0.2);
            }
            .luna-vertical-translation-area { border-top: 2px solid #9c27b0 !important; }
            .luna-vertical-active-paragraph { border-top: 2px solid #3498db !important; }
            .luna-horizontal-translation-area { border-left: 2px solid #9c27b0 !important; }
            .luna-horizontal-active-paragraph { border-left: 2px solid #3498db !important; }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .luna-translation-area hr { border: 1px solid rgba(157, 157, 157, 0.1); width: 100%; height: 100%; }
            .luna-translator-header { color:rgba(126, 87, 194, 0.6); font-size: 10px; }
            .luna-translation-content { font-size: 0.9em; }

            /* Ruby标签样式 */
            .luna-word rt { text-align: center; font-size: 10px; color: #c33c32; }
        `;

        let currentParagraph = null;
        let originalContent = null;
        let selectedWords = [];
        let combinedWord = '';
        let currentWordElement = null;
        let currentWord = '';
        let currentHighlightedSentence = null;
        let isAutoPlayMode = false; // 添加自动播放模式变量

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
                "notConnectedOfflineDisabled": "Not connected to HTTP and offline mode is disabled. Trying to connect...",
                "connectingHTTP": "Connecting: ",
                "connectedHTTP": "HTTP connected successfully √",
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
                "notConnectedOfflineDisabled": "未连接到HTTP且非离线模式，无法处理段落。正在尝试连接...",
                "connectingHTTP": "正在自动连接：",
                "connectedHTTP": "HTTP已成功连接 √",
                "autoPlayModeEnabled": "自动播放模式已启用 ↻",
                "autoPlayModeDisabled": "自动播放模式已禁用"
            }
        };
            
        /* ========== 初始化函数 ========== */
        function init() {
            try {
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

                console.log('[LunaHTTP] 初始化完成');
            } catch (err) {
                console.error('[LunaHTTP] 初始化失败:', err);
            }
        }

        // 从localStorage加载用户设置
        function loadUserSettings() {
            try {
                // 先设置默认值
                userSettings = JSON.parse(JSON.stringify(LUNA_DEFAULT_SETTINGS));
                
                // 尝试读取存储的设置
                const savedSettings = localStorage.getItem('luna-settings');
                if (savedSettings) {
                    try {
                        // 解析并验证设置
                        const parsedSettings = JSON.parse(savedSettings);
                        userSettings = validateUserSettings(parsedSettings);
                        console.log('[LunaHTTP] 已加载并验证设置:', userSettings);
                    } catch (e) {
                        console.error('[LunaHTTP] 解析保存的设置失败:', e);
                        // 保持默认设置
                    }
                } else {
                    console.log('[LunaHTTP] 未找到保存的设置，使用默认设置（默认语言：' + userSettings.language + '）');
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
                matchWidth: false,
                matchHeight: false,
                horizontalGap: 5,
                verticalGap: 5,
                maxWidth: null,
                maxHeight: null,
                priorityPosition: null,
                forceHideForMeasure: false,
                applyPosition: true
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
                options.matchHeight = true;
            } else {
                options.matchWidth = true;
            }
            
            // 使用通用定位函数
            positionElement(translationArea, paragraph, options);
        }

        // 定位翻译区域的函数 2
        function addTranslationArea(translationArea, paragraph) {
            
            // 根据方向添加相应的类
            if (userSettings.verticalPreference) {
                translationArea.classList.add('luna-vertical-translation-area');
            } else {
                translationArea.classList.add('luna-horizontal-translation-area');
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
                currentParagraph.classList.remove('luna-active-paragraph');
                currentParagraph.classList.remove('luna-vertical-active-paragraph');
                currentParagraph.classList.remove('luna-horizontal-active-paragraph');
                
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
                // 确定当前鼠标悬停的元素是否是选择器匹配的段落
                const target = event.target;
                const matchingParagraph = findMatchingParagraph(target);
                
                if (matchingParagraph && matchingParagraph !== currentParagraph) {
                    // 添加高亮样式
                    matchingParagraph.classList.add('luna-highlighted');
                }
            });
            
            // 添加鼠标离开效果
            doc.addEventListener('mouseout', function(event) {
                const target = event.target;
                const matchingParagraph = findMatchingParagraph(target);
                
                if (matchingParagraph && matchingParagraph !== currentParagraph) {
                    // 移除高亮样式
                    matchingParagraph.classList.remove('luna-highlighted');
                }
            });
        }

        // 查找匹配段落选择器的元素
        function findMatchingParagraph(element) {
            // 如果元素为空或是文档节点，返回null
            if (!element || element.nodeType === 9) return null;

            // 如果当前元素已经是活动段落，返回null
            if (element.classList && element.classList.contains('luna-active-paragraph')) return null;

            // 排除控制面板和其内部的所有元素
            if (element.closest && element.closest('.luna-control-panel')) return null;
            
            // 排除设置保存成功提示框
            if (element.closest && element.closest('.luna-settings-saved')) return null;

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
                    console.error('[LunaHTTP] Invalid exclude selector:', selector, e);
                }
            }

            // 检查是否排除特定class和id
            for (const selector of excludeClassIds) {
                try {
                    if (element.matches && element.matches(selector)) {
                        return null; // 如果匹配排除的class或id，直接返回null
                    }
                } catch (e) {
                    console.error('[LunaHTTP] Invalid exclude class/id selector:', selector, e);
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
                    console.error('[LunaHTTP] Invalid include selector:', selector, e);
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
                    console.error('[LunaHTTP] Invalid include class/id selector:', selector, e);
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
            if (e.target.closest('.luna-control-panel')) return;
            if (e.target.closest('.luna-active-paragraph')) return;
            if (e.target.closest('.luna-dictionary-popup')) return;
            if (e.target.closest('.luna-translation-area')) return;
            if (e.target.closest('.luna-settings-saved')) return;

            // 其他区域点击时，恢复原始内容
            restoreOriginalContent();
        }

        // 右键菜单阻止函数
        function handleContextMenu(event) {
            if (event.target.classList.contains('luna-sentence') || 
                event.target.classList.contains('luna-word') || 
                event.target.classList.contains('luna-highlighted') ||
                event.target.classList.contains('luna-active-paragraph')) {
                event.preventDefault();
            }
        }

        // 通用消息提示函数
        function showMessage(message, type = 'info', duration = 1500) {
            if (!userSettings.MessageToggle) return;
            // 确保样式表已添加
            if (!document.querySelector('#luna-message-styles')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'luna-message-styles';
                styleSheet.textContent = `
                    .luna-message-container {
                        position: fixed; top: 20px; left: 20px;
                        max-width: 300px; z-index: 10000; 
                    }
                    .luna-status-message {
                        color: white; padding: 8px; border-radius: 8px; font-size: .8em;
                        margin-bottom: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                        display: flex; align-items: center; opacity: 0; transform: translateX(50px);
                        transition: opacity 0.3s, transform 0.3s; cursor: default;
                    }
                    .luna-message-icon { margin-right: 10px; font-size: .8em; }
                    .luna-message-content { flex: 1; font-weight: 400; }
                    .luna-status-message[data-type="info"] { background-color: rgba(33, 150, 243, 0.7); }
                    .luna-status-message[data-type="success"] { background-color: rgba(76, 175, 80, 0.7); }
                    .luna-status-message[data-type="warning"] { background-color: rgba(255, 152, 0, 0.7); }
                    .luna-status-message[data-type="error"] { background-color: rgba(244, 67, 54, 0.7); }
                `;
                document.head.appendChild(styleSheet);
            }
            
            // 创建或获取消息容器
            let messageContainer = document.querySelector('.luna-message-container');
            if (!messageContainer) {
                messageContainer = document.createElement('div');
                messageContainer.className = 'luna-message-container';
                document.body.appendChild(messageContainer);
            }
            
            // 创建新的消息元素
            const statusDiv = document.createElement('div');
            statusDiv.className = 'luna-status-message';
            statusDiv.dataset.type = type;
            
            // 设置图标
            let icon = '💬';
            if (type === 'success') { icon = '✅';
            } else if (type === 'warning') { icon = '⚠️';
            } else if (type === 'error') { icon = '❌'; }
            
            // 创建消息内容结构
            statusDiv.innerHTML = `
                <div class="luna-message-icon">${icon}</div>
                <div class="luna-message-content">${message}</div>
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

        /* ========== 段落处理 ========== */
        // 处理选中的段落
        function processSelectedParagraph(element) {

            // 通用的段落处理逻辑 - 对在线和离线模式都适用
            // 检查目标元素是否匹配段落选择器，或者是否在已处理的段落内
            const isInsideActiveParagraph = element.closest && element.closest('.luna-active-paragraph');
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
                console.log('[LunaHTTP] 跳过空内容段落');
                return;
            }
            
            // 获取去除空白的文本长度
            const textLength = originalText.trim().length;
            
            // 检查内容长度是否符合要求
            const minLength = parseInt(userSettings.minContentLength) || 5;
            const maxLength = parseInt(userSettings.maxContentLength) || 1000;
            
            if (textLength < minLength) {
                console.log(`[LunaHTTP] 跳过内容长度不足的段落 (${textLength} < ${minLength})`);
                return;
            }
            
            if (textLength > maxLength) {
                console.log(`[LunaHTTP] 跳过内容过长的段落 (${textLength} > ${maxLength})`);
                return;
            }

            // 如果已有选中段落，恢复它
            if (currentParagraph && currentParagraph !== paragraph) {
                restoreOriginalContent();
            }

            // 如果是同一段落，不重复处理
            if (currentParagraph === paragraph) return;
            
            // 移除预选高亮样式
            paragraph.classList.remove('luna-highlighted');

            // 标记当前段落为活动状态
            paragraph.classList.add('luna-active-paragraph');
            
            // 根据垂直/水平设置添加对应的样式类
            if (userSettings.verticalPreference) {
                paragraph.classList.add('luna-vertical-active-paragraph');
                console.log('[LunaHTTP] 使用垂直样式模式');
            } else {
                paragraph.classList.add('luna-horizontal-active-paragraph');
                console.log('[LunaHTTP] 使用水平样式模式');
            }
            
            currentParagraph = paragraph;
            originalContent = paragraph.innerHTML;

            processParagraph(paragraph, originalText);

            // 滚动到视图中（在线和离线模式共有的操作）
            const paragraphRect = paragraph.getBoundingClientRect();
            if (userSettings.scrollToParagraph && (paragraphRect.top < 0 || paragraphRect.bottom > window.innerHeight)) {
                paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // 在线模式的处理逻辑
        function processParagraph(element, originalText) {
            // 添加段落点击事件
            attachParagraphEvents(originalText, element);

            // 移除之前的翻译区域
            removeTranslationArea();

            // 显示加载提示
            element.innerHTML = `<em>${MESSAGE[userSettings.language].segmenting}</em>`;

            // 发送分词请求
            const baseUrl = userSettings.apiUrl;
            const url = `${baseUrl}/api/mecab?text=${encodeURIComponent(originalText)}`;
            // 请补充
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP错误! 状态: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (!data || data.length === 0) {
                        // 如果没有结果，恢复原始内容
                        element.innerHTML = originalContent;
                        element.classList.remove('luna-active-paragraph');
                        currentParagraph = null;
                        originalContent = null;
                        return;
                    }
                    // 处理分词结果 - 构造与原来格式相同的对象
                    const segments = data.map(item => {
                        // 确保kana字段存在且有效，否则使用原词
                        const kana = (item.kana && item.kana.trim()) ? item.kana : null;
                        
                        return {
                            orig: item.word,
                            hira: kana, // 使用kana作为假名注音
                            kana: kana, // 保留kana字段以兼容
                            word_class: item.wordclass || '',
                            prototype: item.prototype || item.word,
                            is_delimiter: item.isdeli || false
                        };
                    });
                    
                    handleSegmentResult({segments: segments});
                })
                .catch(error => {
                    console.error('[LunaHTTP] 分词请求失败:', error);
                    // 如果发送失败，恢复原始内容
                    element.innerHTML = originalContent;
                    element.classList.remove('luna-active-paragraph');
                    currentParagraph = null;
                    originalContent = null;
                    return;
                });

            // 自动触发翻译请求
            setTimeout(() => translateText(originalText), 300);

            // 如果启用了自动朗读段落，或者自动播放模式已开启，发送朗读请求
            if (userSettings.autoReadParagraph || isAutoPlayMode) {
                // 确保有足够的延迟以防止快速切换段落时的音频冲突
                setTimeout(() => {
                    // 再次检查当前段落是否仍然是正在处理的段落
                    if (currentParagraph === element) {
                        readText(originalText, element);
                    }
                }, 500);
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
                    console.error('[LunaHTTP] 处理句子时出错:', err);
                    // 发生错误时使用简单模式显示结果
                    currentParagraph.innerHTML = segmentedContent;
                }
            } catch (error) {
                console.error('[LunaHTTP] 处理分词结果时出错:', error);
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
                wordSpanHtml.className = 'luna-word';
                wordSpanHtml.setAttribute('data-word', segment.orig);

                // 判断原文和振假名是否实质相同
                function isSameSoundIgnoringKana(original, hiragana) {
                    if (!original || !hiragana) return false;

                    // 罗马字始终显示
                    if (/^[a-zA-Z]+$/.test(hiragana)) return false;
                    
                    // 如果原文中包含汉字，总是显示假名
                    if (/[\u4E00-\u9FFF]/.test(original)) return false;
                    
                    // 如果原文和读音完全相同，不显示
                    if (original === hiragana) return true;

                    function toHiragana(str) {
                        return str.replace(/[\u30A0-\u30FF]/g, char => {
                            return String.fromCharCode(char.charCodeAt(0) - 96);
                        });
                    }

                    // 比较转换为平假名后的文本
                    return toHiragana(original) === toHiragana(hiragana);
                }
                
                // 使用ruby标签显示振假名
                // 首先检查hira字段，如果没有则使用kana字段
                const reading = segment.hira || segment.kana;
                if (reading && reading.trim() && !isSameSoundIgnoringKana(segment.orig, reading)) {
                    const rubyElement = document.createElement('ruby');
                    rubyElement.appendChild(document.createTextNode(segment.orig));
                    
                    // 确保使用平假名
                    let hiragana = reading;
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
            const wordElements = Array.from(tempDiv.querySelectorAll('.luna-word'));
            
            // 创建句子并添加到段落中
            const resultContainer = createSentencesFromWords(wordElements);
            
            // 直接设置段落内容，避免HTML字符串解析问题
            currentParagraph.innerHTML = '';
            currentParagraph.appendChild(resultContainer);
            
            // 为单词和句子添加事件
            attachWordEvents(currentParagraph);
            attachSentenceEvents(currentParagraph);
            
            console.log('[LunaHTTP] 句子处理完成，句子数量:', currentParagraph.querySelectorAll('.luna-sentence').length);
        }

        // 从单词创建句子
        function createSentencesFromWords(wordElements) {
            // 创建一个临时容器，用于分组句子
            const resultContainer = document.createElement('div');
            
            // 创建句子分组变量
            let currentSentence = document.createElement('span');
            currentSentence.className = 'luna-sentence';
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
                        currentSentence.className = 'luna-sentence';
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
            container.querySelectorAll('.luna-word').forEach(wordSpan => {
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
            container.querySelectorAll('.luna-sentence').forEach(sentence => {

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
            element.removeEventListener('mousedown', element._lunaMousedownHandler);
            element.removeEventListener('mouseup', element._lunaMouseupHandler);

            // 添加中键点击事件
            element._lunaMousedownHandler = (event) => {
                if (event.button === 1) {
                    // 阻止默认的中键行为
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // 检查是否点击在句子或单词上，如果是则交给它们自己的处理程序
                    if (event.target.closest('.luna-sentence') || event.target.closest('.luna-word')) {
                        return;
                    }
                }
            };
            element._lunaMouseupHandler = (event) => {
                if (event.button === 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // 检查是否点击在句子或单词上，如果是则交给它们自己的处理程序
                    if (event.target.closest('.luna-sentence') || event.target.closest('.luna-word')) {
                        return;
                    }
                    readText(text, element);
                }
            };

            element.addEventListener('mousedown', element._lunaMousedownHandler);
            element.addEventListener('mouseup', element._lunaMouseupHandler);

        }
        
        // 复制文本到剪贴板
        function copyTextToClipboard(text, element = null) {
            // 使用navigator.clipboard API（如果可用）
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        console.log('[LunaHTTP] 文本已复制到剪贴板');
                    })
                    .catch(err => {
                        console.error('[LunaHTTP] 复制失败:', err);
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
            element.classList.add('luna-copy');
            setTimeout(() => { element.classList.remove('luna-copy'); }, 500);
        }


        /* ========== 翻译功能 ========== */
        // 翻译文本
        function translateText(text) {
            try {
                if (!currentParagraph || !text) {
                    console.error('[LunaHTTP] 无法翻译：无当前段落或文本为空');
                    return;
                }

                console.log('[LunaHTTP] 开始翻译文本:', text.substring(0, 30) + '...');
                removeTranslationArea();

                const translationArea = document.createElement('div');
                translationArea.className = 'luna-translation-area';
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
                        translationArea.classList.add('luna-vertical-translation-area');
                    } else {
                        translationArea.style.marginTop = '4px';
                        translationArea.classList.add('luna-horizontal-translation-area');
                    }
                    
                    // 将翻译区域插入到段落后面
                    currentParagraph.after(translationArea);
                }

                // 添加临时加载指示器
                translationArea.innerHTML = `<div style="padding:10px;color:#666;text-align:center;">${MESSAGE[userSettings.language].translating}</div>`;
                translationArea.style.display = 'block';

                // 发送翻译请求到HTTP API
                const baseUrl = userSettings.apiUrl;
                fetch(`${baseUrl}/api/translate?text=${encodeURIComponent(text)}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP错误! 状态: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        const translationData = {
                            type: 'translation_result',
                            translator: data.name || '未知翻译器',
                            content: data.result || '',
                            source_text: text
                        };
                        handleTranslationResult(translationData);
                    })
                    .catch(error => {
                        console.error('[LunaHTTP] 翻译请求出错:', error);
                        translationArea.innerHTML = '<div style="padding:10px;color:red;text-align:center;">翻译请求失败</div>';
                    });
            } catch (error) {
                console.error('[LunaHTTP] 翻译过程中出错:', error);
            }
        }

        // 处理翻译结果
        function handleTranslationResult(data) {
            try {
                console.log('[LunaHTTP] 收到翻译结果:', data);
                
                if (!currentParagraph) {
                    console.error('[LunaHTTP] 没有当前段落，无法处理翻译结果');
                    return;
                }

                const translationId = currentParagraph ? currentParagraph.getAttribute('data-translation-id') : null;
                const translationArea = translationId ? 
                    document.querySelector(`.luna-translation-area[data-paragraph-id="${translationId}"]`) : 
                    document.querySelector('.luna-translation-area');
                    
                if (!translationArea) {
                    console.error('[LunaHTTP] 未找到翻译区域，创建新的翻译区域');
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
                        console.log('[LunaHTTP] 翻译原文不匹配，跳过此结果');
                        return;
                    }
                }

                // 获取翻译器名称和翻译文本
                const translatorName = data.translator || 'default-translator';
                const translationText = data.content || '';

                // 如果没有翻译内容，则不显示
                if (!translationText.trim()) {
                    console.log('[LunaHTTP] 翻译内容为空，不显示');
                    return;
                }

                // 准备翻译容器
                let translationsContainer = translationArea.querySelector('.luna-translations-container');
                if (!translationsContainer) {
                    translationsContainer = document.createElement('div');
                    translationsContainer.className = 'luna-translations-container';
                    translationArea.innerHTML = '';
                    translationArea.appendChild(translationsContainer);
                }

                // 检查现有翻译块
                let translationBlock = translationsContainer.querySelector(`.luna-translation-block[data-translator="${translatorName}"]`);

                if (translationBlock) {
                    // 更新现有翻译
                    const contentElement = translationBlock.querySelector('.luna-translation-content');
                    if (contentElement) {
                        // 获取或创建翻译器名称span
                        let translatorSpan = contentElement.querySelector('.luna-translator-header');
                        if (!translatorSpan) {
                            translatorSpan = document.createElement('span');
                            translatorSpan.className = 'luna-translator-header';
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
                    translationBlock.className = 'luna-translation-block';
                    translationBlock.setAttribute('data-translator', translatorName);
                    
                    // 添加翻译器标题和内容
                    translationBlock.innerHTML = `
                        <div class="luna-translation-content">${translationText} <span class="luna-translator-header">${translatorName}</span></div>
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
                console.log(`[LunaHTTP] 【${translatorName}】翻译显示成功`);
            } catch (error) {
                console.error('[LunaHTTP] 处理翻译结果时出错:', error);
            }
        }

        // 移除翻译区域
        function removeTranslationArea() {
            const translationId = currentParagraph ? currentParagraph.getAttribute('data-translation-id') : null;

            if (translationId) {
                const translationArea = document.querySelector(`.luna-translation-area[data-paragraph-id="${translationId}"]`);
                if (translationArea) translationArea.remove();
                
                if (currentParagraph) {
                    currentParagraph.removeAttribute('data-translation-id');
                }
            } else {
                // 移除所有翻译区域（用于清理任何可能的孤立翻译区域）
                document.querySelectorAll('.luna-translation-area').forEach(area => area.remove());
            }
        }

        /* ========== 查词功能 ========== */
        // 查询单词
        function queryWord(wordElement, word) {
            // 更新当前查询词信息
            currentWord = word;
            currentWordElement = wordElement;

            // 关闭已存在的弹窗
            const existingPopup = document.querySelector('.luna-dictionary-popup');
            if (existingPopup) existingPopup.remove();

            // 创建新弹窗
            const popup = document.createElement('div');
            popup.className = 'luna-dictionary-popup';
            popup.setAttribute('data-query-word', word); // 在弹窗上记录查询词

            // 创建查词输入框
            const searchBox = document.createElement('div');
            searchBox.className = 'luna-search-box';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'luna-search-input';
            searchInput.value = word;
            searchInput.placeholder = MESSAGE[userSettings.language].inputSearch;

            // 创建关闭按钮
            const closeButton = document.createElement('button');
            closeButton.className = 'luna-close-button';
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
                    
                    // 发送新的查词请求 - 使用HTTP API
                    const baseUrl = userSettings.apiUrl;
                    const url = `${baseUrl}/api/dictionary?word=${encodeURIComponent(newWord)}`;
                    //请补充
                    const loadingIndicator = iframeDoc.querySelector('.dict-loading');
                    
                    const eventSource = new EventSource(url);
                    
                    eventSource.onmessage = function(event) {
                        try {
                            const data = JSON.parse(event.data);
                            
                            const dictResult = {
                                type: 'dictionary_result',
                                dictionary: data.name || '未知词典',
                                content: data.result || '',
                                word: newWord
                            };
                            
                            handleDictionaryResult(dictResult);
                        } catch (e) {
                            console.error('[LunaHTTP] 解析词典结果时出错:', e);
                        }
                    };
                    
                    eventSource.onerror = function() {
                        console.error('[LunaHTTP] 词典API连接错误');
                        if (loadingIndicator) {
                            loadingIndicator.textContent = '词典查询失败';
                        }
                        eventSource.close();
                    };
                    
                    // 设置超时，确保即使没有结果也会关闭连接
                    setTimeout(() => {
                        eventSource.close();
                        if (loadingIndicator && loadingIndicator.style.display !== 'none') {
                            loadingIndicator.textContent = '查询完成';
                            loadingIndicator.style.display = 'none';
                        }
                    }, 10000);
                    
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
            iframe.className = 'luna-dict-iframe';
            iframe.setAttribute('data-luna-dictionary', 'true'); // 添加标识属性以便识别
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

            // 发送查词请求 - 使用HTTP API
            const baseUrl = userSettings.apiUrl;
            const url = `${baseUrl}/api/dictionary?word=${encodeURIComponent(word)}`;
            const eventSource = new EventSource(url);
            
            eventSource.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    const dictResult = {
                        type: 'dictionary_result',
                        dictionary: data.name || '未知词典',
                        content: data.result || '',
                        word: word
                    };
                    
                    handleDictionaryResult(dictResult);
                } catch (e) {
                    console.error('[LunaHTTP] 解析词典结果时出错:', e);
                }
            };
            
            eventSource.onerror = function() {
                console.error('[LunaHTTP] 词典API连接错误');
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const loadingIndicator = iframeDoc.querySelector('.dict-loading');
                if (loadingIndicator) {
                    loadingIndicator.textContent = '词典查询失败';
                }
                eventSource.close();
            };
            
            // 设置超时，确保即使没有结果也会关闭连接
            setTimeout(() => {
                eventSource.close();
            }, 10000);
            
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

            const popup = document.querySelector('.luna-dictionary-popup');
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

            const iframe = popup.querySelector('.luna-dict-iframe');
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
            document.querySelectorAll('.luna-word.selected').forEach(word => {
                word.classList.remove('selected');
                word.style.backgroundColor = ''; // 清除背景色
            });
            
            // 关闭词典窗口
            const dictionaryPopup = document.querySelector('.luna-dictionary-popup');
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
            // 使用HTTP API发送朗读请求
            const baseUrl = userSettings.apiUrl;
            const url = `${baseUrl}/api/tts?text=${encodeURIComponent(text)}`;
            
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP错误! 状态: ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => {
                    playAudioBlob(arrayBuffer);
                })
                .catch(error => {
                    console.error('[LunaHTTP] TTS请求失败:', error);
                });

            // 添加视觉反馈
            if (element) {
                element.classList.add('luna-reaction');
                setTimeout(() => { element.classList.remove('luna-reaction'); }, 500);
            }

            return true;
        }

        // 停止朗读
        function stopReading() {
            if (currentAudio) {
                currentAudio.pause();
                if (currentAudio.src) {
                    URL.revokeObjectURL(currentAudio.src);
                }
                currentAudio = null;
            }
        }

        // 播放二进制音频数据
        function playAudioBlob(arrayBuffer, mimeType = "audio/mpeg") {
            // 停止之前的朗读
            if (currentAudio) {
                currentAudio.pause();
                if (currentAudio.src) {
                    URL.revokeObjectURL(currentAudio.src);
                }
            }
            
            const blob = new Blob([arrayBuffer], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const audio = new Audio(url);
            currentAudio = audio;
            
            // 播放结束时清理资源
            audio.onended = () => {
                URL.revokeObjectURL(url);
                currentAudio = null;
                
                // 在自动播放模式下，播放结束后自动跳转到下一段
                if (isAutoPlayMode && currentParagraph) {
                    setTimeout(() => navigateToNextParagraph(), 500);
                }
            };
            
            audio.play();
        }

        init();
        }
    }

    /* ========== 注入脚本 ========== */
    // 注入到主页
    const lunaLensCode = getLunaLensCode();
    lunaLensCode();
    console.log("[LunaLens] 在主页面初始化完成");

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
            if (iframe.classList.contains('luna-dict-iframe') || 
                iframe.closest('.luna-dictionary-popup') || 
                iframe.hasAttribute('data-luna-dictionary') ||
                (iframe.parentElement && iframe.parentElement.closest('.luna-dictionary-popup'))) {
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
                        if (iframe.classList.contains('luna-dict-iframe') || 
                            iframe.closest('.luna-dictionary-popup') || 
                            iframe.hasAttribute('data-luna-dictionary') ||
                            (iframe.parentElement && iframe.parentElement.closest('.luna-dictionary-popup'))) {
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
            if (iframeDoc.querySelector('script[data-luna-injected]')) {
                console.log('此iframe已注入过LunaLens，跳过');
                return;
            }
            
            // 获取完整代码
            const lunaLensCode = getLunaLensCode();
            
            // 创建脚本
            const scriptText = `
                (${lunaLensCode})();
                console.log("[LunaLens] 在iframe中初始化完成");
            `;
            
            // 使用Blob URL创建脚本
            const blob = new Blob([scriptText], {type: 'application/javascript'});
            const url = URL.createObjectURL(blob);
            
            // 创建script标签并添加到iframe
            const script = iframeDoc.createElement('script');
            script.src = url;
            script.setAttribute('data-luna-injected', 'true'); // 添加标记
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


