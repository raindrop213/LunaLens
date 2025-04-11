// ==UserScript==
// @name         LunaLens
// @namespace    http://tampermonkey.net/
// @version      0.1.4
// @description  通过HTTP API连接LunaTranslator实现浏览器上的原文的分词、翻译、朗读和查词功能 
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

(function() {
    'use strict';
    
    // 默认用户设置
    const LUNA_DEFAULT_SETTINGS = {
        language: 'zh', // 默认使用中文
        apiUrl: 'http://127.0.0.1:2333',
        floatingTranslation: true,
        verticalPreference: false,
        scrollToParagraph: true,
        readActiveParagraph: false,
        readActiveWord: true,
        MessageToggle: true,

        sentenceDelimiters: '。．.!?！？…',
        sentenceThreshold: 20,
        minContentLength: 2,
        maxContentLength: 1000,
        removeRuby: true,

        keyNextParagraph: 'ArrowDown, 1',
        keyPrevParagraph: 'ArrowUp, 2',
        keyAutoPlayMode: 'P, 0',
        keyCloseActive: 'Escape',

        includeSelectors: 'p, h1, h2, h3, h4, h5, h6',
        excludeSelectors: '',
        includeClassIds: '',
        excludeClassIds: '',
        stopContainers: 'article, main, section, div.content, div.main-content'
    };
    
    // 获取用户设置
    const userSettings = Object.assign({}, LUNA_DEFAULT_SETTINGS, JSON.parse(localStorage.getItem('lunaSettings') || '{}'));
    // 设置语言
    const lang = userSettings.language || 'zh';
    
    // 状态
    const state = {
        active: null,
        original: null,
        translation: null,
        enabled: true,
        currentElements: [],
        currentIndex: -1,
        autoPlayMode: false,
        mouseX: 0,
        mouseY: 0,
        currentAudio: null, // 当前正在播放的音频对象
        
        // 查词相关状态
        selectedWords: [], // 当前选中的单词
        dictionaryPopup: null, // 字典弹窗元素
        currentWordElement: null, // 当前查询的单词元素
        eventSource: null, // EventSource连接
        fetchController: null, // Fetch控制器
        cleanupDictionary: null, // 清理函数
        currentDictQuery: null, // 当前查询
    };
    
    // 配置
    const CONFIG = {
        TIMEOUT: 3000,
        TAGS: userSettings.includeSelectors.split(',').map(s => s.trim())
    };
    
    // 工具函数
    const utils = {
        // 添加样式到文档，包括iframe内部
        addStyles(doc) {
            // 如果文档中已经有我们添加的样式，不要重复添加
            if (doc.querySelector('.luna-styles')) return;
            
            const style = doc.createElement('style');
            style.className = 'luna-styles';
            style.textContent = `
                .luna-translation {
                    padding: 8px; border-radius: 3px;
                    position: relative;
                    box-shadow: 1px 2px 4px 2px rgba(122, 122, 122, 0.2);
                }
                .luna-highlight {
                    padding: 8px; border-radius: 3px;
                    transition: all 0.1s ease-in-out;
                    box-shadow: 1px 2px 4px 2px rgba(122, 122, 122, 0.2);
                }
                .luna-sentence {
                    border-radius: 3px;
                    transition: background-color 0.1s;
                    cursor: pointer;
                }
                .luna-sentence:hover {
                    background-color: rgba(255, 221, 153, 0.26);
                }
                .luna-copy {
                    outline: 2px solid rgba(76, 175, 79, 0.27);
                    transition: outline 0.2s ease-in-out; border-radius: 3px;
                }
                .luna-reading {
                    background-color: rgba(87, 223, 87, 0.3) !important;
                    transition: background-color 0.2s ease; border-radius: 3px;
                }
                .luna-word {
                    display: inline-block; position: relative;
                    cursor: pointer; margin: 0 1px;
                }
                .luna-word:hover { 
                    background-color: rgba(238, 206, 165, 0.59) !important;
                    border-radius: 2px;
                }
                .luna-word.active { 
                    background-color: #ffeb3b !important;
                    border-radius: 2px;
                }
                .luna-word rt { text-align: center; font-size: 12px; color: #8585858a; }
                .luna-dictionary {
                    border: 1px solid #ddd;
                    background-color: white;
                    padding: 10px;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    margin-top: 10px;
                    max-width: 600px;
                    font-size: 14px;
                    position: relative;
                }
                .luna-dictionary .close {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    color: #999;
                }
                .luna-dictionary .word {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .luna-dictionary .meaning {
                    margin-top: 5px;
                }
                
                /* 词典样式 */
                .luna-dictionary-popup {
                    position: absolute !important;
                    background-color: white !important;
                    border-radius: 4px !important;
                    box-shadow: 1px 2px 4px 2px rgba(122, 122, 122, 0.2) !important;
                    padding: 5px !important;
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
                    display: flex !important; 
                    flex-direction: row !important; 
                    align-items: center !important;
                    margin-bottom: 5px !important; 
                    width: 100% !important;
                    writing-mode: horizontal-tb !important; /* 确保永远保持横向 */
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
                .luna-close-button, .luna-read-button {
                    margin-left: 3px; width: 30px; height: 30px; color: #575757;
                    border: 1px solid #ddd; border-radius: 4px; padding: 0;
                    cursor: pointer; display: flex; align-items: center;
                    justify-content: center; transition: background-color 0.2s;
                    font-size: 18px; background-color: white;
                }
                .luna-close-button:hover { background-color:rgb(196, 86, 74); color: white; }
                .luna-read-button:hover { background-color:rgb(152, 76, 175); color: white; }
                .luna-dict-iframe {
                    margin-top: 5px; width: 100%; height: 280px;
                    border: none; overflow: auto; display: block;
                    background-color: white; border-radius: 3px;
                }
            `;
            doc.head.appendChild(style);
        },
        
        makeDraggable(element) {
            // 找到父面板元素
            const panel = element.closest('.luna-control-panel');
            if (!panel) return;
            
            let startX, startY, initialPanelLeft, initialPanelTop;
            
            element.addEventListener('mousedown', function(e) {
                // 如果点击的是展开/折叠按钮，则不触发拖动
                if (e.target.id === 'luna-toggle-panel') {
                    return;
                }
                
                e.preventDefault();
                
                // 记录初始位置
                startX = e.clientX;
                startY = e.clientY;
                const rect = panel.getBoundingClientRect();
                initialPanelLeft = rect.left;
                initialPanelTop = rect.top;
                
                // 添加拖动时的样式
                panel.style.transition = 'none';
                element.style.cursor = 'grabbing';
                
                document.addEventListener('mousemove', dragHandler);
                document.addEventListener('mouseup', releaseHandler);
            });
            
            function dragHandler(e) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const gap = 25;
                
                // 获取视口尺寸
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // 获取面板尺寸
                const panelRect = panel.getBoundingClientRect();
                const panelWidth = panelRect.width;
                const panelHeight = panelRect.height;
                
                // 获取顶栏高度
                const header = panel.querySelector('.luna-panel-header') || panel.firstElementChild;
                const headerHeight = header ? header.offsetHeight : 40;
                
                // 计算新位置
                let newLeft = initialPanelLeft + dx;
                let newTop = initialPanelTop + dy;
                
                // 限制左右边界（至少保留gap像素在屏幕内）
                const minLeft = -panelWidth + gap;
                const maxLeft = viewportWidth - gap;
                newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
                
                // 限制上边界（确保顶栏至少有gap像素在屏幕内）
                const minTop = -headerHeight + gap;
                const maxTop = viewportHeight - gap;
                newTop = Math.max(minTop, Math.min(newTop, maxTop));
                
                // 应用新位置
                panel.style.left = newLeft + 'px';
                panel.style.top = newTop + 'px';
                panel.style.right = 'auto';
            }
            
            function releaseHandler() {
                // 移除事件监听器
                document.removeEventListener('mousemove', dragHandler);
                document.removeEventListener('mouseup', releaseHandler);
                
                // 恢复样式
                panel.style.transition = '';
                element.style.cursor = 'move';
            }
        },
        
        showMessage(message, duration = 1000) {
            if (!userSettings.MessageToggle) return;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'luna-message';
            msgDiv.textContent = message;
            msgDiv.style.cssText = `
                position: fixed;
                z-index: 10000000;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                transition: opacity 0.3s;
            `;
            
            document.body.appendChild(msgDiv);
            
            setTimeout(() => {
                msgDiv.style.opacity = '0';
                setTimeout(() => msgDiv.remove(), 300);
            }, duration);
        },
        
        // 片假名转平假名
        katakanaToHiragana(text) {
            if (!text) return '';
            
            // 使用正则表达式转换片假名到平假名
            // 片假名的Unicode范围是：U+30A0 to U+30FF
            return text.replace(/[\u30A0-\u30FF]/g, function(match) {
                const code = match.charCodeAt(0) - 0x60;
                return String.fromCharCode(code);
            });
        },
        
        // 判断是否需要注音（如果kana为空或与原词相同，则不需要注音）
        needsFurigana(word, kana) {
            if (!kana) return false;
            
            // 将可能的片假名读音转换为平假名
            const hiragana = this.katakanaToHiragana(kana);
            
            // 如果转换后的读音与原词相同，则不需要注音
            return hiragana !== word;
        },
        
        // 创建带有Ruby注音的单词
        createWordWithRuby(word, kana) {
            if (!this.needsFurigana(word, kana)) {
                return word;
            }
            
            // 将可能的片假名读音转换为平假名
            const hiragana = this.katakanaToHiragana(kana);
            
            return `<ruby>${word}<rt>${hiragana}</rt></ruby>`;
        },
    };
    
    // 核心功能
    const core = {
        init() {
            this.createUI();
            this.setupDocument(document);
            this.handleIframes();
            this.setupIframeObserver();
        },
        
        // 创建控制面板
        createUI() {
            // 创建面板容器
            const panel = document.createElement('div');
            panel.className = 'luna-control-panel collapsed';
            document.body.appendChild(panel);
            
            // 创建样式元素
            const style = document.createElement('style');
            document.head.appendChild(style);
            
            // 设置多语言
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
                    keyNextParagraph: "Next Paragraph:",
                    previousParagraph: "Previous Paragraph:",
                    autoReadMode: "Auto Read Mode:",
                    keyAutoPlayMode: "Auto Play Mode:",
                    keyCloseActive: "Close Active:",
                    sentenceDelimiters: "Sentence Delimiters:",
                    sentenceThreshold: "Sentence Threshold:",
                    minContentLength: "Min Content Length:",
                    maxContentLength: "Max Content Length:",
                    removeRuby: "Remove Ruby Annotations (rt, rp):",
                    autoReadSettings: "Read Settings:",
                    readActiveParagraph: "Read Active Paragraph",
                    readActiveWord: "Read Active Word",
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
                    keyNextParagraph: "下一段落:",
                    previousParagraph: "上一段落:",
                    autoReadMode: "自动朗读模式:",
                    keyAutoPlayMode: "自动播放模式:",
                    keyCloseActive: "关闭当前激活:",
                    sentenceDelimiters: "句子分隔符:",
                    sentenceThreshold: "最小句子长度:",
                    minContentLength: "最小内容长度:",
                    maxContentLength: "最大内容长度:",
                    removeRuby: "去掉注音标记(rt, rp):",
                    autoReadSettings: "朗读设置:",
                    readActiveParagraph: "朗读激活段落",
                    readActiveWord: "朗读激活单词",
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

            // 设置面板HTML内容
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
                                <input type="checkbox" id="luna-read-active-paragraph" ${userSettings.readActiveParagraph ? 'checked' : ''}>
                                <label for="luna-read-active-paragraph">${PANEL_TEXT[lang].readActiveParagraph}</label>
                            </div>
                            <div class="luna-toggle">
                                <input type="checkbox" id="luna-read-active-word" ${userSettings.readActiveWord ? 'checked' : ''}>
                                <label for="luna-read-active-word">${PANEL_TEXT[lang].readActiveWord}</label>
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
                            <label>${PANEL_TEXT[lang].keyNextParagraph}</label>
                            <input type="text" id="luna-next-para-key" value="${userSettings.keyNextParagraph || 'ArrowDown, 1'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].previousParagraph}</label>
                            <input type="text" id="luna-prev-para-key" value="${userSettings.keyPrevParagraph || 'ArrowUp, 2'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].keyAutoPlayMode}</label>
                            <input type="text" id="luna-play-para-key" value="${userSettings.keyAutoPlayMode || 'P, 0'}">
                        </div>
                        <div class="luna-settings-row">
                            <label>${PANEL_TEXT[lang].keyCloseActive}</label>
                            <input type="text" id="luna-close-active-key" value="${userSettings.keyCloseActive || 'Escape'}">
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
            `;
            
            // 设置样式
            style.textContent = `
                .luna-control-panel {
                    top: 20px; left: auto; right: 20px;
                    position: fixed; z-index: 9999999; overflow: visible !important;
                    background-color: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    width: 246px; font-size: 14px; max-height: 80vh; color: #333333;
                    overflow-y: auto; transition: all 0.3s ease; writing-mode: horizontal-tb;
                }
                .luna-control-panel.collapsed { width: 136px !important; }
                .luna-control-panel.collapsed .luna-setup-panel { display: none !important; }
                .luna-header {
                    padding: 8px 8px 6px 8px; font-size: 15px; border-bottom: 1px solid #eee;
                    display: flex; justify-content: space-between; align-items: center;
                    cursor: move; /* 添加移动光标样式 */
                    user-select: none; /* 防止文本被选中 */
                    z-index: 10000; /* 确保可点击 */
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
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 100000; text-align: center; min-width: 300px; writing-mode: horizontal-tb;
                }
                .luna-settings-saved .message { margin-bottom: 15px; color: #333; }
                .luna-settings-saved .buttons { display: flex; justify-content: center; gap: 10px; }
                .luna-settings-saved .luna-button { padding: 5px 15px; font-size: 13px; }
                
                .luna-help { font-size: 12px; color: #666; }
                kbd { background-color: #f0f0f0; border-radius: 3px;
                    color: #333333; padding: 2px 4px; font-size: 12px; 
                }
            `;
            
            // 添加面板事件
            utils.makeDraggable(panel.querySelector('.luna-header'));
            
            // 切换设置面板
            const togglePanel = panel.querySelector('#luna-toggle-panel');
            const setupPanel = panel.querySelector('.luna-setup-panel');
            togglePanel.addEventListener('click', () => {
                // 切换折叠状态
                panel.classList.toggle('collapsed');
                const isCollapsed = panel.classList.contains('collapsed');
                
                // 设置面板显示/隐藏
                if (isCollapsed) {
                    setupPanel.style.display = 'none';
                } else {
                    setupPanel.style.display = 'block';
                }
                
                // 切换按钮文本
                togglePanel.textContent = isCollapsed ? PANEL_TEXT[lang].settings : PANEL_TEXT[lang].collapse;
            });
            
            // 标签切换功能
            const tabs = panel.querySelectorAll('.luna-tab');
            const tabContents = panel.querySelectorAll('.luna-tab-content');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-tab');
                    
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(content => {
                        content.classList.remove('active');
                    });
                    
                    tab.classList.add('active');
                    panel.querySelector(`.luna-tab-content[data-tab="${tabId}"]`).classList.add('active');
                });
            });

            // 保存函数
            const saveUserSettings = () => {
                const newSettings = {
                    language: document.getElementById('luna-language').value,
                    apiUrl: document.getElementById('luna-url').value,
                    floatingTranslation: document.getElementById('luna-floating-translation').checked,
                    verticalPreference: document.getElementById('luna-vertical-preference').checked,
                    scrollToParagraph: document.getElementById('luna-scroll-to-paragraph').checked,
                    readActiveParagraph: document.getElementById('luna-read-active-paragraph').checked,
                    readActiveWord: document.getElementById('luna-read-active-word').checked,
                    MessageToggle: document.getElementById('luna-message-toggle').checked,
                    
                    sentenceDelimiters: document.getElementById('luna-sentence-delimiters').value,
                    sentenceThreshold: parseInt(document.getElementById('luna-sentence-threshold').value, 10),
                    minContentLength: parseInt(document.getElementById('luna-min-content-length').value, 10),
                    maxContentLength: parseInt(document.getElementById('luna-max-content-length').value, 10),
                    removeRuby: document.getElementById('luna-remove-ruby').checked,
                    
                    keyNextParagraph: document.getElementById('luna-next-para-key').value,
                    keyPrevParagraph: document.getElementById('luna-prev-para-key').value,
                    keyAutoPlayMode: document.getElementById('luna-play-para-key').value,
                    keyCloseActive: document.getElementById('luna-close-active-key').value,
                    
                    includeSelectors: document.getElementById('luna-include-selectors').value,
                    excludeSelectors: document.getElementById('luna-exclude-selectors').value,
                    includeClassIds: document.getElementById('luna-include-class-ids').value,
                    excludeClassIds: document.getElementById('luna-exclude-class-ids').value,
                    stopContainers: document.getElementById('luna-stop-containers').value,
                };
                
                // 保存设置到localStorage
                localStorage.setItem('lunaSettings', JSON.stringify(newSettings));
                
                // 显示保存成功提示
                const savedModal = document.createElement('div');
                savedModal.className = 'luna-settings-saved';
                savedModal.innerHTML = `
                    <div class="message">${PANEL_TEXT[lang].settingsSaved}</div>
                    <div class="buttons">
                        <button class="luna-button">${PANEL_TEXT[lang].refreshNow}</button>
                        <button class="luna-button secondary">${PANEL_TEXT[lang].refreshLater}</button>
                    </div>
                `;
                document.body.appendChild(savedModal);
                
                const refreshNowBtn = savedModal.querySelector('.luna-button:not(.secondary)');
                const refreshLaterBtn = savedModal.querySelector('.luna-button.secondary');
                
                refreshNowBtn.addEventListener('click', () => {
                    location.reload();
                });
                
                refreshLaterBtn.addEventListener('click', () => {
                    savedModal.remove();
                });
            };
            // 重置函数
            const confirmReset = () => {
                // 创建并添加确认对话框
                const resetModal = document.createElement('div');
                resetModal.className = 'luna-settings-saved';
                resetModal.innerHTML = `
                    <div class="message">${PANEL_TEXT[lang].confirmReset}</div>
                    <div class="buttons">
                        <button class="luna-button">${PANEL_TEXT[lang].confirmYes}</button>
                        <button class="luna-button secondary">${PANEL_TEXT[lang].confirmNo}</button>
                    </div>
                `;
                document.body.appendChild(resetModal);
                
                // 获取确认对话框和按钮元素
                const confirmYesBtn = resetModal.querySelector('.luna-button:not(.secondary)');
                const confirmNoBtn = resetModal.querySelector('.luna-button.secondary');
                
                // 添加确认按钮事件
                confirmYesBtn.addEventListener('click', () => {
                    // 重置当前网页的设置
                    localStorage.setItem('lunaSettings', JSON.stringify(LUNA_DEFAULT_SETTINGS));
                    location.reload();
                });
                
                // 添加取消按钮事件
                confirmNoBtn.addEventListener('click', () => {
                    resetModal.remove();
                });
            };
            // 绑定保存和重置按钮事件
            document.getElementById('luna-save-settings').addEventListener('click', saveUserSettings);
            document.getElementById('luna-reset-settings').addEventListener('click', confirmReset);
        },
        
        // 设置文档
        setupDocument(doc) {
            // 添加样式到文档
            utils.addStyles(doc);
            
            this.setupObserver(doc);
            this.setupKeyboard(doc);
            this.setupDocumentClickHandler(doc);
            this.processContent(doc);
        },
        
        // 设置文档点击事件处理
        setupDocumentClickHandler(doc) {
            doc.addEventListener('click', e => {
                // 如果点击的不是单词元素，也不是字典相关元素，则清除选中的单词
                if (!e.target.classList.contains('luna-word') && 
                    !e.target.closest('.luna-dictionary-popup') && 
                    !e.target.closest('.luna-dictionary')) {
                    this.clearSelectedWords();
                }
            });
        },
        
        // 设置观察器
        setupObserver(doc) {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        this.processNodes(mutation.addedNodes);
                    }
                });
            });
            
            try {
                observer.observe(doc.body, { childList: true, subtree: true });
            } catch (e) {
                console.error('设置MutationObserver失败:', e);
            }
        },
        
        // 设置键盘事件
        setupKeyboard(doc) {
            doc.addEventListener('keydown', e => {
                if (!state.enabled) return;
                
                // 根据用户设置的快捷键解析
                const keyNextParagraph = userSettings.keyNextParagraph.split(',').map(k => k.trim());
                const keyPrevParagraph = userSettings.keyPrevParagraph.split(',').map(k => k.trim());
                const keyAutoPlayMode = userSettings.keyAutoPlayMode.split(',').map(k => k.trim());
                const keyCloseActive = userSettings.keyCloseActive.split(',').map(k => k.trim());
                
                // 关闭当前激活
                if (keyCloseActive.includes(e.key) && state.active) {
                    e.preventDefault();
                    this.deactivate();
                    return;
                }
                
                // 自动播放模式
                if (keyAutoPlayMode.includes(e.key)) {
                    e.preventDefault();
                    state.autoPlayMode = !state.autoPlayMode;
                    utils.showMessage(state.autoPlayMode ? '自动播放模式开启' : '自动播放模式关闭');
                    
                    if (state.autoPlayMode && state.currentElements.length > 0) {
                        this.autoPlay();
                    }
                    return;
                }
                
                // 导航
                if (keyNextParagraph.includes(e.key) || keyPrevParagraph.includes(e.key)) {
                    e.preventDefault();
                    const direction = keyNextParagraph.includes(e.key) ? 'next' : 'prev';
                    this.navigate(direction);
                    return;
                }
            });
        },
        
        // 处理iframe
        handleIframes() {
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    if (iframe.contentDocument?.readyState === 'complete') {
                            try {
                                this.setupDocument(iframe.contentDocument);
                            } catch (e) {
                                console.log('无法访问iframe内容');
                            }
                    } else {
                        iframe.addEventListener('load', () => {
                            try {
                                this.setupDocument(iframe.contentDocument);
                            } catch (e) {
                                console.log('无法访问iframe内容');
                            }
                        });
                    }
                } catch (e) {
                    console.log('处理iframe时出错:', e);
                }
            });
        },
        
        // 设置iframe观察器
        setupIframeObserver() {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.tagName === 'IFRAME') {
                                try {
                                    // 检查iframe是否有srcdoc属性
                                    if (node.hasAttribute('srcdoc')) {
                                        node.addEventListener('load', () => {
                                            try {
                                                if (node.contentDocument) {
                                                    this.setupDocument(node.contentDocument);
                                                }
                                            } catch (e) {
                                                console.log('无法访问srcdoc iframe内容');
                                            }
                                        });
                                        return;
                                    }

                                    // 常规iframe处理
                                    node.addEventListener('load', () => {
                                        try {
                                                if (node.contentDocument) {
                                                    this.setupDocument(node.contentDocument);
                                                }
                                        } catch (e) {
                                            console.log('无法访问iframe内容');
                                        }
                                    });
                                } catch (e) {
                                    console.log('处理新iframe时出错:', e);
                                }
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        },
        
        processContent(doc) {
                try {
                    CONFIG.TAGS.forEach(tag => {
                        try {
                            doc.querySelectorAll(tag).forEach(element => {
                                try {
                                    if (this.isValidElement(element)) {
                                        this.makeInteractive(element);
                                    }
                                } catch (e) {
                                    console.log('处理元素时出错:', e);
                                }
                            });
                        } catch (e) {
                            console.log('查询选择器时出错:', e);
                        }
                    });
                } catch (e) {
                    console.log('处理文档内容时出错:', e);
                }
        },
        
        processNodes(nodes) {
            try {
            nodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (CONFIG.TAGS.includes(node.tagName) && this.isValidElement(node)) {
                        this.makeInteractive(node);
                    }
                    
                    CONFIG.TAGS.forEach(tag => {
                        node.querySelectorAll(tag).forEach(element => {
                            if (this.isValidElement(element)) {
                                this.makeInteractive(element);
                            }
                        });
                    });
                        }
                    });
            } catch (e) {
                console.log('处理节点集合时出错:', e);
            }
        },
        
        // 验证元素是否有效
        isValidElement(element) {
            // 获取元素内容并去除空白字符
            const contentText = element.textContent.trim();
            const contentLength = contentText.replace(/\s+/g, '').length; // 移除所有空格、换行等空白符
            
            // 判断内容长度是否在设定范围内
            const minLength = parseInt(userSettings.minContentLength) || 2;
            const maxLength = parseInt(userSettings.maxContentLength) || 1000;
            
            return contentLength >= minLength && // 内容长度必须大于等于最小长度
                   contentLength <= maxLength && // 内容长度必须小于等于最大长度
                   contentText.length > 0 && // 内容不能为空
                   !element.classList.contains('luna-ui') &&
                   !element.classList.contains('luna-translation') &&
                   !element.closest('.luna-ui') &&
                   !element.closest('.luna-control-panel') &&
                   !element.closest('.luna-settings-saved');
        },
        
        // 使元素可交互
        makeInteractive(element) {
            if (element.dataset.lunaProcessed) return;
            element.dataset.lunaProcessed = 'true';
            element.onclick = e => {
                if (!state.enabled) return;
                
                // 如果元素已经被激活，则不再触发
                if (element === state.active) return;
                
                e.preventDefault();
                e.stopPropagation();
                if (state.active) this.deactivate();
                this.activate(element);
            };
        },
        
        // 获取不含Ruby标记的文本内容
        getTextWithoutRuby(element) {
            const tempElement = element.cloneNode(true);
            if (userSettings.removeRuby) {
                tempElement.querySelectorAll('rt, rp').forEach(el => el.remove());
            }
            return tempElement.textContent;
        },
        
        // 分句处理函数
        splitSentences(text) {
            if (!text) return [];
            
            const delimiters = userSettings.sentenceDelimiters || '。．.!?！？…';
            const threshold = parseInt(userSettings.sentenceThreshold) || 20;
            const delimiterPattern = new RegExp(`([${delimiters.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}])`, 'g');
            
            let segments = text.split(delimiterPattern);
            let sentences = [];
            let currentSentence = '';
            
            for (let i = 0; i < segments.length; i++) {
                currentSentence += segments[i];
                
                const isDelimiter = segments[i].length === 1 && delimiters.includes(segments[i]);
                const notLastSegment = i < segments.length - 1;
                
                if (isDelimiter && notLastSegment) {
                    if (currentSentence.length >= threshold) {
                        sentences.push(currentSentence);
                        currentSentence = '';
                    }
                }
            }
            
            if (currentSentence.trim()) {
                if (sentences.length > 0 && currentSentence.length < threshold) {
                    sentences[sentences.length - 1] += currentSentence;
                } else {
                    sentences.push(currentSentence);
                }
            }
            
            return sentences;
        },
        
        // 处理HTML文本并添加分句标记
        processTextWithSpans(element) {
            // 获取HTML内容
            const htmlContent = element.innerHTML;
            
            // 创建一个临时容器来处理HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            // 去除ruby标记
            if (userSettings.removeRuby) {
                tempDiv.querySelectorAll('rt, rp').forEach(el => el.remove());
            }
            
            // 获取文本内容
            const textContent = tempDiv.textContent;
            
            // 分句
            const sentences = this.splitSentences(textContent);
            
            // 将文本内容替换为带有span的HTML
            return sentences.map(sentence => 
                `<span class="luna-sentence" data-needs-tokenize="true">${sentence}</span>`
            ).join('');
        },

        // 设置句子的事件处理
        setupSentenceEvents(container) {
            // 获取所有句子元素
            const sentences = container.querySelectorAll('.luna-sentence');
            
            // 一次性处理所有句子的分词，而不是逐句处理
            this.tokenizeAllSentences(container, sentences);
            
            // 为每个句子添加事件处理
            sentences.forEach(sentence => {
                // 句子元素的事件处理
                sentence.addEventListener('mouseup', (e) => {
                    if (e.button === 1) { // 中键朗读
                        // 阻止事件冒泡，以防止同时触发段落朗读
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const sentenceText = sentence.textContent.trim();
                        if (sentenceText) {
                            this.readText(this.getTextWithoutRuby(sentence), sentence);
                        }
                    }
                    else if (e.ctrlKey && e.button === 0) {
                        // 阻止事件冒泡，防止触发段落复制
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const sentenceText = sentence.textContent.trim();
                        if (sentenceText) {
                            navigator.clipboard.writeText(sentenceText)
                                .then(() => utils.showMessage(sentenceText))
                                .catch(err => utils.showMessage('复制失败'));
                        }
                    }
                });
            });
            
            // 容器的事件处理（点击空白处朗读整个段落）
            // 使用事件委托处理，仅在点击非句子元素时处理
            container.addEventListener('mouseup', (e) => {
                // 如果点击的是句子元素本身，则不处理
                if (e.target.classList.contains('luna-sentence') || e.target.closest('.luna-sentence')) {
                    return;
                }
                
                if (e.button === 1) { // 中键朗读整个段落
                    this.readText(this.getTextWithoutRuby(container), container);
                }
                else if (e.ctrlKey && e.button === 0) {
                    navigator.clipboard.writeText(this.getTextWithoutRuby(container))
                        .then(() => utils.showMessage(this.getTextWithoutRuby(container)))
                        .catch(err => utils.showMessage('复制失败'));
                }
            });
        },
        
        // 将整个段落发送到分词API，然后分配给各句子
        tokenizeAllSentences(container, sentences) {
            if (!sentences || sentences.length === 0) return;
            
            // 收集所有需要分词的句子文本
            const paragraphText = this.getTextWithoutRuby(container);
            if (!paragraphText.trim()) return;
            
            // 发送整个段落的分词请求
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${userSettings.apiUrl}/api/mecab?text=${encodeURIComponent(paragraphText)}`,
                timeout: CONFIG.TIMEOUT,
                onload: response => {
                    try {
                        const tokenizedData = JSON.parse(response.responseText);
                        this.processTokenizedParagraph(sentences, tokenizedData);
                    } catch (error) {
                        console.error('分词结果解析失败:', error);
                    }
                },
                onerror: error => {
                    console.error('分词请求失败:', error);
                },
                ontimeout: () => {
                    console.error('分词请求超时');
                }
            });
        },
        
        // 将分词结果按句子分配
        processTokenizedParagraph(sentences, tokenizedData) {
            if (!tokenizedData || !Array.isArray(tokenizedData) || sentences.length === 0) return;
            
            // 获取每个句子的文本内容，用于匹配分词结果
            const sentenceTexts = Array.from(sentences).map(sentence => {
                sentence.dataset.originalText = sentence.textContent;
                return sentence.textContent;
            });
            
            // 按单词重建每个句子
            let sentenceIndex = 0;
            let currentSentenceWords = [];
            let currentText = '';
            
            // 遍历所有分词结果
            for (let i = 0; i < tokenizedData.length; i++) {
                const token = tokenizedData[i];
                currentText += token.word;
                currentSentenceWords.push(token);
                
                // 如果当前文本包含了完整的句子，则处理该句子的分词
                while (sentenceIndex < sentenceTexts.length && 
                       currentText.includes(sentenceTexts[sentenceIndex])) {
                    // 处理当前句子的分词
                    this.processTokenizedSentence(sentences[sentenceIndex], currentSentenceWords);
                    
                    // 移动到下一个句子
                    sentenceIndex++;
                    
                    // 清空当前句子的单词列表和文本
                    currentSentenceWords = [];
                    currentText = '';
                    
                    // 如果已经处理完所有句子，退出循环
                    if (sentenceIndex >= sentenceTexts.length) {
                        break;
                    }
                }
            }
            
            // 处理剩余的单词（如果有）
            if (sentenceIndex < sentenceTexts.length && currentSentenceWords.length > 0) {
                this.processTokenizedSentence(sentences[sentenceIndex], currentSentenceWords);
            }
        },
        
        // 处理分词结果
        processTokenizedSentence(sentenceElement, tokenizedData) {
            if (!tokenizedData || !Array.isArray(tokenizedData) || tokenizedData.length === 0) return;
            
            // 生成带有分词标记的HTML
            let html = '';
            for (const token of tokenizedData) {
                if (token.isdeli) {
                    // 分隔符直接添加
                    html += token.word;
                } else {
                    // 判断是否需要注音
                    const needRuby = utils.needsFurigana(token.word, token.kana);
                    
                    // 为单词创建span元素
                    if (needRuby) {
                        // 转换可能的片假名为平假名
                        const hiragana = utils.katakanaToHiragana(token.kana);
                        html += `<span class="luna-word" data-word="${token.word}" data-kana="${hiragana}" data-pos="${token.wordclass || ''}" data-proto="${token.prototype || ''}"><ruby>${token.word}<rt>${hiragana}</rt></ruby></span>`;
                    } else {
                        html += `<span class="luna-word" data-word="${token.word}" data-kana="${token.kana || ''}" data-pos="${token.wordclass || ''}" data-proto="${token.prototype || ''}">${token.word}</span>`;
                    }
                }
            }
            
            // 更新句子内容
            sentenceElement.innerHTML = html;
            
            // 为单词添加事件处理
            this.setupWordEvents(sentenceElement);
        },
        
        // 为单词添加事件处理
        setupWordEvents(sentenceElement) {
            sentenceElement.querySelectorAll('.luna-word').forEach(wordElement => {
                // 左键点击查词
                wordElement.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 记录鼠标点击位置
                    state.lastClickX = e.clientX;
                    state.lastClickY = e.clientY;
                    
                    // 如果单词已被选中，则清除选择并返回
                    if (wordElement.classList.contains('active')) {
                        this.clearSelectedWords();
                        return;
                    }
                    
                    // 清除之前的选择
                    this.clearSelectedWords();
                    
                    // 选中当前单词
                    wordElement.classList.add('active');
                    state.selectedWords.push(wordElement);
                    
                    // 查询单词
                    const word = wordElement.dataset.word;
                    this.queryWord(wordElement, word);
                });
                
                // 右键点击添加选词
                wordElement.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 记录鼠标点击位置
                    state.lastClickX = e.clientX;
                    state.lastClickY = e.clientY;
                    
                    // 如果当前单词已被选中，则不处理
                    if (wordElement.classList.contains('active')) return;
                    
                    // 添加到选中列表
                    wordElement.classList.add('active');
                    state.selectedWords.push(wordElement);
                    
                    // 查询组合单词
                    const combinedWord = state.selectedWords.map(el => el.dataset.word).join('');
                    this.queryWord(state.selectedWords[0], combinedWord);
                });
            });
        },
        
        // 清除已选中的单词
        clearSelectedWords() {
            // 移除所有单词的active类
            state.selectedWords.forEach(wordElement => {
                wordElement.classList.remove('active');
            });
            
            // 清空选中列表
            state.selectedWords = [];
            
            // 关闭查词弹窗
            this.closeDictionaryPopup();
        },
        
        // 查询单词
        queryWord(wordElement, word) {
            if (!word) return;
            
            // 保存当前查询的单词元素
            state.currentWordElement = wordElement;
            
            // 关闭之前的弹窗
            this.closeDictionaryPopup();
            
            // 创建查词弹窗（使用词典样式）
            const popup = document.createElement('div');
            popup.className = 'luna-dictionary-popup';
            popup.setAttribute('data-query-word', word); // 在弹窗上记录查询词
            
            // 创建搜索框
            const searchBox = document.createElement('div');
            searchBox.className = 'luna-search-box';
            
            const searchInput = document.createElement('input');
            searchInput.className = 'luna-search-input';
            searchInput.type = 'text';
            searchInput.value = word;
            searchInput.placeholder = '输入要查询的单词...';
            
            const closeButton = document.createElement('button');
            closeButton.className = 'luna-close-button';
            closeButton.innerHTML = '🗙';
            closeButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearSelectedWords();
            };
            
            const readButton = document.createElement('button');
            readButton.className = 'luna-read-button';
            readButton.innerHTML = '♬';
            readButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wordToRead = searchInput.value.trim();
                if (wordToRead) {
                    this.readText(wordToRead);
                }
            };
            
            searchBox.appendChild(searchInput);
            searchBox.appendChild(readButton);
            searchBox.appendChild(closeButton);
            popup.appendChild(searchBox);
            
            // 创建iframe容器
            const iframe = document.createElement('iframe');
            iframe.className = 'luna-dict-iframe';
            popup.appendChild(iframe);
            
            // 将弹窗添加到翻译窗后面，而不是直接添加到body
            if (state.active) {
                // 添加到激活元素后面
                state.active.parentNode.insertBefore(popup, state.active.nextSibling);
            } else {
                // 如果都没有，再添加到body
                document.body.appendChild(popup);
            }
            
            // 计算弹窗位置
            const wordRect = wordElement.getBoundingClientRect();
            const popupRect = popup.getBoundingClientRect();
            
            // 获取鼠标位置
            const mouseX = state.lastClickX || window.innerWidth / 2;
            const mouseY = state.lastClickY || window.innerHeight / 2;
            
            // 获取激活元素的边界（如果存在）
            const activeRect = state.active ? state.active.getBoundingClientRect() : null;
            
            // 计算单词相对于文档的绝对位置
            const wordAbsoluteLeft = wordRect.left + window.pageXOffset;
            const wordAbsoluteTop = wordRect.top + window.pageYOffset;
            
            let left, top;
            const gap = 5;
            
            if (userSettings.verticalPreference) {
                // 垂直阅读模式：弹窗显示在单词的左侧或右侧
                // 根据鼠标位置决定显示在左侧还是右侧
                if (mouseX > window.innerWidth / 2) {
                    // 显示在左侧
                    left = wordAbsoluteLeft - popupRect.width - gap;
                } else {
                    // 显示在右侧
                    left = wordAbsoluteLeft + wordRect.width + gap;
                }
                
                // 垂直方向上与单词上边缘对齐
                top = wordAbsoluteTop;
                
                // 确保不超出激活元素的下边缘（如果有）或屏幕下边缘
                const maxTop = Math.min(
                    activeRect ? (activeRect.bottom + window.pageYOffset) - popupRect.height : Infinity,
                    window.innerHeight + window.pageYOffset - popupRect.height - gap
                );
                if (top > maxTop) {
                    top = maxTop;
                }
            } else {
                // 水平阅读模式：弹窗显示在单词的上方或下方
                // 根据鼠标位置决定显示在上方还是下方
                if (mouseY > window.innerHeight / 2) {
                    // 显示在上方
                    top = wordAbsoluteTop - popupRect.height - gap;
                } else {
                    // 显示在下方
                    top = wordAbsoluteTop + wordRect.height + gap;
                }
                
                // 水平方向上与单词左边缘对齐
                left = wordAbsoluteLeft;
                
                // 确保不超出激活元素的右边缘（如果有）或屏幕的右边缘
                const maxLeft = Math.min(
                    activeRect ? (activeRect.right + window.pageXOffset) - popupRect.width : Infinity,
                    window.innerWidth + window.pageXOffset - popupRect.width - gap
                );
                if (left > maxLeft) {
                    left = maxLeft;
                }
            }
            
            // 确保弹窗不超出屏幕边界
            if (left < window.pageXOffset + gap) {
                left = window.pageXOffset + gap;
            }
            if (top < window.pageYOffset + gap) {
                top = window.pageYOffset + gap;
            }
            
            // 设置弹窗位置
            popup.style.left = `${left}px`;
            popup.style.top = `${top}px`;
            
            // 保存弹窗引用
            state.dictionaryPopup = popup;
            
            // 自动聚焦到搜索输入框
            setTimeout(() => {
                // searchInput.focus();
                searchInput.select(); // 全选文本内容，方便直接修改
            }, 0);
            
            
            // 防止事件冒泡和确保点击弹窗不会触发其他事件
            popup.addEventListener('mousedown', e => {
                e.stopPropagation();
            });
            popup.addEventListener('click', e => {
                e.stopPropagation();
            });
            
            // 监听输入框内容变化，自动查词
            searchInput.addEventListener('input', (e) => {
                const newWord = e.target.value.trim();
                if (newWord && newWord.length > 0) {
                    popup.setAttribute('data-query-word', newWord);
                    
                    // 清空现有内容并显示加载提示
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && iframeDoc.body) {
                        iframeDoc.body.innerHTML = '<div class="loading">正在加载词典数据...</div>';
                    }
                    
                    this.fetchDictionaryResults(iframe, newWord);
                    
                    if (userSettings.readActiveWord) {
                        this.readText(newWord);
                    }
                }
            });
            
            // 等待iframe加载完成后获取词典数据
            iframe.onload = () => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    iframeDoc.body.innerHTML = '<div class="loading">正在加载词典数据...</div>';
                    this.fetchDictionaryResults(iframe, word);
                }
            };
            
            // 如果开启了朗读激活单词，则朗读单词
            if (userSettings.readActiveWord) {
                this.readText(word);
            }
        },
        
        // 获取词典结果
        fetchDictionaryResults(iframe, word) {
            if (!word) return;
            
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) return;
            
            iframeDoc.body.innerHTML = '<div class="loading">正在加载词典数据...</div>';
            
            // 添加样式
            const style = iframeDoc.createElement('style');
            style.textContent = `
                body { 
                    font-family: sans-serif; margin: 0; 
                    line-height: 1.5; font-size: 14px; color: #333; 
                }
                .dict-section { 
                    margin-bottom: 15px; 
                    border-bottom: 1px solid #eee; 
                    padding-bottom: 10px; 
                }
                .dict-content { 
                    margin: 0; 
                    padding: 0 5px;
                }
                .dict-content a {
                    color: #0066cc;
                    text-decoration: none;
                }
                .dict-content a:hover {
                    text-decoration: underline;
                }
                .loading { 
                    padding: 20px; 
                    text-align: center; 
                    color: #666; 
                }
                .dict-tabs { 
                    position: sticky; 
                    top: 0; 
                    background: white; 
                    border-bottom: 1px solid #eee; 
                    z-index: 10;
                }
                .dict-tab { 
                    display: inline-block; 
                    font-size: 12px; 
                    padding: 5px 10px; 
                    cursor: pointer; 
                    border-radius: 3px 3px 0 0; 
                }
                .dict-tab.active { 
                    border: 1px solid #ddd; 
                    border-bottom: 1px solid #fff; 
                    margin-bottom: -1px; 
                    background-color: #f9f9f9;
                }
                .dict-entry { 
                    display: none;
                    margin-top: 10px;
                }
                .dict-entry.active {
                    display: block;
                }
            `;
            iframeDoc.head.appendChild(style);

            // 添加MDICT标签切换函数
            const script = iframeDoc.createElement('script');
            script.textContent = `
                function onclickbtn_mdict_internal(_id) {
                    tabPanes = document.querySelectorAll('.tab-widget_mdict_internal .tab-pane_mdict_internal');
                    tabButtons = document.querySelectorAll('.tab-widget_mdict_internal .tab-button_mdict_internal');
                    for (i = 0; i < tabButtons.length; i++)
                        tabButtons[i].classList.remove('active');
                    for (i = 0; i < tabPanes.length; i++)
                        tabPanes[i].classList.remove('active');

                    document.getElementById(_id).classList.add('active');

                    tabId = document.getElementById(_id).getAttribute('data-tab');
                    tabPane = document.getElementById(tabId);
                    tabPane.classList.add('active');
                }
            `;
            iframeDoc.head.appendChild(script);
            
            // 创建词典标签和内容容器
            iframeDoc.body.innerHTML = `
                <div class="dict-tabs"></div>
                <div class="loading">正在查询"${word}"...</div>
                <div class="dict-entries"></div>
            `;
            
            // 清除现有内容
            const tabsContainer = iframeDoc.querySelector('.dict-tabs');
            const entriesContainer = iframeDoc.querySelector('.dict-entries');
            tabsContainer.innerHTML = '';
            entriesContainer.innerHTML = '';
            
            // 如果有正在进行的请求，中止它
            if (state.cleanupDictionary) {
                state.cleanupDictionary();
            }
            
            // 是否已经回退到GM_xmlhttpRequest
            let fallbackToGM = false;
            let eventSourceTimer = null;
            
            const cleanupFunction = () => {
                if (eventSourceTimer) {
                    clearTimeout(eventSourceTimer);
                    eventSourceTimer = null;
                }
                
                if (state.eventSource) {
                    state.eventSource.close();
                    state.eventSource = null;
                }
                
                if (state.fetchController) {
                    state.fetchController.abort();
                    state.fetchController = null;
                }
                
                state.cleanupDictionary = null;
            };
            
            // 保存清理函数
            state.cleanupDictionary = cleanupFunction;
            
            // 尝试使用EventSource（更快的方法）
            try {
            // 使用事件流API获取多个词典结果
            const fetchController = new AbortController();
            const signal = fetchController.signal;
            
            // 保存当前的fetch controller，以便在需要时中止请求
            state.fetchController = fetchController;
                
                // 设置超时，如果5秒内没有结果就切换到备用方法
                eventSourceTimer = setTimeout(() => {
                    console.log('EventSource超时，切换到GM_xmlhttpRequest方法');
                    if (state.eventSource) {
                        state.eventSource.close();
                        state.eventSource = null;
                    }
                    
                    if (!fallbackToGM) {
                        fallbackToGM = true;
                        this.fallbackToGMRequest(word, iframeDoc, tabsContainer, entriesContainer);
                    }
                }, 5000);
            
            // 创建EventSource连接
            const eventSource = new EventSource(`${userSettings.apiUrl}/api/dictionary?word=${encodeURIComponent(word)}`);
            
            // 保存EventSource引用
            state.eventSource = eventSource;
                
                let hasReceivedData = false;
            
            // 处理事件流数据
            eventSource.onmessage = (event) => {
                    hasReceivedData = true;
                    
                    // 收到数据，清除超时定时器
                    if (eventSourceTimer) {
                        clearTimeout(eventSourceTimer);
                        eventSourceTimer = null;
                    }
                    
                try {
                    const data = JSON.parse(event.data);
                    const dictName = data.name || '词典';
                    const dictId = `dict-${dictName.replace(/\s+/g, '-')}`;
                    
                    // 隐藏加载提示
                    const loadingIndicator = iframeDoc.querySelector('.loading');
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    
                    // 检查是否已有该词典结果
                    let entryDiv = iframeDoc.getElementById(dictId);
                    let isNewDictionary = false;
                    
                    if (!entryDiv) {
                        isNewDictionary = true;
                        // 创建新词典条目
                        entryDiv = iframeDoc.createElement('div');
                        entryDiv.className = 'dict-entry';
                        entryDiv.id = dictId;
                        entryDiv.setAttribute('data-dict', dictName);
                        
                        entryDiv.innerHTML = `
                            <div class="dict-content">${data.result || '无结果'}</div>
                        `;
                        
                        entriesContainer.appendChild(entryDiv);
                        
                        // 添加词典标签
                        const tab = iframeDoc.createElement('div');
                        tab.className = 'dict-tab';
                        tab.textContent = dictName;
                        tab.setAttribute('data-dict', dictName);
                        
                        if (tabsContainer.children.length === 0) {
                            tab.classList.add('active');
                            entryDiv.classList.add('active');
                        }
                        
                        tab.addEventListener('click', function() {
                            // 更新标签状态
                            iframeDoc.querySelectorAll('.dict-tab').forEach(t => t.classList.remove('active'));
                            this.classList.add('active');
                            
                            // 更新词典显示
                            const dictName = this.getAttribute('data-dict');
                            iframeDoc.querySelectorAll('.dict-entry').forEach(entry => {
                                if (entry.getAttribute('data-dict') === dictName) {
                                    entry.classList.add('active');
                                } else {
                                    entry.classList.remove('active');
                                }
                            });
                        });
                        
                        tabsContainer.appendChild(tab);
                    } else {
                        // 更新现有词典内容
                        const contentDiv = entryDiv.querySelector('.dict-content');
                        if (contentDiv) contentDiv.innerHTML = data.result || '无结果';
                    }
                    
                    // 处理iframe中的链接点击
                    entryDiv.querySelectorAll('a').forEach(link => {
                        link.target = '_blank'; // 在新窗口打开
                        link.addEventListener('click', function(e) {
                            // 如果是定义跳转类的链接，可以阻止默认行为
                            if (this.href.includes('#') || this.href.includes('javascript:')) {
                                e.preventDefault();
                            }
                        });
                    });
                } catch (error) {
                    console.error('解析词典数据失败:', error);
                }
            };
            
                eventSource.onerror = (error) => {
                    console.error('EventSource错误:', error);
                eventSource.close();
                    state.eventSource = null;
                    
                    // 如果还没有收到任何数据，切换到备用方法
                    if (!hasReceivedData && !fallbackToGM) {
                        fallbackToGM = true;
                        console.log('EventSource出错，切换到GM_xmlhttpRequest方法');
                        this.fallbackToGMRequest(word, iframeDoc, tabsContainer, entriesContainer);
                    } else if (!iframeDoc.querySelector('.dict-section') && !iframeDoc.querySelector('.dict-entry')) {
                // 如果没有内容，显示错误信息
                    const loadingIndicator = iframeDoc.querySelector('.loading');
                    if (loadingIndicator) {
                        loadingIndicator.textContent = '获取词典数据失败';
                    }
                }
            };
            } catch (error) {
                console.error('使用EventSource出错:', error);
                if (!fallbackToGM) {
                    fallbackToGM = true;
                    this.fallbackToGMRequest(word, iframeDoc, tabsContainer, entriesContainer);
                }
            }
        },
        
        // 回退到GM_xmlhttpRequest方法
        fallbackToGMRequest(word, iframeDoc, tabsContainer, entriesContainer) {
            console.log('使用GM_xmlhttpRequest方法获取词典数据');
            
            // 创建变量来存储当前查询
            const currentQuery = { word, timestamp: Date.now() };
            
            // 记录当前查询
            state.currentDictQuery = currentQuery;
            
            // 先获取字典列表
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${userSettings.apiUrl}/api/list/dictionary`,
                onload: (response) => {
                    // 检查是否是最新查询
                    if (state.currentDictQuery !== currentQuery) {
                        console.log('已有更新的查询，放弃处理旧结果');
                        return;
                    }
                    
                    try {
                        const dictionaries = JSON.parse(response.responseText);
                        if (Array.isArray(dictionaries) && dictionaries.length > 0) {
                            // 隐藏加载提示
                            const loadingIndicator = iframeDoc.querySelector('.loading');
                            if (loadingIndicator) loadingIndicator.style.display = 'none';
                            
                            // 创建一个Promise数组来跟踪所有字典请求
                            const dictPromises = dictionaries.map((dict, index) => {
                                if (dict && dict.id) {
                                    return this.queryDictionaryAsync(word, dict.id, dict.name, iframeDoc, tabsContainer, entriesContainer, index === 0, currentQuery);
                                }
                                return Promise.resolve();
                            });
                            
                            // 并行处理所有字典请求
                            Promise.allSettled(dictPromises).then(() => {
                                if (state.currentDictQuery === currentQuery) {
                                    // 所有字典查询完成后，对标签进行排序
                                    this.sortDictionaryTabs(iframeDoc, tabsContainer);
                                }
                            });
                        } else {
                            const loadingIndicator = iframeDoc.querySelector('.loading');
                            if (loadingIndicator) {
                                loadingIndicator.textContent = '未找到可用的字典';
                            }
                        }
                    } catch (e) {
                        console.error('解析字典列表失败:', e);
                        const loadingIndicator = iframeDoc.querySelector('.loading');
                        if (loadingIndicator) {
                            loadingIndicator.textContent = '获取字典列表失败';
                        }
                    }
                },
                onerror: (error) => {
                    // 检查是否是最新查询
                    if (state.currentDictQuery !== currentQuery) return;
                    
                    console.error('获取字典列表出错:', error);
                    const loadingIndicator = iframeDoc.querySelector('.loading');
                    if (loadingIndicator) {
                        loadingIndicator.textContent = '获取字典列表出错，请检查API服务是否可用';
                    }
                }
            });
        },
        
        // 异步查询特定字典
        queryDictionaryAsync(word, dictionaryId, dictionaryName, iframeDoc, tabsContainer, entriesContainer, isFirst, queryIdentifier) {
            return new Promise((resolve) => {
                // 如果不是当前最新查询，直接返回
                if (state.currentDictQuery !== queryIdentifier) {
                    resolve();
                    return;
                }
                
                // 创建这个字典的标签和内容容器
                const dictId = `dict-${dictionaryId.replace(/\s+/g, '-')}`;
                
                // 检查是否已存在这个词典
                if (iframeDoc.getElementById(dictId)) {
                    resolve();
                    return;
                }
                
                // 创建词典条目
                const entryDiv = iframeDoc.createElement('div');
                entryDiv.className = 'dict-entry';
                entryDiv.id = dictId;
                entryDiv.setAttribute('data-dict', dictionaryName);
                
                if (isFirst && !iframeDoc.querySelector('.dict-entry.active')) {
                    entryDiv.classList.add('active');
                }
                
                entryDiv.innerHTML = `<div class="dict-content">加载中...</div>`;
                entriesContainer.appendChild(entryDiv);
                
                // 添加词典标签，但不立即设置为active
                const tab = iframeDoc.createElement('div');
                tab.className = 'dict-tab';
                tab.textContent = dictionaryName;
                tab.setAttribute('data-dict', dictionaryName);
                tab.style.opacity = '0.7'; // 未加载完成的标签显示为半透明
                
                if (isFirst && !iframeDoc.querySelector('.dict-tab.active')) {
                    tab.classList.add('active');
                }
                
                tab.addEventListener('click', function() {
                    // 更新标签状态
                    iframeDoc.querySelectorAll('.dict-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    // 更新词典显示
                    const dictName = this.getAttribute('data-dict');
                    iframeDoc.querySelectorAll('.dict-entry').forEach(entry => {
                        if (entry.getAttribute('data-dict') === dictName) {
                            entry.classList.add('active');
                        } else {
                            entry.classList.remove('active');
                        }
                    });
                });
                
                tabsContainer.appendChild(tab);
                
                // 记录查询开始时间
                const startTime = Date.now();
                
                // 使用GM_xmlhttpRequest查询特定字典
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${userSettings.apiUrl}/api/dictionary?word=${encodeURIComponent(word)}&id=${encodeURIComponent(dictionaryId)}`,
                    onload: (response) => {
                        // 如果不是当前最新查询，忽略结果
                        if (state.currentDictQuery !== queryIdentifier) {
                            resolve();
                            return;
                        }
                        
                        // 计算响应时间
                        const responseTime = Date.now() - startTime;
                        
                        // 设置数据属性记录响应时间
                        tab.setAttribute('data-response-time', responseTime);
                        tab.style.opacity = '1'; // 加载完成后恢复透明度
                        
                        try {
                            const data = JSON.parse(response.responseText);
                            
                            // 更新字典内容
                            const contentDiv = entryDiv.querySelector('.dict-content');
                            if (contentDiv) {
                                if (data && data.result) {
                                    contentDiv.innerHTML = data.result;
                                    
                                    // 如果有结果且没有其他已激活的词典，激活此词典
                                    const hasActiveTab = iframeDoc.querySelector('.dict-tab.active[data-has-result="true"]');
                                    if (!hasActiveTab) {
                                        // 标记此标签有结果
                                        tab.setAttribute('data-has-result', 'true');
                                        
                                        // 移除所有active状态
                                        iframeDoc.querySelectorAll('.dict-tab').forEach(t => t.classList.remove('active'));
                                        iframeDoc.querySelectorAll('.dict-entry').forEach(e => e.classList.remove('active'));
                                        
                                        // 激活此词典
                                        tab.classList.add('active');
                                        entryDiv.classList.add('active');
                                    }
                                } else {
                                    contentDiv.textContent = '无结果';
                                    contentDiv.style.color = '#999';
                                    tab.style.opacity = '0.5'; // 无结果的标签显示更透明
                                }
                            }
                            
                            // 处理iframe中的链接点击
                            entryDiv.querySelectorAll('a').forEach(link => {
                                link.target = '_blank'; // 在新窗口打开
                                link.addEventListener('click', function(e) {
                                    // 如果是定义跳转类的链接，可以阻止默认行为
                                    if (this.href.includes('#') || this.href.includes('javascript:')) {
                                        e.preventDefault();
                                    }
                                });
                            });
                        } catch (e) {
                            console.error(`解析 ${dictionaryId} 字典结果失败:`, e);
                            const contentDiv = entryDiv.querySelector('.dict-content');
                            if (contentDiv) {
                                contentDiv.textContent = '获取结果失败';
                                contentDiv.style.color = 'red';
                            }
                            tab.style.opacity = '0.5'; // 失败的标签显示更透明
                        }
                        
                        resolve();
                    },
                    onerror: (error) => {
                        // 如果不是当前最新查询，忽略错误
                        if (state.currentDictQuery !== queryIdentifier) {
                            resolve();
                            return;
                        }
                        
                        console.error(`查询 ${dictionaryId} 出错:`, error);
                        const contentDiv = entryDiv.querySelector('.dict-content');
                        if (contentDiv) {
                            contentDiv.textContent = '查询失败';
                            contentDiv.style.color = 'red';
                        }
                        tab.style.opacity = '0.5'; // 失败的标签显示更透明
                        
                        resolve();
                    }
                });
            });
        },
        
        // 查询特定字典 - 保留以兼容现有代码，但内部调用异步版本
        queryDictionary(word, dictionaryId, dictionaryName, iframeDoc, tabsContainer, entriesContainer, isFirst) {
            // 创建一个虚拟的查询标识符
            const tempQueryId = { word, timestamp: Date.now() };
            this.queryDictionaryAsync(word, dictionaryId, dictionaryName, iframeDoc, tabsContainer, entriesContainer, isFirst, tempQueryId);
        },
        
        // 对词典标签按响应时间排序
        sortDictionaryTabs(iframeDoc, tabsContainer) {
            const tabs = Array.from(tabsContainer.querySelectorAll('.dict-tab'));
            
            // 按响应时间排序（只排序已完成加载的标签）
            tabs.sort((a, b) => {
                const aTime = parseInt(a.getAttribute('data-response-time') || '999999');
                const bTime = parseInt(b.getAttribute('data-response-time') || '999999');
                return aTime - bTime;
            });
            
            // 重新添加标签
            tabs.forEach(tab => {
                tabsContainer.appendChild(tab);
            });
        },
        
        // 关闭查词弹窗
        closeDictionaryPopup() {
            // 关闭EventSource连接
            if (state.eventSource) {
                state.eventSource.close();
                state.eventSource = null;
            }
            
            // 中止fetch请求
            if (state.fetchController) {
                state.fetchController.abort();
                state.fetchController = null;
            }
            
            // 执行清理函数
            if (state.cleanupDictionary) {
                state.cleanupDictionary();
                state.cleanupDictionary = null;
            }
            
            // 移除弹窗
            if (state.dictionaryPopup && state.dictionaryPopup.parentNode) {
                state.dictionaryPopup.parentNode.removeChild(state.dictionaryPopup);
                state.dictionaryPopup = null;
            }
        },
        
        // 激活元素
        activate(element) {
            state.active = element;
            state.original = element.innerHTML;
            element.classList.add('luna-highlight');
            
            // 处理文本并添加句子标记
            element.innerHTML = this.processTextWithSpans(element);
            
            // 为句子添加中键朗读和右键复制功能，并进行分词处理
            this.setupSentenceEvents(element);
            
            // 阻止激活元素上的所有鼠标事件传播，防止重复激活
            const preventDefaultEvents = (e) => {
                if (e.button === 1 || e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            
            element.addEventListener('mousedown', preventDefaultEvents);
            element.addEventListener('contextmenu', e => {
                // 如果不是单词元素，则阻止默认右键菜单
                if (!e.target.classList.contains('luna-word')) {
                    e.preventDefault();
                    return false;
                }
                return true;
            });
            element.addEventListener('auxclick', e => {
                e.preventDefault();
                return false;
            });
            
            this.createTranslation(element);
            this.translate(this.getTextWithoutRuby(element));
            
            // 如果开启了朗读激活段落，或者在自动播放模式下，则朗读整个段落
            if (userSettings.readActiveParagraph || state.autoPlayMode) {
                this.readText(this.getTextWithoutRuby(element), element);
            }
        },
        
        // 取消激活
        deactivate() {
            if (!state.active) return;
            
            // 停止朗读
            this.stopReading();
            
            // 清除选中的单词
            this.clearSelectedWords();
            
            // 保存对当前活动元素的引用
            const activeElement = state.active;
            
            // 移除高亮类名
            activeElement.classList.remove('luna-highlight');
            
            // 恢复原始内容前，先克隆当前元素以便清理事件监听器
            const newElement = activeElement.cloneNode(false);
            newElement.innerHTML = state.original;
            
            // 确保新元素没有处理标记，以便可以再次激活
            newElement.removeAttribute('data-luna-processed');
            
            // 用新元素替换当前元素，这样会自动清除所有事件监听器
            if (activeElement.parentNode) {
                activeElement.parentNode.replaceChild(newElement, activeElement);
            }
            
            // 移除翻译元素
            if (state.translation?.parentNode) {
                state.translation.parentNode.removeChild(state.translation);
            }
            
            // 移除字典弹窗
            if (state.dictionaryPopup?.parentNode) {
                state.dictionaryPopup.parentNode.removeChild(state.dictionaryPopup);
                state.dictionaryPopup = null;
            }
            
            // 重置状态
            state.active = null;
            state.original = null;
            state.translation = null;
            
            // 重新为新元素添加交互性
            setTimeout(() => {
                if (this.isValidElement(newElement)) {
                    this.makeInteractive(newElement);
                }
                
                // 重新处理子元素
                CONFIG.TAGS.forEach(tag => {
                    if (newElement && newElement.querySelectorAll) {
                        newElement.querySelectorAll(tag).forEach(element => {
                            if (this.isValidElement(element)) {
                                element.removeAttribute('data-luna-processed');
                                this.makeInteractive(element);
                            }
                        });
                    }
                });
            }, 0);
        },
        
        // 翻译相关
        createTranslation(element) {
            state.translation = document.createElement('div');
            state.translation.className = 'luna-translation';
            state.translation.textContent = '正在翻译...';
            element.parentNode.insertBefore(state.translation, element.nextSibling);
        },
        
        translate(text) {
            if (!text.trim()) {
                this.updateTranslation('没有可翻译的文本');
                return;
            }
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${userSettings.apiUrl}/api/translate?text=${encodeURIComponent(text)}`,
                timeout: CONFIG.TIMEOUT,
                onload: response => {
                    try {
                        const data = JSON.parse(response.responseText);
                        this.updateTranslation(data.result || '翻译失败');
                    } catch (error) {
                        this.updateTranslation('翻译结果解析失败');
                        console.error('翻译结果解析失败:', error);
                    }
                },
                onerror: error => {
                    this.updateTranslation('翻译请求失败');
                    console.error('翻译请求失败:', error);
                },
                ontimeout: () => {
                    this.updateTranslation('翻译请求超时');
                    console.error('翻译请求超时');
                }
            });
        },
        
        updateTranslation(content) {
            if (state.translation) {
                state.translation.textContent = content;
            }
        },

        // 语音相关
        readText(text, element = null) {
            if (!text || !text.trim()) return false;
            
            // 停止之前的朗读
            this.stopReading();
            
            // 发送朗读请求
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${userSettings.apiUrl}/api/tts?text=${encodeURIComponent(text)}`,
                responseType: 'arraybuffer',
                timeout: CONFIG.TIMEOUT,
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        this.playAudioBlob(response.response);
                    } else {
                        console.error('TTS请求失败! 状态:', response.status);
                        utils.showMessage('朗读请求失败');
                    }
                },
                onerror: error => {
                    console.error('TTS请求失败:', error);
                    utils.showMessage('朗读请求失败');
                },
                ontimeout: () => {
                    console.error('TTS请求超时');
                    utils.showMessage('朗读请求超时');
                }
            });
            
            // 添加视觉反馈
            if (element) {
                element.classList.add('luna-reading');
                setTimeout(() => {
                    element.classList.remove('luna-reading');
                }, 500);
            }
            
            return true;
        },
        
        stopReading() {
            if (state.currentAudio) {
                state.currentAudio.pause();
                if (state.currentAudio.src) {
                    URL.revokeObjectURL(state.currentAudio.src);
                }
                state.currentAudio = null;
            }
        },
        
        playAudioBlob(arrayBuffer) {
            // 停止之前的朗读
            this.stopReading();
            
            // 播放结束回调
            const onPlayEnd = () => {
                state.currentAudio = null;
                // 自动播放模式处理
                if (state.autoPlayMode && state.active) {
                    setTimeout(() => this.navigate('next'), 500);
                }
            };
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                audioContext.decodeAudioData(arrayBuffer, 
                    (buffer) => {
                        const source = audioContext.createBufferSource();
                        source.buffer = buffer;
                        source.connect(audioContext.destination);
                        
                        state.currentAudio = {
                            source: source,
                            context: audioContext,
                            pause: function() {
                                try {
                                    this.source.stop();
                                    this.context.close();
                                } catch(e) {}
                            }
                        };
                        
                        source.onended = () => {
                            audioContext.close().catch(() => {});
                            onPlayEnd();
                        };
                        
                        source.start(0);
                    },
                    () => utils.showMessage('音频播放失败')
                );
            } catch (e) {
                utils.showMessage('音频播放失败');
            }
        },
        
        // 导航功能
        navigate(direction) {
            const elements = this.getAllElements();
            if (elements.length === 0) return;
            
            state.currentElements = elements;
            
            if (state.active) {
                const currentIndex = elements.indexOf(state.active);
                if (currentIndex === -1) {
                    state.currentIndex = 0;
                } else {
                    state.currentIndex = direction === 'prev' 
                        ? (currentIndex - 1 + elements.length) % elements.length
                        : (currentIndex + 1) % elements.length;
                }
            } else {
                state.currentIndex = direction === 'prev' ? elements.length - 1 : 0;
            }
            
            if (state.active) this.deactivate();
            
            const nextElement = elements[state.currentIndex];
            this.activate(nextElement);
            
            if (userSettings.scrollToParagraph) {
                nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        
        // 自动播放
        autoPlay() {
            if (!state.autoPlayMode) return;
            
            this.navigate('next');
            
            // 如果启用了朗读激活段落，则朗读当前段落
            if (userSettings.readActiveParagraph && state.active) {
                this.readText(this.getTextWithoutRuby(state.active), state.active);
            }
            
            // 无论是否启用了自动朗读段落，都设置定时器继续自动播放
            setTimeout(() => {
                if (state.autoPlayMode) {
                    // 只有当没有音频在播放时才继续自动播放
                    if (!state.currentAudio) {
                        this.autoPlay();
                    }
                }
            }, 2000); // 可以添加设置项控制间隔
        },
        
        getAllElements() {
            let elements = [];
            const selectors = [];
            
            // 处理包含的标签选择器
            if (userSettings.includeSelectors) {
                selectors.push(userSettings.includeSelectors);
            }
            
            // 处理包含的类/ID选择器
            if (userSettings.includeClassIds) {
                selectors.push(userSettings.includeClassIds);
            }
            
            // 如果没有任何选择器，使用默认选择器
            if (selectors.length === 0) {
                selectors.push('p, h1, h2, h3, h4, h5, h6');
            }
            
            // 构建排除的选择器部分
            let excludeSelectors = '';
            if (userSettings.excludeSelectors) {
                excludeSelectors += `:not(${userSettings.excludeSelectors})`;
            }
            
            if (userSettings.excludeClassIds) {
                userSettings.excludeClassIds.split(',').forEach(selector => {
                    excludeSelectors += `:not(${selector.trim()})`;
                });
            }
            
            // 构建完整选择器
            const fullSelector = selectors.join(', ') + excludeSelectors;
            
            try {
                elements = Array.from(document.querySelectorAll(fullSelector))
                    .filter(el => this.isValidElement(el));
                    
                // 对于嵌套iframe，也获取内部元素
                document.querySelectorAll('iframe').forEach(iframe => {
                    try {
                        if (iframe.contentDocument) {
                            const iframeElements = Array.from(iframe.contentDocument.querySelectorAll(fullSelector))
                                .filter(el => this.isValidElement(el));
                            elements = elements.concat(iframeElements);
                        }
                    } catch (e) {
                        // 忽略跨域iframe
                    }
                });
            } catch (e) {
                console.error('选择器解析错误:', e);
                // 回退到基本选择器
                elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
                    .filter(el => this.isValidElement(el));
            }
            
            return elements;
        }
    };
    
    // 启动脚本
    core.init();
})(); 