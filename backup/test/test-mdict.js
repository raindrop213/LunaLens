// ==UserScript==
// @name         LunaLens Test
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  测试GM_xmlhttpRequest并发性能
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

(function() {
    'use strict';

    // 创建UI
    function createUI() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
        container.style.maxWidth = '400px';
        container.style.maxHeight = '80vh';
        container.style.overflow = 'auto';

        const header = document.createElement('div');
        header.style.marginBottom = '10px';
        header.style.fontWeight = 'bold';
        header.textContent = 'LunaLens API 测试';
        container.appendChild(header);

        const button = document.createElement('button');
        button.textContent = '开始测试 (10次请求)';
        button.style.marginBottom = '10px';
        button.style.padding = '5px 10px';
        button.addEventListener('click', runTest);
        container.appendChild(button);

        const resultContainer = document.createElement('div');
        resultContainer.id = 'test-results';
        container.appendChild(resultContainer);

        document.body.appendChild(container);
    }

    // 运行测试
    function runTest() {
        const resultContainer = document.getElementById('test-results');
        resultContainer.innerHTML = '<p>开始测试...</p>';

        const apiUrl = 'http://127.0.0.1:2333';
        const word = '上司';
        const requestCount = 10;
        const startTime = performance.now();
        let completedRequests = 0;
        let results = [];

        // 清空结果容器
        resultContainer.innerHTML = '';

        // 添加测试开始信息
        addResult(`开始测试 - ${new Date().toLocaleTimeString()}`, 'header');
        addResult(`API: ${apiUrl}/api/dictionary?id=weblio&word=${word}`, 'info');
        addResult(`并发请求数: ${requestCount}`, 'info');

        // 发送10个并发请求
        for (let i = 0; i < requestCount; i++) {
            const requestStartTime = performance.now();
            const requestInfo = {
                id: i + 1,
                startTime: requestStartTime,
                endTime: null,
                duration: null,
                status: 'pending'
            };
            
            results.push(requestInfo);
            updateRequestStatus(requestInfo);

            GM_xmlhttpRequest({
                method: 'GET',
                url: `${apiUrl}/api/dictionary?id=mdict&word=${encodeURIComponent(word)}`,
                timeout: 30000,
                onload: function(response) {
                    requestInfo.endTime = performance.now();
                    requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
                    requestInfo.status = response.status;
                    
                    completedRequests++;
                    updateRequestStatus(requestInfo);
                    
                    if (completedRequests === requestCount) {
                        const totalTime = performance.now() - startTime;
                        showSummary(results, totalTime);
                    }
                },
                onerror: function(error) {
                    requestInfo.endTime = performance.now();
                    requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
                    requestInfo.status = 'error';
                    
                    completedRequests++;
                    updateRequestStatus(requestInfo);
                    
                    if (completedRequests === requestCount) {
                        const totalTime = performance.now() - startTime;
                        showSummary(results, totalTime);
                    }
                },
                ontimeout: function() {
                    requestInfo.endTime = performance.now();
                    requestInfo.duration = requestInfo.endTime - requestInfo.startTime;
                    requestInfo.status = 'timeout';
                    
                    completedRequests++;
                    updateRequestStatus(requestInfo);
                    
                    if (completedRequests === requestCount) {
                        const totalTime = performance.now() - startTime;
                        showSummary(results, totalTime);
                    }
                }
            });
        }
    }

    // 更新请求状态
    function updateRequestStatus(requestInfo) {
        let statusElem = document.getElementById(`request-${requestInfo.id}`);
        
        if (!statusElem) {
            statusElem = document.createElement('div');
            statusElem.id = `request-${requestInfo.id}`;
            statusElem.className = 'request-status';
            statusElem.style.marginBottom = '5px';
            document.getElementById('test-results').appendChild(statusElem);
        }
        
        let statusText = `请求 #${requestInfo.id}: `;
        
        if (requestInfo.status === 'pending') {
            statusText += `进行中...`;
            statusElem.style.color = 'blue';
        } else if (requestInfo.status >= 200 && requestInfo.status < 300) {
            statusText += `成功 (${Math.round(requestInfo.duration)}ms)`;
            statusElem.style.color = 'green';
        } else if (requestInfo.status === 'timeout') {
            statusText += `超时 (${Math.round(requestInfo.duration)}ms)`;
            statusElem.style.color = 'orange';
        } else {
            statusText += `失败 - ${requestInfo.status} (${Math.round(requestInfo.duration)}ms)`;
            statusElem.style.color = 'red';
        }
        
        statusElem.textContent = statusText;
    }

    // 显示测试结果摘要
    function showSummary(results, totalTime) {
        // 计算统计信息
        const successRequests = results.filter(r => r.status >= 200 && r.status < 300).length;
        const failedRequests = results.length - successRequests;
        const durations = results.map(r => r.duration).filter(d => d !== null);
        const avgDuration = durations.reduce((sum, val) => sum + val, 0) / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        
        // 添加分隔线
        const separator = document.createElement('hr');
        separator.style.margin = '10px 0';
        document.getElementById('test-results').appendChild(separator);
        
        // 添加摘要信息
        addResult('测试结果摘要', 'header');
        addResult(`总耗时: ${Math.round(totalTime)}ms`, 'summary');
        addResult(`成功请求: ${successRequests}/${results.length}`, 'summary');
        addResult(`失败请求: ${failedRequests}/${results.length}`, 'summary');
        addResult(`平均响应时间: ${Math.round(avgDuration)}ms`, 'summary');
        addResult(`最快响应时间: ${Math.round(minDuration)}ms`, 'summary');
        addResult(`最慢响应时间: ${Math.round(maxDuration)}ms`, 'summary');
        
        // 判断是否存在阻塞
        const isBlocking = maxDuration > 5 * minDuration;
        const conclusion = isBlocking ? 
            '可能存在阻塞问题，最慢响应远大于最快响应' : 
            '没有明显的阻塞问题，请求响应时间相对均衡';
        
        addResult(conclusion, isBlocking ? 'error' : 'success');
    }

    // 添加结果
    function addResult(text, type) {
        const resultContainer = document.getElementById('test-results');
        const resultElem = document.createElement('div');
        
        switch (type) {
            case 'header':
                resultElem.style.fontWeight = 'bold';
                resultElem.style.marginTop = '10px';
                resultElem.style.fontSize = '1.1em';
                break;
            case 'info':
                resultElem.style.color = '#666';
                break;
            case 'summary':
                resultElem.style.marginLeft = '10px';
                break;
            case 'success':
                resultElem.style.color = 'green';
                resultElem.style.fontWeight = 'bold';
                resultElem.style.marginTop = '10px';
                break;
            case 'error':
                resultElem.style.color = 'red';
                resultElem.style.fontWeight = 'bold';
                resultElem.style.marginTop = '10px';
                break;
        }
        
        resultElem.textContent = text;
        resultContainer.appendChild(resultElem);
    }

    // 初始化
    createUI();
})(); 