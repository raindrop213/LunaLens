# Luna-WS

Luna-WS是一个油猴脚本，通过WebSocket连接LunaTranslator实现浏览器上的原文分词、翻译和查词功能。

## 功能特点
- 🔍 **分词功能**：对日文文本进行分词处理，便于学习
- 📚 **词典查询**：点击单词查看详细词典解释
- 🌐 **翻译功能**：对选中段落进行实时翻译
- 🔊 **朗读功能**：支持文本朗读，辅助语言学习

## 安装方法

1. 确保已安装油猴扩展（Tampermonkey）
   - [Chrome版](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox版](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge版](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. 安装Luna-WS脚本
   - 方法1：[点击此处安装](https://raw.githubusercontent.com/raindrop213/luna-ws/main/luna-ws.js)
   - 方法2：访问油猴插件管理面板->添加新脚本->粘贴本仓库中的代码

3. 安装并配置LunaTranslator
   - [下载LunaTranslator](https://github.com/HIllya51/LunaTranslator)
   - 配置WebSocket服务（默认端口6619）

