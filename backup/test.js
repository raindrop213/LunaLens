// ==UserScript==
// @name         段落高亮和复制工具
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  当鼠标悬停在p标签上时高亮并点击后复制内容，适用于复杂环境
// @author       You
// @match        *://*/*
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 样式
    const style = document.createElement('style');
    style.textContent = `
        .paragraph-hover-highlight {
            background-color: rgba(255, 255, 0, 0.3) !important;
            outline: 2px solid rgba(255, 165, 0, 0.5) !important;
            cursor: pointer !important;
            transition: all 0.2s ease-in-out !important;
        }
        .paragraph-copy-feedback {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        .paragraph-copy-feedback.show {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    // 创建复制反馈元素
    const feedback = document.createElement('div');
    feedback.className = 'paragraph-copy-feedback';
    feedback.textContent = '已复制到剪贴板';
    document.body.appendChild(feedback);

    // 当前高亮的元素
    let currentHighlightedElement = null;

    // 显示复制反馈
    function showCopyFeedback() {
        feedback.classList.add('show');
        setTimeout(() => {
            feedback.classList.remove('show');
        }, 2000);
    }

    // 文本提取工具，借鉴Yomitan的方法
    class TextExtractor {
        // 从元素中提取文本
        static getElementContent(element) {
            // 首先尝试使用textContent，这是最基础的提取方法
            let content = element.textContent || '';

            // 移除零宽空格、零宽非连接符和软连字符，这些在复制时可能导致问题
            content = content.replace(/[\u200b\u200c\u00ad]/g, '');

            return content.trim();
        }

        // 尝试从子元素中递归提取并组合文本
        static getRecursiveContent(element) {
            if (element.nodeType === Node.TEXT_NODE) {
                return element.textContent.trim();
            }

            let content = '';
            for (const child of element.childNodes) {
                const childContent = this.getRecursiveContent(child);
                if (childContent) {
                    if (content && childContent &&
                        !content.endsWith(' ') && !childContent.startsWith(' ')) {
                        content += ' ';
                    }
                    content += childContent;
                }
            }

            // 检查是否需要根据元素类型添加换行或特殊处理
            if (['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(element.nodeName)) {
                if (content && !content.endsWith('\n')) {
                    content += '\n';
                }
            }

            return content.trim();
        }

        // 综合提取文本，考虑各种可能的情况
        static extractText(element) {
            // 先尝试简单方法
            let content = this.getElementContent(element);

            // 如果内容很少，可能是因为有嵌套的元素或复杂的DOM结构
            if (!content || content.length < element.innerText.trim().length / 2) {
                content = this.getRecursiveContent(element);
            }

            // 再做一次净化处理
            content = content.replace(/\s+/g, ' ').trim();

            return content;
        }
    }

    // 处理鼠标悬停事件
    function handleMouseOver(event) {
        // 查找目标元素是否是p标签或者包含在p标签内
        let target = event.target;
        while (target && target.nodeName !== 'P') {
            target = target.parentElement;
        }

        if (target && target.nodeName === 'P') {
            // 移除之前的高亮
            if (currentHighlightedElement && currentHighlightedElement !== target) {
                currentHighlightedElement.classList.remove('paragraph-hover-highlight');
            }

            // 添加高亮
            target.classList.add('paragraph-hover-highlight');
            currentHighlightedElement = target;
        }
    }

    // 处理鼠标离开事件
    function handleMouseOut(event) {
        // 确保我们不是从p标签移动到其子元素
        let target = event.target;
        let relatedTarget = event.relatedTarget;

        while (target && target.nodeName !== 'P') {
            target = target.parentElement;
        }

        if (target && currentHighlightedElement === target) {
            let isChildOfHighlighted = false;

            while (relatedTarget) {
                if (relatedTarget === target) {
                    isChildOfHighlighted = true;
                    break;
                }
                relatedTarget = relatedTarget.parentElement;
            }

            if (!isChildOfHighlighted) {
                target.classList.remove('paragraph-hover-highlight');
                currentHighlightedElement = null;
            }
        }
    }

    // 处理点击事件
    function handleClick(event) {
        let target = event.target;
        while (target && target.nodeName !== 'P') {
            target = target.parentElement;
        }

        if (target && target.nodeName === 'P') {
            // 使用我们的TextExtractor来提取文本
            const text = TextExtractor.extractText(target);

            // 使用GM_setClipboard复制到剪贴板
            GM_setClipboard(text);

            // 显示反馈
            showCopyFeedback();

            // 阻止默认行为和冒泡
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // 主函数：设置事件监听器
    function setupEventListeners(root) {
        // 对根元素和所有iframe内的文档也应用相同的事件监听
        root.addEventListener('mouseover', handleMouseOver, true);
        root.addEventListener('mouseout', handleMouseOut, true);
        root.addEventListener('click', handleClick, true);

        // 处理iframe
        try {
            const iframes = root.querySelectorAll('iframe');
            for (const iframe of iframes) {
                if (iframe.contentDocument) {
                    setupEventListeners(iframe.contentDocument);

                    // 添加加载事件，以防iframe内容延迟加载
                    iframe.addEventListener('load', () => {
                        try {
                            if (iframe.contentDocument) {
                                setupEventListeners(iframe.contentDocument);
                            }
                        } catch (e) {
                            console.log('无法访问iframe内容，可能是跨域限制:', e);
                        }
                    });
                }
            }
        } catch (e) {
            console.log('处理iframe时出错，可能是跨域限制:', e);
        }
    }

    // 处理动态加载的iframe
    function observeNewIframes() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeName === 'IFRAME') {
                            try {
                                if (node.contentDocument) {
                                    setupEventListeners(node.contentDocument);

                                    node.addEventListener('load', () => {
                                        try {
                                            if (node.contentDocument) {
                                                setupEventListeners(node.contentDocument);
                                            }
                                        } catch (e) {
                                            console.log('无法访问动态加载的iframe内容:', e);
                                        }
                                    });
                                }
                            } catch (e) {
                                console.log('处理动态iframe时出错:', e);
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 初始化
    setupEventListeners(document);
    observeNewIframes();

    // 尝试访问同源iframe
    try {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            iframe.addEventListener('load', () => {
                try {
                    if (iframe.contentDocument) {
                        setupEventListeners(iframe.contentDocument);
                    }
                } catch (e) {
                    // 跨域iframe会抛出错误，这是预期的
                }
            });
        }
    } catch (e) {
        // 忽略跨域错误
    }
})();