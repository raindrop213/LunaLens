# 🌙 LunaLens

LunaLens是一个专为移动端小说阅读设计的油猴脚本，通过连接LunaTranslator的HTTP API，在浏览器中实现文本分词、翻译、朗读和词汇查询功能，让您畅享无障碍的阅读体验。

## ✨ 核心功能
- 🔍 **分词注音**：Mecab分词，加注音
- 📚 **即时词典**：点击单词查询词典
- 🌐 **段落翻译**：选中文本内容并翻译
- 🔊 **语音朗读**：朗读句子或段落

## 🛠 视频演示

https://github.com/user-attachments/assets/b362eb4a-abd0-4656-bf73-b5e7f14f41d9

## 📥 安装指南

1. 安装油猴扩展（Tampermonkey）
   - [Tampermonkey](https://www.tampermonkey.net/)

2. 安装LunaLens脚本
   - 方法1：[点击此处安装](https://raw.githubusercontent.com/raindrop213/LunaLens/main/luna-lens.user.js)
   - 方法2：访问油猴插件管理面板->添加新脚本->粘贴本仓库中的代码

3. 配置LunaTranslator
   - [下载LunaTranslator](https://github.com/HIllya51/LunaTranslator)
   - 启用HTTP网络服务（默认端口2333）

4. ※重点：设置服务端
   - 填写你的服务器地址API_URL。（局域网ip的话需要设备与服务器出在同一个网段下，既换成对应的wifi）

5. 推荐阅读器
   - [ッツ阅读器](https://reader.ttsu.app)
