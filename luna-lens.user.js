// ==UserScript==
// @name         LunaLens
// @namespace    http://tampermonkey.net/
// @version      0.2.1
// @description  通过HTTP API连接LunaTranslator实现浏览器上的原文的分词、翻译、朗读和查词功能 
// @author       Raindrop213
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @updateURL    https://github.com/username/LunaLens/raw/main/luna-lens.meta.js
// @downloadURL  https://github.com/username/LunaLens/raw/main/luna-lens.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 默认配置
    const CONFIG = {
        // ※重点：填写你的服务器地址，记得上面要多加一个@connect如： @connect 192.168.6.229
        API_URL: 'http://127.0.0.1:2333',
        // 选择的标签
        TARGET_TAGS: ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
        // 分句：断句的符号基准
        SENTENCE_DELIMITERS: ['。', '！', '？', '…', '.', '!', '?'],
        // 分句：最短句子阈值
        MIN_SENTENCE_LENGTH: 50, 
        // API请求等待的最大时限
        TIMEOUT: 10000,
        // 是否使用句子模式
        DISPLAY_SENTENCE_MODE: false,
        // 是否打开翻译
        TRANSLATION_ENABLED: false,
        // 是否激活标签就自动朗读
        TTS_ENABLED: false,
        BUTTON_TEXT: {
            TTS: {true: 'TTS:开', false: 'TTS:关'},
            TRANSLATION: {true: '翻译:开', false: '翻译:关'},
            DISPLAY: {true: '句子', false: '段落'}
        },
        STYLE: `
            .lunalens-highlighted {
                outline: 2px solid rgba(59, 122, 83, 0.52) !important;
            }
            .lunalens-word {
                display: inline-block;
                position: relative;
                margin: 1px;
                cursor: pointer;
            }
            .lunalens-word.flash {
                animation: word-flash 0.3s ease-out;
            }
            @keyframes word-flash {
                0% { background-color: rgba(255, 206, 30, 0.5); }
                100% { background-color: transparent; }
            }
            /* 仅在词典窗内使用的高亮样式 */
            .lunalens-dict-context .lunalens-word.active-word {
                background-color:rgba(255, 206, 30, 0.5);
            }
            .lunalens-word rt {
                font-size: 0.7em;
                color: #b91a1a;
            }
            /* 常驻词典样式 */
            #lunalens-dict-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 92%;
                background-color: #fff;
                border-top: 1px solid #ccc;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                font-family: sans-serif;
                transition: transform 0.2s ease;
                transform: translateY(100%);
                writing-mode: horizontal-tb !important;
                -webkit-writing-mode: horizontal-tb !important;
            }
            #lunalens-dict-panel.visible {
                transform: translateY(0);
            }
            .lunalens-dict-header {
                display: flex;
                justify-content: space-between;
                background: #ffffff;
                border-bottom: 1px solid #ddd;
                height: 36px;
            }
            .lunalens-dict-title {
                font-size: 16px;
                font-weight: bold;
                padding: 8px 10px;
                margin: 0;
                line-height: 20px;
            }
            .lunalens-dict-header-buttons {
                display: flex;
                align-items: stretch;
                height: 100%;
            }
            .lunalens-dict-header-button {
                cursor: pointer;
                color: #666;
                font-size: 14px;
                padding: 0 12px;
                margin: 0;
                border: none;
                border-radius: 0;
                border-left: 1px solid #ddd;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .lunalens-dict-close {
                background-color: #000000;
                color: white;
                font-weight: bold;
            }
            .lunalens-dict-context-wrapper {
                position: relative;
                background: #f9f9f9;
                border-bottom: 1px solid #eee;
                max-height: 20vh;
                overflow: hidden;
            }
            .lunalens-dict-context {
                padding: 8px 10px;
                font-size: 15px;
                line-height: 1.5;
                overflow-y: auto;
                height: 100%;
            }
            .lunalens-dict-query-box {
                display: flex;
                padding: 0;
                border-bottom: 1px solid #eee;
                height: 36px;
            }
            .lunalens-dict-query-input {
                flex: 1;
                padding: 0 10px;
                border: 1px solid transparent;
                border-right: 1px solid #ddd;
                border-radius: 0;
                margin: 0;
                height: 100%;
                outline: none;
                box-sizing: border-box;
            }
            .lunalens-dict-query-input:focus {
                border: 1px solid #000000;
            }
            .lunalens-dict-query-button {
                width: 36px;
                background: #23ab12;
                color: white;
                border: none;
                border-radius: 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                margin: 0;
            }
            .lunalens-tts-button {
                width: 36px;
                background: #a51dd1;
                color: white;
                border: none;
                border-radius: 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                margin: 0;
            }
            .lunalens-context-tts-button {
                position: absolute;
                bottom: 0px;
                right: 0px;
                width: 36px;
                height: 36px;
                color: #666;
                background: none;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                z-index: 10;
            }
            .lunalens-dict-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lunalens-dict-tabs {
                display: flex;
                flex-direction: row;
                background: #f9f9f9;
                overflow-x: auto;
                white-space: nowrap;
            }
            .lunalens-dict-tab {
                padding: 8px 15px;
                cursor: pointer;
                border-right: 1px solid #eee;
                font-size: 13px;
            }
            .lunalens-dict-tab.active {
                background: #fff;
                font-weight: bold;
                border-top: 3px solid #b91a1a;
                border-left: none;
            }
            .lunalens-dict-entries {
                flex: 1;
                overflow-y: auto;
                padding-top: 10px;
            }
            .lunalens-dict-entry {
                display: none;
            }
            .lunalens-dict-entry.active {
                display: block;
            }
            .lunalens-dict-loading {
                text-align: center;
                padding: 20px;
                color: #666;
            }
            /* 翻译区域样式 */
            .lunalens-translation {
                padding: 8px 10px;
                border-bottom: 1px solid #e0e6f5;
                font-size: 13px;
                line-height: 1.5;
                max-height: 15vh;
                overflow-y: auto;
            }
            .lunalens-translator-item {
                position: relative;
                padding-right: 40px;
            }
            .lunalens-translator-name {
                position: absolute;
                right: 0;
                top: 0;
                font-size: 10px;
                color: #bbb;
                font-style: italic;
            }
            .lunalens-hr {
                border: none;
                border-top: 1px dashed #c1c1c17d;
                margin: 5px 0;
            }
        `
    };

    // 全局变量
    let activeElement = null;
    let originalContent = null;
    let dictionaryPanel = null;
    let currentWord = '';
    let activeWordElements = []; // 改为数组存储所有激活的单词元素
    let contextSentence = null;
    let translationArea = null; // 翻译区域
    let lastTranslatedText = ''; // 上次翻译的文本，用于避免重复翻译
    let currentAudio = null; // 当前播放的音频对象

    // 添加样式到文档
    function addStyle(doc) {
        if (!doc.querySelector('#anon-simple-style')) {
            const style = doc.createElement('style');
            style.id = 'anon-simple-style';
            style.textContent = CONFIG.STYLE;
            doc.head.appendChild(style);
        }
    }

    // 复制文本到剪贴板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => console.log(`Copy: ${text}`))
            .catch(err => console.log('Failed to copy text: ', err));
    }

    // 获取纯文本（移除rp、rt）
    function getPlainText(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // 先找出所有ruby元素
        div.querySelectorAll('ruby').forEach(ruby => {
            // 创建文本节点，只包含主要内容（不包含rt中的注音）
            const mainText = Array.from(ruby.childNodes)
                .filter(node => node.nodeName !== 'RT' && node.nodeName !== 'RP')
                .map(node => node.textContent)
                .join('');
                
            // 替换整个ruby标签为纯文本
            const textNode = document.createTextNode(mainText);
            ruby.parentNode.replaceChild(textNode, ruby);
        });
        
        return div.textContent || '';
    }

    // 辅助函数：判断片假名和平假名是否等价
    function isKanaEquivalent(word, kana) {
        if (!word || !kana) return false;
        // 简单转换为片假名进行比较
        const toKatakana = str => {
            const hiraRange = [0x3041, 0x3096];
            return str.split('')
                .map(char => {
                    const code = char.charCodeAt(0);
                    if (code >= hiraRange[0] && code <= hiraRange[1]) {
                        return String.fromCharCode(code + 0x60);
                    }
                    return char;
                })
                .join('');
        };
        return toKatakana(word) === toKatakana(kana);
    }
    
    // 片假名转平假名
    function katakanaToHiragana(text) {
        if (!text) return '';
        
        // 片假名的Unicode范围是：U+30A0 to U+30FF
        return text.replace(/[\u30A0-\u30FF]/g, function(match) {
            const code = match.charCodeAt(0) - 0x60;
            return String.fromCharCode(code);
        });
    }

    // 处理分词API请求
    function processMecabAPI(text, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${CONFIG.API_URL}/api/mecab?text=${encodeURIComponent(text)}`,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        callback(data);
                    } catch (e) {
                        console.error('解析API响应失败:', e);
                        callback(null);
                    }
                } else {
                    console.error('API请求失败:', response.status);
                    callback(null);
                }
            },
            onerror: function(error) {
                console.error('API请求错误:', error);
                callback(null);
            }
        });
    }

    // 生成带注音的HTML标记，添加唯一索引
    function generateRubyHTML(word, index) {
        const indexAttr = `data-original-index="${index}"`;
        
        if (word.isdeli || !word.kana || isKanaEquivalent(word.word, word.kana)) {
            return `<span class="lunalens-word" data-word="${word.word}" ${indexAttr}>${word.word}</span>`;
        } else {
            // 将片假名转换为平假名
            const hiragana = katakanaToHiragana(word.kana);
            return `<span class="lunalens-word" data-word="${word.word}" ${indexAttr}><ruby>${word.word}<rt>${hiragana}</rt></ruby></span>`;
        }
    }

    // 处理文本并生成带注音的分句HTML
    function processTextWithTokenization(html, callback) {
        // 1. 获取纯文本
        const plainText = getPlainText(html);
        
        // 2. 一次性请求API进行分词
        processMecabAPI(plainText, function(words) {
            if (!words) {
                callback(html); // 如果API失败，返回原HTML
                return;
            }
            
            // 3. 按句子分隔符构建句子数组
            const sentences = [];
            let currentSentence = [];
            let currentSentenceLength = 0;
            let wordIndex = 0;
            
            // 遍历所有词汇，构建句子
            words.forEach(word => {
                // 生成当前词的HTML，添加唯一索引
                const wordHTML = generateRubyHTML(word, wordIndex++);
                currentSentence.push(wordHTML);
                currentSentenceLength += word.word.length;
                
                // 如果当前词是句子分隔符，检查是否应结束当前句子
                if (CONFIG.SENTENCE_DELIMITERS.includes(word.word) && currentSentenceLength >= CONFIG.MIN_SENTENCE_LENGTH) {
                    sentences.push(`<span class="lunalens-sentence">${currentSentence.join('')}</span>`);
                    currentSentence = [];
                    currentSentenceLength = 0;
                }
            });
            
            // 处理剩余的词
            if (currentSentence.length > 0) {
                sentences.push(`<span class="lunalens-sentence">${currentSentence.join('')}</span>`);
            }
            
            callback(sentences.join(''));
        });
    }

    // 查询按钮点击事件（添加下一个单词）
    function setupQueryButton(queryButton, queryInput) {
        queryButton.addEventListener('click', function() {
            if (activeWordElements.length > 0) {
                // 获取最后一个激活的单词元素的索引
                const lastActiveIndex = activeWordElements[activeWordElements.length - 1];
                let lastActiveElement;
                
                // 在主页和词典上下文中查找元素
                const allWords = document.querySelectorAll('.lunalens-word');
                for (const word of allWords) {
                    if (word.dataset.originalIndex === lastActiveIndex || 
                        (typeof lastActiveIndex === 'object' && 
                         lastActiveIndex.dataset && 
                         lastActiveIndex.dataset.originalIndex === word.dataset.originalIndex)) {
                        lastActiveElement = word;
                        // 一旦在主页上找到匹配的元素，优先使用
                        if (activeElement.contains(word)) {
                            break;
                        }
                    }
                }
                
                if (!lastActiveElement) return;
                
                // 寻找下一个单词元素
                let nextWord = null;
                if (activeElement.contains(lastActiveElement)) {
                    // 如果最后激活的单词在主页上，直接找下一个相邻元素
                    nextWord = lastActiveElement.nextElementSibling;
                    while (nextWord && !nextWord.classList.contains('lunalens-word')) {
                        nextWord = nextWord.nextElementSibling;
                    }
                } else {
                    // 如果最后激活的单词在词典上下文中，需要找到主页上对应的单词，再找下一个
                    const mainPageWords = activeElement.querySelectorAll('.lunalens-word');
                    for (let i = 0; i < mainPageWords.length; i++) {
                        if (mainPageWords[i].dataset.originalIndex === lastActiveIndex) {
                            if (i < mainPageWords.length - 1) {
                                nextWord = mainPageWords[i + 1];
                            }
                            break;
                        }
                    }
                }
                
                if (nextWord && nextWord.classList.contains('lunalens-word')) {
                    
                    // 记录下一个单词，保留之前的记录
                    activeWordElements.push(nextWord.dataset.originalIndex || nextWord);
                    
                    // 获取当前查询框内容
                    const currentQuery = queryInput.value.trim();
                    
                    // 将下一个单词添加到查询框
                    queryInput.value = currentQuery + nextWord.dataset.word;
                    
                    // 更新上下文
                    updateContext();
                    
                    // 触发查询
                    lookupWord(queryInput.value);
                }
            }
        });
    }
    
    // 上下文区域点击事件处理
    function setupContextAreaEvents(contextArea, queryInput) {
        // 使用事件委托，避免在每次更新上下文时都要重新绑定事件
        contextArea.addEventListener('click', function(e) {
            // 阻止事件冒泡到document，防止触发deactivateElement
            e.stopPropagation();
            
            // 寻找被点击的单词元素，包括临时容器中的元素
            let targetWord = null;
            if (e.target.classList && e.target.classList.contains('lunalens-word')) {
                targetWord = e.target;
            } else {
                targetWord = e.target.closest('.lunalens-word');
            }
            
            if (targetWord) {
                // 清除所有已激活的高亮样式
                contextArea.querySelectorAll('.lunalens-word.active-word').forEach(word => {
                    word.classList.remove('active-word');
                });
                
                // 清空激活单词数组
                activeWordElements = [];
                
                // 直接给当前单词添加高亮类
                targetWord.classList.add('active-word');
                
                // 记录当前激活的单词
                activeWordElements.push(targetWord.dataset.originalIndex || targetWord);
                
                // 更新查询框内容
                queryInput.value = targetWord.dataset.word;
                
                // 触发查询
                lookupWord(targetWord.dataset.word);
                
                // 找到主页上对应的单词并添加临时闪烁效果
                const originalIndex = targetWord.dataset.originalIndex;
                if (originalIndex && activeElement) {
                    const mainPageWord = activeElement.querySelector(`.lunalens-word[data-original-index="${originalIndex}"]`);
                    if (mainPageWord) {
                        mainPageWord.classList.add('flash');
                        setTimeout(() => {
                            mainPageWord.classList.remove('flash');
                        }, 1000);
                    }
                }
            }
        });
    }

    // 创建词典面板
    function createDictionaryPanel() {
        // 检查是否已存在
        if (document.getElementById('lunalens-dict-panel')) {
            return document.getElementById('lunalens-dict-panel');
        }

        // 创建面板
        const panel = document.createElement('div');
        panel.id = 'lunalens-dict-panel';
        panel.innerHTML = `
            <div class="lunalens-dict-header">
                <div class="lunalens-dict-title">LunaLens</div>
                <div class="lunalens-dict-header-buttons">
                    <span class="lunalens-dict-header-button lunalens-dict-tts-toggle" title="自动朗读开关">
                        ${CONFIG.BUTTON_TEXT.TTS[CONFIG.TTS_ENABLED]}
                    </span>
                    <span class="lunalens-dict-header-button lunalens-dict-translation-toggle" title="切换翻译功能">
                        ${CONFIG.BUTTON_TEXT.TRANSLATION[CONFIG.TRANSLATION_ENABLED]}
                    </span>
                    <span class="lunalens-dict-header-button lunalens-dict-context-toggle" title="切换句子/段落">
                        ${CONFIG.BUTTON_TEXT.DISPLAY[CONFIG.DISPLAY_SENTENCE_MODE]}
                    </span>
                    <span class="lunalens-dict-header-button lunalens-dict-close" title="关闭面板">×</span>
                </div>
            </div>
            <div class="lunalens-dict-context-wrapper">
                <div class="lunalens-dict-context"></div>
                <button class="lunalens-context-tts-button" title="朗读上下文">♬</button>
            </div>
            <div class="lunalens-translation"></div>
            <div class="lunalens-dict-query-box">
                <input type="text" class="lunalens-dict-query-input" placeholder="输入要查询的单词">
                <button class="lunalens-dict-query-button">+</button>
                <button class="lunalens-tts-button" title="朗读单词">♬</button>
            </div>
            <div class="lunalens-dict-content">
                <div class="lunalens-dict-tabs"></div>
                <div class="lunalens-dict-entries">
                    <div class="lunalens-dict-loading">请点击任意单词或输入要查询的词</div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 保存翻译区域引用
        translationArea = panel.querySelector('.lunalens-translation');

        // 添加事件处理
        const closeButton = panel.querySelector('.lunalens-dict-close');
        const contextToggle = panel.querySelector('.lunalens-dict-context-toggle');
        const translationToggle = panel.querySelector('.lunalens-dict-translation-toggle');
        const ttsToggle = panel.querySelector('.lunalens-dict-tts-toggle');
        const queryInput = panel.querySelector('.lunalens-dict-query-input');
        const queryButton = panel.querySelector('.lunalens-dict-query-button');
        const contextArea = panel.querySelector('.lunalens-dict-context');
        const ttsButton = panel.querySelector('.lunalens-tts-button');
        const contextTtsButton = panel.querySelector('.lunalens-context-tts-button');
        
        // 阻止滚轮事件穿透
        panel.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: false });
        
        // 阻止触摸滚动事件穿透
        panel.addEventListener('touchmove', function(e) {
            e.stopPropagation();
        }, { passive: false });

        // 关闭词典面板
        closeButton.addEventListener('click', function() {
            hidePanel();
            // 注意：不再调用deactivateElement()，保持页面激活状态
        });

        // 切换句子/段落
        contextToggle.addEventListener('click', function() {
            CONFIG.DISPLAY_SENTENCE_MODE = !CONFIG.DISPLAY_SENTENCE_MODE;
            this.textContent = CONFIG.BUTTON_TEXT.DISPLAY[CONFIG.DISPLAY_SENTENCE_MODE];
            
            // 更新上下文
            updateContext();
        });

        // 切换翻译功能
        translationToggle.addEventListener('click', function() {
            CONFIG.TRANSLATION_ENABLED = !CONFIG.TRANSLATION_ENABLED;
            this.textContent = CONFIG.BUTTON_TEXT.TRANSLATION[CONFIG.TRANSLATION_ENABLED];
            this.classList.toggle('active', CONFIG.TRANSLATION_ENABLED);
            
            if (CONFIG.TRANSLATION_ENABLED) {
                translationArea.style.display = 'block';
                // 如果有上下文内容且不同于上次翻译的内容，立即翻译
                const currentContextText = getContextText();
                if (currentContextText && currentContextText !== lastTranslatedText) {
                    translateContextText(currentContextText);
                }
            } else {
                translationArea.style.display = 'none';
            }
        });
        
        // 切换TTS功能
        ttsToggle.addEventListener('click', function() {
            CONFIG.TTS_ENABLED = !CONFIG.TTS_ENABLED;
            this.textContent = CONFIG.BUTTON_TEXT.TTS[CONFIG.TTS_ENABLED];
            this.classList.toggle('active', CONFIG.TTS_ENABLED);
        });
        
        // 单词发音按钮
        ttsButton.addEventListener('click', function() {
            const word = queryInput.value.trim();
            if (word) {
                readText(word);
            }
        });
        
        // 上下文朗读按钮
        contextTtsButton.addEventListener('click', function() {
            const contextText = getContextText();
            if (contextText) {
                readText(contextText);
            }
        });

        // 查询框输入事件
        queryInput.addEventListener('input', function() {
            const word = this.value.trim();
            if (word) {
                lookupWord(word);
            }
        });

        // 查询按钮点击事件（添加下一个单词）
        setupQueryButton(queryButton, queryInput);

        // 上下文区域点击事件：点击上下文中的单词
        setupContextAreaEvents(contextArea, queryInput);

        // 初始设置翻译区域显示状态
        translationArea.style.display = CONFIG.TRANSLATION_ENABLED ? 'block' : 'none';

        return panel;
    }

    // 显示词典面板
    function showPanel() {
        if (dictionaryPanel) {
            dictionaryPanel.classList.add('visible');
        }
    }

    // 隐藏词典面板
    function hidePanel() {
        if (dictionaryPanel) {
            dictionaryPanel.classList.remove('visible');
        }
    }

    // 更新词典面板上下文（句子或段落）
    function updateContext() {
        if (!dictionaryPanel || !activeElement || !contextSentence) return;
        
        const contextArea = dictionaryPanel.querySelector('.lunalens-dict-context');
        
        // 保存当前滚动位置
        const scrollTop = contextArea.scrollTop;
        
        // 清空上下文区域
        contextArea.innerHTML = '';
        
        // 创建临时容器
        const tempContainer = document.createElement('div');
        
        if (!CONFIG.DISPLAY_SENTENCE_MODE) {
            // 段落模式：显示整个段落的内容
            tempContainer.innerHTML = activeElement.innerHTML;
        } else {
            // 句子模式：只显示当前句子的内容
            tempContainer.innerHTML = contextSentence.innerHTML;
        }
        
        // 将内容添加到上下文区域，不带原始事件监听器
        contextArea.appendChild(tempContainer);
        
        // 重新标记激活的单词
        if (activeWordElements.length > 0) {
            contextArea.querySelectorAll('.lunalens-word').forEach(word => {
                const isActive = activeWordElements.some(activeWord => 
                    activeWord === word.dataset.originalIndex || // 通过索引匹配
                    (typeof activeWord === 'object' && 
                     activeWord.dataset && 
                     activeWord.dataset.originalIndex === word.dataset.originalIndex)
                );
                
                if (isActive) {
                    word.classList.add('active-word');
                } else {
                    word.classList.remove('active-word');
                }
            });
        }
        
        // 恢复滚动位置
        contextArea.scrollTop = scrollTop;
        
        // 检查上下文内容是否变化，如果变化且翻译功能开启，才翻译上下文内容
        if (CONFIG.TRANSLATION_ENABLED) {
            const currentContextText = getContextText();
            if (currentContextText !== lastTranslatedText) {
                translateContextText(currentContextText);
            }
        }
    }

    // 获取上下文区域的纯文本
    function getContextText() {
        if (!dictionaryPanel) return '';
        
        const contextArea = dictionaryPanel.querySelector('.lunalens-dict-context');
        if (!contextArea) return '';
        
        // 去除振假名
        return getPlainText(contextArea.innerHTML).trim();
    }

    // 翻译上下文内容
    function translateContextText(text) {
        if (!translationArea || !CONFIG.TRANSLATION_ENABLED) return;
        
        // 如果未提供文本参数，则获取当前上下文文本
        if (!text) {
            text = getContextText();
        }
        
        if (!text) {
            translationArea.innerHTML = '<div class="lunalens-translator-item">没有可翻译的文本</div>';
            return;
        }
        
        // 避免重复翻译相同的文本
        if (text === lastTranslatedText) {
            return;
        }
        
        // 更新上次翻译的文本
        lastTranslatedText = text;
        
        // 清空翻译区域，显示加载信息
        translationArea.innerHTML = '<div class="lunalens-translator-item">正在获取翻译...</div>';
        
        // 获取翻译器列表并发起请求
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${CONFIG.API_URL}/api/list/translator`,
            timeout: CONFIG.TIMEOUT,
            onload: (response) => {
                try {
                    const translators = JSON.parse(response.responseText);
                    if (Array.isArray(translators) && translators.length > 0) {
                        // 清空翻译容器
                        translationArea.innerHTML = '';
                        
                        // 对每个翻译器发起请求
                        translators.forEach((translator, index) => {
                            // 为每个翻译器创建一个项，先显示加载中
                            const translatorItem = document.createElement('div');
                            translatorItem.className = 'lunalens-translator-item';
                            translatorItem.innerHTML = `加载中...<span class="lunalens-translator-name">${translator.name}</span>`;
                            translationArea.appendChild(translatorItem);
                            
                            // 如果不是最后一个翻译器，添加分隔线
                            if (index < translators.length - 1) {
                                const hr = document.createElement('hr');
                                hr.className = 'lunalens-hr';
                                translationArea.appendChild(hr);
                            }
                            
                            // 发起翻译请求
                            GM_xmlhttpRequest({
                                method: 'GET',
                                url: `${CONFIG.API_URL}/api/translate?text=${encodeURIComponent(text)}&id=${encodeURIComponent(translator.id)}`,
                                timeout: CONFIG.TIMEOUT,
                                onload: (response) => {
                                    try {
                                        const data = JSON.parse(response.responseText);
                                        translatorItem.innerHTML = `${data.result || '翻译失败'}<span class="lunalens-translator-name">${translator.name}</span>`;
                                    } catch (error) {
                                        translatorItem.innerHTML = `翻译结果解析失败<span class="lunalens-translator-name">${translator.name}</span>`;
                                    }
                                },
                                onerror: () => {
                                    translatorItem.innerHTML = `翻译请求失败<span class="lunalens-translator-name">${translator.name}</span>`;
                                },
                                ontimeout: () => {
                                    translatorItem.innerHTML = `翻译请求超时<span class="lunalens-translator-name">${translator.name}</span>`;
                                }
                            });
                        });
                    } else {
                        translationArea.innerHTML = '<div class="lunalens-translator-item">未找到可用的翻译器</div>';
                    }
                } catch (error) {
                    translationArea.innerHTML = '<div class="lunalens-translator-item">获取翻译器列表失败</div>';
                }
            },
            onerror: () => {
                translationArea.innerHTML = '<div class="lunalens-translator-item">获取翻译器列表失败</div>';
            },
            ontimeout: () => {
                translationArea.innerHTML = '<div class="lunalens-translator-item">获取翻译器列表超时</div>';
            }
        });
    }

    // 激活元素
    function activateElement(element) {
        // 取消激活当前元素
        deactivateElement();
        
        // 设置新的激活元素
        activeElement = element;
        // 保存原始内容以便后续恢复
        originalContent = element.innerHTML;
        element.classList.add('lunalens-highlighted');
        
        // 重置上次翻译的文本
        lastTranslatedText = '';
        
        // 创建一个取消标志，用于标识当前处理是否仍然有效
        const requestId = Date.now();
        element.dataset.requestId = requestId;
        
        // 处理文本并添加分词标记
        processTextWithTokenization(originalContent, html => {
            // 如果元素已经不是当前激活的元素或者请求ID不匹配，则不更新内容
            if (element !== activeElement || element.dataset.requestId != requestId) {
                return;
            }
            
            element.innerHTML = html;
            
            // 为所有单词添加点击事件
            element.querySelectorAll('.lunalens-word').forEach(word => {
                word.addEventListener('click', e => {
                    e.stopPropagation();
                    
                    // 获取单词文本
                    const wordText = word.dataset.word;
                    
                    // 获取所在句子
                    contextSentence = word.closest('.lunalens-sentence');
                    if (!contextSentence) contextSentence = element;
                    
                    // 给单词添加临时闪烁效果
                    word.classList.add('flash');
                    setTimeout(() => {
                        word.classList.remove('flash');
                    }, 1000);
                    
                    // 首先清空之前的激活状态
                    const contextArea = dictionaryPanel.querySelector('.lunalens-dict-context');
                    if (contextArea) {
                        contextArea.querySelectorAll('.lunalens-word.active-word').forEach(w => {
                            w.classList.remove('active-word');
                        });
                    }
                    activeWordElements = [];
                    
                    // 记录当前活跃词
                    activeWordElements.push(word.dataset.originalIndex || word);
                    
                    // 显示词典面板
                    showPanel();
                    
                    // 更新面板上下文
                    updateContext();
                    
                    // 设置查词框内容
                    const queryInput = dictionaryPanel.querySelector('.lunalens-dict-query-input');
                    queryInput.value = wordText;
                    
                    // 查询单词
                    lookupWord(wordText);
                });
            });
            
            // 如果TTS功能开启，激活元素后自动朗读段落
            if (CONFIG.TTS_ENABLED) {
                // 获取纯文本内容
                const plainText = getPlainText(element.innerHTML);
                // 朗读文本
                readText(plainText, element);
            }
        });
    }

    // 取消激活元素
    function deactivateElement() {
        if (activeElement && originalContent) {
            activeElement.innerHTML = originalContent;
            activeElement.classList.remove('lunalens-highlighted');
            activeElement = null;
            originalContent = null;
            
            // 清除激活单词记录
            activeWordElements = [];
            
            // 清除上次翻译的文本记录
            lastTranslatedText = '';
        }
    }

    // 处理点击事件
    function handleClick(e) {
        // 如果点击发生在词典面板内，不处理
        if (dictionaryPanel && dictionaryPanel.contains(e.target)) {
            return;
        }
        
        if (activeElement && activeElement.contains(e.target)) {
            if (e.target.classList.contains('lunalens-sentence') || 
                e.target.classList.contains('lunalens-word') || 
                e.target.closest('.lunalens-word')) {
                e.preventDefault();
                return;
            }
        } else if (CONFIG.TARGET_TAGS.includes(e.target.tagName)) {
            e.preventDefault();
            activateElement(e.target);
        } else if (!e.target.closest('.lunalens-dict-panel')) {
            // 只有当点击不在词典面板内时才停用元素
            deactivateElement();
        }
    }

    // 处理iframe
    function handleIframe(iframe) {
        try {
            function setupIframe() {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                addStyle(iframeDoc);
                iframeDoc.addEventListener('click', handleClick);
            }

            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                setupIframe();
            } else {
                iframe.addEventListener('load', setupIframe);
            }
        } catch (e) {
            console.log('无法访问iframe:', e);
        }
    }

    // 处理所有iframe
    function handleAllIframes() {
        document.querySelectorAll('iframe').forEach(handleIframe);
    }

    // 初始化函数
    function init() {
        addStyle(document);
        document.addEventListener('click', handleClick);
        
        // 创建常驻词典面板
        dictionaryPanel = createDictionaryPanel();
        
        // 处理现有iframe
        handleAllIframes();
        
        // 监听新添加的iframe
        new MutationObserver(handleAllIframes).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setTimeout(init, 500);

    // 查词典并显示结果
    function lookupWord(word) {
        if (!word) return;
        if (word === currentWord) return;

        currentWord = word;

        // 获取词典面板
        const panel = document.getElementById('lunalens-dict-panel');
        if (!panel) return;

        const tabsContainer = panel.querySelector('.lunalens-dict-tabs');
        const entriesContainer = panel.querySelector('.lunalens-dict-entries');
        
        // 清空现有内容
        tabsContainer.innerHTML = '';
        entriesContainer.innerHTML = `<div class="lunalens-dict-loading">正在查询${word}</div>`;
        
        // 使用兼容模式查询
        fetchDictionaryByGM(word, tabsContainer, entriesContainer);
    }

    // 使用GM_xmlhttpRequest并行获取多个词典数据
    function fetchDictionaryByGM(word, tabsContainer, entriesContainer, dictIds = []) {
        // 生成唯一请求ID
        const requestId = Date.now().toString();
        dictionaryPanel.setAttribute('data-request-id', requestId);
        
        // 如果没有提供词典ID列表，则先获取可用词典列表
        if (!dictIds || dictIds.length === 0) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${CONFIG.API_URL}/api/list/dictionary`,
                onload: (response) => {
                    // 检查响应是否匹配当前请求
                    if (dictionaryPanel.getAttribute('data-request-id') !== requestId) return;
                    
                    try {
                        const dictList = JSON.parse(response.responseText);
                        if (Array.isArray(dictList) && dictList.length > 0) {
                            // 提取词典ID列表
                            const ids = dictList.map(dict => dict.id);
                            // 递归调用，使用获取的词典ID列表
                            fetchDictionaryByGM(word, tabsContainer, entriesContainer, ids);
                        } else {
                            // 没有找到词典
                            showDictionaryStatus(entriesContainer, '');
                        }
                    } catch (error) {
                        console.error('获取词典列表失败:', error);
                        showDictionaryStatus(entriesContainer, '');
                    }
                },
                onerror: () => {
                    // 检查响应是否匹配当前请求
                    if (dictionaryPanel.getAttribute('data-request-id') !== requestId) return;
                    
                    showDictionaryStatus(entriesContainer, '');
                }
            });
            return;
        }
        
        // 记录未完成的请求数
        let pendingRequests = dictIds.length;
        
        // 添加MDICT内部标签切换函数
        if (entriesContainer.parentNode && !entriesContainer.parentNode.querySelector('script[data-mdict-function]')) {
            const script = document.createElement('script');
            script.setAttribute('data-mdict-function', 'true');
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
            entriesContainer.parentNode.appendChild(script);
        }
        
        // 并行请求每个词典
        dictIds.forEach(dictId => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${CONFIG.API_URL}/api/dictionary?id=${dictId}&word=${encodeURIComponent(word)}`,
                onload: (response) => {
                    // 检查响应是否匹配当前请求
                    if (dictionaryPanel.getAttribute('data-request-id') !== requestId) return;
                    
                    try {
                        const data = JSON.parse(response.responseText);
                        
                        // 隐藏加载提示
                        const loadingIndicator = entriesContainer.querySelector('.lunalens-dict-loading');
                        if (loadingIndicator) loadingIndicator.style.display = 'none';
                        
                        // 添加词典条目
                        addDictionaryEntry(tabsContainer, entriesContainer, data);
                    } catch (error) {
                        console.error(`获取词典 ${dictId} 失败:`, error);
                    }
                    
                    // 减少未完成请求计数
                    pendingRequests--;
                    
                    // 如果所有请求都完成了，但没有词典结果，则显示提示
                    if (pendingRequests === 0 && tabsContainer.children.length === 0) {
                        showDictionaryStatus(entriesContainer, '');
                    }
                },
                onerror: () => {
                    // 检查响应是否匹配当前请求
                    if (dictionaryPanel.getAttribute('data-request-id') !== requestId) return;
                    
                    console.error(`获取词典 ${dictId} 失败`);
                    
                    // 减少未完成请求计数
                    pendingRequests--;
                    
                    // 如果所有请求都完成了，但没有词典结果，则显示提示
                    if (pendingRequests === 0 && tabsContainer.children.length === 0) {
                        showDictionaryStatus(entriesContainer, '');
                    }
                }
            });
        });
    }

    // 显示词典状态信息
    function showDictionaryStatus(container, message) {
        const loadingIndicator = container.querySelector('.lunalens-dict-loading');
        if (loadingIndicator) {
            loadingIndicator.textContent = message;
        } else {
            container.innerHTML = `<div class="lunalens-dict-loading">${message}</div>`;
        }
    }

    // 添加词典条目
    function addDictionaryEntry(tabsContainer, entriesContainer, data, isFirst) {
        // 如果没有词典名称，直接跳过
        if (!data.name) return;
        
        const dictName = data.name;
        const dictId = `dict-${dictName.replace(/\s+/g, '-')}`;
        
        // 检查是否已有该词典结果
        let entryDiv = document.getElementById(dictId);
        
        if (!entryDiv) {
            // 创建新词典条目
            entryDiv = document.createElement('div');
            entryDiv.className = 'lunalens-dict-entry';
            if (isFirst || tabsContainer.children.length === 0) entryDiv.classList.add('active');
            entryDiv.id = dictId;
            entryDiv.setAttribute('data-dict', dictName);
            entryDiv.innerHTML = `<div class="lunalens-dict-content">${data.result || ''}</div>`;
            entriesContainer.appendChild(entryDiv);
            
            // 添加词典标签
            const tab = document.createElement('div');
            tab.className = 'lunalens-dict-tab';
            if (isFirst || tabsContainer.children.length === 0) tab.classList.add('active');
            tab.textContent = dictName;
            tab.setAttribute('data-dict', dictName);
            
            tab.addEventListener('click', function() {
                // 更新标签状态
                document.querySelectorAll('.lunalens-dict-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // 更新词典显示
                const dictName = this.getAttribute('data-dict');
                document.querySelectorAll('.lunalens-dict-entry').forEach(entry => {
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
            const contentDiv = entryDiv.querySelector('.lunalens-dict-content');
            if (contentDiv) contentDiv.innerHTML = data.result || '';
        }
    }

    // 更新激活单词（只在词典窗口内使用）
    function updateActiveWord(wordElement, addToExisting = false) {
        // 仅在词典上下文中更新样式，不影响主页元素
        const contextArea = dictionaryPanel.querySelector('.lunalens-dict-context');
        if (!contextArea) return;
        
        if (!addToExisting) {
            // 清除已有的高亮（仅在词典窗口内）
            contextArea.querySelectorAll('.lunalens-word.active-word').forEach(word => {
                word.classList.remove('active-word');
            });
            activeWordElements = [];
        }
        
        // 给当前单词添加高亮
        if (wordElement.classList) {
            wordElement.classList.add('active-word');
        }
        
        // 添加新的激活单词到列表
        activeWordElements.push(wordElement.dataset.originalIndex || wordElement);
        
        // 更新上下文中的激活单词
        updateContext();
    }

    // TTS朗读功能
    function readText(text, element = null) {
        if (!text || !text.trim()) return false;
        
        // 停止之前的朗读
        stopReading();
        
        // 发送朗读请求
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${CONFIG.API_URL}/api/tts?text=${encodeURIComponent(text)}`,
            responseType: 'arraybuffer',
            timeout: CONFIG.TIMEOUT,
            onload: response => {
                if (response.status >= 200 && response.status < 300) {
                    playAudioBlob(response.response);
                } else {
                    console.error('TTS请求失败! 状态:', response.status);
                }
            },
            onerror: error => {
                console.error('TTS请求失败:', error);
            },
            ontimeout: () => {
                console.error('TTS请求超时');
            }
        });
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
    
    // 播放音频数据
    function playAudioBlob(arrayBuffer) {
        // 停止之前的朗读
        stopReading();
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            audioContext.decodeAudioData(arrayBuffer, 
                (buffer) => {
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    
                    currentAudio = {
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
                        currentAudio = null;
                    };
                    
                    source.start(0);
                },
                () => console.error('音频播放失败')
            );
        } catch (e) {
            console.error('音频播放失败:', e);
        }
    }
})();
